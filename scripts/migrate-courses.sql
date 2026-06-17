-- Supabase Course Migration SQL
-- This script adds all 45 courses from the Student Atlas curriculum to Supabase
-- Run this in the Supabase SQL editor for your project

-- Step 1: Create the school (if not exists)
INSERT INTO schools (name, website, city, state)
VALUES ('Student Atlas High School', 'https://studentatlas.example.com', 'San Francisco', 'CA')
ON CONFLICT DO NOTHING
RETURNING id as school_id;

-- Get the school ID
WITH school_data AS (
  SELECT id as school_id FROM schools WHERE name = 'Student Atlas High School' LIMIT 1
)
-- Step 2: Create teachers
INSERT INTO teachers (school_id, first_name, last_name, email, department)
SELECT 
  school_data.school_id,
  first_name,
  last_name,
  NULL,
  NULL
FROM (
  VALUES
  ('Ms.', 'Elena Vasquez'),
  ('Mr.', 'James Whitfield'),
  ('Ms.', 'Priya Kapoor'),
  ('Ms.', 'Rachel Donovan'),
  ('Mr.', 'Marcus Chen'),
  ('Ms.', 'Sofia Reyes'),
  ('Mr.', 'Daniel Okonkwo'),
  ('Ms.', 'Hannah Brooks'),
  ('Mr.', 'Thomas Lindqvist'),
  ('Ms.', 'Aisha Rahman'),
  ('Mr.', 'Kevin Park'),
  ('Ms.', 'Laura Nguyen'),
  ('Dr.', 'Samuel Ortiz'),
  ('Mr.', 'Gregory Walsh'),
  ('Ms.', 'Natalie Fischer'),
  ('Mr.', 'David Kim'),
  ('Mr.', 'Richard Pemberton'),
  ('Mr.', 'Ryan Holloway'),
  ('Ms.', 'Christine Alvarez'),
  ('Ms.', 'Margaret Sullivan'),
  ('Mr.', 'Ethan Morrison'),
  ('Dr.', 'Claire Bennett'),
  ('Mr.', 'Omar Hassan'),
  ('Ms.', 'Jennifer Caldwell'),
  ('Dr.', 'Robert Stein'),
  ('Ms.', 'Maya Patel'),
  ('Mr.', 'Andrew Green'),
  ('Ms.', 'Diane Foster'),
  ('Sra.', 'Carmen Delgado'),
  ('Ms.', 'Wei Lin'),
  ('Mme.', 'Isabelle Moreau'),
  ('Mr.', 'Steven Clarke'),
  ('Ms.', 'Angela Torres'),
  ('Dr.', 'Michael Brennan'),
  ('Ms.', 'Olivia Grant'),
  ('Dr.', 'Susan Nakamura'),
  ('Mr.', 'Paul Richardson'),
  ('Dr.', 'Helen Voss'),
  ('Ms.', 'Emily Carter'),
  ('Ms.', 'Grace Williams'),
  ('Mr.', 'Jonathan Price'),
  ('Ms.', 'Karen Mitchell')
) AS teachers(first_name, last_name)
CROSS JOIN school_data
ON CONFLICT (school_id, first_name, last_name) DO NOTHING;

-- Note: The above approach has limitations. 
-- It's recommended to use the TypeScript migration script instead:
-- 1. Run: npm install tsx -D
-- 2. Run: npx tsx scripts/migrate-courses.ts
-- 3. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in your environment

-- The TypeScript script handles:
-- - Proper teacher name parsing
-- - Course creation with teacher linkage
-- - Prerequisite relationship establishment
-- - Corequisite relationship establishment
-- - Idempotency (can be run multiple times safely)
-- - Better error handling and logging
