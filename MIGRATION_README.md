# Supabase Courses Migration Guide

This guide explains how to migrate the 45 courses from the Student Atlas app data into your Supabase database with the correct schema structure.

## Quick Start

### Prerequisites

1. Supabase project set up with the database schema created
2. Environment variables configured in `.env.local`:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

### Run Migration

```bash
# Install dependencies (if needed)
npm install

# Run the migration
npm run migrate-courses
```

## What Gets Migrated

### Overview

- **45 Courses** across 13 subjects
- **~34 Teachers** extracted from course data
- **1 School** (Student Atlas High School, San Francisco, CA)
- **18 Prerequisite** relationships
- **2 Corequisite** relationships

### Course Subjects

1. Arts (3)
2. Performing Arts (3)
3. Visual Arts (3)
4. Computer Science (4)
5. Economics (3)
6. Engineering (3)
7. English (3)
8. History (3)
9. Interdisciplinary (3)
10. Languages (3)
11. Math (5)
12. Science (5)
13. Social Emotional Learning (3)

## Schema Mapping

### Source → Database

#### Courses

```
Local App               Supabase Database
────────────────────   ─────────────────
id (string)            → (discarded, UUID generated)
title                  → title
subject                → subject
shortDescription       → short_description
longDescription        → long_description
grades (array)         → grade (single, uses min value)
term                   → term
teacher (string)       → teacher_id (resolved to UUID)
prerequisites []       → course_prerequisites (junction table)
corequisites []        → course_corequisites (junction table)
```

#### Grade Mapping

Since the database stores a single `grade` field but app courses support multiple grades:

- **Strategy:** Use the lowest eligible grade
- **Example:** [9, 10, 11, 12] → 8 (this course shows to grade 8+)
- **Example:** [10, 11, 12] → 10 (this course shows to grade 10+)

#### Teachers

Teachers are parsed from names like "Ms. Elena Vasquez":

- `first_name`: "Ms."
- `last_name`: "Elena Vasquez"

**Note:** This is a limitation of how names are stored in the source data. Consider updating teacher records manually if you need better name handling.

## Migration Process

The `scripts/migrate-courses.ts` script executes in three phases:

### Phase 1: Setup

1. Checks for existing school "Student Atlas High School"
2. Creates school if it doesn't exist
3. Initializes course title → ID mapping

### Phase 2: Course & Teacher Creation

For each course:

1. Parse and get/create teacher (if assigned)
2. Check if course already exists (by title + school_id)
3. Create new course with:
   - All descriptions and metadata
   - Linked teacher ID
   - Representative grade (min of grades array)
   - NULL for department_id and term_id (not in source)
4. Add course title → UUID to mapping

### Phase 3: Relationship Creation

For each course:

1. **Prerequisites:** Link to prerequisite course UUIDs
2. **Corequisites:** Link to corequisite course UUIDs

## Idempotency

The migration script is **idempotent** and can be run multiple times safely:

- Existing courses are detected by (title, school_id) uniqueness
- Existing relationships are not duplicated
- New runs add missing data without errors

## Verification

After migration completes, verify the data:

### Check totals

```sql
SELECT COUNT(*) as course_count FROM courses;
-- Expected: 45

SELECT COUNT(DISTINCT teacher_id) as teacher_count FROM courses WHERE teacher_id IS NOT NULL;
-- Expected: ~34

SELECT COUNT(*) as prerequisite_count FROM course_prerequisites;
-- Expected: 18

SELECT COUNT(*) as corequisite_count FROM course_corequisites;
-- Expected: 2
```

### View a course with relationships

```sql
SELECT
  c.id,
  c.title,
  c.subject,
  c.short_description,
  c.grade,
  c.term,
  CONCAT(t.first_name, ' ', t.last_name) as teacher_name
FROM courses c
LEFT JOIN teachers t ON c.teacher_id = t.id
WHERE c.title = 'Art Foundations';
```

### View prerequisites for a course

```sql
SELECT
  c.title as course,
  pc.title as prerequisite
FROM course_prerequisites cp
JOIN courses c ON cp.course_id = c.id
JOIN courses pc ON cp.prerequisite_course_id = pc.id
ORDER BY c.title, pc.title;
```

### View corequisites for a course

```sql
SELECT
  c.title as course,
  cc.title as corequisite
FROM course_corequisites cco
JOIN courses c ON cco.course_id = c.id
JOIN courses cc ON cco.corequisite_course_id = cc.id
ORDER BY c.title, cc.title;
```

## Troubleshooting

### Migration doesn't run

1. **Missing environment variables:**

   ```bash
   echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
   echo "VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY"
   ```

   If empty, add to `.env.local`

2. **tsx not found:**

   ```bash
   npm install tsx -D
   ```

3. **Dependencies missing:**
   ```bash
   npm install
   ```

### "Course already exists" warnings

This is normal and expected if you've run the migration before. The script is idempotent and will:

- Skip existing courses
- Skip existing relationships
- Add only new data

### "Prerequisite course not found" warnings

This shouldn't happen with the provided course data, but if it does:

1. Check course title spelling in `src/data/courses.ts`
2. Ensure all prerequisite titles exactly match course titles
3. Look for case sensitivity issues

### Database connection errors

1. Verify Supabase URL and key are correct
2. Check network connectivity
3. Ensure Supabase project is accessible from your location
4. Check rate limiting (Supabase free tier has limits)

## Files

- **Migration Script:** `scripts/migrate-courses.ts`
- **SQL Alternative:** `scripts/migrate-courses.sql` (not recommended, use TypeScript)
- **Documentation:** `COURSES_MIGRATION_GUIDE.md` (detailed technical guide)
- **Source Data:** `src/data/courses.ts` (45 course definitions)
- **Database Types:** `src/types/database.ts` (Supabase schema types)

## Manual Fixes

If needed, you can manually update teacher information:

```sql
UPDATE teachers
SET email = 'elena.vasquez@school.edu', department = 'Arts'
WHERE first_name = 'Ms.' AND last_name = 'Elena Vasquez';
```

## Next Steps

After migration:

1. **Verify data** using queries above
2. **Update teacher info** (emails, departments, photos)
3. **Create department records** and link courses
4. **Create term records** and link courses
5. **Add graduation requirements** as needed
6. **Test app** with real database courses

## Support

For detailed technical information, see `COURSES_MIGRATION_GUIDE.md`.

For schema documentation, see comments in `src/lib/supabase.ts`.

## Related Documentation

- [Supabase Docs](https://supabase.com/docs)
- [Supabase JavaScript SDK](https://supabase.com/docs/reference/javascript)
- [Database Schema](./COURSES_MIGRATION_GUIDE.md)
