-- The Nueva School — course schedule seed
--
-- Adds `courses.schedule` (nullable integer[]) if missing, then populates it
-- for every Nueva course with 2-5 section offerings across 2 days.
--
-- Encoding: flat 2D integer[] of [day, start_minute, end_minute] triples,
-- ordered by day then start. Times are minutes from midnight (inclusive start,
-- exclusive end). Day is always 1 or 2 (positional, no weekday meaning).
--
-- Example:
--   ARRAY[[1,535,615],[2,535,615],[2,615,695]]
--   = block 1 on day 1; blocks 1 and 2 on day 2 (3 sections total).
--
-- Nueva daily blocks:
--   1: 8:55-10:15  -> (535, 615)
--   2: 10:15-11:35 -> (615, 695)
--   3: 12:35-1:55  -> (755, 835)
--   4: 1:55-3:15   -> (835, 915)
--
-- Section count is driven by the same popularity tiers used in
-- nueva-students.sql. Blocks are load-balanced catalog-wide and never
-- duplicated within a day.
--
-- Idempotent: re-running overwrites existing Nueva schedule values.
-- Wrapped in a transaction.

BEGIN;

----------------------------------------------------------------------
-- 0. Ensure the column exists
----------------------------------------------------------------------
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS schedule integer[];

----------------------------------------------------------------------
-- 1. Resolve school; abort if missing
----------------------------------------------------------------------
DO $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id
  FROM schools
  WHERE name = 'The Nueva School'
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION
      'The Nueva School not found. Run the Nueva catalog import scripts first.';
  END IF;
END $$;

DROP TABLE IF EXISTS _nueva_sched_ctx;
CREATE TEMP TABLE _nueva_sched_ctx ON COMMIT DROP AS
SELECT id AS school_id
FROM schools
WHERE name = 'The Nueva School'
LIMIT 1;

----------------------------------------------------------------------
-- 2. Helpers (temp — vanish at COMMIT)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.rnd_uuid(p_id uuid, salt text)
RETURNS double precision AS $fn$
  SELECT (('x' || substr(md5(p_id::text || ':' || salt), 1, 8))::bit(32)::bigint::double precision
          / 4294967296.0);
$fn$ LANGUAGE sql IMMUTABLE;

-- Copied from scripts/nueva-students.sql (pg_temp functions are session-scoped).
CREATE OR REPLACE FUNCTION pg_temp.popularity(p_title text, p_dept text)
RETURNS double precision AS $fn$
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

  IF p_title IN (
    'Adv. Clay Sculpture','Steel Drum Band','Number Theory','Semiconductor Processes',
    'Complex Analysis','Differential Equations','Abstract Algebra',
    'Geometries Beyond Euclid','Adv. Topics in Japanese',
    'Chinese Literature & Advanced Research',
    'Hit Harmonics: Studio Recording from Idea to Record','Groove Workshop',
    'Sound Experience','Film & Stage Prop Making','Film and Stage Costume Making',
    'Creature Comforts','All About Wearables','Architecture of Unbreakable Homes',
    'Sensory Neuroscience','Mechanisms of Cancer','Immunology','Drug Design',
    'Chemistry Consulting','Economic Thesis Seminar','Models of Group Decisions',
    'Advanced Probability','Math and Philosophy for Human Flourishing',
    'Core Mathematics Intensive X','Core Mathematics Intensive Y','Algebra Techniques',
    'Adv. Studio Art'
  ) THEN RETURN 0.45; END IF;

  IF p_dept IN ('Science','Math','Computer Science','English') THEN RETURN 1.4; END IF;
  IF p_dept IN ('History','Economics','Interdisciplinary') THEN RETURN 1.2; END IF;
  IF p_dept IN ('Performing Arts','Visual Arts','Engineering, Fabrication & Design') THEN
    RETURN 0.9;
  END IF;
  RETURN 1.0;
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.section_count(p_weight double precision)
RETURNS int AS $fn$
  SELECT CASE
    WHEN p_weight >= 3.5 THEN 5
    WHEN p_weight >= 2.2 THEN 4
    WHEN p_weight >= 0.9 THEN 3
    ELSE 2
  END;
$fn$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.block_start(p_block int)
RETURNS int AS $fn$
  SELECT CASE p_block
    WHEN 1 THEN 535
    WHEN 2 THEN 615
    WHEN 3 THEN 755
    WHEN 4 THEN 835
  END;
$fn$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION pg_temp.block_end(p_block int)
RETURNS int AS $fn$
  SELECT CASE p_block
    WHEN 1 THEN 615
    WHEN 2 THEN 695
    WHEN 3 THEN 835
    WHEN 4 THEN 915
  END;
$fn$ LANGUAGE sql IMMUTABLE;

----------------------------------------------------------------------
-- 3. Per-course section count + which day gets the larger share
----------------------------------------------------------------------
DROP TABLE IF EXISTS _course_n;
CREATE TEMP TABLE _course_n ON COMMIT DROP AS
SELECT
  c.id AS course_id,
  pg_temp.section_count(
    pg_temp.popularity(c.title, COALESCE(d.name, c.subject))
  ) AS n_sections,
  (pg_temp.rnd_uuid(c.id, 'dayflip') < 0.5) AS flip
FROM courses c
CROSS JOIN _nueva_sched_ctx ctx
LEFT JOIN departments d ON d.id = c.department_id
WHERE c.school_id = ctx.school_id;

----------------------------------------------------------------------
-- 4. Split across day 1 and day 2 (each day gets >= 1)
--    2 -> 1+1 | 3 -> 2+1 | 4 -> 2+2 | 5 -> 3+2
--    For odd totals, flip chooses which day receives the extra section.
----------------------------------------------------------------------
DROP TABLE IF EXISTS _day_groups;
CREATE TEMP TABLE _day_groups ON COMMIT DROP AS
SELECT
  course_id,
  1 AS day,
  CASE n_sections
    WHEN 2 THEN 1
    WHEN 3 THEN CASE WHEN flip THEN 2 ELSE 1 END
    WHEN 4 THEN 2
    WHEN 5 THEN CASE WHEN flip THEN 3 ELSE 2 END
  END AS cnt
FROM _course_n
UNION ALL
SELECT
  course_id,
  2 AS day,
  CASE n_sections
    WHEN 2 THEN 1
    WHEN 3 THEN CASE WHEN flip THEN 1 ELSE 2 END
    WHEN 4 THEN 2
    WHEN 5 THEN CASE WHEN flip THEN 2 ELSE 3 END
  END AS cnt
FROM _course_n;

----------------------------------------------------------------------
-- 5. Load-balanced block assignment
--    Deterministic global index per (course, day); consecutive wrapping
--    blocks from (index % 4) keep all 4 blocks near-equally loaded and
--    guarantee distinct blocks within a day.
----------------------------------------------------------------------
DROP TABLE IF EXISTS _day_groups_ranked;
CREATE TEMP TABLE _day_groups_ranked ON COMMIT DROP AS
SELECT
  course_id,
  day,
  cnt,
  ((row_number() OVER (ORDER BY md5(course_id::text || ':' || day::text)) - 1) % 4)
    AS start_offset
FROM _day_groups;

DROP TABLE IF EXISTS _sections;
CREATE TEMP TABLE _sections ON COMMIT DROP AS
SELECT
  g.course_id,
  g.day,
  b.block_num,
  pg_temp.block_start(b.block_num) AS start_min,
  pg_temp.block_end(b.block_num)   AS end_min
FROM _day_groups_ranked g
CROSS JOIN LATERAL (
  SELECT (((g.start_offset + j) % 4) + 1)::int AS block_num
  FROM generate_series(0, g.cnt - 1) AS j
) b;

----------------------------------------------------------------------
-- 6. Write schedule arrays
----------------------------------------------------------------------
UPDATE courses c
SET schedule = s.sched
FROM (
  SELECT
    course_id,
    array_agg(ARRAY[day, start_min, end_min] ORDER BY day, start_min) AS sched
  FROM _sections
  GROUP BY course_id
) s
WHERE c.id = s.course_id;

----------------------------------------------------------------------
-- 7. Verification
----------------------------------------------------------------------
DO $$
DECLARE
  v_school_id uuid;
  v_total int;
  v_bad_len int;
  v_bad_days int;
  v_bad_dupes int;
  v_bad_width int;
  v_bad_blocks int;
  rec record;
BEGIN
  SELECT school_id INTO v_school_id FROM _nueva_sched_ctx;

  SELECT COUNT(*) INTO v_total
  FROM courses
  WHERE school_id = v_school_id;

  -- Section count must be 2..5
  SELECT COUNT(*) INTO v_bad_len
  FROM courses
  WHERE school_id = v_school_id
    AND (
      schedule IS NULL
      OR array_length(schedule, 1) IS NULL
      OR array_length(schedule, 1) < 2
      OR array_length(schedule, 1) > 5
    );

  -- Exactly days {1,2}, each with >= 1 section (distinct day values = 2
  -- and both values present implies min 1 per day)
  SELECT COUNT(*) INTO v_bad_days
  FROM (
    SELECT c.id
    FROM courses c
    CROSS JOIN LATERAL generate_series(1, array_length(c.schedule, 1)) AS i
    WHERE c.school_id = v_school_id
    GROUP BY c.id
    HAVING COUNT(DISTINCT c.schedule[i][1]) <> 2
        OR bool_and(c.schedule[i][1] IN (1, 2)) IS NOT TRUE
  ) bad;

  -- No duplicate (day, start_min) within a course (= no same block twice)
  SELECT COUNT(*) INTO v_bad_dupes
  FROM (
    SELECT c.id, c.schedule[i][1] AS day, c.schedule[i][2] AS start_min
    FROM courses c
    CROSS JOIN LATERAL generate_series(1, array_length(c.schedule, 1)) AS i
    WHERE c.school_id = v_school_id
    GROUP BY c.id, c.schedule[i][1], c.schedule[i][2]
    HAVING COUNT(*) > 1
  ) bad;

  -- Inner width exactly 3
  SELECT COUNT(*) INTO v_bad_width
  FROM courses
  WHERE school_id = v_school_id
    AND (
      array_ndims(schedule) <> 2
      OR array_length(schedule, 2) IS DISTINCT FROM 3
    );

  -- Every start/end pair must be one of the four known blocks
  SELECT COUNT(*) INTO v_bad_blocks
  FROM (
    SELECT c.id, c.schedule[i][2] AS start_min, c.schedule[i][3] AS end_min
    FROM courses c
    CROSS JOIN LATERAL generate_series(1, array_length(c.schedule, 1)) AS i
    WHERE c.school_id = v_school_id
      AND NOT (
        (c.schedule[i][2], c.schedule[i][3]) IN (
          (535, 615), (615, 695), (755, 835), (835, 915)
        )
      )
  ) bad;

  RAISE NOTICE 'Nueva courses updated: %', v_total;
  RAISE NOTICE '--- Courses by section count ---';
  FOR rec IN
    SELECT array_length(schedule, 1) AS n, COUNT(*) AS cnt
    FROM courses
    WHERE school_id = v_school_id
    GROUP BY array_length(schedule, 1)
    ORDER BY 1
  LOOP
    RAISE NOTICE '  % sections: % courses', rec.n, rec.cnt;
  END LOOP;

  RAISE NOTICE '--- Sections per block (catalog-wide) ---';
  FOR rec IN
    SELECT
      CASE s.start_min
        WHEN 535 THEN 1
        WHEN 615 THEN 2
        WHEN 755 THEN 3
        WHEN 835 THEN 4
      END AS block_num,
      s.start_min,
      s.end_min,
      COUNT(*) AS sections
    FROM courses c
    CROSS JOIN LATERAL (
      SELECT c.schedule[i][2] AS start_min, c.schedule[i][3] AS end_min
      FROM generate_series(1, array_length(c.schedule, 1)) AS i
    ) s
    WHERE c.school_id = v_school_id
    GROUP BY s.start_min, s.end_min
    ORDER BY 1
  LOOP
    RAISE NOTICE '  block % (%-%): % sections',
      rec.block_num, rec.start_min, rec.end_min, rec.sections;
  END LOOP;

  IF v_bad_len > 0 THEN
    RAISE EXCEPTION '% courses have schedule length outside 2..5 (or NULL)', v_bad_len;
  END IF;
  IF v_bad_days > 0 THEN
    RAISE EXCEPTION '% courses do not have exactly 2 distinct days', v_bad_days;
  END IF;
  IF v_bad_dupes > 0 THEN
    RAISE EXCEPTION '% courses have duplicate (day, block) pairs', v_bad_dupes;
  END IF;
  IF v_bad_width > 0 THEN
    RAISE EXCEPTION '% courses have schedule inner width <> 3', v_bad_width;
  END IF;
  IF v_bad_blocks > 0 THEN
    RAISE EXCEPTION '% schedule triples use unrecognized block times', v_bad_blocks;
  END IF;

  RAISE NOTICE 'Schedule seed OK.';
END $$;

COMMIT;
