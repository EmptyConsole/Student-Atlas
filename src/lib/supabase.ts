import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey
);

/*
SUPABASE DATABASE SCHEMA

schools
-------
id: uuid (PK)
name: text
website: text
city: text
state: text
created_at: timestamptz

Relationships:
- has many departments
- has many teachers
- has many students
- has many terms
- has many courses


departments
-----------
id: uuid (PK)
school_id: uuid (FK -> schools.id)
name: text
code: text
created_at: timestamptz

Relationships:
- belongs to school
- has many courses


teachers
--------
id: uuid (PK)
school_id: uuid (FK -> schools.id)
first_name: text
last_name: text
email: text
department: text
created_at: timestamptz

Relationships:
- belongs to school
- can teach many courses


terms
-----
id: uuid (PK)
school_id: uuid (FK -> schools.id)
name: text
season: text
year: smallint
start_date: date
end_date: date
created_at: timestamptz

Relationships:
- belongs to school
- has many courses


courses
-------
id: uuid (PK)
school_id: uuid (FK -> schools.id)
department_id: uuid (FK -> departments.id)
teacher_id: uuid (FK -> teachers.id)
term_id: uuid (FK -> terms.id)

title: text
short_description: text
long_description: text

grade: smallint
subject: text

created_at: timestamptz

Relationships:
- belongs to school
- belongs to department
- belongs to teacher
- belongs to term
- can have many prerequisites
- can have many corequisites
- can have many enrolled students
- can have many completed students
- can have many bookmarked students


students
--------
id: uuid (PK)
school_id: uuid (FK -> schools.id)

name: text
email: text (UNIQUE)

grade: smallint
graduation_year: bigint

created_at: timestamptz

Relationships:
- belongs to school
- has many completed courses
- has many enrolled courses
- has many bookmarked courses
- has many course notes


completed_courses
-----------------
id: uuid (PK)
student_id: uuid (FK -> students.id)
course_id: uuid (FK -> courses.id)
created_at: timestamptz

Unique:
(student_id, course_id)

Purpose:
Tracks courses a student has completed.


enrolled_courses
----------------
id: uuid (PK)
student_id: uuid (FK -> students.id)
course_id: uuid (FK -> courses.id)
created_at: timestamptz

Unique:
(student_id, course_id)

Purpose:
Tracks courses a student is currently enrolled in.


bookmarked_courses
------------------
id: uuid (PK)
student_id: uuid (FK -> students.id)
course_id: uuid (FK -> courses.id)
created_at: timestamptz

Unique:
(student_id, course_id)

Purpose:
Tracks courses a student has bookmarked.


course_notes
------------
id: uuid (PK)
student_id: uuid (FK -> students.id)
course_id: uuid (FK -> courses.id)

note: text

created_at: timestamptz

Purpose:
Student-specific notes for a course.


graduation_requirements
-----------------------
id: uuid (PK)

school_id: uuid (FK -> schools.id)
course_id: uuid (FK -> courses.id)

must_complete_by_grade: smallint | null
must_complete_before_graduation: boolean | null
recommended_grade: smallint | null

created_at: timestamptz

Unique:
(course_id)

Purpose:
Stores graduation requirement rules for courses.


course_prerequisites
--------------------
id: uuid (PK)

course_id: uuid (FK -> courses.id)
prerequisite_course_id: uuid (FK -> courses.id)

Unique:
(course_id, prerequisite_course_id)

Purpose:
Defines prerequisite relationships between courses.


course_corequisites
-------------------
id: uuid (PK)

course_id: uuid (FK -> courses.id)
corequisite_course_id: uuid (FK -> courses.id)

Unique:
(course_id, corequisite_course_id)

Purpose:
Defines corequisite relationships between courses.


COMMON QUERIES

Catalog:
school -> departments -> courses

Student Dashboard:
student -> enrolled_courses -> courses
student -> completed_courses -> courses
student -> bookmarked_courses -> courses

Course Detail:
course
-> teacher
-> department
-> term
-> prerequisites
-> corequisites
*/