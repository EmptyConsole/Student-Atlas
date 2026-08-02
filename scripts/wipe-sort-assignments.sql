-- Wipe elective-sort assignment data
--
-- Clears the two columns that `sort` / apply_elective_assignments write:
--   courses.students       (per-class rosters)
--   students.times_taken   (assigned schedule quads)
--
-- Does NOT touch rankings, bookmarks, completed courses, or the catalog.
--
-- Default target: The Nueva School. Change the name filter below to wipe
-- another school, or comment out the school filter to wipe ALL schools.
--
-- Safe to re-run. Wrapped in a transaction.

BEGIN;

DO $$
DECLARE
  v_school_id uuid;
  v_courses_cleared int;
  v_students_cleared int;
BEGIN
  SELECT id INTO v_school_id
  FROM schools
  WHERE name = 'The Nueva School'
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'The Nueva School not found.';
  END IF;

  UPDATE courses
  SET students = NULL
  WHERE school_id = v_school_id
    AND students IS NOT NULL;
  GET DIAGNOSTICS v_courses_cleared = ROW_COUNT;

  UPDATE students
  SET times_taken = NULL
  WHERE school_id = v_school_id
    AND times_taken IS NOT NULL;
  GET DIAGNOSTICS v_students_cleared = ROW_COUNT;

  RAISE NOTICE 'Wiped sort data for school %', v_school_id;
  RAISE NOTICE 'courses.students cleared on % row(s)', v_courses_cleared;
  RAISE NOTICE 'students.times_taken cleared on % row(s)', v_students_cleared;
END $$;

COMMIT;
