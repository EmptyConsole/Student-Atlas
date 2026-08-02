-- Assignment columns + reorder_terms RPC
--
-- Adds:
--   courses.students          text[]     — self-describing per-class rosters
--   students.times_taken      integer[]  — flat [term_rank, day, start, end] quads
--   schools.electives_assigned integer   — NOT NULL DEFAULT 0
--
-- Sets electives_assigned = 2 for The Nueva School.
--
-- Also creates public.reorder_terms(school_id, ordered_term_ids) which
-- atomically remaps students.times_taken term ranks, then writes 0-based
-- terms.position values. Call this instead of updating position row-by-row.
--
-- Encoding notes
-- --------------
-- courses.students: each element is 'day,start,end|uuid1,uuid2,...'
--   The part before '|' matches a row of courses.schedule. A class with no
--   roster yet simply has no entry, so adding a class time to schedule
--   requires no edit here. Left NULL by this script.
--
-- students.times_taken: flat 2D integer[] of [term_rank, day, start, end]
--   ordered by term then day then start. term_rank is the 1-based rank in
--   register display order (position ASC NULLS LAST, created_at ASC).
--   Left NULL by this script.
--
-- Idempotent: re-running is safe (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE
-- FUNCTION, electives_assigned re-set to 2). Wrapped in a transaction.

BEGIN;

----------------------------------------------------------------------
-- 0. DDL
----------------------------------------------------------------------
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS students text[];

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS times_taken integer[];

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS electives_assigned integer NOT NULL DEFAULT 0;

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

----------------------------------------------------------------------
-- 2. Set electives_assigned for Nueva
----------------------------------------------------------------------
UPDATE schools
SET electives_assigned = 2
WHERE name = 'The Nueva School';

----------------------------------------------------------------------
-- 3. Permanent reorder_terms function
--
-- Remap must happen BEFORE positions are overwritten, so old ranks are
-- still readable from the current position/created_at order.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_terms(
  p_school_id uuid,
  p_ordered_term_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $fn$
DECLARE
  v_school_count int;
  v_arg_count int;
  v_matched int;
BEGIN
  IF p_ordered_term_ids IS NULL THEN
    RAISE EXCEPTION 'p_ordered_term_ids must not be null';
  END IF;

  SELECT COUNT(*) INTO v_school_count
  FROM terms
  WHERE school_id = p_school_id;

  v_arg_count := COALESCE(cardinality(p_ordered_term_ids), 0);

  IF v_arg_count <> v_school_count THEN
    RAISE EXCEPTION
      'reorder_terms: expected % term ids for school %, got %',
      v_school_count, p_school_id, v_arg_count;
  END IF;

  SELECT COUNT(*) INTO v_matched
  FROM terms t
  WHERE t.school_id = p_school_id
    AND t.id = ANY (p_ordered_term_ids);

  IF v_matched <> v_school_count THEN
    RAISE EXCEPTION
      'reorder_terms: p_ordered_term_ids must cover exactly the terms of school %',
      p_school_id;
  END IF;

  -- Remap times_taken using the OLD display order before positions change.
  WITH old_ranks AS (
    SELECT
      t.id AS term_id,
      row_number() OVER (
        ORDER BY t.position ASC NULLS LAST, t.created_at ASC
      )::int AS old_rank
    FROM terms t
    WHERE t.school_id = p_school_id
  ),
  new_ranks AS (
    SELECT
      o.id AS term_id,
      o.ord::int AS new_rank
    FROM unnest(p_ordered_term_ids) WITH ORDINALITY AS o(id, ord)
  ),
  map AS (
    SELECT
      old_ranks.old_rank,
      new_ranks.new_rank
    FROM old_ranks
    JOIN new_ranks ON new_ranks.term_id = old_ranks.term_id
  ),
  remapped AS (
    SELECT
      st.id,
      array_agg(
        ARRAY[
          m.new_rank,
          st.times_taken[i][2],
          st.times_taken[i][3],
          st.times_taken[i][4]
        ]
        ORDER BY m.new_rank, st.times_taken[i][2], st.times_taken[i][3]
      ) AS times_taken
    FROM students st
    CROSS JOIN LATERAL generate_series(1, array_length(st.times_taken, 1)) AS i
    JOIN map m ON m.old_rank = st.times_taken[i][1]
    WHERE st.school_id = p_school_id
      AND st.times_taken IS NOT NULL
      AND array_length(st.times_taken, 1) IS NOT NULL
    GROUP BY st.id
  )
  UPDATE students s
  SET times_taken = r.times_taken
  FROM remapped r
  WHERE s.id = r.id;

  -- Write 0-based positions (matches prior reorderTerms behavior).
  UPDATE terms t
  SET position = (o.ord - 1)::smallint
  FROM unnest(p_ordered_term_ids) WITH ORDINALITY AS o(id, ord)
  WHERE t.id = o.id
    AND t.school_id = p_school_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.reorder_terms(uuid, uuid[]) TO anon, authenticated;

----------------------------------------------------------------------
-- 4. Verification
----------------------------------------------------------------------
DO $$
DECLARE
  v_assigned int;
  v_students_type text;
  v_times_type text;
  v_electives_type text;
BEGIN
  SELECT electives_assigned INTO v_assigned
  FROM schools
  WHERE name = 'The Nueva School'
  LIMIT 1;

  IF v_assigned IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION
      'Expected electives_assigned = 2 for The Nueva School, got %',
      v_assigned;
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_students_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'courses'
    AND a.attname = 'students'
    AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_times_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'students'
    AND a.attname = 'times_taken'
    AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_electives_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'schools'
    AND a.attname = 'electives_assigned'
    AND NOT a.attisdropped;

  IF v_students_type IS NULL OR v_times_type IS NULL OR v_electives_type IS NULL THEN
    RAISE EXCEPTION 'One or more new columns are missing';
  END IF;

  RAISE NOTICE 'courses.students type: %', v_students_type;
  RAISE NOTICE 'students.times_taken type: %', v_times_type;
  RAISE NOTICE 'schools.electives_assigned type: %', v_electives_type;
  RAISE NOTICE 'The Nueva School electives_assigned: %', v_assigned;
  RAISE NOTICE 'Assignment columns seed OK.';
END $$;

COMMIT;
