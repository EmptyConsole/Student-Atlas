-- Class time maintenance
--
-- Keeps courses.students and students.times_taken consistent when a course's
-- schedule changes. Run after nueva-assignment-columns.sql.
--
-- Public API
-- ----------
--   add_class_time(course_id, day, start, end)                -> integer[]
--   edit_class_time(course_id, old_d, old_s, old_e,
--                              new_d, new_s, new_e)           -> integer[]
--   remove_class_time(course_id, day, start, end)             -> integer[]
--   cleanup_class_times(school_id DEFAULT NULL)               -> summary row
--
-- Each mutator returns the course's new schedule.
--
-- What each operation does
-- ------------------------
--   ADD     schedule gains a triple. Rosters and times_taken are untouched:
--           a class with no roster entry simply has no students yet.
--   EDIT    schedule triple is rewritten, the courses.students entry is
--           rekeyed to the new day/start/end, and every rostered student's
--           matching times_taken row is moved to the new block.
--   REMOVE  schedule triple is dropped, the courses.students entry is dropped,
--           and every rostered student's matching times_taken row is dropped.
--
-- Safety net
-- ----------
-- Trigger courses_schedule_sync fires BEFORE UPDATE OF schedule. Any direct
-- write to courses.schedule (SQL editor, teacher UI, another script) has its
-- orphaned roster entries removed and those students' times_taken rows
-- stripped. The mutators above update rosters before touching schedule, so the
-- trigger is a no-op on their writes.
--
-- times_taken rows are matched within the course's term ranks only, derived
-- from courses.term_options and the school's register display order.
--
-- Idempotent: CREATE OR REPLACE throughout, trigger dropped before recreate.
-- Wrapped in a transaction, and ends with a self-test that creates and then
-- deletes a throwaway school/term/course/student.

BEGIN;

----------------------------------------------------------------------
-- 1. Key + roster entry helpers
--
-- A roster entry is 'day,start,end|uuid1,uuid2,...'
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.class_time_key(
  p_day int,
  p_start int,
  p_end int
) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT p_day || ',' || p_start || ',' || p_end;
$fn$;

CREATE OR REPLACE FUNCTION public.roster_entry_key(p_entry text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT split_part(p_entry, '|', 1);
$fn$;

CREATE OR REPLACE FUNCTION public.roster_entry_students(p_entry text)
RETURNS uuid[]
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT COALESCE(
    (
      SELECT array_agg(btrim(s)::uuid)
      FROM unnest(string_to_array(split_part(p_entry, '|', 2), ',')) AS s
      WHERE btrim(s) <> ''
    ),
    ARRAY[]::uuid[]
  );
$fn$;

CREATE OR REPLACE FUNCTION public.roster_entry_build(
  p_key text,
  p_students uuid[]
) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT p_key || '|' || COALESCE(array_to_string(p_students, ','), '');
$fn$;

----------------------------------------------------------------------
-- 2. Term rank helpers
--
-- Rank is the 1-based position in register display order, matching
-- students.times_taken[i][1].
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.term_ranks(
  p_school_id uuid,
  p_term_ids uuid[]
) RETURNS int[]
LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(array_agg(r.pos_rank ORDER BY r.pos_rank), ARRAY[]::int[])
  FROM (
    SELECT
      t.id AS term_id,
      row_number() OVER (
        ORDER BY t.position ASC NULLS LAST, t.created_at ASC
      )::int AS pos_rank
    FROM terms t
    WHERE t.school_id = p_school_id
  ) r
  WHERE r.term_id = ANY (COALESCE(p_term_ids, ARRAY[]::uuid[]));
$fn$;

CREATE OR REPLACE FUNCTION public.course_term_ranks(p_course_id uuid)
RETURNS int[]
LANGUAGE sql STABLE AS $fn$
  SELECT public.term_ranks(c.school_id, c.term_options)
  FROM courses c
  WHERE c.id = p_course_id;
$fn$;

----------------------------------------------------------------------
-- 3. Schedule expansion helper
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_rows(p_schedule integer[])
RETURNS TABLE (day int, start_min int, end_min int)
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT p_schedule[i][1], p_schedule[i][2], p_schedule[i][3]
  FROM generate_series(1, COALESCE(array_length(p_schedule, 1), 0)) AS i;
$fn$;

CREATE OR REPLACE FUNCTION public.schedule_keys(p_schedule integer[])
RETURNS text[]
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT COALESCE(
    array_agg(public.class_time_key(r.day, r.start_min, r.end_min)),
    ARRAY[]::text[]
  )
  FROM public.schedule_rows(p_schedule) r;
$fn$;

----------------------------------------------------------------------
-- 4. times_taken primitives
--
-- retime moves matching rows to a new block; passing NULL for the new
-- block drops them instead. Returns the number of students rewritten.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.times_taken_retime(
  p_student_ids uuid[],
  p_term_ranks int[],
  p_old_day int,
  p_old_start int,
  p_old_end int,
  p_new_day int DEFAULT NULL,
  p_new_start int DEFAULT NULL,
  p_new_end int DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql AS $fn$
DECLARE
  v_changed int;
BEGIN
  IF p_student_ids IS NULL OR cardinality(p_student_ids) = 0
     OR p_term_ranks IS NULL OR cardinality(p_term_ranks) = 0 THEN
    RETURN 0;
  END IF;

  WITH expanded AS (
    SELECT
      st.id AS student_id,
      st.times_taken[i][1] AS term_rank,
      st.times_taken[i][2] AS day,
      st.times_taken[i][3] AS start_min,
      st.times_taken[i][4] AS end_min
    FROM students st
    CROSS JOIN LATERAL generate_series(1, array_length(st.times_taken, 1)) AS i
    WHERE st.id = ANY (p_student_ids)
      AND st.times_taken IS NOT NULL
      AND array_length(st.times_taken, 1) IS NOT NULL
  ),
  flagged AS (
    SELECT
      e.*,
      (
        e.term_rank = ANY (p_term_ranks)
        AND e.day = p_old_day
        AND e.start_min = p_old_start
        AND e.end_min = p_old_end
      ) AS is_match
    FROM expanded e
  ),
  touched AS (
    SELECT DISTINCT student_id FROM flagged WHERE is_match
  ),
  rebuilt AS (
    SELECT
      f.student_id,
      array_agg(
        ARRAY[
          f.term_rank,
          CASE WHEN f.is_match THEN p_new_day   ELSE f.day       END,
          CASE WHEN f.is_match THEN p_new_start ELSE f.start_min END,
          CASE WHEN f.is_match THEN p_new_end   ELSE f.end_min   END
        ]
        ORDER BY
          f.term_rank,
          CASE WHEN f.is_match THEN p_new_day   ELSE f.day       END,
          CASE WHEN f.is_match THEN p_new_start ELSE f.start_min END
      ) FILTER (
        WHERE NOT f.is_match OR p_new_day IS NOT NULL
      ) AS times_taken
    FROM flagged f
    JOIN touched t ON t.student_id = f.student_id
    GROUP BY f.student_id
  )
  UPDATE students s
  SET times_taken = COALESCE(r.times_taken, '{}'::integer[])
  FROM rebuilt r
  WHERE s.id = r.student_id;

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.times_taken_drop(
  p_student_ids uuid[],
  p_term_ranks int[],
  p_day int,
  p_start int,
  p_end int
) RETURNS int
LANGUAGE sql AS $fn$
  SELECT public.times_taken_retime(
    p_student_ids, p_term_ranks, p_day, p_start, p_end, NULL, NULL, NULL
  );
$fn$;

-- Drops every times_taken row keyed to a roster entry's class time.
CREATE OR REPLACE FUNCTION public.roster_entry_release(
  p_entry text,
  p_term_ranks int[]
) RETURNS int
LANGUAGE plpgsql AS $fn$
DECLARE
  v_key text := public.roster_entry_key(p_entry);
BEGIN
  IF v_key IS NULL OR v_key = '' THEN
    RETURN 0;
  END IF;

  RETURN public.times_taken_drop(
    public.roster_entry_students(p_entry),
    p_term_ranks,
    split_part(v_key, ',', 1)::int,
    split_part(v_key, ',', 2)::int,
    split_part(v_key, ',', 3)::int
  );
END;
$fn$;

----------------------------------------------------------------------
-- 5. Public mutators
--
-- Rosters and times_taken are updated BEFORE schedule, so the
-- courses_schedule_sync trigger sees a consistent row and does nothing.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_class_time(
  p_course_id uuid,
  p_day int,
  p_start int,
  p_end int
) RETURNS integer[]
LANGUAGE plpgsql AS $fn$
DECLARE
  v_schedule integer[];
  v_new integer[];
BEGIN
  IF p_day IS NULL OR p_start IS NULL OR p_end IS NULL THEN
    RAISE EXCEPTION 'add_class_time: day, start and end are required';
  END IF;
  IF p_start >= p_end THEN
    RAISE EXCEPTION 'add_class_time: start (%) must be before end (%)', p_start, p_end;
  END IF;

  SELECT schedule INTO v_schedule FROM courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'add_class_time: course % not found', p_course_id;
  END IF;

  -- Already present: no-op, keeps the call idempotent.
  IF public.class_time_key(p_day, p_start, p_end)
       = ANY (public.schedule_keys(v_schedule)) THEN
    RETURN v_schedule;
  END IF;

  SELECT COALESCE(
    array_agg(ARRAY[r.day, r.start_min, r.end_min] ORDER BY r.day, r.start_min),
    '{}'::integer[]
  )
  INTO v_new
  FROM (
    SELECT s.day, s.start_min, s.end_min FROM public.schedule_rows(v_schedule) s
    UNION ALL
    SELECT p_day, p_start, p_end
  ) r;

  UPDATE courses SET schedule = v_new WHERE id = p_course_id;
  RETURN v_new;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.edit_class_time(
  p_course_id uuid,
  p_old_day int,
  p_old_start int,
  p_old_end int,
  p_new_day int,
  p_new_start int,
  p_new_end int
) RETURNS integer[]
LANGUAGE plpgsql AS $fn$
DECLARE
  v_schedule integer[];
  v_new integer[];
  v_roster text[];
  v_roster_new text[];
  v_old_key text;
  v_new_key text;
  v_ranks int[];
  v_students uuid[];
BEGIN
  IF p_new_day IS NULL OR p_new_start IS NULL OR p_new_end IS NULL THEN
    RAISE EXCEPTION 'edit_class_time: new day, start and end are required';
  END IF;
  IF p_new_start >= p_new_end THEN
    RAISE EXCEPTION 'edit_class_time: start (%) must be before end (%)',
      p_new_start, p_new_end;
  END IF;

  SELECT schedule, students INTO v_schedule, v_roster
  FROM courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'edit_class_time: course % not found', p_course_id;
  END IF;

  v_old_key := public.class_time_key(p_old_day, p_old_start, p_old_end);
  v_new_key := public.class_time_key(p_new_day, p_new_start, p_new_end);

  IF NOT (v_old_key = ANY (public.schedule_keys(v_schedule))) THEN
    RAISE EXCEPTION 'edit_class_time: course % has no class time %',
      p_course_id, v_old_key;
  END IF;

  IF v_old_key = v_new_key THEN
    RETURN v_schedule;
  END IF;

  IF v_new_key = ANY (public.schedule_keys(v_schedule)) THEN
    RAISE EXCEPTION 'edit_class_time: course % already meets at %',
      p_course_id, v_new_key;
  END IF;

  v_ranks := public.course_term_ranks(p_course_id);

  -- Move the rostered students' occupied block.
  SELECT public.roster_entry_students(u.e)
  INTO v_students
  FROM unnest(COALESCE(v_roster, '{}'::text[])) AS u(e)
  WHERE public.roster_entry_key(u.e) = v_old_key
  LIMIT 1;

  PERFORM public.times_taken_retime(
    v_students, v_ranks,
    p_old_day, p_old_start, p_old_end,
    p_new_day, p_new_start, p_new_end
  );

  -- Rekey the roster entry before schedule changes, so the trigger no-ops.
  IF v_roster IS NOT NULL THEN
    SELECT COALESCE(
      array_agg(
        CASE WHEN public.roster_entry_key(u.e) = v_old_key
             THEN public.roster_entry_build(v_new_key, public.roster_entry_students(u.e))
             ELSE u.e END
        ORDER BY u.ord
      ),
      '{}'::text[]
    )
    INTO v_roster_new
    FROM unnest(v_roster) WITH ORDINALITY AS u(e, ord);

    UPDATE courses SET students = v_roster_new WHERE id = p_course_id;
  END IF;

  SELECT COALESCE(
    array_agg(ARRAY[r.day, r.start_min, r.end_min] ORDER BY r.day, r.start_min),
    '{}'::integer[]
  )
  INTO v_new
  FROM (
    SELECT
      CASE WHEN s.day = p_old_day AND s.start_min = p_old_start AND s.end_min = p_old_end
           THEN p_new_day ELSE s.day END AS day,
      CASE WHEN s.day = p_old_day AND s.start_min = p_old_start AND s.end_min = p_old_end
           THEN p_new_start ELSE s.start_min END AS start_min,
      CASE WHEN s.day = p_old_day AND s.start_min = p_old_start AND s.end_min = p_old_end
           THEN p_new_end ELSE s.end_min END AS end_min
    FROM public.schedule_rows(v_schedule) s
  ) r;

  UPDATE courses SET schedule = v_new WHERE id = p_course_id;
  RETURN v_new;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.remove_class_time(
  p_course_id uuid,
  p_day int,
  p_start int,
  p_end int
) RETURNS integer[]
LANGUAGE plpgsql AS $fn$
DECLARE
  v_schedule integer[];
  v_new integer[];
  v_roster text[];
  v_roster_new text[];
  v_key text;
  v_ranks int[];
  v_students uuid[];
BEGIN
  SELECT schedule, students INTO v_schedule, v_roster
  FROM courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'remove_class_time: course % not found', p_course_id;
  END IF;

  v_key := public.class_time_key(p_day, p_start, p_end);
  v_ranks := public.course_term_ranks(p_course_id);

  SELECT public.roster_entry_students(u.e)
  INTO v_students
  FROM unnest(COALESCE(v_roster, '{}'::text[])) AS u(e)
  WHERE public.roster_entry_key(u.e) = v_key
  LIMIT 1;

  PERFORM public.times_taken_drop(v_students, v_ranks, p_day, p_start, p_end);

  IF v_roster IS NOT NULL THEN
    SELECT COALESCE(
      array_agg(u.e ORDER BY u.ord)
        FILTER (WHERE public.roster_entry_key(u.e) <> v_key),
      '{}'::text[]
    )
    INTO v_roster_new
    FROM unnest(v_roster) WITH ORDINALITY AS u(e, ord);

    UPDATE courses SET students = v_roster_new WHERE id = p_course_id;
  END IF;

  SELECT COALESCE(
    array_agg(ARRAY[r.day, r.start_min, r.end_min] ORDER BY r.day, r.start_min),
    '{}'::integer[]
  )
  INTO v_new
  FROM public.schedule_rows(v_schedule) r
  WHERE NOT (r.day = p_day AND r.start_min = p_start AND r.end_min = p_end);

  UPDATE courses SET schedule = v_new WHERE id = p_course_id;
  RETURN v_new;
END;
$fn$;

----------------------------------------------------------------------
-- 6. Safety net trigger for direct schedule writes
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.courses_schedule_sync()
RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_valid_keys text[];
  v_ranks int[];
  v_kept text[];
  rec record;
BEGIN
  IF NEW.students IS NULL OR cardinality(NEW.students) = 0 THEN
    RETURN NEW;
  END IF;

  v_valid_keys := public.schedule_keys(NEW.schedule);
  v_ranks := public.term_ranks(NEW.school_id, NEW.term_options);

  FOR rec IN
    SELECT u.e AS entry
    FROM unnest(NEW.students) AS u(e)
    WHERE NOT (public.roster_entry_key(u.e) = ANY (v_valid_keys))
  LOOP
    PERFORM public.roster_entry_release(rec.entry, v_ranks);
  END LOOP;

  SELECT COALESCE(array_agg(u.e ORDER BY u.ord), '{}'::text[])
  INTO v_kept
  FROM unnest(NEW.students) WITH ORDINALITY AS u(e, ord)
  WHERE public.roster_entry_key(u.e) = ANY (v_valid_keys);

  NEW.students := v_kept;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS courses_schedule_sync ON public.courses;

CREATE TRIGGER courses_schedule_sync
BEFORE UPDATE OF schedule ON public.courses
FOR EACH ROW
WHEN (OLD.schedule IS DISTINCT FROM NEW.schedule)
EXECUTE FUNCTION public.courses_schedule_sync();

----------------------------------------------------------------------
-- 7. Repair sweep for data that already drifted
--
-- Pass 1 drops roster entries whose key is not in the course schedule,
-- along with those students' matching times_taken rows.
-- Pass 2 drops times_taken rows whose (term, day, start, end) matches no
-- course block at that school, which is conservative: a student cannot be
-- occupied by a class in a term where no course meets at that block.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_class_times(p_school_id uuid DEFAULT NULL)
RETURNS TABLE (orphaned_roster_entries int, stale_time_rows int)
LANGUAGE plpgsql AS $fn$
DECLARE
  v_orphans int := 0;
  v_stale int := 0;
  crs record;
  rec record;
  v_valid_keys text[];
  v_ranks int[];
  v_kept text[];
BEGIN
  FOR crs IN
    SELECT c.id, c.school_id, c.term_options, c.schedule, c.students
    FROM courses c
    WHERE c.students IS NOT NULL
      AND cardinality(c.students) > 0
      AND (p_school_id IS NULL OR c.school_id = p_school_id)
  LOOP
    v_valid_keys := public.schedule_keys(crs.schedule);

    IF EXISTS (
      SELECT 1 FROM unnest(crs.students) AS u(e)
      WHERE NOT (public.roster_entry_key(u.e) = ANY (v_valid_keys))
    ) THEN
      v_ranks := public.term_ranks(crs.school_id, crs.term_options);

      FOR rec IN
        SELECT u.e AS entry
        FROM unnest(crs.students) AS u(e)
        WHERE NOT (public.roster_entry_key(u.e) = ANY (v_valid_keys))
      LOOP
        PERFORM public.roster_entry_release(rec.entry, v_ranks);
        v_orphans := v_orphans + 1;
      END LOOP;

      SELECT COALESCE(array_agg(u.e ORDER BY u.ord), '{}'::text[])
      INTO v_kept
      FROM unnest(crs.students) WITH ORDINALITY AS u(e, ord)
      WHERE public.roster_entry_key(u.e) = ANY (v_valid_keys);

      UPDATE courses SET students = v_kept WHERE id = crs.id;
    END IF;
  END LOOP;

  WITH school_blocks AS (
    SELECT DISTINCT
      c.school_id,
      tr.term_rank,
      r.day,
      r.start_min,
      r.end_min
    FROM courses c
    CROSS JOIN LATERAL public.schedule_rows(c.schedule) r
    CROSS JOIN LATERAL unnest(public.term_ranks(c.school_id, c.term_options))
      AS tr(term_rank)
    WHERE p_school_id IS NULL OR c.school_id = p_school_id
  ),
  expanded AS (
    SELECT
      st.id AS student_id,
      st.school_id,
      st.times_taken[i][1] AS term_rank,
      st.times_taken[i][2] AS day,
      st.times_taken[i][3] AS start_min,
      st.times_taken[i][4] AS end_min
    FROM students st
    CROSS JOIN LATERAL generate_series(1, array_length(st.times_taken, 1)) AS i
    WHERE st.times_taken IS NOT NULL
      AND array_length(st.times_taken, 1) IS NOT NULL
      AND (p_school_id IS NULL OR st.school_id = p_school_id)
  ),
  judged AS (
    SELECT
      e.*,
      EXISTS (
        SELECT 1 FROM school_blocks b
        WHERE b.school_id = e.school_id
          AND b.term_rank = e.term_rank
          AND b.day = e.day
          AND b.start_min = e.start_min
          AND b.end_min = e.end_min
      ) AS is_valid
    FROM expanded e
  ),
  regrouped AS (
    SELECT
      j.student_id,
      array_agg(
        ARRAY[j.term_rank, j.day, j.start_min, j.end_min]
        ORDER BY j.term_rank, j.day, j.start_min
      ) FILTER (WHERE j.is_valid) AS times_taken,
      COUNT(*) FILTER (WHERE NOT j.is_valid)::int AS removed
    FROM judged j
    GROUP BY j.student_id
  ),
  applied AS (
    UPDATE students s
    SET times_taken = COALESCE(g.times_taken, '{}'::integer[])
    FROM regrouped g
    WHERE s.id = g.student_id
      AND g.removed > 0
    RETURNING g.removed AS removed
  )
  SELECT COALESCE(SUM(a.removed), 0)::int INTO v_stale FROM applied a;

  orphaned_roster_entries := v_orphans;
  stale_time_rows := v_stale;
  RETURN NEXT;
END;
$fn$;

----------------------------------------------------------------------
-- 8. Grants (app uses the anon key)
----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.add_class_time(uuid, int, int, int)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_class_time(uuid, int, int, int, int, int, int)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_class_time(uuid, int, int, int)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_class_times(uuid)
  TO anon, authenticated;

----------------------------------------------------------------------
-- 9. Self-test
--
-- Builds a throwaway school/terms/course/student, exercises every path,
-- asserts the results, then deletes everything it created.
----------------------------------------------------------------------
DO $$
DECLARE
  v_school uuid;
  v_term1 uuid;
  v_term2 uuid;
  v_course uuid;
  v_stu uuid;
  v_sched integer[];
  v_roster text[];
  v_times integer[];
  v_sweep record;
BEGIN
  INSERT INTO schools (name, website, city, state)
  VALUES ('__class_time_selftest__', 'https://example.invalid', 'Testville', 'CA')
  RETURNING id INTO v_school;

  INSERT INTO terms (school_id, name, position)
  VALUES (v_school, 'T1', 0) RETURNING id INTO v_term1;
  INSERT INTO terms (school_id, name, position)
  VALUES (v_school, 'T2', 1) RETURNING id INTO v_term2;

  INSERT INTO students (school_id, name, email, grade)
  VALUES (v_school, 'Selftest Student', '__class_time_selftest__@example.invalid', 10)
  RETURNING id INTO v_stu;

  INSERT INTO courses (
    school_id, title, short_description, long_description,
    grade, term, subject, term_options, schedule, students
  )
  VALUES (
    v_school, 'Selftest Course', 's', 'l',
    ARRAY[10], 'fall', 'Testing',
    ARRAY[v_term1]::uuid[],
    ARRAY[[1,535,615],[2,615,695]],
    ARRAY[
      public.roster_entry_build('1,535,615', ARRAY[v_stu]),
      public.roster_entry_build('2,615,695', ARRAY[v_stu])
    ]
  )
  RETURNING id INTO v_course;

  UPDATE students
  SET times_taken = ARRAY[[1,1,535,615],[1,2,615,695]]
  WHERE id = v_stu;

  -- T1 is the first term in display order, so rank 1.
  IF public.course_term_ranks(v_course) <> ARRAY[1] THEN
    RAISE EXCEPTION 'selftest: expected term rank {1}, got %',
      public.course_term_ranks(v_course);
  END IF;

  ------------------------------------------------------------------
  -- EDIT: move the day 2 block from 615-695 to 755-835
  ------------------------------------------------------------------
  v_sched := public.edit_class_time(v_course, 2, 615, 695, 2, 755, 835);

  IF v_sched <> ARRAY[[1,535,615],[2,755,835]] THEN
    RAISE EXCEPTION 'selftest edit: bad schedule %', v_sched;
  END IF;

  SELECT students INTO v_roster FROM courses WHERE id = v_course;
  IF NOT EXISTS (
    SELECT 1 FROM unnest(v_roster) AS u(e)
    WHERE public.roster_entry_key(u.e) = '2,755,835'
      AND v_stu = ANY (public.roster_entry_students(u.e))
  ) THEN
    RAISE EXCEPTION 'selftest edit: roster not rekeyed, got %', v_roster;
  END IF;

  SELECT times_taken INTO v_times FROM students WHERE id = v_stu;
  IF v_times <> ARRAY[[1,1,535,615],[1,2,755,835]] THEN
    RAISE EXCEPTION 'selftest edit: bad times_taken %', v_times;
  END IF;

  ------------------------------------------------------------------
  -- REMOVE: drop the day 1 block
  ------------------------------------------------------------------
  v_sched := public.remove_class_time(v_course, 1, 535, 615);

  IF v_sched <> ARRAY[[2,755,835]] THEN
    RAISE EXCEPTION 'selftest remove: bad schedule %', v_sched;
  END IF;

  SELECT students INTO v_roster FROM courses WHERE id = v_course;
  IF cardinality(v_roster) <> 1 THEN
    RAISE EXCEPTION 'selftest remove: roster not pruned, got %', v_roster;
  END IF;

  SELECT times_taken INTO v_times FROM students WHERE id = v_stu;
  IF v_times <> ARRAY[[1,2,755,835]] THEN
    RAISE EXCEPTION 'selftest remove: bad times_taken %', v_times;
  END IF;

  ------------------------------------------------------------------
  -- ADD: new block, rosters and times untouched
  ------------------------------------------------------------------
  v_sched := public.add_class_time(v_course, 1, 835, 915);

  IF v_sched <> ARRAY[[1,835,915],[2,755,835]] THEN
    RAISE EXCEPTION 'selftest add: bad schedule %', v_sched;
  END IF;

  SELECT times_taken INTO v_times FROM students WHERE id = v_stu;
  IF v_times <> ARRAY[[1,2,755,835]] THEN
    RAISE EXCEPTION 'selftest add: times_taken changed unexpectedly %', v_times;
  END IF;

  -- Adding the same block twice is a no-op.
  v_sched := public.add_class_time(v_course, 1, 835, 915);
  IF v_sched <> ARRAY[[1,835,915],[2,755,835]] THEN
    RAISE EXCEPTION 'selftest add: not idempotent %', v_sched;
  END IF;

  ------------------------------------------------------------------
  -- TRIGGER: a direct schedule write drops the orphaned roster entry
  ------------------------------------------------------------------
  UPDATE courses SET schedule = ARRAY[[1,835,915]] WHERE id = v_course;

  SELECT students INTO v_roster FROM courses WHERE id = v_course;
  IF cardinality(v_roster) <> 0 THEN
    RAISE EXCEPTION 'selftest trigger: orphan roster survived %', v_roster;
  END IF;

  SELECT times_taken INTO v_times FROM students WHERE id = v_stu;
  IF cardinality(v_times) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'selftest trigger: stale times survived %', v_times;
  END IF;

  ------------------------------------------------------------------
  -- SWEEP: hand-introduced drift is repaired
  ------------------------------------------------------------------
  UPDATE courses
  SET students = ARRAY[public.roster_entry_build('4,100,200', ARRAY[v_stu])]
  WHERE id = v_course;

  UPDATE students
  SET times_taken = ARRAY[[1,4,100,200],[1,1,835,915]]
  WHERE id = v_stu;

  SELECT * INTO v_sweep FROM public.cleanup_class_times(v_school);

  IF v_sweep.orphaned_roster_entries < 1 THEN
    RAISE EXCEPTION 'selftest sweep: expected an orphaned roster entry, got %',
      v_sweep.orphaned_roster_entries;
  END IF;

  SELECT times_taken INTO v_times FROM students WHERE id = v_stu;
  IF v_times <> ARRAY[[1,1,835,915]] THEN
    RAISE EXCEPTION 'selftest sweep: bad times_taken %', v_times;
  END IF;

  ------------------------------------------------------------------
  -- Cleanup
  ------------------------------------------------------------------
  DELETE FROM courses WHERE school_id = v_school;
  DELETE FROM students WHERE school_id = v_school;
  DELETE FROM terms WHERE school_id = v_school;
  DELETE FROM schools WHERE id = v_school;

  RAISE NOTICE 'Class time maintenance self-test passed.';
END $$;

----------------------------------------------------------------------
-- 10. Verification
----------------------------------------------------------------------
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'add_class_time', 'edit_class_time', 'remove_class_time',
    'cleanup_class_times', 'courses_schedule_sync',
    'times_taken_retime', 'times_taken_drop', 'term_ranks',
    'schedule_rows', 'schedule_keys', 'roster_entry_release'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_name
    ) THEN
      v_missing := array_append(v_missing, v_name);
    END IF;
  END LOOP;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Missing functions: %', array_to_string(v_missing, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'courses_schedule_sync' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Trigger courses_schedule_sync is missing';
  END IF;

  RAISE NOTICE 'Class time maintenance installed OK.';
END $$;

COMMIT;
