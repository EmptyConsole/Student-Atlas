-- RLS policies for submitted_notes
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)
--
-- The app uses the anon/publishable key without Supabase Auth, so these
-- policies mirror the permissive access used by submitted_courses and
-- other student junction tables.

ALTER TABLE submitted_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "anon_select_submitted_notes" ON submitted_notes;
DROP POLICY IF EXISTS "anon_insert_submitted_notes" ON submitted_notes;
DROP POLICY IF EXISTS "anon_update_submitted_notes" ON submitted_notes;
DROP POLICY IF EXISTS "anon_delete_submitted_notes" ON submitted_notes;

CREATE POLICY "anon_select_submitted_notes"
  ON submitted_notes FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_submitted_notes"
  ON submitted_notes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_submitted_notes"
  ON submitted_notes FOR UPDATE TO anon USING (true);

CREATE POLICY "anon_delete_submitted_notes"
  ON submitted_notes FOR DELETE TO anon USING (true);
