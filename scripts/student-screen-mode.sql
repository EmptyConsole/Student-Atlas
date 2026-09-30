-- Per-student light/dark preference (students.screen_mode)
--
-- Adds:
--   students.screen_mode  text  NOT NULL DEFAULT 'default'
--
-- Values:
--   'light'   — always the light theme
--   'dark'    — always the dark theme
--   'default' — follow the device's prefers-color-scheme
--
-- The column is written from the Profile page through /api/student
-- (action "saveProfile" / "createStudent") with the service role. The anon
-- role has no access to students at all (scripts/student-rls.sql), so no
-- policy changes are needed here.
--
-- Idempotent: re-running is safe. Wrapped in a transaction.

BEGIN;

----------------------------------------------------------------------
-- 0. DDL
----------------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS screen_mode text NOT NULL DEFAULT 'default';

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_screen_mode_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_screen_mode_check
  CHECK (screen_mode IN ('light', 'dark', 'default'));

COMMENT ON COLUMN public.students.screen_mode IS
  'Theme preference: light, dark, or default (follow the device setting).';

----------------------------------------------------------------------
-- 1. Verify
----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'students'
      AND column_name = 'screen_mode'
  ) THEN
    RAISE EXCEPTION 'students.screen_mode was not created';
  END IF;

  RAISE NOTICE 'students.screen_mode OK.';
END $$;

COMMIT;

-- Inspect the result:
--   SELECT screen_mode, count(*) FROM students GROUP BY screen_mode;
