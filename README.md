# Student Atlas

A course catalog and elective registration system for high schools. Students browse
their school's real catalog, bookmark what interests them, rank electives term by
term, and submit once. A deferred-acceptance algorithm then places every student
into elective seats at the same time, respecting seat caps, schedule conflicts, and
grade-level priority.

## The problem

Elective registration at most high schools runs one of three ways, and all three
have the same failure modes:

- **Paper or spreadsheet forms.** A counselor collects a few hundred preference
  sheets and hand-places students into seats. It takes days, it is impossible to
  audit, and a mistake in row 200 is invisible.
- **First-come-first-served portals.** Registration opens at 8:00 AM and seats go
  to whoever has the fastest connection and the fewest morning classes. The result
  is a lottery that looks like a policy.
- **Static PDF catalogs.** Students pick courses from a 90-page document that never
  says which sections meet at the same time, which courses they are actually
  eligible for, or which ones are already full.

Underneath all of this is a genuine allocation problem: more students want popular
electives than there are seats, students have real preference orderings, courses
have hard capacity limits, and sections collide on the schedule. Solving that by
hand does not scale, and solving it by race condition is not fair.

## How Student Atlas solves it

**1. Make the catalog legible.** The catalog lives in Postgres, not a PDF. Courses
carry their department, eligible grade levels, which terms they run in, their
section meeting times, seat capacity, and structured prerequisites. Students filter
by grade and term, search descriptions, and can hide courses whose prerequisites
they do not meet based on the coursework they have recorded.

**2. Collect preferences instead of clicks.** Students bookmark courses, then drag
them into a ranked order — one column per term. The app enforces the school's
required ranking depth (a school can require 9th graders to rank 8 courses per term
and 12th graders to rank 12). Courses that span multiple terms stay aligned across
columns. Nothing is a race; students submit whenever they like before the deadline
and get an email confirming what they ranked.

## Architecture

React 19 + TypeScript on Vite, Tailwind v4 for styling, Supabase (Postgres) for
data, Vercel serverless functions for anything privileged, and Resend for email.

There are two real routes. `/teacher` is the catalog editor; everything else is the
student app, whose `courses` / `register` / `profile` views are client state in
`App.tsx` rather than separate URLs.

### Trust model

The browser only ever holds the Supabase anon key. Privileged work happens in
`api/`:

- **Catalog writes** (schools, terms, departments, courses, teachers) go through
  `/api/teacher-mutate`. The anon role has `SELECT`-only grants on those tables, so
  there is no client-side path to edit a catalog.
- **Teacher auth** is a per-school password stored as a bcrypt hash in
  `school_secrets`, a table with RLS enabled and no policies — unreadable by any
  client. `/api/teacher-login` verifies it through a `service_role`-only RPC (10
  failed attempts triggers a 15-minute lock) and returns an HMAC-SHA256 session
  token valid for 12 hours. `/api/teacher-mutate` re-verifies that token and will
  only modify the school encoded in it. Destructive actions require the password
  again.
- **Student identity** is email verification via one-time code. Codes are stored
  SHA-256 hashed in `email_verification_codes` with a 10-minute TTL and a 5-attempt
  cap, and verification gates signup, login, and email changes.

One caveat worth stating plainly: student tables (`students`, `bookmarked_courses`,
`submitted_courses`, `course_notes`, and friends) are still written from the browser
with the anon key under permissive RLS, and the app trusts the `studentId` in
`localStorage`. Email verification gates the UI flows, but writes are not
cryptographically bound to a verified identity. This is the main hardening target if
Student Atlas is deployed beyond a trusted school population.

### Data model

```
schools
  ├── school_secrets      bcrypt teacher password, service-role only
  ├── terms               ordered by position
  ├── departments         graduation_requirement text
  ├── teachers
  ├── courses             → department, teacher
  │                       term_options[], schedule[], max_student_count
  │                       students[]  ← roster written by the sort
  └── students            grade
                          times_taken[]  ← schedule written by the sort

students ──┬── completed_courses    self-reported prerequisites
           ├── enrolled_courses     self-reported corequisites
           ├── bookmarked_courses
           ├── course_notes
           ├── submitted_courses    preference number + submitted flag
           └── submitted_notes      appeal / note text
```

`courses.schedule` is a flat `integer[]` of `[day, start_minute, end_minute]`
triples. `students.times_taken` is a flat `integer[]` of
`[term_rank, day, start_minute, end_minute]` quads. Keep `src/types/database.ts` in
sync with the real schema.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

`npm run dev` serves the app and the `api/` functions together —
`vite.local-api.ts` mounts the serverless handlers on the Vite dev server, so you
do not need `vercel dev`. Note that `npm run preview` serves built assets only and
does _not_ include the API middleware, so the teacher gate and email flows will not
work there.

### Environment variables

| Variable                        | Used by               | Purpose                                                          |
| ------------------------------- | --------------------- | ---------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | browser, api, scripts | Supabase project URL                                             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser, api, scripts | Anon key for client reads                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | api only              | Bypasses RLS for catalog writes, password RPCs, and OTP storage  |
| `TEACHER_SESSION_SECRET`        | api only              | Signs teacher session tokens; falls back to the service-role key |
| `RESEND_API_KEY`                | api only              | Outbound email                                                   |
| `EMAIL_OTP_PEPPER`              | api only              | Optional extra secret for OTP hashing                            |

Only the `VITE_`-prefixed variables reach the browser. The rest must stay
server-side.

### Database setup

Schema, RLS policies, and stored functions are applied by hand in the Supabase SQL
Editor. `scripts/supabase-schema.sql` documents the full schema but is **context
only — not executable**; table order and constraints are not valid for a direct run.

The tracked scripts are the reusable ones. Run `assignment-columns.sql` before
`teacher-auth.sql`, since the latter revokes grants on `reorder_terms` and expects
that function to exist:

| Script                                                  | Purpose                                                                                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assignment-columns.sql`                                | Adds the elective columns (`courses.term_options`, `courses.schedule`, `courses.students`, `students.times_taken`, `schools.electives_assigned`, `terms.position`) and the `reorder_terms` RPC |
| `teacher-auth.sql`                                      | Moves passwords into `school_secrets` as bcrypt hashes, adds the verify/set RPCs, revokes anon write grants                                                                                    |
| `teacher-rls.sql`                                       | Read policies for catalog tables                                                                                                                                                               |
| `submitted-courses-rls.sql`, `submitted-notes-rls.sql`  | Policies for student submission tables                                                                                                                                                         |
| `email-verification-codes.sql`                          | OTP table, RLS on with no policies                                                                                                                                                             |
| `class-time-maintenance.sql`                            | `add/edit/remove_class_time` and `cleanup_class_times`                                                                                                                                         |
| `elective-assignment-apply.sql`                         | `apply_elective_assignments` RPC the sort writes through                                                                                                                                       |
| `school-grade-settings.sql`                             | Adds `schools.grade`                                                                                                                                                                           |
| `student-delete-cascade.sql`                            | Cascading FKs so deleting a student cleans up child rows                                                                                                                                       |
| `wipe-sort-assignments.sql`                             | Clears assignment results                                                                                                                                                                      |
| `drop-terms-season-year.sql`, `drop-skipped-emails.sql` | Legacy cleanups                                                                                                                                                                                |
| `migrate-courses.sql`                                   | Small generic demo catalog                                                                                                                                                                     |

School-specific seeds — real catalogs, bulk student data, and demo seeds that set
teacher passwords in plaintext — are **not** in this repository (see
[Sensitive data](#sensitive-data)). So there is no seed data to start from: create
your first school, terms, departments, and courses through the teacher UI at
`/teacher`, which sets the password hashed server-side.

## Running an assignment

```bash
npm run testsort -- "School Name"          # analyze, never writes
npm run sort -- "School Name" --dry-run    # full run, no write
npm run sort -- "School Name"              # run and apply
npm run sort -- "School Name" --seed 12345 # reproduce a previous run
```

`testsort` is the one to reach for first. It loads the same data and runs the same
algorithm, then prints a report: missing seats by grade, leftover fills,
a displacement matrix, preference-quality histograms per grade and term, class size
distributions, and any notes students submitted with their rankings. It never
touches the database.

`sort` loads from Supabase (`src/lib/loadElectiveData.ts`), runs the engine, and
applies results through the `apply_elective_assignments` RPC, which validates that
every ID belongs to the school and then clears and rewrites rosters and schedules in
a single transaction. Every run prints its seed — keep it if you want to reproduce
or audit the result.

Both accept a school name or UUID and read credentials from `.env.local`.

**Current limitation:** the sort is CLI-only and there is no student-facing view of
final placements. Results land in `courses.students` and `students.times_taken`;
telling students where they ended up is still a manual step outside this app.

## Project structure

```
src/App.tsx              student shell: header, sidebar, catalog/register/profile
src/main.tsx             router: /teacher → teacher app, /* → student app
src/components/          student UI (CourseBrowser, RegisterPage, ProfilePage, …)
src/components/teacher/  catalog forms, modals, unsaved-change guards
src/hooks/               data hooks (useCourses, useProfile, useTerms, …)
src/lib/                 Supabase client, student sync, sort orchestration
src/utils/               pure helpers: electiveSort, classTime, courseRanking
src/types/               database.ts (Supabase types), app.ts (view union)
api/                     Vercel functions: teacher auth/mutate, email
scripts/                 SQL and CLIs (sort, testsort, migrate-courses)
```

Files under `api/` must stay self-contained — no imports from `src/`, since Vercel's
bundler will miss them. Duplicate small helpers instead.

## Testing

```bash
npm test        # Vitest
npm run lint    # ESLint
npm run build   # tsc -b && vite build
```

Coverage is focused on the parts where a bug is expensive and silent: the sort
engine, ranking model, grade settings, and the teacher mutation endpoint. There is
no integration test against a live Supabase instance.

## Sensitive data

`.gitignore` excludes any SQL carrying a real school's data or a credential:

- `scripts/nueva-*.sql` — a real school's course catalog, descriptions, and
  prerequisites
- `scripts/*-students.sql` — bulk student seed rows
- `scripts/test-school.sql`, `scripts/test2-school.sql` — demo seeds that call
  `set_school_password()` with a plaintext password
- `scripts/_gen/` — the generators that emit those seeds, which embed the same
  passwords
- `scripts/local/`, `*.dump`, `*.sql.gz`, `*-dump.sql`, `*-export.sql` — a
  catch-all for local dumps and exports
- `.env*` (except `.env.example`) and `supabase/.temp` — the latter holds the
  Supabase project ref and a pooler connection string

If you add a seed for your own school, name it so it matches one of these patterns
or drop it in `scripts/local/`. Never put a password in a SQL file that will be
committed; set it through the teacher UI, which hashes it server-side.
