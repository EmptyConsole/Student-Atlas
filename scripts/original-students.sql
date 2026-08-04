-- The Nueva School — 500-student seed (rewrite)
--
-- Deletes every prior Nueva test student (email '%test@gmail.com'), then
-- inserts 500 fresh students with:
--   • grade-appropriate cores + completed prerequisites
--   • archetyped elective preferences (stem / humanities / arts / balanced)
--   • exactly 8 ranked courses per term column (Fall + Spring)
--   • every submitted_courses row has submitted = true
--   • every ranked course is also bookmarked
--
-- Caps every Nueva course at max_student_count = 20 and sets schools.rankings = 8.
--
-- Naming:
--   name  = "One Test", "Two Test", ... "FiveHundred Test"
--   email = onetest@gmail.com ... fivehundredtest@gmail.com
--
-- Prerequisites (catalog already on the term_options model):
--   nueva-school.sql → nueva-arts.sql → nueva-prereq-options.sql
--   → nueva-term-options.sql
--
-- Idempotent. Wrapped in a transaction. Aborts if any student lacks a full
-- submitted ranking set.

BEGIN;

----------------------------------------------------------------------
-- 0. Resolve school + terms; abort on a half-migrated catalog
----------------------------------------------------------------------
DO $$
DECLARE
  v_school_id uuid;
  v_fall_id   uuid;
  v_spring_id uuid;
  v_term_count int;
  v_missing_term_options int;
BEGIN
  SELECT id INTO v_school_id
  FROM schools
  WHERE name = 'The Nueva School'
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION
      'The Nueva School not found. Run the Nueva catalog import scripts first.';
  END IF;

  SELECT COUNT(*) INTO v_term_count
  FROM terms
  WHERE school_id = v_school_id;

  IF v_term_count <> 2 THEN
    RAISE EXCEPTION
      'Expected exactly 2 Nueva terms (Fall + Spring); found %. Run nueva-term-options.sql first.',
      v_term_count;
  END IF;

  SELECT id INTO v_fall_id
  FROM terms
  WHERE school_id = v_school_id
  ORDER BY
    CASE WHEN position = 1 THEN 0 WHEN name ILIKE 'Fall%' THEN 1 ELSE 2 END,
    position NULLS LAST,
    name
  LIMIT 1;

  SELECT id INTO v_spring_id
  FROM terms
  WHERE school_id = v_school_id
    AND id <> v_fall_id
  ORDER BY
    CASE WHEN position = 2 THEN 0 WHEN name ILIKE 'Spring%' THEN 1 ELSE 2 END,
    position NULLS LAST,
    name
  LIMIT 1;

  IF v_fall_id IS NULL OR v_spring_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve Fall/Spring term ids for The Nueva School.';
  END IF;

  SELECT COUNT(*) INTO v_missing_term_options
  FROM courses
  WHERE school_id = v_school_id
    AND (term_options IS NULL OR cardinality(term_options) = 0);

  IF v_missing_term_options > 0 THEN
    RAISE EXCEPTION
      '% Nueva courses have empty term_options. Run nueva-term-options.sql first.',
      v_missing_term_options;
  END IF;

  DROP TABLE IF EXISTS _nueva_ctx;
  CREATE TEMP TABLE _nueva_ctx (
    school_id uuid NOT NULL,
    fall_id   uuid NOT NULL,
    spring_id uuid NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _nueva_ctx (school_id, fall_id, spring_id)
  VALUES (v_school_id, v_fall_id, v_spring_id);
END $$;

----------------------------------------------------------------------
-- 1. Cap courses + rankings policy
----------------------------------------------------------------------
UPDATE courses AS c
SET max_student_count = 20
FROM _nueva_ctx ctx
WHERE c.school_id = ctx.school_id;

UPDATE schools AS s
SET rankings = 8
FROM _nueva_ctx ctx
WHERE s.id = ctx.school_id;

----------------------------------------------------------------------
-- 2. Wipe prior generated test students (+ assignment leftovers)
----------------------------------------------------------------------
DO $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT school_id INTO v_school_id FROM _nueva_ctx;

  CREATE TEMP TABLE _wipe_students ON COMMIT DROP AS
  SELECT id
  FROM students
  WHERE school_id = v_school_id
    AND email ILIKE '%test@gmail.com';

  DELETE FROM submitted_courses
  WHERE student_id IN (SELECT id FROM _wipe_students);

  DELETE FROM bookmarked_courses
  WHERE student_id IN (SELECT id FROM _wipe_students);

  DELETE FROM completed_courses
  WHERE student_id IN (SELECT id FROM _wipe_students);

  DELETE FROM enrolled_courses
  WHERE student_id IN (SELECT id FROM _wipe_students);

  DELETE FROM course_notes
  WHERE student_id IN (SELECT id FROM _wipe_students);

  DELETE FROM submitted_notes
  WHERE student_id IN (SELECT id FROM _wipe_students);

  -- Drop any roster entries that still name wiped students.
  UPDATE courses c
  SET students = (
    SELECT CASE
      WHEN cardinality(kept) = 0 THEN NULL
      ELSE kept
    END
    FROM (
      SELECT array_agg(entry) FILTER (
        WHERE entry IS NOT NULL AND entry <> ''
      ) AS kept
      FROM (
        SELECT
          CASE
            WHEN split_part(e, '|', 2) = '' THEN e
            ELSE
              split_part(e, '|', 1) || '|' || COALESCE((
                SELECT string_agg(uid, ',')
                FROM unnest(string_to_array(split_part(e, '|', 2), ',')) AS uid
                WHERE btrim(uid) <> ''
                  AND btrim(uid)::uuid NOT IN (SELECT id FROM _wipe_students)
              ), '')
          END AS entry
        FROM unnest(COALESCE(c.students, ARRAY[]::text[])) AS e
      ) rewritten
      WHERE split_part(entry, '|', 2) <> '' OR position('|' IN entry) = 0
    ) q
  )
  WHERE c.school_id = v_school_id
    AND c.students IS NOT NULL;

  DELETE FROM students
  WHERE id IN (SELECT id FROM _wipe_students);
END $$;

----------------------------------------------------------------------
-- 3. Helpers (pg_temp)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.numword(n int) RETURNS text AS $fn$
DECLARE
  ones text[] := ARRAY[
    'Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
    'Seventeen','Eighteen','Nineteen'
  ];
  tens text[] := ARRAY[
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];
  h int; r int; t int; o int; out text;
BEGIN
  IF n < 1 OR n > 500 THEN
    RAISE EXCEPTION 'numword only supports 1..500, got %', n;
  END IF;
  IF n < 20 THEN RETURN ones[n + 1]; END IF;
  IF n < 100 THEN
    t := n / 10; o := n % 10;
    IF o = 0 THEN RETURN tens[t + 1]; END IF;
    RETURN tens[t + 1] || ones[o + 1];
  END IF;
  h := n / 100; r := n % 100;
  out := ones[h + 1] || 'Hundred';
  IF r = 0 THEN RETURN out; END IF;
  IF r < 20 THEN RETURN out || ones[r + 1]; END IF;
  t := r / 10; o := r % 10;
  IF o = 0 THEN RETURN out || tens[t + 1]; END IF;
  RETURN out || tens[t + 1] || ones[o + 1];
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.rnd(n int, salt text) RETURNS double precision AS $fn$
  SELECT (('x' || substr(md5(n::text || ':' || salt), 1, 8))::bit(32)::bigint::double precision
          / 4294967296.0);
$fn$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.course_title(p_id uuid) RETURNS text AS $fn$
  SELECT title FROM courses WHERE id = p_id;
$fn$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION pg_temp.course_id_by_title(p_title text) RETURNS uuid AS $fn$
DECLARE
  v_school_id uuid;
  v_fall_id   uuid;
  v_id        uuid;
BEGIN
  SELECT school_id, fall_id INTO v_school_id, v_fall_id FROM _nueva_ctx;

  SELECT c.id INTO v_id
  FROM courses c
  WHERE c.school_id = v_school_id
    AND c.title = p_title
  ORDER BY
    CASE
      WHEN cardinality(c.term_options) > 1 THEN 0
      WHEN v_fall_id = ANY (c.term_options) THEN 1
      ELSE 2
    END,
    c.created_at
  LIMIT 1;

  RETURN v_id;
END;
$fn$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION pg_temp.course_id_for_term(p_title text, p_term_id uuid) RETURNS uuid AS $fn$
DECLARE
  v_school_id uuid;
  v_id uuid;
BEGIN
  SELECT school_id INTO v_school_id FROM _nueva_ctx;

  SELECT c.id INTO v_id
  FROM courses c
  WHERE c.school_id = v_school_id
    AND c.title = p_title
    AND p_term_id = ANY (c.term_options)
  ORDER BY
    CASE WHEN cardinality(c.term_options) = 1 THEN 0 ELSE 1 END,
    c.created_at
  LIMIT 1;

  RETURN v_id;
END;
$fn$ LANGUAGE plpgsql STABLE;

-- Evaluate prereq_options DNF. Free-text never auto-passes unless override.
CREATE OR REPLACE FUNCTION pg_temp.prereq_met(
  p_course_id uuid,
  p_completed_titles text[],
  p_allow_override boolean DEFAULT false
) RETURNS boolean AS $fn$
DECLARE
  v_opts text[][];
  v_or   int;
  v_and  int;
  v_elem text;
  v_title text;
  v_group_ok boolean;
  v_any_group boolean;
  v_is_uuid boolean;
  v_had_content boolean := false;
BEGIN
  SELECT prereq_options INTO v_opts FROM courses WHERE id = p_course_id;

  IF v_opts IS NULL OR cardinality(v_opts) IS NULL OR cardinality(v_opts) = 0 THEN
    RETURN true;
  END IF;

  FOR v_or IN 1 .. array_length(v_opts, 1) LOOP
    v_group_ok := true;
    v_any_group := false;

    FOR v_and IN 1 .. COALESCE(array_length(v_opts, 2), 0) LOOP
      v_elem := v_opts[v_or][v_and];
      IF v_elem IS NULL OR v_elem = '' THEN CONTINUE; END IF;
      v_any_group := true;
      v_had_content := true;

      v_is_uuid := (v_elem ~ '^[0-9a-fA-F-]{36}$');
      v_title := NULL;
      IF v_is_uuid THEN
        BEGIN
          v_title := pg_temp.course_title(v_elem::uuid);
        EXCEPTION WHEN OTHERS THEN
          v_title := NULL;
        END;
      END IF;

      IF v_title IS NOT NULL THEN
        IF NOT (v_title = ANY (p_completed_titles)) THEN
          v_group_ok := false;
          EXIT;
        END IF;
      ELSE
        IF NOT p_allow_override THEN
          v_group_ok := false;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    IF v_any_group AND v_group_ok THEN
      RETURN true;
    END IF;
  END LOOP;

  IF NOT v_had_content THEN RETURN true; END IF;
  RETURN false;
END;
$fn$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION pg_temp.popularity(p_title text, p_dept text) RETURNS double precision AS $fn$
BEGIN
  IF p_title ILIKE '%Teaching Fellowship%' THEN RETURN 0.05; END IF;
  IF p_title ILIKE 'Independent Study%' THEN RETURN 0.08; END IF;
  IF p_title ILIKE '%[Not Running%' THEN RETURN 0.01; END IF;

  IF p_title IN (
    'Physics','Intro to Computer Programming','Intro to Psychology','Data Science',
    'Free Block','Creative Writing','Calculus','Biology','Chemistry','Journalism',
    'Video Game Programming','Mobile App Development','Intro to Machine Learning',
    'Algorithms','Software Engineering'
  ) THEN RETURN 3.5; END IF;

  IF p_title IN (
    'Intro to Microeconomics','Intro to Macroeconomics','What Is Philosophy?',
    'Existentialism','International Relations','Cinema Studies',
    'Yearbook Media Production','Intro to Speech and Debate','Programming with OOP',
    'Computer Security','Computer Vision','Intro to CAD','How to Build Anything?',
    'Product Design','Dance','Musical Theater','Intro to Photography','Intro to Drawing',
    'Intro to Film & Video','Statistics','Linear Algebra','Multivariable Calculus',
    'Anatomy and Physiology','Modern Physics','Environmental Earth Science',
    'Marine Environments'
  ) THEN RETURN 2.2; END IF;

  IF p_dept IN ('Science','Math','Computer Science','English') THEN RETURN 1.4; END IF;
  IF p_dept IN ('History','Economics','Interdisciplinary') THEN RETURN 1.2; END IF;
  IF p_dept IN ('Performing Arts','Visual Arts','Engineering, Fabrication & Design') THEN
    RETURN 0.9;
  END IF;
  RETURN 1.0;
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.arch_mult(p_archetype text, p_dept text) RETURNS double precision AS $fn$
BEGIN
  IF p_archetype = 'stem' THEN
    IF p_dept IN ('Science','Math','Computer Science','Engineering, Fabrication & Design') THEN
      RETURN 2.5;
    END IF;
    IF p_dept IN ('Performing Arts','Visual Arts') THEN RETURN 0.4; END IF;
    RETURN 1.0;
  ELSIF p_archetype = 'humanities' THEN
    IF p_dept IN ('English','History','Interdisciplinary','Languages') THEN RETURN 2.5; END IF;
    IF p_dept = 'Computer Science' THEN RETURN 0.5; END IF;
    RETURN 1.0;
  ELSIF p_archetype = 'arts' THEN
    IF p_dept IN ('Performing Arts','Visual Arts','Engineering, Fabrication & Design') THEN
      RETURN 3.0;
    END IF;
    IF p_dept = 'Science' THEN RETURN 0.5; END IF;
    RETURN 1.0;
  END IF;
  RETURN 1.0;
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

----------------------------------------------------------------------
-- 4. Catalog + picks scratch
----------------------------------------------------------------------
CREATE TEMP TABLE _catalog ON COMMIT DROP AS
SELECT
  c.id,
  c.title,
  c.grade,
  COALESCE(d.name, c.subject) AS dept,
  (ctx.fall_id = ANY (c.term_options)) AS is_fall,
  (ctx.spring_id = ANY (c.term_options)) AS is_spring,
  (ctx.fall_id = ANY (c.term_options)
   AND ctx.spring_id = ANY (c.term_options)) AS is_allyear,
  (ctx.fall_id = ANY (c.term_options)
   AND NOT ctx.spring_id = ANY (c.term_options)) AS is_fall_only,
  (ctx.spring_id = ANY (c.term_options)
   AND NOT ctx.fall_id = ANY (c.term_options)) AS is_spring_only,
  pg_temp.popularity(c.title, COALESCE(d.name, c.subject)) AS base_weight
FROM courses c
CROSS JOIN _nueva_ctx ctx
LEFT JOIN departments d ON d.id = c.department_id
WHERE c.school_id = ctx.school_id;

CREATE INDEX ON _catalog (title);
CREATE INDEX ON _catalog (is_allyear);
CREATE INDEX ON _catalog (is_fall_only);
CREATE INDEX ON _catalog (is_spring_only);

CREATE TEMP TABLE _picks (
  course_id uuid PRIMARY KEY,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('allyear', 'fall', 'spring')),
  desire double precision NOT NULL,
  is_core boolean NOT NULL DEFAULT false
) ON COMMIT DROP;

----------------------------------------------------------------------
-- 5. Generate 500 students with full submitted rankings
----------------------------------------------------------------------
DO $$
DECLARE
  v_school_id uuid;
  v_fall_id   uuid;
  v_spring_id uuid;

  i int;
  v_name text;
  v_email text;
  v_grade int;
  v_grad_year int;
  v_student_id uuid;
  v_archetype text;

  v_r double precision;
  v_math_title text;
  v_lang_family text;
  v_lang_level int;
  v_lang_title text;

  v_completed text[];
  v_title text;
  v_cid uuid;
  v_des double precision;
  v_kind text;
  v_allow boolean;

  v_slots_ay int;
  v_slots_sem int;
  v_avail_ay int;
  v_avail_f int;
  v_avail_s int;
  v_min_ay int;
  v_max_ay int;

  v_fall_order uuid[];
  v_spring_order uuid[];
  v_ay_q uuid[];
  v_f_q uuid[];
  v_s_q uuid[];
  v_ay_d double precision[];
  v_f_d double precision[];
  v_s_d double precision[];
  v_ayi int; v_fi int; v_si int;
  v_rank int;
  v_use_ay boolean;
  v_next_ay_des double precision;
  v_next_sem_des double precision;

  v_bookmark uuid;
  v_alt int;
  v_pref int;
  v_written uuid[];

  v_eng_fall text;
  v_eng_spring text;
  v_n_fall int;
  v_n_spring int;
  rec RECORD;
BEGIN
  SELECT school_id, fall_id, spring_id
  INTO v_school_id, v_fall_id, v_spring_id
  FROM _nueva_ctx;

  FOR i IN 1..500 LOOP
    v_name  := pg_temp.numword(i) || ' Test';
    v_email := lower(pg_temp.numword(i)) || 'test@gmail.com';

    -- Even grade split with deterministic jitter (≈125 each).
    v_grade := 9 + ((i - 1) % 4);
    v_grad_year := 2027 + (12 - v_grade);

    v_r := pg_temp.rnd(i, 'archetype');
    IF v_r < 0.35 THEN v_archetype := 'stem';
    ELSIF v_r < 0.60 THEN v_archetype := 'humanities';
    ELSIF v_r < 0.80 THEN v_archetype := 'arts';
    ELSE v_archetype := 'balanced';
    END IF;

    INSERT INTO students (name, email, grade, school_id, graduation_year, times_taken)
    VALUES (v_name, v_email, v_grade, v_school_id, v_grad_year, NULL)
    RETURNING id INTO v_student_id;

    ------------------------------------------------------------------
    -- Math / language placement
    ------------------------------------------------------------------
    v_r := pg_temp.rnd(i, 'math');
    IF v_grade = 9 THEN
      v_math_title := CASE WHEN v_r < 0.70 THEN 'Math 1' ELSE 'Math 2' END;
    ELSIF v_grade = 10 THEN
      IF v_r < 0.40 THEN v_math_title := 'Math 2';
      ELSIF v_r < 0.80 THEN v_math_title := 'Math 3';
      ELSE v_math_title := 'Calculus';
      END IF;
    ELSIF v_grade = 11 THEN
      IF v_r < 0.25 THEN v_math_title := 'Math 3';
      ELSIF v_r < 0.70 THEN v_math_title := 'Calculus';
      ELSIF v_r < 0.85 THEN v_math_title := 'Statistics';
      ELSE v_math_title := 'Linear Algebra';
      END IF;
    ELSE
      IF v_r < 0.30 THEN v_math_title := 'Calculus';
      ELSIF v_r < 0.55 THEN v_math_title := 'Multivariable Calculus';
      ELSIF v_r < 0.75 THEN v_math_title := 'Statistics';
      ELSIF v_r < 0.90 THEN v_math_title := 'Linear Algebra';
      ELSE v_math_title := 'Differential Equations';
      END IF;
    END IF;

    v_r := pg_temp.rnd(i, 'langfam');
    IF v_r < 0.45 THEN v_lang_family := 'Spanish';
    ELSIF v_r < 0.75 THEN v_lang_family := 'Chinese';
    ELSE v_lang_family := 'Japanese';
    END IF;

    v_r := pg_temp.rnd(i, 'langlvl');
    IF v_grade = 9 THEN
      v_lang_level := CASE WHEN v_r < 0.70 THEN 1 ELSE 2 END;
    ELSIF v_grade = 10 THEN
      v_lang_level := CASE WHEN v_r < 0.50 THEN 2 ELSE 3 END;
    ELSIF v_grade = 11 THEN
      v_lang_level := CASE WHEN v_r < 0.40 THEN 3 ELSE 4 END;
    ELSE
      v_lang_level := CASE WHEN v_r < 0.50 THEN 4 ELSE 5 END;
    END IF;

    IF v_lang_family = 'Spanish' THEN
      v_lang_title := CASE v_lang_level
        WHEN 1 THEN 'Spanish 1' WHEN 2 THEN 'Spanish 2'
        WHEN 3 THEN 'Spanish 3' WHEN 4 THEN 'Spanish 4'
        ELSE CASE WHEN pg_temp.rnd(i, 'spadv') < 0.5
          THEN 'Spanish Communication'
          ELSE 'Advanced Topics in Spanish: Cultural Analysis and Lifestyles' END
      END;
    ELSIF v_lang_family = 'Chinese' THEN
      v_lang_title := CASE v_lang_level
        WHEN 1 THEN 'Chinese 1' WHEN 2 THEN 'Chinese 2'
        WHEN 3 THEN 'Chinese 3' WHEN 4 THEN 'Chinese 4'
        ELSE CASE WHEN pg_temp.rnd(i, 'chadv') < 0.5
          THEN 'Chinese 5: Current Events & Film'
          ELSE 'Chinese Literature & Advanced Research' END
      END;
    ELSE
      v_lang_title := CASE v_lang_level
        WHEN 1 THEN 'Japanese 1' WHEN 2 THEN 'Japanese 2'
        WHEN 3 THEN 'Japanese 3' WHEN 4 THEN 'Japanese 4'
        ELSE 'Adv. Topics in Japanese'
      END;
    END IF;

    ------------------------------------------------------------------
    -- Completed prerequisites
    ------------------------------------------------------------------
    v_completed := ARRAY[]::text[];

    IF v_grade >= 10 THEN
      v_completed := v_completed || ARRAY[
        'English 9','History 9 - World to 1500','Social Emotional Learning 9','Chemistry'
      ];
    END IF;
    IF v_grade >= 11 THEN
      v_completed := v_completed || ARRAY[
        'English 10','History 10 - Modern World','Social Emotional Learning 10','Biology'
      ];
    END IF;
    IF v_grade >= 12 THEN
      v_completed := v_completed || ARRAY[
        'English 11','History 11 - US History','Social Emotional Learning 11'
      ];
      IF pg_temp.rnd(i, 'physdone') < 0.55 THEN
        v_completed := array_append(v_completed, 'Physics');
      END IF;
    END IF;

    IF v_math_title <> 'Math 1' THEN
      v_completed := array_append(v_completed, 'Math 1');
    END IF;
    IF v_math_title IN (
      'Math 3','Calculus','Statistics','Linear Algebra','Multivariable Calculus',
      'Differential Equations','Complex Analysis','Advanced Probability',
      'Mathematical Modeling','Computational Biology','Geometries Beyond Euclid'
    ) THEN
      v_completed := array_append(v_completed, 'Math 2');
    END IF;
    IF v_math_title IN (
      'Calculus','Linear Algebra','Multivariable Calculus','Differential Equations',
      'Complex Analysis','Advanced Probability','Mathematical Modeling',
      'Computational Biology','Geometries Beyond Euclid'
    ) THEN
      v_completed := array_append(v_completed, 'Math 3');
    END IF;
    IF v_math_title IN (
      'Multivariable Calculus','Differential Equations','Complex Analysis',
      'Advanced Probability','Mathematical Modeling'
    ) THEN
      v_completed := array_append(v_completed, 'Calculus');
    END IF;

    IF v_lang_family = 'Spanish' THEN
      IF v_lang_level >= 2 THEN v_completed := array_append(v_completed, 'Spanish 1'); END IF;
      IF v_lang_level >= 3 THEN v_completed := array_append(v_completed, 'Spanish 2'); END IF;
      IF v_lang_level >= 4 THEN v_completed := array_append(v_completed, 'Spanish 3'); END IF;
      IF v_lang_level >= 5 THEN v_completed := array_append(v_completed, 'Spanish 4'); END IF;
    ELSIF v_lang_family = 'Chinese' THEN
      IF v_lang_level >= 2 THEN v_completed := array_append(v_completed, 'Chinese 1'); END IF;
      IF v_lang_level >= 3 THEN v_completed := array_append(v_completed, 'Chinese 2'); END IF;
      IF v_lang_level >= 4 THEN v_completed := array_append(v_completed, 'Chinese 3'); END IF;
      IF v_lang_level >= 5 THEN v_completed := array_append(v_completed, 'Chinese 4'); END IF;
    ELSE
      IF v_lang_level >= 2 THEN v_completed := array_append(v_completed, 'Japanese 1'); END IF;
      IF v_lang_level >= 3 THEN v_completed := array_append(v_completed, 'Japanese 2'); END IF;
      IF v_lang_level >= 4 THEN v_completed := array_append(v_completed, 'Japanese 3'); END IF;
      IF v_lang_level >= 5 THEN v_completed := array_append(v_completed, 'Japanese 4'); END IF;
    END IF;

    IF v_grade >= 10 AND pg_temp.rnd(i, 'csintro') < 0.40 THEN
      v_completed := array_append(v_completed, 'Intro to Computer Programming');
    END IF;
    IF v_grade >= 11 AND 'Intro to Computer Programming' = ANY (v_completed)
       AND pg_temp.rnd(i, 'cs2') < 0.25 THEN
      IF pg_temp.rnd(i, 'cs2pick') < 0.5 THEN
        v_completed := array_append(v_completed, 'Programming with OOP');
      ELSE
        v_completed := array_append(v_completed, 'Data Science');
      END IF;
    END IF;
    IF v_grade >= 10 AND v_archetype = 'arts' AND pg_temp.rnd(i, 'artintro') < 0.55 THEN
      IF pg_temp.rnd(i, 'artpick') < 0.5 THEN
        v_completed := array_append(v_completed, 'Intro to Drawing');
      ELSE
        v_completed := array_append(v_completed, 'Intro to Photography');
      END IF;
    END IF;
    IF v_grade >= 11 AND pg_temp.rnd(i, 'psych') < 0.30 THEN
      v_completed := array_append(v_completed, 'Intro to Psychology');
    END IF;
    IF v_grade >= 11 AND pg_temp.rnd(i, 'micro') < 0.25 THEN
      v_completed := array_append(v_completed, 'Intro to Microeconomics');
    END IF;

    SELECT ARRAY(SELECT DISTINCT x FROM unnest(v_completed) AS x) INTO v_completed;

    FOREACH v_title IN ARRAY v_completed LOOP
      v_cid := pg_temp.course_id_by_title(v_title);
      IF v_cid IS NOT NULL THEN
        INSERT INTO completed_courses (course_id, student_id)
        VALUES (v_cid, v_student_id);
      END IF;
    END LOOP;

    ------------------------------------------------------------------
    -- Build picks: cores first, then scored electives
    ------------------------------------------------------------------
    DELETE FROM _picks;

    IF v_grade = 9 THEN
      FOREACH v_title IN ARRAY ARRAY[
        'English 9','History 9 - World to 1500','Chemistry',
        'Social Emotional Learning 9','Design Create Innovate (DCI)',
        v_math_title, v_lang_title
      ] LOOP
        v_cid := pg_temp.course_id_by_title(v_title);
        IF v_cid IS NULL THEN CONTINUE; END IF;
        SELECT CASE WHEN is_allyear THEN 'allyear'
                    WHEN is_fall_only THEN 'fall'
                    ELSE 'spring' END,
               base_weight
        INTO v_kind, v_des
        FROM _catalog WHERE id = v_cid;
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (v_cid, v_title, v_kind, 1000.0 + v_des, true)
        ON CONFLICT (course_id) DO NOTHING;
      END LOOP;
    ELSIF v_grade = 10 THEN
      FOREACH v_title IN ARRAY ARRAY[
        'English 10','History 10 - Modern World','Biology',
        'Social Emotional Learning 10', v_math_title, v_lang_title
      ] LOOP
        v_cid := pg_temp.course_id_by_title(v_title);
        IF v_cid IS NULL THEN CONTINUE; END IF;
        SELECT CASE WHEN is_allyear THEN 'allyear'
                    WHEN is_fall_only THEN 'fall'
                    ELSE 'spring' END,
               base_weight
        INTO v_kind, v_des
        FROM _catalog WHERE id = v_cid;
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (v_cid, v_title, v_kind, 1000.0 + v_des, true)
        ON CONFLICT (course_id) DO NOTHING;
      END LOOP;
    ELSIF v_grade = 11 THEN
      FOREACH v_title IN ARRAY ARRAY[
        'English 11','History 11 - US History','Physics',
        'Social Emotional Learning 11', v_math_title, v_lang_title
      ] LOOP
        v_cid := pg_temp.course_id_by_title(v_title);
        IF v_cid IS NULL THEN CONTINUE; END IF;
        SELECT CASE WHEN is_allyear THEN 'allyear'
                    WHEN is_fall_only THEN 'fall'
                    ELSE 'spring' END,
               base_weight
        INTO v_kind, v_des
        FROM _catalog WHERE id = v_cid;
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (v_cid, v_title, v_kind, 1000.0 + v_des, true)
        ON CONFLICT (course_id) DO NOTHING;
      END LOOP;
    ELSE
      FOREACH v_title IN ARRAY ARRAY[v_math_title, v_lang_title] LOOP
        v_cid := pg_temp.course_id_by_title(v_title);
        IF v_cid IS NULL THEN CONTINUE; END IF;
        SELECT CASE WHEN is_allyear THEN 'allyear'
                    WHEN is_fall_only THEN 'fall'
                    ELSE 'spring' END,
               base_weight
        INTO v_kind, v_des
        FROM _catalog WHERE id = v_cid;
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (v_cid, v_title, v_kind, 1000.0 + v_des, true)
        ON CONFLICT (course_id) DO NOTHING;
      END LOOP;

      v_cid := pg_temp.course_id_for_term('Senior Block', v_fall_id);
      IF v_cid IS NOT NULL THEN
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (v_cid, 'Senior Block', 'fall', 1100.0, true)
        ON CONFLICT (course_id) DO NOTHING;
      END IF;

      v_cid := pg_temp.course_id_for_term(
        'Social Emotional Learning 12: The Good Life', v_spring_id);
      IF v_cid IS NOT NULL THEN
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (
          v_cid,
          'Social Emotional Learning 12: The Good Life',
          'spring',
          1100.0,
          true
        )
        ON CONFLICT (course_id) DO NOTHING;
      END IF;

      v_eng_fall := (ARRAY[
        'Irish Literature','Memoir and Adaptation','Monstrosity',
        'War and Conflict in Literature'
      ])[1 + floor(pg_temp.rnd(i, 'engf') * 4)::int];
      v_eng_spring := (ARRAY[
        '19th-Century Adaptations','Cinema Studies','Shakespeare Ever After',
        'The Tie that Binds: Family Dynamics in Shakespeare','Women in Literature'
      ])[1 + floor(pg_temp.rnd(i, 'engs') * 5)::int];

      v_cid := pg_temp.course_id_for_term(v_eng_fall, v_fall_id);
      IF v_cid IS NOT NULL THEN
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (v_cid, v_eng_fall, 'fall', 1050.0, true)
        ON CONFLICT (course_id) DO NOTHING;
      END IF;
      v_cid := pg_temp.course_id_for_term(v_eng_spring, v_spring_id);
      IF v_cid IS NOT NULL THEN
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (v_cid, v_eng_spring, 'spring', 1050.0, true)
        ON CONFLICT (course_id) DO NOTHING;
      END IF;
    END IF;

    FOR rec IN
      SELECT c.id, c.title, c.dept, c.base_weight,
             CASE WHEN c.is_allyear THEN 'allyear'
                  WHEN c.is_fall_only THEN 'fall'
                  ELSE 'spring' END AS kind
      FROM _catalog c
      WHERE v_grade = ANY (c.grade)
        AND (c.is_allyear OR c.is_fall_only OR c.is_spring_only)
        AND c.title NOT ILIKE '%Teaching Fellowship%'
        AND c.title NOT ILIKE '%[Not Running%'
        AND NOT EXISTS (SELECT 1 FROM _picks p WHERE p.course_id = c.id)
        AND NOT (c.title = ANY (v_completed))
    LOOP
      v_allow := pg_temp.rnd(i, 'override:' || rec.id::text) < 0.08;
      IF NOT pg_temp.prereq_met(rec.id, v_completed, v_allow) THEN
        CONTINUE;
      END IF;

      v_des := rec.base_weight
             * pg_temp.arch_mult(v_archetype, rec.dept)
             * (0.55 + 0.90 * pg_temp.rnd(i, 'des:' || rec.id::text));

      INSERT INTO _picks (course_id, title, kind, desire, is_core)
      VALUES (rec.id, rec.title, rec.kind, v_des, false)
      ON CONFLICT (course_id) DO NOTHING;
    END LOOP;

    -- Guaranteed fillers so every student can always reach 8+8.
    FOREACH v_title IN ARRAY ARRAY[
      'Free Block','Creative Writing','Intro to Speech and Debate',
      'Mixed Media','Dance','Groove Workshop','Intro to Music Production',
      'What Is Philosophy?','Existentialism','Environmental Earth Science',
      'Marine Environments','Building Toys','The Art of Repair',
      'Intro to CAD','Cinema Studies','Irish Literature','Journalism',
      'Intro to Psychology','Intro to Drawing','Intro to Photography'
    ] LOOP
      FOR rec IN
        SELECT c.id,
               CASE WHEN c.is_allyear THEN 'allyear'
                    WHEN c.is_fall_only THEN 'fall'
                    ELSE 'spring' END AS kind,
               c.base_weight, c.title
        FROM _catalog c
        WHERE c.title = v_title
          AND v_grade = ANY (c.grade)
          AND NOT EXISTS (SELECT 1 FROM _picks p WHERE p.course_id = c.id)
          AND NOT (c.title = ANY (v_completed))
      LOOP
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (rec.id, rec.title, rec.kind, 0.25 + rec.base_weight * 0.15, false)
        ON CONFLICT (course_id) DO NOTHING;
      END LOOP;
    END LOOP;

    -- Last-resort pad: any grade-eligible course, ignore prereqs.
    SELECT COUNT(*) INTO v_avail_f FROM _picks WHERE kind IN ('allyear', 'fall');
    SELECT COUNT(*) INTO v_avail_s FROM _picks WHERE kind IN ('allyear', 'spring');
    IF v_avail_f < 8 OR v_avail_s < 8 THEN
      FOR rec IN
        SELECT c.id, c.title,
               CASE WHEN c.is_allyear THEN 'allyear'
                    WHEN c.is_fall_only THEN 'fall'
                    ELSE 'spring' END AS kind,
               c.base_weight
        FROM _catalog c
        WHERE v_grade = ANY (c.grade)
          AND (c.is_allyear OR c.is_fall_only OR c.is_spring_only)
          AND NOT EXISTS (SELECT 1 FROM _picks p WHERE p.course_id = c.id)
        ORDER BY c.base_weight DESC, c.title
        LIMIT 40
      LOOP
        INSERT INTO _picks (course_id, title, kind, desire, is_core)
        VALUES (rec.id, rec.title, rec.kind, 0.05 + rec.base_weight * 0.01, false)
        ON CONFLICT (course_id) DO NOTHING;
      END LOOP;
    END IF;

    ------------------------------------------------------------------
    -- Slot plan: A all-year + (8-A) fall-only + (8-A) spring-only
    ------------------------------------------------------------------
    SELECT COUNT(*) INTO v_avail_ay FROM _picks WHERE kind = 'allyear';
    SELECT COUNT(*) INTO v_avail_f  FROM _picks WHERE kind = 'fall';
    SELECT COUNT(*) INTO v_avail_s  FROM _picks WHERE kind = 'spring';

    v_min_ay := GREATEST(0, 8 - v_avail_f, 8 - v_avail_s);
    v_max_ay := LEAST(8, v_avail_ay);
    IF v_min_ay > v_max_ay THEN
      v_min_ay := v_max_ay;
    END IF;

    SELECT COUNT(*) INTO v_slots_ay
    FROM _picks WHERE kind = 'allyear' AND is_core;
    v_slots_ay := GREATEST(v_min_ay, LEAST(v_max_ay, v_slots_ay));

    WHILE v_slots_ay > v_min_ay
      AND (v_avail_f < 8 - v_slots_ay OR v_avail_s < 8 - v_slots_ay)
    LOOP
      v_slots_ay := v_slots_ay - 1;
    END LOOP;
    v_slots_ay := GREATEST(v_min_ay, LEAST(v_max_ay, v_slots_ay));
    v_slots_sem := 8 - v_slots_ay;

    SELECT ARRAY_AGG(course_id ORDER BY desire DESC, title),
           ARRAY_AGG(desire ORDER BY desire DESC, title)
    INTO v_ay_q, v_ay_d
    FROM (
      SELECT course_id, desire, title FROM _picks
      WHERE kind = 'allyear'
      ORDER BY desire DESC, title
      LIMIT v_slots_ay
    ) t;

    SELECT ARRAY_AGG(course_id ORDER BY desire DESC, title),
           ARRAY_AGG(desire ORDER BY desire DESC, title)
    INTO v_f_q, v_f_d
    FROM (
      SELECT course_id, desire, title FROM _picks
      WHERE kind = 'fall'
      ORDER BY desire DESC, title
      LIMIT v_slots_sem
    ) t;

    SELECT ARRAY_AGG(course_id ORDER BY desire DESC, title),
           ARRAY_AGG(desire ORDER BY desire DESC, title)
    INTO v_s_q, v_s_d
    FROM (
      SELECT course_id, desire, title FROM _picks
      WHERE kind = 'spring'
      ORDER BY desire DESC, title
      LIMIT v_slots_sem
    ) t;

    v_ay_q := COALESCE(v_ay_q, ARRAY[]::uuid[]);
    v_f_q  := COALESCE(v_f_q,  ARRAY[]::uuid[]);
    v_s_q  := COALESCE(v_s_q,  ARRAY[]::uuid[]);
    v_ay_d := COALESCE(v_ay_d, ARRAY[]::double precision[]);
    v_f_d  := COALESCE(v_f_d,  ARRAY[]::double precision[]);
    v_s_d  := COALESCE(v_s_d,  ARRAY[]::double precision[]);

    ------------------------------------------------------------------
    -- Merge into 8 ranks per term (all-year shared across columns)
    ------------------------------------------------------------------
    v_fall_order := ARRAY[]::uuid[];
    v_spring_order := ARRAY[]::uuid[];
    v_ayi := 1; v_fi := 1; v_si := 1;

    FOR v_rank IN 1..8 LOOP
      v_next_ay_des := CASE
        WHEN v_ayi <= COALESCE(array_length(v_ay_q, 1), 0) THEN v_ay_d[v_ayi]
        ELSE -1
      END;
      v_next_sem_des := LEAST(
        CASE WHEN v_fi <= COALESCE(array_length(v_f_q, 1), 0) THEN v_f_d[v_fi] ELSE -1 END,
        CASE WHEN v_si <= COALESCE(array_length(v_s_q, 1), 0) THEN v_s_d[v_si] ELSE -1 END
      );

      IF v_next_ay_des < 0 THEN
        v_use_ay := false;
      ELSIF v_next_sem_des < 0 THEN
        v_use_ay := true;
      ELSE
        v_use_ay := v_next_ay_des >= v_next_sem_des;
      END IF;

      IF v_use_ay = false
         AND (COALESCE(array_length(v_ay_q, 1), 0) - v_ayi + 1) > (8 - v_rank) THEN
        v_use_ay := true;
      END IF;
      IF v_use_ay = true
         AND (COALESCE(array_length(v_f_q, 1), 0) - v_fi + 1) > (8 - v_rank)
         AND v_next_sem_des >= 0 THEN
        v_use_ay := false;
      END IF;

      IF v_use_ay AND v_ayi <= COALESCE(array_length(v_ay_q, 1), 0) THEN
        v_fall_order := array_append(v_fall_order, v_ay_q[v_ayi]);
        v_spring_order := array_append(v_spring_order, v_ay_q[v_ayi]);
        v_ayi := v_ayi + 1;
      ELSE
        IF v_fi <= COALESCE(array_length(v_f_q, 1), 0) THEN
          v_fall_order := array_append(v_fall_order, v_f_q[v_fi]);
          v_fi := v_fi + 1;
        END IF;
        IF v_si <= COALESCE(array_length(v_s_q, 1), 0) THEN
          v_spring_order := array_append(v_spring_order, v_s_q[v_si]);
          v_si := v_si + 1;
        END IF;
      END IF;
    END LOOP;

    -- Hard pad to 8 per column from catalog (never leave a student short).
    WHILE COALESCE(array_length(v_fall_order, 1), 0) < 8 LOOP
      SELECT c.id INTO v_cid
      FROM _catalog c
      WHERE c.is_fall
        AND v_grade = ANY (c.grade)
        AND NOT (c.id = ANY (v_fall_order))
      ORDER BY c.base_weight DESC, c.title
      LIMIT 1;
      EXIT WHEN v_cid IS NULL;
      v_fall_order := array_append(v_fall_order, v_cid);
    END LOOP;

    WHILE COALESCE(array_length(v_spring_order, 1), 0) < 8 LOOP
      SELECT c.id INTO v_cid
      FROM _catalog c
      WHERE c.is_spring
        AND v_grade = ANY (c.grade)
        AND NOT (c.id = ANY (v_spring_order))
      ORDER BY c.base_weight DESC, c.title
      LIMIT 1;
      EXIT WHEN v_cid IS NULL;
      v_spring_order := array_append(v_spring_order, v_cid);
    END LOOP;

    v_n_fall := COALESCE(array_length(v_fall_order, 1), 0);
    v_n_spring := COALESCE(array_length(v_spring_order, 1), 0);
    IF v_n_fall < 8 OR v_n_spring < 8 THEN
      RAISE EXCEPTION
        'Student % (grade %) could not fill 8 rankings (fall=%, spring=%). Catalog too thin.',
        v_email, v_grade, v_n_fall, v_n_spring;
    END IF;

    ------------------------------------------------------------------
    -- Bookmarks: every ranked course + a few alternates
    ------------------------------------------------------------------
    v_written := ARRAY[]::uuid[];
    FOR v_pref IN 1..v_n_fall LOOP
      v_bookmark := v_fall_order[v_pref];
      IF NOT (v_bookmark = ANY (v_written)) THEN
        INSERT INTO bookmarked_courses (course_id, student_id)
        VALUES (v_bookmark, v_student_id);
        v_written := array_append(v_written, v_bookmark);
      END IF;
    END LOOP;
    FOR v_pref IN 1..v_n_spring LOOP
      v_bookmark := v_spring_order[v_pref];
      IF NOT (v_bookmark = ANY (v_written)) THEN
        INSERT INTO bookmarked_courses (course_id, student_id)
        VALUES (v_bookmark, v_student_id);
        v_written := array_append(v_written, v_bookmark);
      END IF;
    END LOOP;

    v_alt := 2 + floor(pg_temp.rnd(i, 'altn') * 4)::int;
    FOR rec IN
      SELECT p.course_id
      FROM _picks p
      WHERE NOT (p.course_id = ANY (v_written))
      ORDER BY p.desire DESC, p.title
      LIMIT v_alt
    LOOP
      INSERT INTO bookmarked_courses (course_id, student_id)
      VALUES (rec.course_id, v_student_id);
      v_written := array_append(v_written, rec.course_id);
    END LOOP;

    ------------------------------------------------------------------
    -- Submitted rankings — ALWAYS submitted = true
    -- Mirror syncSubmittedCourses: Fall first, then Spring; all-year once.
    ------------------------------------------------------------------
    v_written := ARRAY[]::uuid[];
    FOR v_pref IN 1..8 LOOP
      v_cid := v_fall_order[v_pref];
      IF NOT (v_cid = ANY (v_written)) THEN
        INSERT INTO submitted_courses (course_id, student_id, preference, submitted)
        VALUES (v_cid, v_student_id, v_pref, true);
        v_written := array_append(v_written, v_cid);
      END IF;
    END LOOP;
    FOR v_pref IN 1..8 LOOP
      v_cid := v_spring_order[v_pref];
      IF NOT (v_cid = ANY (v_written)) THEN
        INSERT INTO submitted_courses (course_id, student_id, preference, submitted)
        VALUES (v_cid, v_student_id, v_pref, true);
        v_written := array_append(v_written, v_cid);
      END IF;
    END LOOP;

    IF pg_temp.rnd(i, 'note') < 0.12 THEN
      INSERT INTO submitted_notes (student_id, note)
      VALUES (
        v_student_id,
        CASE floor(pg_temp.rnd(i, 'notetext') * 4)::int
          WHEN 0 THEN 'Hoping to keep mornings free for research.'
          WHEN 1 THEN 'Please prioritize my top three choices if possible.'
          WHEN 2 THEN 'I need the yearlong math sequence to stay on track.'
          ELSE 'Open to swaps within the same department.'
        END
      );
    END IF;

  END LOOP;
END $$;

----------------------------------------------------------------------
-- 6. Verification — abort unless all 500 have full submitted rankings
----------------------------------------------------------------------
DO $$
DECLARE
  v_school_id uuid;
  v_students int;
  v_with_rankings int;
  v_submitted_rows int;
  v_draft_rows int;
  v_incomplete int;
  v_missing_bookmark int;
  v_allyear_dupes int;
  v_capped int;
  rec RECORD;
BEGIN
  SELECT school_id INTO v_school_id FROM _nueva_ctx;

  SELECT COUNT(*) INTO v_students
  FROM students
  WHERE school_id = v_school_id AND email ILIKE '%test@gmail.com';

  SELECT COUNT(DISTINCT sc.student_id) INTO v_with_rankings
  FROM submitted_courses sc
  JOIN students s ON s.id = sc.student_id
  WHERE s.school_id = v_school_id
    AND s.email ILIKE '%test@gmail.com'
    AND sc.submitted = true;

  SELECT COUNT(*) INTO v_submitted_rows
  FROM submitted_courses sc
  JOIN students s ON s.id = sc.student_id
  WHERE s.school_id = v_school_id AND s.email ILIKE '%test@gmail.com';

  SELECT COUNT(*) INTO v_draft_rows
  FROM submitted_courses sc
  JOIN students s ON s.id = sc.student_id
  WHERE s.school_id = v_school_id
    AND s.email ILIKE '%test@gmail.com'
    AND sc.submitted IS DISTINCT FROM true;

  SELECT COUNT(*) INTO v_incomplete
  FROM students s
  WHERE s.school_id = v_school_id
    AND s.email ILIKE '%test@gmail.com'
    AND (
      SELECT COUNT(*)
      FROM submitted_courses sc
      WHERE sc.student_id = s.id AND sc.submitted = true
    ) < 8;

  SELECT COUNT(*) INTO v_missing_bookmark
  FROM submitted_courses sc
  JOIN students s ON s.id = sc.student_id
  WHERE s.school_id = v_school_id
    AND s.email ILIKE '%test@gmail.com'
    AND NOT EXISTS (
      SELECT 1 FROM bookmarked_courses bc
      WHERE bc.student_id = sc.student_id AND bc.course_id = sc.course_id
    );

  SELECT COUNT(*) INTO v_allyear_dupes
  FROM (
    SELECT sc.student_id, sc.course_id
    FROM submitted_courses sc
    JOIN students s ON s.id = sc.student_id
    JOIN _catalog c ON c.id = sc.course_id
    WHERE s.school_id = v_school_id
      AND s.email ILIKE '%test@gmail.com'
      AND c.is_allyear
    GROUP BY sc.student_id, sc.course_id
    HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO v_capped
  FROM courses WHERE school_id = v_school_id AND max_student_count = 20;

  RAISE NOTICE '=== Nueva 500-student seed verification ===';
  RAISE NOTICE 'Students: %', v_students;
  RAISE NOTICE 'Students with submitted=true rankings: %', v_with_rankings;
  RAISE NOTICE 'submitted_courses rows: %', v_submitted_rows;
  RAISE NOTICE 'draft (submitted≠true) rows: %', v_draft_rows;
  RAISE NOTICE 'Students with <8 submitted rankings: %', v_incomplete;
  RAISE NOTICE 'Submitted rows missing bookmarks: %', v_missing_bookmark;
  RAISE NOTICE 'All-year duplicate submitted rows: %', v_allyear_dupes;
  RAISE NOTICE 'Courses capped at 20: %', v_capped;

  RAISE NOTICE '--- Students by grade ---';
  FOR rec IN
    SELECT grade, COUNT(*) AS n
    FROM students
    WHERE school_id = v_school_id AND email ILIKE '%test@gmail.com'
    GROUP BY grade
    ORDER BY grade
  LOOP
    RAISE NOTICE '  grade %: %', rec.grade, rec.n;
  END LOOP;

  RAISE NOTICE '--- Top 15 courses by ranking demand ---';
  FOR rec IN
    SELECT c.title,
           COUNT(DISTINCT sc.student_id) AS demand,
           COUNT(DISTINCT sc.student_id) FILTER (WHERE sc.preference = 1) AS first_choice
    FROM submitted_courses sc
    JOIN students s ON s.id = sc.student_id
    JOIN courses c ON c.id = sc.course_id
    WHERE s.school_id = v_school_id AND s.email ILIKE '%test@gmail.com'
    GROUP BY c.title
    ORDER BY demand DESC
    LIMIT 15
  LOOP
    RAISE NOTICE '  % — demand %, first-choice %',
      rec.title, rec.demand, rec.first_choice;
  END LOOP;

  IF v_students <> 500 THEN
    RAISE EXCEPTION 'Expected 500 students, got %', v_students;
  END IF;
  IF v_with_rankings <> 500 THEN
    RAISE EXCEPTION
      'Expected all 500 students to have submitted rankings, got %',
      v_with_rankings;
  END IF;
  IF v_draft_rows <> 0 THEN
    RAISE EXCEPTION 'Found % draft ranking rows (submitted must be true)', v_draft_rows;
  END IF;
  IF v_incomplete <> 0 THEN
    RAISE EXCEPTION '% students have fewer than 8 submitted rankings', v_incomplete;
  END IF;
  IF v_missing_bookmark <> 0 THEN
    RAISE EXCEPTION '% submitted rows are not bookmarked', v_missing_bookmark;
  END IF;
  IF v_allyear_dupes <> 0 THEN
    RAISE EXCEPTION 'Found duplicate all-year submitted rows';
  END IF;
  IF v_capped = 0 THEN
    RAISE EXCEPTION 'No courses were capped at 20';
  END IF;

  RAISE NOTICE 'Seed OK: 500 students, all with submitted=true rankings.';
END $$;

COMMIT;
