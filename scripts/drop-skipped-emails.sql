-- Undo skipped_emails (from the Resend skip feature).
-- Run in the Supabase SQL Editor if you already created that table.
-- Safe to run even if the table does not exist.

DROP TABLE IF EXISTS public.skipped_emails;
