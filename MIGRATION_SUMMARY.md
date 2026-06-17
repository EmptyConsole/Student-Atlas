# Courses to Supabase - Migration Summary

## What Has Been Set Up

### Files Created

1. **scripts/migrate-courses.ts** (8.9 KB)
   - Complete TypeScript migration script
   - Handles all 45 courses with proper schema mapping
   - Creates schools, teachers, courses, prerequisites, and corequisites
   - Fully idempotent (safe to run multiple times)
   - Comprehensive error handling and logging

2. **scripts/migrate-courses.sql** (2.6 KB)
   - Alternative SQL approach (not recommended)
   - Provided as reference

3. **MIGRATION_README.md** (6.9 KB)
   - Quick-start guide
   - Troubleshooting
   - Verification queries

4. **COURSES_MIGRATION_GUIDE.md** (11 KB)
   - Detailed technical documentation
   - Complete schema mapping explanation
   - Prerequisites and corequisites breakdown
   - Future enhancement suggestions

5. **COURSES_DATA_STRUCTURE.md** (10 KB)
   - Visual database schema overview
   - Complete course catalog with prerequisites
   - Statistics and data flow diagrams
   - Grade field mapping explanation

### Package.json Updates

Added:

- `"migrate-courses": "tsx scripts/migrate-courses.ts"` command
- `tsx` to devDependencies for TypeScript execution

## How to Run

### Step 1: Set Environment Variables

```bash
# Create or update .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Run Migration

```bash
npm run migrate-courses
```

Expected output:

```
Starting course migration...

Using existing school: [uuid]

=== Creating courses ===
Created course: Art Foundations ([uuid])
Created course: Portfolio Studio ([uuid])
... [43 more courses] ...

=== Creating prerequisites ===
Created prerequisite: Portfolio Studio -> Art Foundations
... [17 more prerequisites] ...

=== Creating corequisites ===
Created corequisite: Intro to Machine Learning <- -> Statistics
Created corequisite: Chemistry <- -> Algebra I
... [0 more] ...

✅ Migration completed successfully! All courses have been added to Supabase.
Total courses migrated: 45
```

## Data Structure Overview

### Database Tables Created/Populated

| Table                | Records | Purpose                    |
| -------------------- | ------- | -------------------------- |
| schools              | 1       | School information         |
| teachers             | ~34     | Course instructors         |
| courses              | 45      | Course catalog             |
| course_prerequisites | 18      | Prerequisite relationships |
| course_corequisites  | 2       | Corequisite relationships  |

### Courses by Subject

| Subject                   | Count  | Example Courses                                            |
| ------------------------- | ------ | ---------------------------------------------------------- |
| Arts                      | 3      | Art Foundations, Portfolio Studio, Printmaking             |
| Performing Arts           | 3      | Acting & Improvisation, Music Ensemble, Dance Composition  |
| Visual Arts               | 3      | Drawing & Observation, Digital Design, Painting Studio     |
| Computer Science          | 4      | Intro to Programming, Web Development, Data Structures, ML |
| Economics                 | 3      | Microeconomics, Macroeconomics, Personal Finance           |
| Engineering               | 3      | Intro to Engineering, Robotics, CAD & Fabrication          |
| English                   | 3      | World Literature, Creative Writing, Rhetoric & Argument    |
| History                   | 3      | Modern World History, US History, History of Capitalism    |
| Interdisciplinary         | 3      | Design Thinking, Sustainability, Independent Capstone      |
| Languages                 | 3      | Spanish I, Mandarin I, Advanced French                     |
| Math                      | 5      | Algebra I, Geometry, Calculus, Statistics, + 1 more        |
| Science                   | 5      | Biology, Chemistry, Physics, Environmental, + 1 more       |
| Social Emotional Learning | 3      | Mindfulness, Leadership, Healthy Relationships             |
| **TOTAL**                 | **45** |                                                            |

## Schema Mapping

### Course Field Mapping

```typescript
// Local app format
interface Course {
  id: string; // App-level ID (discarded)
  subject: string; // → courses.subject
  title: string; // → courses.title
  grades: number[]; // → courses.grade (min value)
  prerequisites: string[]; // → course_prerequisites (resolved by title)
  corequisites: string[]; // → course_corequisites (resolved by title)
  teacher?: string; // → courses.teacher_id (resolved teacher UUID)
  term: Term; // → courses.term
  shortDescription: string; // → courses.short_description
  longDescription: string; // → courses.long_description
}

// Supabase database format
interface SupabaseCourse {
  id: uuid; // Auto-generated
  school_id: uuid; // FK to schools
  title: string;
  subject: string;
  short_description: string;
  long_description: string;
  grade: number; // Single grade (min of app grades)
  term: string;
  teacher_id?: uuid; // FK to teachers
  department_id?: uuid; // NULL (not in source)
  term_id?: uuid; // NULL (not in source)
  created_at: timestamp; // Auto-generated
}
```

## Key Features of Migration

✅ **Idempotent** - Run multiple times without duplicates
✅ **Comprehensive** - All 45 courses with full relationships
✅ **Type-Safe** - Uses Supabase TypeScript types
✅ **Error Handling** - Detailed logging and error messages
✅ **Automatic** - Creates schools and teachers as needed
✅ **Verified** - Each step includes validation

## Prerequisite Chains

### Math → Physics Path

```
Algebra I (Gr 8)
  ↓
Geometry (Gr 9)
  ↓ and Algebra I
  ↓
Calculus (Gr 11)
  ↓ Calculus + [Chemistry + Algebra I]
  ↓
Physics (Gr 11)
```

### CS → ML Path

```
Intro to Programming (Gr 8)
  ↓
Data Structures & Algorithms (Gr 10)
  ↓ + Statistics (coreq)
  ↓
Intro to Machine Learning (Gr 11)
```

### Full prerequisite count: 18 relationships

### Full corequisite count: 2 relationships

## Verification Steps

After migration, run these queries in Supabase:

```sql
-- Verify course count
SELECT COUNT(*) FROM courses;  -- Should be 45

-- Verify teachers
SELECT COUNT(*) FROM teachers;  -- Should be ~34

-- Verify prerequisites
SELECT COUNT(*) FROM course_prerequisites;  -- Should be 18

-- Verify corequisites
SELECT COUNT(*) FROM course_corequisites;  -- Should be 2

-- Check a specific course
SELECT c.id, c.title, c.subject, t.first_name, t.last_name
FROM courses c
LEFT JOIN teachers t ON c.teacher_id = t.id
WHERE c.title = 'Intro to Programming';
```

## Next Steps

1. ✅ **Run Migration**

   ```bash
   npm run migrate-courses
   ```

2. ✅ **Verify Data**
   - Check Supabase SQL editor
   - Run verification queries

3. ⚠️ **Manual Updates** (Optional)
   - Update teacher emails/departments
   - Create proper department records
   - Create term records
   - Add graduation requirements

4. 🧪 **Test Application**
   - Update app to query Supabase courses
   - Test prerequisites/corequisites logic
   - Test filtering and search

5. 📚 **Documentation**
   - Update app docs with new data source
   - Document any schema changes
   - Create backup procedures

## Files Reference

| File                          | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `scripts/migrate-courses.ts`  | Main migration script              |
| `scripts/migrate-courses.sql` | SQL alternative (reference only)   |
| `MIGRATION_README.md`         | Quick-start and troubleshooting    |
| `COURSES_MIGRATION_GUIDE.md`  | Detailed technical guide           |
| `COURSES_DATA_STRUCTURE.md`   | Visual data structure and diagrams |
| `README.md` (this file)       | Executive summary                  |

## Troubleshooting Quick Reference

| Issue                                    | Solution                                |
| ---------------------------------------- | --------------------------------------- |
| "Missing Supabase environment variables" | Add to `.env.local`                     |
| "Course already exists" warnings         | Normal - script is idempotent           |
| "tsx not found"                          | `npm install tsx -D`                    |
| "Prerequisite course not found"          | Check spelling in `src/data/courses.ts` |
| Database connection errors               | Verify URL and key, check network       |

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **Supabase JS SDK:** https://supabase.com/docs/reference/javascript
- **Database Schema Docs:** See `COURSES_MIGRATION_GUIDE.md`
- **Technical Details:** See `COURSES_DATA_STRUCTURE.md`

---

**Status:** ✅ Ready to migrate
**Total Courses:** 45
**Total Teachers:** ~34
**Total Relationships:** 20 (18 prerequisites + 2 corequisites)

Ready to run: `npm run migrate-courses`
