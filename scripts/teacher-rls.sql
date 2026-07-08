-- RLS policies for the teacher editing flow (/teacher)
-- Run this in the Supabase SQL Editor (Dashboard -> SQL -> New query)
--
-- The app uses the anon/publishable key without Supabase Auth. The teacher flow
-- gates writes behind a per-school password checked client-side, so these
-- policies simply allow the anon role to insert/update/delete the catalog
-- tables. Without them, teacher writes silently fail under RLS.
--
-- SELECT policies are assumed to already exist (the student app reads these
-- tables). Re-running is safe: existing policies are dropped first.

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_schools" ON schools;
DROP POLICY IF EXISTS "anon_insert_schools" ON schools;
DROP POLICY IF EXISTS "anon_update_schools" ON schools;
DROP POLICY IF EXISTS "anon_delete_schools" ON schools;

CREATE POLICY "anon_select_schools" ON schools FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_schools" ON schools FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_schools" ON schools FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_schools" ON schools FOR DELETE TO anon USING (true);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_departments" ON departments;
DROP POLICY IF EXISTS "anon_insert_departments" ON departments;
DROP POLICY IF EXISTS "anon_update_departments" ON departments;
DROP POLICY IF EXISTS "anon_delete_departments" ON departments;

CREATE POLICY "anon_select_departments" ON departments FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_departments" ON departments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_departments" ON departments FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_departments" ON departments FOR DELETE TO anon USING (true);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_courses" ON courses;
DROP POLICY IF EXISTS "anon_insert_courses" ON courses;
DROP POLICY IF EXISTS "anon_update_courses" ON courses;
DROP POLICY IF EXISTS "anon_delete_courses" ON courses;

CREATE POLICY "anon_select_courses" ON courses FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_courses" ON courses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_courses" ON courses FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_courses" ON courses FOR DELETE TO anon USING (true);

-- ---------------------------------------------------------------------------
-- teachers
-- ---------------------------------------------------------------------------
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_teachers" ON teachers;
DROP POLICY IF EXISTS "anon_insert_teachers" ON teachers;
DROP POLICY IF EXISTS "anon_update_teachers" ON teachers;
DROP POLICY IF EXISTS "anon_delete_teachers" ON teachers;

CREATE POLICY "anon_select_teachers" ON teachers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_teachers" ON teachers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_teachers" ON teachers FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_teachers" ON teachers FOR DELETE TO anon USING (true);
