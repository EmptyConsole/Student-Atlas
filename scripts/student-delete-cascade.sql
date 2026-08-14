-- Make deleting a student cascade to all of their data (bookmarks, completed/
-- enrolled courses, notes, submissions). Without this, the child FKs block the
-- students delete and a partial app-side cleanup can leave orphaned rows.
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.bookmarked_courses
  DROP CONSTRAINT IF EXISTS bookmarked_courses_student_id_fkey,
  ADD CONSTRAINT bookmarked_courses_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.completed_courses
  DROP CONSTRAINT IF EXISTS completed_courses_student_id_fkey,
  ADD CONSTRAINT completed_courses_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.enrolled_courses
  DROP CONSTRAINT IF EXISTS enrolled_courses_student_id_fkey,
  ADD CONSTRAINT enrolled_courses_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.course_notes
  DROP CONSTRAINT IF EXISTS course_notes_student_id_fkey,
  ADD CONSTRAINT course_notes_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.submitted_courses
  DROP CONSTRAINT IF EXISTS submitted_courses_student_id_fkey,
  ADD CONSTRAINT submitted_courses_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.submitted_notes
  DROP CONSTRAINT IF EXISTS submitted_notes_student_id_fkey,
  ADD CONSTRAINT submitted_notes_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
