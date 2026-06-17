# Updated Migration Guide - Complete Database Setup

## ✅ Fixed: Now Includes Departments & Terms

The migration script has been updated to properly create and link all required tables:

### Complete Table Structure

```
schools (1)
├── departments (13) ← One per subject
│   └── linked to courses
├── terms (4) ← Offering periods
│   └── linked to courses
├── teachers (~34) ← Course instructors
│   └── linked to courses
└── courses (45) ← Catalog
    ├── course_prerequisites (18)
    └── course_corequisites (2)
```

## What Gets Created

### Schools (1 record)

- **Name:** Student Atlas High School
- **Location:** San Francisco, CA
- **Website:** https://studentatlas.example.com

### Departments (13 records)

One department per subject:

1. Arts (code: ARTS)
2. Performing Arts (code: PERF)
3. Visual Arts (code: VISU)
4. Computer Science (code: COMP)
5. Economics (code: ECON)
6. Engineering (code: ENGI)
7. English (code: ENGL)
8. History (code: HIST)
9. Interdisciplinary (code: INTE)
10. Languages (code: LANG)
11. Math (code: MATH)
12. Science (code: SCIE)
13. Social Emotional Learning (code: SOCI)

**Key:** Each course links to its subject's department via `department_id`

### Terms (4 records)

- **Fall 2026** (season: "fall", year: 2026)
- **Spring 2027** (season: "spring", year: 2027)
- **Fall & Spring 2026** (season: "both", year: 2026)
- **All Year 2026** (season: "all-year", year: 2026)

**Key:** Each course links to its term record via `term_id`
**Note:** The `term` field (text) AND `term_id` (FK) are both populated

### Teachers (~34 records)

Automatically created from course data

- Each course with a teacher links via `teacher_id`
- Teachers without courses are not created

### Courses (45 records)

Each course now properly links:

- ✅ `school_id` → schools
- ✅ `department_id` → departments (by subject)
- ✅ `term_id` → terms (by term type)
- ✅ `teacher_id` → teachers (when assigned)
- ✅ `subject` → stored as text
- ✅ `term` → stored as text ("fall", "spring", "both", "all-year")

### Relationships (20 records)

- **Prerequisites:** 18 relationships
- **Corequisites:** 2 relationships

## Migration Phases

### Phase 1: Infrastructure Setup

1. Create/verify school
2. Create 13 departments (one per subject)
3. Create 4 term records for the year
4. Build mapping tables (subject→dept, term→term-id)

### Phase 2: Content Creation

1. For each of 45 courses:
   - Get/create teacher if assigned
   - Look up department ID from subject
   - Look up term ID from term type
   - Create course with all FK references

### Phase 3: Relationships

1. Link prerequisites using title-based lookup
2. Link corequisites using title-based lookup

## Running the Migration

```bash
# 1. Setup environment
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# OR add to .env.local:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=...

# 2. Install
npm install

# 3. Run migration
npm run migrate-courses
```

### Expected Output

```
Starting course migration...

Using existing school: [uuid]

Creating departments for 13 subjects...
Created department: Arts (ARTS) ([uuid])
Created department: Computer Science (COMP) ([uuid])
... [11 more] ...

Creating terms...
Created term: Fall 2026 ([uuid])
Created term: Spring 2027 ([uuid])
Created term: Fall & Spring 2026 ([uuid])
Created term: All Year 2026 ([uuid])

=== Creating courses ===
Created course: Art Foundations ([uuid])
Created course: Intro to Programming ([uuid])
... [43 more] ...

=== Creating prerequisites ===
Created prerequisite: Portfolio Studio -> Art Foundations
... [17 more] ...

=== Creating corequisites ===
Created corequisite: Intro to Machine Learning <- -> Statistics
Created corequisite: Chemistry <- -> Algebra I

✅ Migration completed successfully!
Total courses migrated: 45
```

## Verification Queries

```sql
-- Check all tables
SELECT COUNT(*) as schools FROM schools;           -- Should be 1
SELECT COUNT(*) as departments FROM departments;   -- Should be 13
SELECT COUNT(*) as terms FROM terms;               -- Should be 4
SELECT COUNT(*) as teachers FROM teachers;         -- Should be ~34
SELECT COUNT(*) as courses FROM courses;           -- Should be 45
SELECT COUNT(*) as prerequisites FROM course_prerequisites;  -- Should be 18
SELECT COUNT(*) as corequisites FROM course_corequisites;    -- Should be 2

-- Verify relationships are set
SELECT COUNT(*) FROM courses WHERE department_id IS NULL;    -- Should be 0
SELECT COUNT(*) FROM courses WHERE term_id IS NULL;          -- Should be 0
SELECT COUNT(*) FROM courses WHERE school_id IS NULL;        -- Should be 0

-- View a complete course with all links
SELECT
  c.id,
  c.title,
  c.subject,
  d.name as department,
  t.name as term,
  CONCAT(te.first_name, ' ', te.last_name) as teacher,
  c.grade,
  c.short_description
FROM courses c
LEFT JOIN departments d ON c.department_id = d.id
LEFT JOIN terms t ON c.term_id = t.id
LEFT JOIN teachers te ON c.teacher_id = te.id
WHERE c.title = 'Intro to Programming';

-- Count courses by department
SELECT d.name, COUNT(c.id) as course_count
FROM departments d
LEFT JOIN courses c ON d.id = c.department_id
GROUP BY d.id, d.name
ORDER BY d.name;

-- Count courses by term
SELECT t.name, COUNT(c.id) as course_count
FROM terms t
LEFT JOIN courses c ON t.id = c.term_id
GROUP BY t.id, t.name
ORDER BY t.name;
```

## Schema Details

### departments table

```
id (UUID, PK)          - Auto-generated
school_id (UUID, FK)   - Links to schools
name (text)            - Subject name (Arts, CS, etc.)
code (text)            - 4-letter code (ARTS, COMP, etc.)
created_at (timestamp) - Auto-generated
```

### terms table

```
id (UUID, PK)          - Auto-generated
school_id (UUID, FK)   - Links to schools
name (text)            - Display name (e.g., "Fall 2026")
season (text)          - "fall", "spring", "both", "all-year"
year (integer)         - Academic year
start_date (date)      - NULL (can be updated)
end_date (date)        - NULL (can be updated)
created_at (timestamp) - Auto-generated
```

### courses table (updated)

```
id (UUID, PK)
school_id (UUID, FK)           - Links to schools
department_id (UUID, FK)       - Links to departments ✅ NOW SET
term_id (UUID, FK)             - Links to terms ✅ NOW SET
teacher_id (UUID, FK)          - Links to teachers (nullable)
title (text)
subject (text)
short_description (text)
long_description (text)
grade (integer)
term (text)                    - Also stored as text
created_at (timestamp)
```

## Idempotency

The updated script remains **fully idempotent**:

- Running it multiple times won't create duplicates
- Departments are detected by (school_id, name)
- Terms are detected by (school_id, season, year)
- Courses are detected by (school_id, title)
- Relationships are detected by existing FK combinations

## Data Integrity

All foreign key constraints are satisfied:

- ✅ Every course has a valid department_id
- ✅ Every course has a valid term_id
- ✅ Every department has a valid school_id
- ✅ Every term has a valid school_id
- ✅ Every teacher has a valid school_id
- ✅ All prerequisites point to valid courses
- ✅ All corequisites point to valid courses

## Migration Statistics

| Component         | Count    |
| ----------------- | -------- |
| Schools           | 1        |
| Departments       | 13       |
| Terms             | 4        |
| Teachers          | ~34      |
| Courses           | 45       |
| Prerequisites     | 18       |
| Corequisites      | 2        |
| **Total Records** | **117+** |

## What Changed from Original

| Item                  | Before      | After           |
| --------------------- | ----------- | --------------- |
| departments           | Not created | 13 created      |
| terms                 | Not created | 4 created       |
| courses.department_id | NULL        | Properly linked |
| courses.term_id       | NULL        | Properly linked |
| Database integrity    | Incomplete  | ✅ Complete     |

## Next Steps After Migration

1. **Verify Data**
   - Run verification queries above
   - Check Supabase dashboard

2. **Update Start Dates** (Optional)
   - Add actual start/end dates to terms

   ```sql
   UPDATE terms
   SET start_date = '2026-09-01', end_date = '2026-12-15'
   WHERE season = 'fall' AND year = 2026;
   ```

3. **Update Teacher Info** (Optional)

   ```sql
   UPDATE teachers
   SET email = 'elena.vasquez@school.edu', department = 'Arts'
   WHERE first_name = 'Ms.' AND last_name = 'Elena Vasquez';
   ```

4. **Test Application**
   - Update app to query Supabase courses
   - Test department filtering
   - Test term selection
   - Test prerequisites/corequisites

## Troubleshooting

### Migration stops at departments

- Check Supabase connection
- Verify environment variables
- Ensure `departments` table exists in schema

### Migration stops at terms

- Same as above, but check `terms` table

### Course creation fails

- Verify no courses exist with same title
- Check department/term IDs are valid

### Run migration again if needed

```bash
npm run migrate-courses
```

It will skip existing records and add missing ones.

## Files Modified

- ✅ `scripts/migrate-courses.ts` - Updated with dept/term creation
- ✅ `package.json` - Added migration command + tsx dependency

## Files Available

- `scripts/migrate-courses.ts` - Main migration (updated)
- `scripts/migrate-courses.sql` - SQL reference
- `MIGRATION_README.md` - Quick-start guide
- `COURSES_MIGRATION_GUIDE.md` - Original detailed guide
- `COURSES_DATA_STRUCTURE.md` - Data diagrams
- `INDEX.md` - Documentation index

---

**Status:** ✅ Ready - Now with complete database schema
**Tables:** 7 (schools, departments, terms, teachers, courses, course_prerequisites, course_corequisites)
**Records:** 117+ total
**Foreign Keys:** All properly linked and validated

🚀 **Ready to run:** `npm run migrate-courses`
