// Vercel serverless function: every student read and write.
// Self-contained (no imports outside api/) so Vercel's function bundler includes everything.
//
// The anon key has no access to the student tables (see scripts/student-rls.sql),
// so the student app goes through here. Each request carries the session token
// issued by /api/verify-email-code; the student it was minted for is the only
// student this request can touch, regardless of what the body claims.
//
// `createStudent` is the one action without a session: it takes the short-lived
// email proof from a verified signup code instead.

import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FROM_ADDRESS = "Student Atlas <noreply@emptyconsole.com>";

const MAX_NAME_LENGTH = 200;
const MAX_NOTE_LENGTH = 5000;
const MAX_LIST_LENGTH = 500;

type Payload = {
  action?: string;
  proof?: unknown;
  emailProof?: unknown;
  name?: unknown;
  email?: unknown;
  grade?: unknown;
  schoolId?: unknown;
  screenMode?: unknown;
  completedCourses?: unknown;
  courseIds?: unknown;
  courseNotes?: unknown;
  columnOrders?: unknown;
  submitted?: unknown;
  note?: unknown;
  columns?: unknown;
};

type ScreenMode = "light" | "dark" | "default";

type StudentRow = {
  id: string;
  name: string;
  email: string;
  grade: number | null;
  school_id: string;
  screen_mode: string | null;
};

/** Service-role client. Wrapped so `Supabase` below infers a concrete type. */
function createServiceClient() {
  const url = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Supabase = ReturnType<typeof createServiceClient>;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tokens (kept in sync with api/verify-email-code.ts)
// ---------------------------------------------------------------------------

function sessionSecret(): string {
  return (
    process.env.STUDENT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The "student." prefix keeps these from ever verifying as teacher tokens. */
function signPayload(payload: Record<string, unknown>): string {
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(
    createHmac("sha256", sessionSecret()).update(`student.${body}`).digest(),
  );
  return `${body}.${signature}`;
}

function readToken(token: string): Record<string, unknown> | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = base64url(
    createHmac("sha256", sessionSecret()).update(`student.${body}`).digest(),
  );
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function signSession(studentId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return { token: signPayload({ typ: "session", stu: studentId, exp: expiresAt }), expiresAt };
}

function studentIdFromSession(token: string): string | null {
  const parsed = readToken(token);
  if (!parsed || parsed.typ !== "session" || typeof parsed.stu !== "string") return null;
  return parsed.stu;
}

/** Returns the verified email an email proof carries for `purpose`, or null. */
function emailFromProof(proof: unknown, purpose: string): string | null {
  if (typeof proof !== "string") return null;
  const parsed = readToken(proof);
  if (
    !parsed ||
    parsed.typ !== "proof" ||
    parsed.purpose !== purpose ||
    typeof parsed.email !== "string"
  ) {
    return null;
  }
  return parsed.email;
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Escapes `%`, `_`, and `\` so an email can be matched exactly with ILIKE.
 *
 * `*` is deliberately absent: PostgREST rewrites every `*` in a `like` /
 * `ilike` value to `%` with a blind character map, so `\*` would arrive as
 * `\%` and match a literal percent sign instead. It has to be refused rather
 * than escaped — `hasLikeWildcard` below is that check.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** True when an address carries a wildcard `escapeLike` cannot neutralize. */
function hasLikeWildcard(value: string): boolean {
  return value.includes("*");
}

function isGrade(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 12;
}

/** "default" means follow the device's color scheme. */
function screenMode(value: unknown): ScreenMode {
  return value === "light" || value === "dark" ? value : "default";
}

function toMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return err instanceof Error ? err.message : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const missing: string[] = [];
  if (!process.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    return json(
      { error: `Server is missing required environment variables: ${missing.join(", ")}` },
      500,
    );
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createServiceClient();

  try {
    if (payload.action === "createStudent") {
      return await createStudent(supabase, payload);
    }

    const header = request.headers.get("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    const studentId = token ? studentIdFromSession(token) : null;
    if (!studentId) {
      return json({ error: "Your session expired. Log in again." }, 401);
    }

    const student = await loadStudentRow(supabase, studentId);
    if (!student) {
      return json({ error: "Your account no longer exists. Log in again." }, 401);
    }

    switch (payload.action) {
      case "load":
        return json(await studentSnapshot(supabase, student), 200);
      case "loadRankings":
        return await loadRankings(supabase, student);
      case "saveProfile":
        return await saveProfile(supabase, student, payload);
      case "saveCourses":
        return await saveCourses(supabase, student, payload.completedCourses);
      case "saveBookmarks":
        return await saveBookmarks(supabase, student, payload);
      case "saveNotes":
        return await saveNotes(supabase, student, payload);
      case "saveRankings":
        return await saveRankings(supabase, student, payload);
      case "saveSubmissionNote":
        return await saveSubmissionNote(supabase, student, payload);
      case "sendConfirmation":
        return await sendConfirmation(supabase, student, payload);
      case "deleteAccount":
        return await deleteAccount(supabase, student);
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error(`student ${payload.action} error:`, err);
    return json({ error: toMessage(err, "Something went wrong.") }, 500);
  }
}

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

async function loadStudentRow(supabase: Supabase, studentId: string): Promise<StudentRow | null> {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, email, grade, school_id, screen_mode")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  return (data as StudentRow | null) ?? null;
}

async function findStudentByEmail(supabase: Supabase, email: string): Promise<StudentRow | null> {
  // Callers reach here with an email from a signed proof, which /api/verify-email-code
  // already refused a `*` in. Belt and braces: never let one widen the pattern.
  if (hasLikeWildcard(email)) return null;

  const { data, error } = await supabase
    .from("students")
    .select("id, name, email, grade, school_id, screen_mode")
    .ilike("email", escapeLike(email))
    .limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as StudentRow | undefined) ?? null;
}

/** Keeps only ids of courses that exist, preserving order and dropping repeats. */
async function existingCourseIds(supabase: Supabase, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids)) return [];
  const candidates = [...new Set(ids.filter(isUuid))].slice(0, MAX_LIST_LENGTH);
  if (candidates.length === 0) return [];
  const { data, error } = await supabase.from("courses").select("id").in("id", candidates);
  if (error) throw error;
  const found = new Set((data ?? []).map((row) => row.id as string));
  return candidates.filter((id) => found.has(id));
}

/** The student's profile plus completed/enrolled courses, bookmarks, and notes. */
async function studentSnapshot(supabase: Supabase, student: StudentRow) {
  const [completedRes, enrolledRes, bookmarkedRes, notesRes] = await Promise.all([
    supabase.from("completed_courses").select("course_id").eq("student_id", student.id),
    supabase.from("enrolled_courses").select("course_id").eq("student_id", student.id),
    supabase.from("bookmarked_courses").select("course_id").eq("student_id", student.id),
    supabase.from("course_notes").select("course_id, note").eq("student_id", student.id),
  ]);
  const failed = [completedRes, enrolledRes, bookmarkedRes, notesRes].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const completedIds = (completedRes.data ?? []).map((r) => r.course_id as string);
  const enrolledIds = (enrolledRes.data ?? []).map((r) => r.course_id as string);

  const titleById = new Map<string, string>();
  const allIds = [...new Set([...completedIds, ...enrolledIds])];
  if (allIds.length > 0) {
    const { data, error } = await supabase.from("courses").select("id, title").in("id", allIds);
    if (error) throw error;
    for (const row of data ?? []) titleById.set(row.id as string, row.title as string);
  }

  const completedCourses: Record<string, "prereq" | "coreq"> = {};
  for (const id of completedIds) {
    const title = titleById.get(id);
    if (title) completedCourses[title] = "prereq";
  }
  for (const id of enrolledIds) {
    const title = titleById.get(id);
    if (title) completedCourses[title] = "coreq";
  }

  const courseNotes: Record<string, string> = {};
  for (const row of notesRes.data ?? []) {
    if (row.note) courseNotes[row.course_id as string] = row.note as string;
  }

  return {
    studentId: student.id,
    profile: {
      schoolId: student.school_id,
      name: student.name,
      email: student.email,
      grade: student.grade,
      screenMode: screenMode(student.screen_mode),
    },
    completedCourses,
    bookmarkIds: (bookmarkedRes.data ?? []).map((r) => r.course_id as string),
    courseNotes,
  };
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

/**
 * Signup, after the email code was verified. The email comes from the proof,
 * never the body. An email that already has an account signs into it, applying
 * the form's profile fields, which matches the old client-side behavior.
 */
async function createStudent(supabase: Supabase, payload: Payload): Promise<Response> {
  const email = emailFromProof(payload.proof, "signup");
  if (!email) {
    return json({ error: "Your email verification expired. Verify your email again." }, 401);
  }

  const name = text(payload.name).slice(0, MAX_NAME_LENGTH);
  const schoolId = payload.schoolId;
  if (!name || !isUuid(schoolId) || !isGrade(payload.grade)) {
    return json({ error: "Please select a school and fill in your name, email, and grade." }, 400);
  }

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("id")
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolError) throw schoolError;
  if (!school) return json({ error: "That school no longer exists." }, 400);

  let student = await findStudentByEmail(supabase, email);
  const existing = student !== null;
  const mode = screenMode(payload.screenMode);

  if (student) {
    const { error } = await supabase
      .from("students")
      .update({ name, grade: payload.grade, school_id: schoolId, screen_mode: mode })
      .eq("id", student.id);
    if (error) throw error;
    student = { ...student, name, grade: payload.grade, school_id: schoolId, screen_mode: mode };
  } else {
    const { data, error } = await supabase
      .from("students")
      .insert({ name, email, grade: payload.grade, school_id: schoolId, screen_mode: mode })
      .select("id, name, email, grade, school_id, screen_mode")
      .single();
    if (error) throw error;
    student = data as StudentRow;
  }

  const coursesError = await replaceCompletedCourses(supabase, student, payload.completedCourses);
  if (coursesError) return coursesError;

  const session = signSession(student.id);
  return json(
    {
      ...session,
      existing,
      snapshot: await studentSnapshot(supabase, student),
    },
    200,
  );
}

/** Name, grade, school, and screen mode. A new email also needs a verified
 * email proof. */
async function saveProfile(
  supabase: Supabase,
  student: StudentRow,
  payload: Payload,
): Promise<Response> {
  const name = text(payload.name).slice(0, MAX_NAME_LENGTH);
  const email = normalizeEmail(text(payload.email));
  const schoolId = payload.schoolId;
  if (!name || !email || !isUuid(schoolId) || !isGrade(payload.grade)) {
    return json({ error: "Please select a school and fill in your name, email, and grade." }, 400);
  }

  const update: Record<string, unknown> = {
    name,
    grade: payload.grade,
    school_id: schoolId,
    screen_mode: screenMode(payload.screenMode),
  };

  if (email !== normalizeEmail(student.email)) {
    if (emailFromProof(payload.emailProof, "email_change") !== email) {
      return json({ error: "Verify your new email before saving it." }, 403);
    }
    const taken = await findStudentByEmail(supabase, email);
    if (taken && taken.id !== student.id) {
      return json({ error: "That email is already in use." }, 409);
    }
    update.email = email;
  }

  const { error } = await supabase.from("students").update(update).eq("id", student.id);
  if (error) throw error;
  return json({ ok: true }, 200);
}

async function deleteAccount(supabase: Supabase, student: StudentRow): Promise<Response> {
  // Child rows must go first: their FKs to students(id) would otherwise block
  // the final students delete.
  const childDeletes = await Promise.all(
    [
      "bookmarked_courses",
      "completed_courses",
      "enrolled_courses",
      "course_notes",
      "submitted_courses",
      "submitted_notes",
    ].map((table) => supabase.from(table).delete().eq("student_id", student.id)),
  );
  const childError = childDeletes.find((r) => r.error)?.error;
  if (childError) throw childError;

  const { error } = await supabase.from("students").delete().eq("id", student.id);
  if (error) throw error;
  return json({ ok: true }, 200);
}

// ---------------------------------------------------------------------------
// Completed / enrolled courses, bookmarks, notes
// ---------------------------------------------------------------------------

async function saveCourses(
  supabase: Supabase,
  student: StudentRow,
  completedCourses: unknown,
): Promise<Response> {
  const error = await replaceCompletedCourses(supabase, student, completedCourses);
  return error ?? json({ ok: true }, 200);
}

/**
 * Prereqs -> completed_courses, coreqs -> enrolled_courses. The client sends
 * course titles; they are resolved within the student's own school so a title
 * shared by two schools can't pick the other school's course.
 */
async function replaceCompletedCourses(
  supabase: Supabase,
  student: StudentRow,
  completedCourses: unknown,
): Promise<Response | null> {
  const prereqTitles: string[] = [];
  const coreqTitles: string[] = [];
  if (completedCourses && typeof completedCourses === "object") {
    for (const [title, type] of Object.entries(completedCourses as Record<string, unknown>)) {
      if (type === "prereq") prereqTitles.push(title);
      else if (type === "coreq") coreqTitles.push(title);
    }
  }

  const allTitles = [...new Set([...prereqTitles, ...coreqTitles])].slice(0, MAX_LIST_LENGTH);
  const idByTitle = new Map<string, string>();
  if (allTitles.length > 0) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, title")
      .eq("school_id", student.school_id)
      .in("title", allTitles);
    if (error) throw error;
    for (const row of data ?? []) idByTitle.set(row.title as string, row.id as string);
  }
  const toIds = (titles: string[]) => [
    ...new Set(titles.map((t) => idByTitle.get(t)).filter((id): id is string => Boolean(id))),
  ];
  const prereqIds = toIds(prereqTitles);
  const coreqIds = toIds(coreqTitles);

  const deletes = await Promise.all([
    supabase.from("completed_courses").delete().eq("student_id", student.id),
    supabase.from("enrolled_courses").delete().eq("student_id", student.id),
  ]);
  const deleteError = deletes.find((r) => r.error)?.error;
  if (deleteError) throw deleteError;

  if (prereqIds.length > 0) {
    const { error } = await supabase
      .from("completed_courses")
      .insert(prereqIds.map((course_id) => ({ student_id: student.id, course_id })));
    if (error) throw error;
  }
  if (coreqIds.length > 0) {
    const { error } = await supabase
      .from("enrolled_courses")
      .insert(coreqIds.map((course_id) => ({ student_id: student.id, course_id })));
    if (error) throw error;
  }
  return null;
}

async function saveBookmarks(
  supabase: Supabase,
  student: StudentRow,
  payload: Payload,
): Promise<Response> {
  const ids = await existingCourseIds(supabase, payload.courseIds);

  const { error: deleteError } = await supabase
    .from("bookmarked_courses")
    .delete()
    .eq("student_id", student.id);
  if (deleteError) throw deleteError;

  if (ids.length > 0) {
    const { error } = await supabase
      .from("bookmarked_courses")
      .insert(ids.map((course_id) => ({ student_id: student.id, course_id })));
    if (error) throw error;
  }
  return json({ ok: true }, 200);
}

async function saveNotes(
  supabase: Supabase,
  student: StudentRow,
  payload: Payload,
): Promise<Response> {
  const notes =
    payload.courseNotes && typeof payload.courseNotes === "object"
      ? (payload.courseNotes as Record<string, unknown>)
      : {};
  const trimmed = new Map<string, string>();
  for (const [courseId, note] of Object.entries(notes)) {
    const value = text(note).slice(0, MAX_NOTE_LENGTH);
    if (value) trimmed.set(courseId, value);
  }
  const ids = await existingCourseIds(supabase, [...trimmed.keys()]);

  const { error: deleteError } = await supabase
    .from("course_notes")
    .delete()
    .eq("student_id", student.id);
  if (deleteError) throw deleteError;

  if (ids.length > 0) {
    const { error } = await supabase.from("course_notes").insert(
      ids.map((course_id) => ({
        student_id: student.id,
        course_id,
        note: trimmed.get(course_id)!,
      })),
    );
    if (error) throw error;
  }
  return json({ ok: true }, 200);
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

/** Official rankings, draft rankings, and the latest submission note. */
async function loadRankings(supabase: Supabase, student: StudentRow): Promise<Response> {
  const [submittedRes, draftRes, noteRes] = await Promise.all([
    supabase
      .from("submitted_courses")
      .select("course_id, preference")
      .eq("student_id", student.id)
      .eq("submitted", true)
      .order("preference", { ascending: true }),
    supabase
      .from("submitted_courses")
      .select("course_id, preference")
      .eq("student_id", student.id)
      .eq("submitted", false)
      .order("preference", { ascending: true }),
    supabase
      .from("submitted_notes")
      .select("note")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const failed = [submittedRes, draftRes, noteRes].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const note = (noteRes.data?.note as string | null | undefined) ?? "";
  return json(
    {
      submitted: submittedRes.data ?? [],
      drafts: draftRes.data ?? [],
      note: note.trim() ? note : "",
    },
    200,
  );
}

/**
 * `columnOrders` is one ordered list of course ids per term column; each
 * column's preference numbering restarts at 1, and a course that appears in
 * multiple columns keeps its first occurrence.
 *
 * Draft saves (`submitted: false`) replace only draft rows so an official
 * submitted snapshot can coexist. Final submit (`submitted: true`) deletes all
 * of the student's rows (draft + prior submitted) then inserts the new set.
 */
async function saveRankings(
  supabase: Supabase,
  student: StudentRow,
  payload: Payload,
): Promise<Response> {
  const submitted = payload.submitted === true;
  const columnOrders = Array.isArray(payload.columnOrders)
    ? payload.columnOrders.filter(Array.isArray)
    : [];
  const valid = new Set(await existingCourseIds(supabase, columnOrders.flat()));

  let deleteQuery = supabase.from("submitted_courses").delete().eq("student_id", student.id);
  if (!submitted) deleteQuery = deleteQuery.eq("submitted", false);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  const seen = new Set<string>();
  const rows: { student_id: string; course_id: string; preference: number; submitted: boolean }[] =
    [];
  for (const order of columnOrders as unknown[][]) {
    for (const [i, courseId] of order.entries()) {
      if (typeof courseId !== "string" || !valid.has(courseId) || seen.has(courseId)) continue;
      seen.add(courseId);
      rows.push({ student_id: student.id, course_id: courseId, preference: i + 1, submitted });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("submitted_courses").insert(rows);
    if (error) throw error;
  }
  return json({ ok: true }, 200);
}

/** One submission note per student. */
async function saveSubmissionNote(
  supabase: Supabase,
  student: StudentRow,
  payload: Payload,
): Promise<Response> {
  const note = text(payload.note).slice(0, MAX_NOTE_LENGTH) || null;

  const { error: deleteError } = await supabase
    .from("submitted_notes")
    .delete()
    .eq("student_id", student.id);
  if (deleteError) throw deleteError;

  const { error } = await supabase
    .from("submitted_notes")
    .insert({ student_id: student.id, note });
  if (error) throw error;
  return json({ ok: true }, 200);
}

// ---------------------------------------------------------------------------
// Confirmation email (always to the signed-in student's own address)
// ---------------------------------------------------------------------------

function buildEmailHtml(
  studentName: string,
  columns: { termName: string; titles: string[] }[],
  note: string | null,
): string {
  const termSections = columns
    .map((col) => {
      const items = col.titles
        .map(
          (title, i) => `
            <tr>
              <td style="padding:6px 12px 6px 0;color:#4169e1;font-weight:700;white-space:nowrap;vertical-align:top;">${i + 1}.</td>
              <td style="padding:6px 0;color:#374151;">${escapeHtml(title)}</td>
            </tr>`,
        )
        .join("");
      return `
        <div style="margin-top:24px;">
          <h2 style="margin:0 0 8px;font-size:16px;color:#1f2937;">${escapeHtml(col.termName)}</h2>
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
            ${items}
          </table>
        </div>`;
    })
    .join("");

  const noteSection = note
    ? `
      <div style="margin-top:24px;padding:12px 16px;background:#fffff0;border:1px solid #f3e5ab;border-radius:8px;">
        <h2 style="margin:0 0 6px;font-size:14px;color:#1f2937;">Your appeals / notes</h2>
        <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(note)}</p>
      </div>`
    : "";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#faf9f6;">
      <div style="background:#ffffff;border:1px solid #d7e3fc;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#1f2937;">Elective rankings submitted</h1>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
          Hi ${escapeHtml(studentName)}, here's a copy of the course rankings you submitted.
        </p>
        ${termSections}
        ${noteSection}
        <p style="margin:28px 0 0;font-size:12px;color:#9ca3af;">
          This is an automated confirmation from Student Atlas. If anything looks wrong, please contact your school.
        </p>
      </div>
    </div>`;
}

async function sendConfirmation(
  supabase: Supabase,
  student: StudentRow,
  payload: Payload,
): Promise<Response> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return json({ error: "Server is missing RESEND_API_KEY." }, 500);
  }

  const columns = (Array.isArray(payload.columns) ? payload.columns : [])
    .slice(0, 20)
    .map((col) => {
      const c = (col ?? {}) as { termName?: unknown; courseIds?: unknown };
      return {
        termName: text(c.termName).slice(0, 100) || "Term",
        courseIds: Array.isArray(c.courseIds) ? c.courseIds.filter(isUuid) : [],
      };
    });
  if (columns.length === 0) {
    return json({ error: "columns are required" }, 400);
  }

  const allIds = [...new Set(columns.flatMap((col) => col.courseIds))].slice(0, MAX_LIST_LENGTH);
  const titleById = new Map<string, string>();
  if (allIds.length > 0) {
    const { data, error } = await supabase.from("courses").select("id, title").in("id", allIds);
    if (error) throw error;
    for (const row of data ?? []) titleById.set(row.id as string, row.title as string);
  }

  const html = buildEmailHtml(
    student.name || "there",
    columns.map((col) => ({
      termName: col.termName,
      titles: col.courseIds
        .map((id) => titleById.get(id))
        .filter((t): t is string => Boolean(t)),
    })),
    text(payload.note).slice(0, MAX_NOTE_LENGTH) || null,
  );

  const resend = new Resend(resendApiKey);
  const { error: sendError } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: student.email,
    subject: "Your elective rankings have been submitted",
    html,
  });
  if (sendError) {
    console.error("Resend error:", sendError);
    return json({ error: "Failed to send email" }, 502);
  }
  return json({ ok: true }, 200);
}
