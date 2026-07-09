-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.schools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  password text NOT NULL DEFAULT ''::text,
  CONSTRAINT schools_pkey PRIMARY KEY (id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  short_description text NOT NULL,
  long_description text NOT NULL,
  grade ARRAY NOT NULL,
  term text NOT NULL,
  subject text NOT NULL,
  school_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  term_id uuid,
  teacher_id uuid,
  department_id uuid,
  retakeable boolean NOT NULL DEFAULT false,
  custom_prereq text NOT NULL DEFAULT ''::text,
  custom_coreq text NOT NULL DEFAULT ''::text,
  or_prereq boolean NOT NULL DEFAULT false,
  or_coreq boolean NOT NULL DEFAULT false,
  prereq_options ARRAY,
  coreq_options ARRAY,
  max_student_count smallint NOT NULL DEFAULT '-1'::smallint,
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT courses_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.terms(id),
  CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT courses_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.students (
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  grade smallint,
  school_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  graduation_year bigint,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.completed_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  CONSTRAINT completed_courses_pkey PRIMARY KEY (id),
  CONSTRAINT completed_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT completed_courses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.enrolled_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  CONSTRAINT enrolled_courses_pkey PRIMARY KEY (id),
  CONSTRAINT enrolled_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT enrolled_courses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.bookmarked_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  CONSTRAINT bookmarked_courses_pkey PRIMARY KEY (id),
  CONSTRAINT bookmarked_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT bookmarked_courses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.course_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  note text NOT NULL,
  CONSTRAINT course_notes_pkey PRIMARY KEY (id),
  CONSTRAINT course_notes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.graduation_requirements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  school_id uuid NOT NULL,
  course_id uuid NOT NULL,
  must_complete_by_grade smallint,
  must_complete_before_graduation boolean,
  recommended_grade smallint,
  CONSTRAINT graduation_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT graduation_requirements_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT graduation_requirements_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.course_prerequisites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  prerequisite_course_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_prerequisites_pkey PRIMARY KEY (id),
  CONSTRAINT course_prerequisites_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_prerequisites_prerequisite_course_id_fkey FOREIGN KEY (prerequisite_course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.course_corequisites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  corequisite_course_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT course_corequisites_pkey PRIMARY KEY (id),
  CONSTRAINT course_corequisites_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_corequisites_corequisite_course_id_fkey FOREIGN KEY (corequisite_course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.terms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  season text NOT NULL,
  year smallint NOT NULL,
  start_date date,
  end_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT terms_pkey PRIMARY KEY (id),
  CONSTRAINT terms_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.teachers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  department text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teachers_pkey PRIMARY KEY (id),
  CONSTRAINT teachers_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  graduation_requirement text NOT NULL DEFAULT ''::text,
  subtitle text DEFAULT ''::text,
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.submitted_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  preference smallint,
  submitted boolean,
  CONSTRAINT submitted_courses_pkey PRIMARY KEY (id),
  CONSTRAINT submitted_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT submitted_courses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.submitted_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  student_id uuid,
  note text,
  CONSTRAINT submitted_notes_pkey PRIMARY KEY (id),
  CONSTRAINT submitted_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);