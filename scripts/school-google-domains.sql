-- Google sign-in domains per school (schools.google_domains)
--
-- Adds:
--   schools.google_domains  text[]  - Google Workspace domains (the ID token's
--                                     `hd` claim) whose students may use
--                                     Sign in with Google. Empty = Google off.
--
-- Stored lowercase with no "@"; /api/teacher-mutate and /api/teacher-login
-- normalize before writing. Not secret: anon SELECT on schools is fine, and
-- the student app reads it to decide whether to show the button.
--
-- Idempotent: re-running is safe. Wrapped in a transaction.

BEGIN;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS google_domains text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.schools.google_domains IS
  'Google Workspace domains (hd claim) allowed for student Google sign-in. '
  'Lowercase, no "@". Empty array disables Google sign-in for the school.';

COMMIT;

-- Inspect:
--   SELECT name, google_domains FROM schools ORDER BY name;
-- Set by hand if needed:
--   UPDATE schools SET google_domains = ARRAY['myschool.org'] WHERE name = '...';
