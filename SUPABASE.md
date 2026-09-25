# How Supabase is used

Student Atlas uses Supabase as hosted Postgres plus the Data API. There is no
Supabase Auth in the student or teacher flows. Schema, RLS, and stored functions
are applied by hand in the SQL Editor (`scripts/*.sql`).
`scripts/supabase-schema.sql` is a snapshot of the tables — context only, not
executable. Keep `src/types/database.ts` in sync with the live schema.

## Clients and keys

Two different keys, two different privileges.

| Client | Key | Where | What it can do |
| ------ | --- | ----- | -------------- |
| Browser singleton in `src/lib/supabase.ts` | `VITE_SUPABASE_PUBLISHABLE_KEY` (anon) | Vite app, hooks, `src/lib/teacher.ts` reads | Catalog **SELECT** only. No access to student tables. Cannot write catalog tables or call teacher RPCs. |
| Service-role client created inside `api/` | `SUPABASE_SERVICE_ROLE_KEY` | `teacher-login`, `teacher-mutate`, `student`, `send-email-verification`, `verify-email-code` | Bypasses RLS. Catalog writes, student reads/writes, password RPCs, OTP storage, cascade deletes. |

Only `VITE_`-prefixed variables reach the browser. Never put the service-role
key, `TEACHER_SESSION_SECRET`, `STUDENT_SESSION_SECRET`, or a school password in
client code.

`api/` files must not import from `src/` (Vercel’s bundler will miss them). They
create their own `createClient(...)` and duplicate any small helpers.

## Who writes what

```
Browser (anon key)
  reads:  schools, terms, departments, teachers, courses
  writes: nothing

/api/student (service role + student HMAC session)
  students, completed_courses, enrolled_courses,
  bookmarked_courses, course_notes,
  submitted_courses, submitted_notes
  ranking confirmation email (Resend)

/api/teacher-login  (service role)
  verify_school_password / set_school_password
  insert schools + terms on create

/api/teacher-mutate (service role + HMAC session)
  schools, terms, departments, courses, teachers
  reorder_terms, add/edit/remove_class_time
  cascade deletes that also touch student tables

/api/send-email-verification, /api/verify-email-code (service role)
  email_verification_codes only
```

Teacher catalog writes never go through the anon key. The browser posts to
`/api/teacher-mutate` with the HMAC session from `/api/teacher-login`. That
session is valid 12 hours and is scoped to one school. Destructive actions ask
for the password again.

Student identity is an email one-time code. `/api/verify-email-code` returns a
signed student session (login, 30 days) or a short-lived email proof (signup and
email change, 10 minutes). The browser sends the session as a Bearer token to
`/api/student`, which takes the student id from the token — never from the
request body — so a student can only read and change their own rows. Changing
the account email needs a proof for the new address. Tokens are signed with
`STUDENT_SESSION_SECRET` (falls back to the service-role key) and can never
verify as teacher tokens.

## Tables

Everything hangs off `schools`. Catalog rows are school-scoped. Student rows
point at a school and at courses.

### Catalog (anon SELECT, service-role writes)

**`schools`** — name, website, city, state. `rankings` is how many courses a
student must rank per term when their grade has no override. `grade` is jsonb
per-grade settings, e.g. `{"9": {"rankings": "8", "assigned": "2"}}`. Missing
grades fall back to the school-wide columns.

**`school_secrets`** — bcrypt teacher password, failed-attempt counter, lockout.
RLS on, no policies, grants revoked from anon/authenticated. Only
`verify_school_password` / `set_school_password` (service role) touch it.

**`terms`** — named terms for a school, ordered by `position` (then
`created_at`). Reorder through `reorder_terms`, not row-by-row updates.

**`departments`** — name, optional code/subtitle, `graduation_requirement` text.

**`teachers`** — name, optional email/department. Courses point at a teacher.

**`courses`** — one offering: title, descriptions, eligible `grade[]`,
`subject`, department, teacher, `term_options[]` (which terms it runs),
`schedule` (flat `[day, start_minute, end_minute]` triples), seat cap
(`max_student_count`, `-1` = unset), structured prereqs/coreqs
(`prereq_options` / `coreq_options` as OR-of-AND groups of course UUIDs or free
text). `students` holds per-section rosters (`'day,start,end|uuid,uuid,...'`).

### Student records (service role only, via `/api/student`)

**`students`** — name, unique email, grade, graduation year, `school_id`.
`times_taken` is a flat `[term_rank, day, start, end]` schedule of assigned
blocks.

**`completed_courses` / `enrolled_courses`** — self-reported prerequisites and
corequisites. Unique `(student_id, course_id)`.

**`bookmarked_courses`** — catalog bookmarks. Unique `(student_id, course_id)`.

**`course_notes`** — per-student note on a course.

**`submitted_courses`** — ranked preferences: `preference` number plus a
`submitted` flag.

**`submitted_notes`** — optional appeal / note text sent with a ranking.

Deleting a student cascades to all of those child tables
(`scripts/student-delete-cascade.sql`).

### Junctions on courses (catalog-owned)

**`course_prerequisites` / `course_corequisites`** — course-to-course links
used alongside the options arrays.

**`graduation_requirements`** — per-course rules (by-grade / before graduation /
recommended grade).

### Server-only

**`email_verification_codes`** — SHA-256 hashed OTPs. `purpose` is `signup`,
`login`, or `email_change`. 10-minute expiry, attempt cap. RLS on, no policies;
anon cannot see rows.

## Row Level Security

Every exposed table has RLS enabled.

| Tables | Anon policy | Why |
| ------ | ----------- | --- |
| `schools`, `terms`, `departments`, `teachers`, `courses` | SELECT only | Catalog is public to the app; writes go through the service role. INSERT/UPDATE/DELETE grants are **revoked** so a future write policy cannot reopen client writes. |
| `course_prerequisites`, `course_corequisites`, `graduation_requirements` | SELECT only | Catalog-owned link tables, same lockdown. |
| `students`, `completed_courses`, `enrolled_courses`, `bookmarked_courses`, `course_notes`, `submitted_courses`, `submitted_notes` | RLS on, **no policies, all grants revoked** | Only `/api/student` (service role) touches them. |
| `school_secrets`, `email_verification_codes` | RLS on, **no policies** | Unreadable by any client. Service role bypasses RLS. |

`scripts/teacher-rls.sql` is the catalog SELECT policies. The catalog write
lockdown is section 0 of `scripts/restore-courses.sql`.
`scripts/student-rls.sql` locks the student tables and the link tables.

## Stored functions (RPCs)

Teacher-only RPCs have EXECUTE revoked from anon/authenticated and granted to
`service_role`. The browser never calls them.

| Function | Called from | Role |
| -------- | ----------- | ---- |
| `verify_school_password(school_id, password) → boolean` | `/api/teacher-login`, `/api/teacher-mutate` (destructive confirms) | service role. SECURITY DEFINER so it can read `school_secrets`. 10 failures lock the school for 15 minutes (`school_locked`). |
| `set_school_password(school_id, password)` | login (create school), mutate (change password) | service role. SECURITY DEFINER. bcrypt, resets lockout. |
| `reorder_terms(school_id, ordered_term_ids)` | mutate, when the teacher reorders terms | service role. Remaps `students.times_taken` term ranks, then writes 0-based `terms.position`. |
| `add_class_time` / `edit_class_time` / `remove_class_time` | mutate, when a course’s meeting times change | service role. Updates `courses.schedule` and keeps rosters / `times_taken` in sync. |
| `cleanup_class_times(school_id)` | SQL Editor / maintenance | service role. Repair pass for leftover roster rows. |

`verify_school_password` and `set_school_password` live in
`scripts/teacher-auth.sql`. Class-time functions live in
`scripts/class-time-maintenance.sql`. `reorder_terms` lives in
`scripts/assignment-columns.sql` — run that **before** `teacher-auth.sql`, which
revokes its grants and expects the function to exist.

<!--
sort / testsort — currently disabled. Uncomment this section (and the matching
TypeScript / npm scripts) to restore.

| Function | Called from | Role |
| -------- | ----------- | ---- |
| `apply_elective_assignments(school_id, rosters, times)` | `src/lib/applyElectiveAssignments.ts` via `npm run sort` | anon today (CLI-only). Validates every id belongs to the school, then clears and rewrites `courses.students` and `students.times_taken` in one transaction. Defined in `scripts/elective-assignment-apply.sql`. |

`npm run sort` loads through `src/lib/loadElectiveData.ts`, runs the deferred-
acceptance engine, and applies via that RPC. `npm run testsort` is the same
load + engine with no write — it prints a report. Both CLIs and the wrappers
(`src/lib/sort.ts`, `src/lib/testSort.ts`) are commented out.
-->

## How the app talks to it

**Student catalog** — `useCourses`, `useTerms`, `useSubjects`, `useSchools`,
`useSchoolRankings`, `useSchoolGrades` all SELECT with the anon client.

**Student profile / register** — `src/lib/students.ts` POSTs every student
read and write (profile, bookmarks, notes, completed courses, rankings) to
`/api/student` with the stored session. A 401 clears the session and sends the
student back to the login screen.

**Teacher editor** — `src/lib/teacher.ts` SELECTs catalog rows with the anon
client, then POSTs mutations to `/api/teacher-mutate`. Conflict checks
(`useCourseConflict`) also SELECT courses with anon.

**Email** — `/api/send-email-verification` inserts hashed codes with the service
role. `/api/verify-email-code` consumes them and issues the student session or
proof. The ranking confirmation email is the `sendConfirmation` action on
`/api/student`; it always goes to the signed-in student's own address, through
Resend (not Supabase).

## Applying schema changes

Run the tracked scripts in the Supabase SQL Editor. Order matters for a fresh
project:

1. `assignment-columns.sql` — elective columns + `reorder_terms`
2. `teacher-auth.sql` — `school_secrets`, password RPCs, revoke catalog writes
3. `teacher-rls.sql` — catalog SELECT policies (also recreated by teacher-auth)
4. `email-verification-codes.sql`
5. `class-time-maintenance.sql`
6. `school-grade-settings.sql` — `schools.grade`
7. `student-delete-cascade.sql`
8. `student-rls.sql` — lock student tables (after `/api/student` is deployed)

<!--
9. `elective-assignment-apply.sql` — `apply_elective_assignments` for sort.
   The sort CLI now needs the service-role key: anon cannot read students.
-->

School-specific seeds (real catalogs, bulk students, demo passwords) are gitignored.
Create the first school through `/teacher`, which hashes the password server-side.

After a schema change, update `src/types/database.ts` to match.
