# Project Context

Student Atlas is a high-school course catalog and elective registration app. Students browse a school’s courses, bookmark them, rank electives by term, and submit preferences. Teachers manage the catalog behind a password gate. A deferred-acceptance sort then assigns students to elective seats. Stack: React 19, TypeScript, Vite, Tailwind v4, Supabase (Postgres), Vercel serverless functions, Resend for email.

# About Me

This product is for students, teachers, and counselors. Copy and UI should stay clear and practical — no jargon, no filler. Prefer small, targeted changes that match existing patterns over rewrites. When explaining work, use short bullets.

# Rules

- Match existing file structure, naming, and TypeScript style. Do not invent a parallel architecture.
- Student app views (`courses` / `register` / `profile`) are client state in `App.tsx`, not separate routes. Only `/teacher` is a real route.
- Browser code uses the Supabase anon key (`VITE_SUPABASE_PUBLISHABLE_KEY`). Never put `SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_SESSION_SECRET`, or school passwords in client code.
- Catalog writes (schools, terms, departments, courses, teachers) go through `/api/teacher-mutate` with the HMAC session from `/api/teacher-login`. The anon role is SELECT-only on those tables. Do not add client-side catalog mutations.
- Files under `api/` must stay self-contained: no imports from `src/` (Vercel’s bundler will miss them). Duplicate small helpers if needed.
- Student tables (`students`, `completed_courses`, `enrolled_courses`, `bookmarked_courses`, `course_notes`, `submitted_courses`, `submitted_notes`) are still written from the client with the anon key. Teacher cascade deletes that touch those tables run server-side with the service role.
- Schema and RLS live in `scripts/*.sql` and are applied in the Supabase SQL Editor. `scripts/supabase-schema.sql` is context only — not executable. Keep `src/types/database.ts` in sync with the real schema.
- Keep `src/utils/electiveSort.ts` pure (no I/O). Load/apply lives in `src/lib/loadElectiveData.ts`, `applyElectiveAssignments.ts`, and `sort.ts`. Prefer tests in `*.test.ts` (Vitest) for sort, ranking, and grade settings.
- Use design tokens from `src/index.css`: `main-*` (blue) and `detail-*` (cream). Body font is `font-sans`. Do not introduce a new palette.
-Ask clarifying questions.
- For any Supabase work, follow `.agents/skills/supabase/SKILL.md` and `.agents/skills/supabase-postgres-best-practices/SKILL.md`. Enable RLS on exposed tables; never expose `school_secrets`.
- Do not commit, push, or add unsolicited markdown docs unless asked.

# Project Structure

- `src/App.tsx` — student shell: header, sidebar, catalog / register / profile views
- `src/main.tsx` — router: `/teacher` → teacher app, `/*` → student app
- `src/components/` — student UI (`CourseBrowser`, `RegisterPage`, `ProfilePage`, `Header`, `Sidebar`, …)
- `src/components/teacher/` — teacher catalog forms, modals, and unsaved-change guards
- `src/hooks/` — data hooks (`useCourses`, `useProfile`, `useSubjects`, `useTerms`, school settings)
- `src/lib/` — Supabase client, student sync, teacher API wrappers, elective sort orchestration
- `src/utils/` — pure helpers: `electiveSort.ts` (DA engine), `classTime.ts`, `courseRanking.ts`, `gradeSettings.ts`
- `src/data/` — course/subject types and static fallbacks used by the UI
- `src/types/` — `database.ts` (generated-style Supabase types), `app.ts` (view union)
- `api/` — Vercel functions: `teacher-login`, `teacher-mutate`, email verification, elective-registration email
- `scripts/` — SQL (schema, RLS, school seeds) and CLIs (`npm run sort`, `npm run testsort`, `npm run migrate-courses`)
- `public/` — static assets (logo)
- `.cursor/rules/` — always-on design tokens and notes
- `.agents/skills/` — Supabase agent skills
