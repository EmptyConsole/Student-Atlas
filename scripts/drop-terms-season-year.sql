-- Drop legacy terms.season and terms.year columns
--
-- The app orders and displays terms by name + position only. season/year were
-- holdovers from the old fixed Fall/Spring enum and enforced a UNIQUE
-- (school_id, season, year) constraint that blocked multiple custom terms per
-- school (e.g. three trimesters).
--
-- Run this before scripts/test-school.sql (or any seed that inserts multiple
-- terms for one school). Safe to re-run: uses IF EXISTS throughout.

BEGIN;

ALTER TABLE terms DROP CONSTRAINT IF EXISTS terms_unique;

ALTER TABLE terms DROP COLUMN IF EXISTS season;
ALTER TABLE terms DROP COLUMN IF EXISTS year;

COMMIT;
