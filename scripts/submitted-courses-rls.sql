-- RLS policies for submitted_courses
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)
--
-- The app uses the anon/publishable key without Supabase Auth, so these
-- policies mirror the permissive access used by bookmarked_courses and
-- other student junction tables.

ALTER TABLE submitted_courses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "anon_select_submitted_courses" ON submitted_courses;
DROP POLICY IF EXISTS "anon_insert_submitted_courses" ON submitted_courses;
DROP POLICY IF EXISTS "anon_update_submitted_courses" ON submitted_courses;
DROP POLICY IF EXISTS "anon_delete_submitted_courses" ON submitted_courses;

CREATE POLICY "anon_select_submitted_courses"
  ON submitted_courses FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_submitted_courses"
  ON submitted_courses FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_submitted_courses"
  ON submitted_courses FOR UPDATE TO anon USING (true);

CREATE POLICY "anon_delete_submitted_courses"
  ON submitted_courses FOR DELETE TO anon USING (true);
