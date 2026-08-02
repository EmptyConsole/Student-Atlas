-- Apply elective assignment results
--
-- Public API
-- ----------
--   apply_elective_assignments(p_school_id, p_rosters, p_times) -> void
--
-- Atomically resets and writes assignment results for one school:
--   1. Validates every course_id / student_id in the payloads belongs to
--      p_school_id (raises on foreign ids).
--   2. Clears courses.students for every course of the school and
--      students.times_taken for every student of the school.
--   3. Writes the supplied final rosters and times_taken quads.
--
-- Payload shapes
-- --------------
-- p_rosters: jsonb array of
--   { "course_id": "<uuid>", "students": ["day,start,end|uuid1,uuid2,...", ...] }
--
-- p_times: jsonb array of
--   { "student_id": "<uuid>", "times_taken": [[term_rank, day, start, end], ...] }
--
-- Only courses.students is touched (never schedule), so the
-- courses_schedule_sync trigger is a no-op on these writes.
--
-- Idempotent: CREATE OR REPLACE. Granted to anon, authenticated.
-- Wrapped in a transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_elective_assignments(
  p_school_id uuid,
  p_rosters jsonb,
  p_times jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
DECLARE
  v_foreign_course uuid;
  v_foreign_student uuid;
  v_roster jsonb;
  v_time jsonb;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'p_school_id must not be null';
  END IF;

  IF p_rosters IS NULL OR jsonb_typeof(p_rosters) <> 'array' THEN
    RAISE EXCEPTION 'p_rosters must be a jsonb array';
  END IF;

  IF p_times IS NULL OR jsonb_typeof(p_times) <> 'array' THEN
    RAISE EXCEPTION 'p_times must be a jsonb array';
  END IF;

  -- Reject any course_id that does not belong to this school.
  SELECT (r ->> 'course_id')::uuid INTO v_foreign_course
  FROM jsonb_array_elements(p_rosters) AS r
  WHERE (r ->> 'course_id') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM courses c
       WHERE c.id = (r ->> 'course_id')::uuid
         AND c.school_id = p_school_id
     )
  LIMIT 1;

  IF v_foreign_course IS NOT NULL THEN
    RAISE EXCEPTION
      'apply_elective_assignments: course % is not in school %',
      v_foreign_course, p_school_id;
  END IF;

  -- Also catch null / missing course_id entries (the SELECT above only
  -- populates when a row fails; null course_id yields a cast error earlier
  -- for malformed uuids, but a missing key yields NULL).
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_rosters) AS r
    WHERE r ->> 'course_id' IS NULL
  ) THEN
    RAISE EXCEPTION
      'apply_elective_assignments: every roster entry needs a course_id';
  END IF;

  -- Reject any student_id that does not belong to this school.
  SELECT (t ->> 'student_id')::uuid INTO v_foreign_student
  FROM jsonb_array_elements(p_times) AS t
  WHERE (t ->> 'student_id') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM students s
       WHERE s.id = (t ->> 'student_id')::uuid
         AND s.school_id = p_school_id
     )
  LIMIT 1;

  IF v_foreign_student IS NOT NULL THEN
    RAISE EXCEPTION
      'apply_elective_assignments: student % is not in school %',
      v_foreign_student, p_school_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_times) AS t
    WHERE t ->> 'student_id' IS NULL
  ) THEN
    RAISE EXCEPTION
      'apply_elective_assignments: every times entry needs a student_id';
  END IF;

  -- Reset: clear all rosters and times_taken for this school only.
  UPDATE courses
  SET students = NULL
  WHERE school_id = p_school_id;

  UPDATE students
  SET times_taken = NULL
  WHERE school_id = p_school_id;

  -- Write final rosters.
  FOR v_roster IN SELECT * FROM jsonb_array_elements(p_rosters)
  LOOP
    UPDATE courses
    SET students = (
      SELECT COALESCE(array_agg(elem), ARRAY[]::text[])
      FROM jsonb_array_elements_text(
        COALESCE(v_roster -> 'students', '[]'::jsonb)
      ) AS elem
    )
    WHERE id = (v_roster ->> 'course_id')::uuid
      AND school_id = p_school_id;
  END LOOP;

  -- Write final times_taken.
  FOR v_time IN SELECT * FROM jsonb_array_elements(p_times)
  LOOP
    UPDATE students
    SET times_taken = (
      SELECT COALESCE(
        array_agg(
          ARRAY[
            (quad ->> 0)::int,
            (quad ->> 1)::int,
            (quad ->> 2)::int,
            (quad ->> 3)::int
          ]
          ORDER BY
            (quad ->> 0)::int,
            (quad ->> 1)::int,
            (quad ->> 2)::int
        ),
        ARRAY[]::integer[]
      )
      FROM jsonb_array_elements(
        COALESCE(v_time -> 'times_taken', '[]'::jsonb)
      ) AS quad
    )
    WHERE id = (v_time ->> 'student_id')::uuid
      AND school_id = p_school_id;
  END LOOP;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.apply_elective_assignments(uuid, jsonb, jsonb)
  TO anon, authenticated;

COMMIT;
