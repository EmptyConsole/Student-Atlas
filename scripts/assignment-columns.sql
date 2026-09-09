-- Elective / assignment columns + reorder_terms RPC
--
-- School-agnostic schema migration. Run this on a fresh Supabase project
-- BEFORE scripts/teacher-auth.sql, which revokes grants on reorder_terms and
-- therefore expects the function to already exist.
--
-- Adds:
--   courses.term_options       uuid[]     — terms.id values this offering runs in
--   courses.schedule           integer[]  — flat [day, start, end] triples
--   courses.students           text[]     — self-describing per-class rosters
--   students.times_taken       integer[]  — flat [term_rank, day, start, end] quads
--   schools.electives_assigned integer    — NOT NULL DEFAULT 0
--   terms.position             smallint   — register display order
--
-- Also creates public.reorder_terms(school_id, ordered_term_ids), which
-- atomically remaps students.times_taken term ranks and then writes 0-based
-- terms.position values. Call this instead of updating position row-by-row,
-- otherwise already-assigned schedules end up pointing at the wrong term.
--
-- Encoding notes
-- --------------
-- courses.schedule: flat 2D integer[] of [day, start_minute, end_minute]
--   triples, ordered by day then start. Minutes are from midnight, start
--   inclusive and end exclusive. `day` is a rotation-day index, not a weekday.
--   Each triple is one section with its own capacity.
--
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
-- FUNCTION). Wrapped in a transaction.

BEGIN;

----------------------------------------------------------------------
-- 0. DDL
----------------------------------------------------------------------
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS term_options uuid[];

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS schedule integer[];

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS students text[];

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS times_taken integer[];

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS electives_assigned integer NOT NULL DEFAULT 0;

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS position smallint;

----------------------------------------------------------------------
-- 1. Permanent reorder_terms function
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

----------------------------------------------------------------------
-- 2. Grants
--
-- Term reordering is a catalog write, so it runs server-side with the
-- service role via /api/teacher-mutate. The browser must not call it.
-- scripts/teacher-auth.sql re-asserts this revoke; keeping it here means a
-- fresh project is never briefly exposed.
----------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.reorder_terms(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_terms(uuid, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_terms(uuid, uuid[]) TO service_role;

----------------------------------------------------------------------
-- 3. Verification
----------------------------------------------------------------------
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(x.tbl || '.' || x.col, ', ')
  INTO v_missing
  FROM (VALUES
    ('courses',  'term_options'),
    ('courses',  'schedule'),
    ('courses',  'students'),
    ('students', 'times_taken'),
    ('schools',  'electives_assigned'),
    ('terms',    'position')
  ) AS x(tbl, col)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns ic
    WHERE ic.table_schema::text = 'public'
      AND ic.table_name::text = x.tbl
      AND ic.column_name::text = x.col
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing columns after migration: %', v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'reorder_terms'
  ) THEN
    RAISE EXCEPTION 'public.reorder_terms was not created';
  END IF;

  RAISE NOTICE 'Assignment columns + reorder_terms OK.';
END $$;

COMMIT;
