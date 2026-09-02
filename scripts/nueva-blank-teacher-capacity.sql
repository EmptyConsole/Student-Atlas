-- The Nueva School — clear teacher and max enrollment on all courses
--
-- Run in the Supabase SQL editor against an existing Nueva catalog.
--
-- Sets teacher_id to NULL and max_student_count to -1 (unknown / blank) for
-- every course row belonging to The Nueva School.
--
-- Idempotent: safe to re-run.

BEGIN;

UPDATE courses c
SET
  teacher_id = NULL,
  max_student_count = -1
FROM schools s
WHERE c.school_id = s.id
  AND s.name = $c$The Nueva School$c$;

COMMIT;
