-- Per-grade elective settings (schools.grade)
--
-- Adds:
--   schools.grade  jsonb  — per-grade ranking/assignment counts
--
-- Shape, keyed by grade number with string-valued counts:
--   {
--     "9":  {"rankings": "8",  "assigned": "2"},
--     "10": {"rankings": "8",  "assigned": "2"},
--     "11": {"rankings": "9",  "assigned": "3"},
--     "12": {"rankings": "12", "assigned": "6"}
--   }
--
--   "rankings" — how many courses a student in that grade must rank per term.
--                Overrides schools.rankings.
--   "assigned" — how many elective seats the sort gives them per term.
--                Overrides schools.electives_assigned.
--
-- A grade absent from the object falls back to those two columns, so schools
-- with grade = NULL keep behaving exactly as before. Section 2 backfills
-- grades 9-12 from the current column values; section 3 sets Nueva's counts.
--
-- Idempotent: re-running is safe. Wrapped in a transaction.

BEGIN;

----------------------------------------------------------------------
-- 0. DDL
----------------------------------------------------------------------
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS grade jsonb;

COMMENT ON COLUMN public.schools.grade IS
  'Per-grade elective settings: {"<grade>": {"rankings": "<n>", "assigned": "<n>"}}. '
  'Grades absent here fall back to schools.rankings / schools.electives_assigned.';

----------------------------------------------------------------------
-- 1. Backfill grades 9-12 from the existing school-wide columns
--
-- Only touches schools that have no per-grade settings yet, so hand-tuned
-- values are never overwritten.
----------------------------------------------------------------------
UPDATE schools
SET grade = (
  SELECT jsonb_object_agg(
    g::text,
    jsonb_build_object(
      'rankings', rankings::text,
      'assigned', electives_assigned::text
    )
  )
  FROM generate_series(9, 12) AS g
)
WHERE grade IS NULL;

----------------------------------------------------------------------
-- 2. Nueva: 2 electives in 9/10, 3 in 11, 6 in 12
----------------------------------------------------------------------
UPDATE schools
SET grade = jsonb_build_object(
  '9',  jsonb_build_object('rankings', '8',  'assigned', '2'),
  '10', jsonb_build_object('rankings', '8',  'assigned', '2'),
  '11', jsonb_build_object('rankings', '9',  'assigned', '3'),
  '12', jsonb_build_object('rankings', '12', 'assigned', '6')
)
WHERE name = 'The Nueva School';

----------------------------------------------------------------------
-- 3. Verify
----------------------------------------------------------------------
DO $$
DECLARE
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing FROM schools WHERE grade IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Backfill missed % school(s)', v_missing;
  END IF;
END $$;

COMMIT;

-- Inspect the result:
--   SELECT name, rankings, electives_assigned, jsonb_pretty(grade) FROM schools;
