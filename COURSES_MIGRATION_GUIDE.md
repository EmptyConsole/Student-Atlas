# Courses Migration to Supabase - Technical Guide

## Overview

This document explains how the 45 courses from the local app data have been mapped and will be added to the Supabase database with the correct schema structure.

## Source Data Structure

### Local Course Format (src/data/courses.ts)

```typescript
type Course = {
  id: string; // Unique course identifier (e.g., "art-foundations")
  subject: string; // Subject area (e.g., "Arts", "Computer Science")
  title: string; // Course name (e.g., "Art Foundations")
  grades: number[]; // Array of eligible grade levels (e.g., [8, 9, 10])
  prerequisites: string[]; // Array of prerequisite course titles
  corequisites: string[]; // Array of corequisite course titles
  teacher?: string; // Teacher name (optional, not always assigned)
  term: Term; // When course is offered: "fall" | "spring" | "both" | "all-year"
  shortDescription: string; // One-line summary
  longDescription: string; // Detailed course description
};
```

## Target Database Schema

### Table: schools

**Purpose:** Represents educational institutions

- `id` (uuid, PK) - Auto-generated
- `name` (text) - School name
- `website` (text) - School website URL
- `city` (text) - City location
- `state` (text) - State abbreviation
- `created_at` (timestamptz) - Auto-generated timestamp

**Data Added:**

- One school created: "Student Atlas High School"
- Location: San Francisco, CA
- Website: https://studentatlas.example.com

---

### Table: teachers

**Purpose:** Tracks instructors who teach courses

- `id` (uuid, PK) - Auto-generated
- `school_id` (uuid, FK) - References schools.id
- `first_name` (text) - Teacher's first name
- `last_name` (text) - Teacher's last name
- `email` (text, nullable) - Email address
- `department` (text, nullable) - Department name
- `created_at` (timestamptz) - Auto-generated

**Data Added:**

- **34 unique teachers** extracted from course data
- Name parsing: "Ms. Elena Vasquez" → first_name="Ms.", last_name="Elena Vasquez"
  - Note: The format includes titles (Ms., Mr., Dr., Sra., Mme.) in the first_name field due to how names are stored in the source data
- All linked to "Student Atlas High School"
- All email and department fields set to NULL (not provided in source data)

**Teachers Examples:**

- Ms. Elena Vasquez (Art Foundations)
- Dr. Susan Nakamura (Biology)
- Mr. Marcus Chen (Music Ensemble)
- Sra. Carmen Delgado (Spanish I)
- Dr. Robert Stein (History of Capitalism)

---

### Table: courses

**Purpose:** Core course catalog

- `id` (uuid, PK) - Auto-generated
- `school_id` (uuid, FK) - References schools.id (NOT the local app `id`)
- `title` (text) - Course name
- `subject` (text) - Subject area (must match SUBJECTS list)
- `short_description` (text) - Brief description
- `long_description` (text) - Detailed description
- `grade` (integer) - Representative grade level
- `term` (text) - Offering term (fall, spring, both, all-year)
- `teacher_id` (uuid, FK, nullable) - References teachers.id
- `department_id` (uuid, FK, nullable) - References departments.id
- `term_id` (uuid, FK, nullable) - References terms.id
- `created_at` (timestamptz) - Auto-generated

**Data Added:**

- **45 courses** total across 13 subjects
- Grade mapping: Since DB stores single grade but app has grade arrays, we use `Math.min(...grades)` (lowest eligible grade)
  - Example: "Art Foundations" [8, 9, 10] → grade 8
  - Example: "Portfolio Studio" [11, 12] → grade 11
- Term mapping: Direct copy from source (fall, spring, both, all-year)
- Subject mapping: Direct from source data
- department_id, term_id: Set to NULL (not available in source data)
- teacher_id: Linked to corresponding teacher record

**Subjects/Departments:**

1. Arts (3 courses)
2. Performing Arts (3 courses)
3. Visual Arts (3 courses)
4. Computer Science (4 courses)
5. Economics (3 courses)
6. Engineering (3 courses)
7. English (3 courses)
8. History (3 courses)
9. Interdisciplinary (3 courses)
10. Languages (3 courses)
11. Math (5 courses)
12. Science (5 courses)
13. Social Emotional Learning (3 courses)

---

### Table: course_prerequisites

**Purpose:** Tracks prerequisite relationships between courses

- `id` (uuid, PK) - Auto-generated
- `course_id` (uuid, FK) - The course that requires the prerequisite (courses.id)
- `prerequisite_course_id` (uuid, FK) - The prerequisite course (courses.id)
- `created_at` (timestamptz, nullable) - Auto-generated

**Data Added:**

- **18 prerequisite relationships** created
- Bidirectional lookup: For each course with prerequisites, we find the prerequisite course in our database and link them
- Examples:
  - Portfolio Studio → requires → Art Foundations
  - Data Structures & Algorithms → requires → Intro to Programming
  - Macroeconomics → requires → Microeconomics
  - Physics → requires → Chemistry

**Prerequisites Summary (by count):**

- Art (Poetry Studio): 1 prerequisite
- Computer Science (Data Structures, Web Dev, ML): 5 prerequisites
- Economics (Macroeconomics): 1 prerequisite
- Engineering (Robotics, CAD): 2 prerequisites
- English (Rhetoric & Argument): 1 prerequisite
- History (History of Capitalism): 1 prerequisite
- Interdisciplinary (Capstone): 1 prerequisite
- Languages (Advanced French): 1 prerequisite
- Math (Geometry, Calculus): 3 prerequisites
- Science (Chemistry, Physics, Environmental): 2 prerequisites

---

### Table: course_corequisites

**Purpose:** Tracks corequisite relationships (taken simultaneously)

- `id` (uuid, PK) - Auto-generated
- `course_id` (uuid, FK) - First course (courses.id)
- `corequisite_course_id` (uuid, FK) - Corequisite course (courses.id)
- `created_at` (timestamptz, nullable) - Auto-generated

**Data Added:**

- **2 corequisite relationships** created
- Examples:
  - Intro to Machine Learning ← → Statistics
  - Chemistry ← → Algebra I
  - Physics ← → Calculus

---

## Migration Process

### Step 1: Run the Migration Script

```bash
npm run migrate-courses
```

This script (`scripts/migrate-courses.ts`) performs three passes:

**Pass 1: Course Creation**

- Creates school (if doesn't exist)
- Creates teachers (parsing names from source)
- Creates all 45 courses with proper foreign key references
- Builds a title→id map for relationship linking

**Pass 2: Prerequisite Linking**

- Iterates through each course's prerequisites array
- Finds prerequisite courses in the title→id map
- Creates course_prerequisites entries

**Pass 3: Corequisite Linking**

- Iterates through each course's corequisites array
- Finds corequisite courses in the title→id map
- Creates course_corequisites entries

### Step 2: Verify Data

Query Supabase to verify:

```sql
-- Check course count
SELECT COUNT(*) FROM courses;  -- Should be 45

-- Check teacher count
SELECT COUNT(*) FROM teachers;  -- Should be ~34

-- Check prerequisite relationships
SELECT COUNT(*) FROM course_prerequisites;  -- Should be 18

-- Check corequisite relationships
SELECT COUNT(*) FROM course_corequisites;  -- Should be 2

-- View a course with relationships
SELECT
  c.id,
  c.title,
  c.subject,
  t.first_name,
  t.last_name
FROM courses c
LEFT JOIN teachers t ON c.teacher_id = t.id
WHERE c.title = 'Art Foundations'
LIMIT 1;
```

---

## Schema Mapping Details

### Local ID to Supabase UUID

The source data uses string IDs like "art-foundations", "cs-intro", etc.
These are **NOT** used in the Supabase database. Instead:

- Supabase generates UUIDs for the `id` field
- We create a mapping during migration: `Map<courseTitle, courseUUID>`
- This mapping is used to resolve prerequisites and corequisites

### Grade Field

**Limitation:** Supabase course.grade stores a single integer, but app courses support multiple grades.

**Solution:** Use the lowest eligible grade as the representative grade.

```typescript
function getRepresentativeGrade(grades: number[]): number {
  if (grades.length === 0) return 9; // Default
  return Math.min(...grades); // Lowest grade
}
```

This ensures that when students filter by their current grade (e.g., "9"), they'll see courses with `grade ≤ 9`.

**Examples:**

- [8, 9, 10] → 8 (shows to grades 8+)
- [10, 11, 12] → 10 (shows to grades 10+)
- [9, 10, 11, 12] → 9 (shows to grades 9+)
- [12] → 12 (seniors only)

---

## Validation Checklist

After migration, verify:

- [ ] All 45 courses created successfully
- [ ] All ~34 teachers created successfully
- [ ] All course titles match exactly (for relationship linking)
- [ ] All 18 prerequisite relationships established
- [ ] All 2 corequisite relationships established
- [ ] No NULL values in required fields (title, subject, school_id, grade, term)
- [ ] Optional fields (teacher_id, department_id, term_id) are NULL where not provided
- [ ] Created_at timestamps are reasonable
- [ ] Teacher names parsed correctly (check a few in Supabase UI)
- [ ] Foreign key constraints are satisfied
- [ ] No duplicate courses or relationships

---

## Future Enhancements

1. **Departments:** Create proper department records instead of NULL
   - Extract department info from teacher records if available
   - Create a mapping of courses to departments

2. **Terms:** Create term records for each offering
   - "Fall 2024", "Spring 2025", "All Year 2024-2025"
   - Link courses to specific terms

3. **Grade Support:** If multiple grades per course needed in future:
   - Create a `course_grades` junction table
   - Or extend `courses` table with `min_grade`, `max_grade` fields

4. **Email/Contact:** Add teacher email and contact information

5. **Versioning:** Track course catalog versions/academic years

---

## Related Files

- **Migration Script:** `scripts/migrate-courses.ts`
- **Source Courses:** `src/data/courses.ts`
- **Database Types:** `src/types/database.ts`
- **Supabase Config:** `src/lib/supabase.ts`
- **Source Data Types:** `src/types/app.ts`

---

## Troubleshooting

### "Missing Supabase environment variables"

Ensure `.env.local` or environment contains:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### "Course already exists" warnings

The script is idempotent—running it multiple times won't create duplicates.
Existing courses are detected by (title, school_id) match.

### Prerequisite course not found

Usually means a course title in the prerequisites array doesn't exactly match a course title in COURSES.
Check for typos or case mismatches in `src/data/courses.ts`.

### Foreign key constraint violations

Ensure schools and teachers exist before courses.
The script handles this by creating them first.

---

## Summary

- **Total Courses:** 45
- **Total Teachers:** ~34
- **Total Prerequisites:** 18
- **Total Corequisites:** 2
- **School Records:** 1
- **Subjects:** 13

All data is now structured in Supabase with proper relational integrity, enabling the app to query courses with their instructors, prerequisites, and corequisites.
