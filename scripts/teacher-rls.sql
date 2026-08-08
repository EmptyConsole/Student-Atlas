-- RLS policies for the catalog tables read by the student app (/) and the
-- teacher editor (/teacher)
-- Run this in the Supabase SQL Editor (Dashboard -> SQL -> New query)
--
-- The browser uses the anon/publishable key and may only READ these tables.
-- Teacher writes go through /api/teacher-mutate, which authenticates a signed
-- session token and then writes with the service role key (bypassing RLS).
-- See scripts/teacher-auth.sql for the password hashing and grant revocations
-- that back that flow; this file only maintains the read policies.
--
-- Re-running is safe: existing policies are dropped first.

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_schools" ON schools;
DROP POLICY IF EXISTS "anon_insert_schools" ON schools;
DROP POLICY IF EXISTS "anon_update_schools" ON schools;
DROP POLICY IF EXISTS "anon_delete_schools" ON schools;

CREATE POLICY "anon_select_schools" ON schools FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_departments" ON departments;
DROP POLICY IF EXISTS "anon_insert_departments" ON departments;
DROP POLICY IF EXISTS "anon_update_departments" ON departments;
DROP POLICY IF EXISTS "anon_delete_departments" ON departments;

CREATE POLICY "anon_select_departments" ON departments FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_courses" ON courses;
DROP POLICY IF EXISTS "anon_insert_courses" ON courses;
DROP POLICY IF EXISTS "anon_update_courses" ON courses;
DROP POLICY IF EXISTS "anon_delete_courses" ON courses;

CREATE POLICY "anon_select_courses" ON courses FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- teachers
-- ---------------------------------------------------------------------------
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_teachers" ON teachers;
DROP POLICY IF EXISTS "anon_insert_teachers" ON teachers;
DROP POLICY IF EXISTS "anon_update_teachers" ON teachers;
DROP POLICY IF EXISTS "anon_delete_teachers" ON teachers;

CREATE POLICY "anon_select_teachers" ON teachers FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- terms
-- ---------------------------------------------------------------------------
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_terms" ON terms;
DROP POLICY IF EXISTS "anon_insert_terms" ON terms;
DROP POLICY IF EXISTS "anon_update_terms" ON terms;
DROP POLICY IF EXISTS "anon_delete_terms" ON terms;

CREATE POLICY "anon_select_terms" ON terms FOR SELECT TO anon, authenticated USING (true);
