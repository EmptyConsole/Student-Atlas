// Vercel serverless function: every teacher-catalog write.
// Self-contained (no imports outside api/) so Vercel's function bundler includes everything.
//
// The anon key can only read the catalog tables (see scripts/teacher-auth.sql),
// so all teacher writes land here. Each request carries the session token
// issued by /api/teacher-login; the school it was minted for is the only
// school this request can touch, regardless of what the body claims.

import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Wrapped so `Supabase` below infers a concrete type. */
function createServiceClient() {
  const url = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Supabase = ReturnType<typeof createServiceClient>;

type ClassTime = { day: number; start: number; end: number };
type ClassTimeEdit = { original: ClassTime | null; value: ClassTime };

type SchoolPayload = {
  name?: string;
  website?: string;
  city?: string;
  state?: string;
  /** Blank or absent keeps the current password. */
  password?: string;
  rankings?: number;
  /** Already serialized `schools.grade` object. */
  grade?: unknown;
};

type TermDraftPayload = { id?: string | null; name?: string };

type DepartmentPayload = {
  name?: string;
  subtitle?: string;
  graduationRequirement?: string;
};

type OfferingPayload = {
  courseId?: string | null;
  termOptions?: string[];
  times?: ClassTimeEdit[];
};

type CoursePayload = {
  title?: string;
  shortDescription?: string;
  longDescription?: string;
  grades?: number[];
  subject?: string;
  departmentId?: string | null;
  teacherName?: string;
  maxStudentCount?: number;
  retakeable?: boolean;
  prereqOptions?: string[][];
  coreqOptions?: string[][];
  offerings?: OfferingPayload[];
};

type Payload = {
  action?: string;
  password?: string;
  school?: SchoolPayload;
  terms?: TermDraftPayload[];
  departmentId?: string;
  department?: DepartmentPayload;
  courseId?: string;
  course?: CoursePayload;
  existingRows?: { courseId?: string; schedule?: ClassTime[] }[];
};

/** Child tables keyed by `course_id`, cleared before a course row is removed. */
const COURSE_CHILD_TABLES = [
  "completed_courses",
  "enrolled_courses",
  "bookmarked_courses",
  "course_notes",
  "submitted_courses",
  "course_prerequisites",
  "course_corequisites",
  "graduation_requirements",
] as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sessionSecret(): string {
  return (
    process.env.TEACHER_SESSION_SECRET ||
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

/** Returns the school id a token authorizes, or null when it is not valid. */
function schoolIdFromToken(token: string): string | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = base64url(
    createHmac("sha256", sessionSecret()).update(body).digest(),
  );
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as { sid?: unknown; exp?: unknown };
    if (typeof parsed.sid !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp <= Date.now()) return null;
    return parsed.sid;
  } catch {
    return null;
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Stable key matching the SQL helper `class_time_key`. */
function classTimeKey(t: ClassTime): string {
  return `${t.day},${t.start},${t.end}`;
}

function toScheduleArray(times: ClassTime[]): number[][] {
  return [...times]
    .sort((a, b) => a.day - b.day || a.start - b.start)
    .map((t) => [t.day, t.start, t.end]);
}

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
  if (!sessionSecret()) {
    return json({ error: "Server is missing TEACHER_SESSION_SECRET." }, 500);
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const schoolId = token ? schoolIdFromToken(token) : null;
  if (!schoolId) {
    return json({ error: "Your session expired. Unlock the school again." }, 401);
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createServiceClient();

  try {
    switch (payload.action) {
      case "updateSchool":
        return await updateSchool(supabase, schoolId, payload);
      case "deleteSchool":
        return await deleteSchool(supabase, schoolId, payload);
      case "createDepartment":
        return await createDepartment(supabase, schoolId, payload);
      case "updateDepartment":
        return await updateDepartment(supabase, schoolId, payload);
      case "deleteDepartment":
        return await deleteDepartment(supabase, schoolId, payload);
      case "saveCourseOfferings":
        return await saveCourseOfferings(supabase, schoolId, payload);
      case "deleteCourse":
        return await deleteCourse(supabase, schoolId, payload);
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error(`teacher-mutate ${payload.action} error:`, err);
    return json({ error: toMessage(err, "Something went wrong.") }, 500);
  }
}

// ---------------------------------------------------------------------------
// Shared guards
// ---------------------------------------------------------------------------

/** Re-checks the school password for destructive actions. */
async function requirePassword(
  supabase: Supabase,
  schoolId: string,
  password: unknown,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("verify_school_password", {
    p_school_id: schoolId,
    p_password: typeof password === "string" ? password : "",
  });
  if (error) {
    if ((error.message ?? "").includes("school_locked")) {
      return "Too many attempts. Try again in 15 minutes.";
    }
    throw error;
  }
  return data === true ? null : "Incorrect password for this school.";
}

/** Course ids belonging to the token's school, used to reject foreign ids. */
async function schoolCourseIds(
  supabase: Supabase,
  schoolId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("courses")
    .select("id")
    .eq("school_id", schoolId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id as string));
}

/** Clears every child row that references the given courses. */
async function clearCourseChildren(
  supabase: Supabase,
  courseIds: string[],
): Promise<void> {
  if (courseIds.length === 0) return;
  for (const table of COURSE_CHILD_TABLES) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in("course_id", courseIds);
    if (error) throw error;
  }
  // The prereq/coreq join tables also point at courses from the other side.
  const { error: prereqError } = await supabase
    .from("course_prerequisites")
    .delete()
    .in("prerequisite_course_id", courseIds);
  if (prereqError) throw prereqError;

  const { error: coreqError } = await supabase
    .from("course_corequisites")
    .delete()
    .in("corequisite_course_id", courseIds);
  if (coreqError) throw coreqError;
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

async function updateSchool(
  supabase: Supabase,
  schoolId: string,
  payload: Payload,
): Promise<Response> {
  const input = payload.school ?? {};
  const name = text(input.name);
  if (!name) return json({ error: "School name is required." }, 400);

  const { error } = await supabase
    .from("schools")
    .update({
      name,
      website: text(input.website),
      city: text(input.city),
      state: text(input.state),
      rankings: typeof input.rankings === "number" ? input.rankings : 8,
      grade: input.grade ?? {},
    })
    .eq("id", schoolId);
  if (error) throw error;

  // A blank field in the form means "keep the current password".
  const password = typeof input.password === "string" ? input.password : "";
  if (password.trim()) {
    const { error: passwordError } = await supabase.rpc("set_school_password", {
      p_school_id: schoolId,
      p_password: password,
    });
    if (passwordError) throw passwordError;
  }

  const termsError = await reconcileTerms(supabase, schoolId, payload.terms ?? []);
  if (termsError) return json({ error: termsError }, 400);

  return json({ name }, 200);
}

async function deleteSchool(
  supabase: Supabase,
  schoolId: string,
  payload: Payload,
): Promise<Response> {
  const denied = await requirePassword(supabase, schoolId, payload.password);
  if (denied) return json({ error: denied }, 403);

  const courseIds = [...(await schoolCourseIds(supabase, schoolId))];

  const { data: studentRows, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId);
  if (studentsError) throw studentsError;
  const studentIds = (studentRows ?? []).map((s) => s.id as string);

  await clearCourseChildren(supabase, courseIds);

  if (studentIds.length > 0) {
    const { error } = await supabase
      .from("submitted_notes")
      .delete()
      .in("student_id", studentIds);
    if (error) throw error;
  }

  // Dependency order matters, so these run one at a time.
  for (const table of ["courses", "departments", "teachers", "terms", "students"]) {
    const { error } = await supabase.from(table).delete().eq("school_id", schoolId);
    if (error) throw error;
  }

  // school_secrets is removed by its ON DELETE CASCADE foreign key.
  const { error } = await supabase.from("schools").delete().eq("id", schoolId);
  if (error) throw error;

  return json({ ok: true }, 200);
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

/**
 * Applies the school form's term drafts: deletes removed terms (guarded by
 * course usage), renames changed ones, creates new ones, then persists the
 * ordering through reorder_terms so students.times_taken ranks stay aligned.
 * Returns a user-facing message when a term could not be deleted.
 */
async function reconcileTerms(
  supabase: Supabase,
  schoolId: string,
  drafts: TermDraftPayload[],
): Promise<string | null> {
  const { data: existing, error: existingError } = await supabase
    .from("terms")
    .select("id, name, position")
    .eq("school_id", schoolId);
  if (existingError) throw existingError;

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("term_options")
    .eq("school_id", schoolId);
  if (coursesError) throw coursesError;

  const usedTermIds = new Set<string>();
  for (const course of courses ?? []) {
    const options = course.term_options;
    if (Array.isArray(options)) {
      for (const id of options) usedTermIds.add(id as string);
    }
  }

  const keptIds = new Set(
    drafts.map((d) => d.id).filter((id): id is string => typeof id === "string"),
  );

  for (const term of existing ?? []) {
    const id = term.id as string;
    if (keptIds.has(id)) continue;
    if (usedTermIds.has(id)) {
      return "This term is used by one or more courses and cannot be deleted.";
    }
    const { error } = await supabase.from("terms").delete().eq("id", id);
    if (error) throw error;
  }

  let nextPosition = (existing ?? []).reduce(
    (max, row) => Math.max(max, (row.position as number | null) ?? 0),
    -1,
  );

  const orderedIds: string[] = [];
  for (const draft of drafts) {
    const name = text(draft.name);
    if (!name) return "Term name is required.";

    if (typeof draft.id === "string") {
      const prev = (existing ?? []).find((t) => t.id === draft.id);
      if (!prev) return "That term no longer exists. Reopen the school form.";
      if (prev.name !== name) {
        const { error } = await supabase
          .from("terms")
          .update({ name })
          .eq("id", draft.id)
          .eq("school_id", schoolId);
        if (error) throw error;
      }
      orderedIds.push(draft.id);
    } else {
      nextPosition += 1;
      const { data, error } = await supabase
        .from("terms")
        .insert({ school_id: schoolId, name, position: nextPosition })
        .select("id")
        .single();
      if (error) throw error;
      if (data) orderedIds.push(data.id as string);
    }
  }

  const { error: reorderError } = await supabase.rpc("reorder_terms", {
    p_school_id: schoolId,
    p_ordered_term_ids: orderedIds,
  });
  if (reorderError) throw reorderError;

  return null;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

function departmentFields(input: DepartmentPayload) {
  return {
    name: text(input.name),
    subtitle: text(input.subtitle),
    graduation_requirement: text(input.graduationRequirement),
  };
}

async function createDepartment(
  supabase: Supabase,
  schoolId: string,
  payload: Payload,
): Promise<Response> {
  const fields = departmentFields(payload.department ?? {});
  if (!fields.name) return json({ error: "Department name is required." }, 400);

  const { data, error } = await supabase
    .from("departments")
    .insert({ school_id: schoolId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return json({ department: data }, 200);
}

async function updateDepartment(
  supabase: Supabase,
  schoolId: string,
  payload: Payload,
): Promise<Response> {
  const departmentId = text(payload.departmentId);
  const fields = departmentFields(payload.department ?? {});
  if (!departmentId) return json({ error: "Missing department." }, 400);
  if (!fields.name) return json({ error: "Department name is required." }, 400);

  const { data: existing, error: existingError } = await supabase
    .from("departments")
    .select("name")
    .eq("id", departmentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return json({ error: "That department was not found." }, 404);

  const { error } = await supabase
    .from("departments")
    .update(fields)
    .eq("id", departmentId)
    .eq("school_id", schoolId);
  if (error) throw error;

  // Courses carry a denormalized `subject` for UI grouping; keep it in sync.
  if (existing.name !== fields.name) {
    const { error: coursesError } = await supabase
      .from("courses")
      .update({ subject: fields.name })
      .eq("department_id", departmentId)
      .eq("school_id", schoolId);
    if (coursesError) throw coursesError;
  }

  return json({ ok: true }, 200);
}

async function deleteDepartment(
  supabase: Supabase,
  schoolId: string,
  payload: Payload,
): Promise<Response> {
  const departmentId = text(payload.departmentId);
  if (!departmentId) return json({ error: "Missing department." }, 400);

  const denied = await requirePassword(supabase, schoolId, payload.password);
  if (denied) return json({ error: denied }, 403);

  const { data: department, error: departmentError } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (departmentError) throw departmentError;
  if (!department) return json({ error: "That department was not found." }, 404);

  const { data: courseRows, error: coursesError } = await supabase
    .from("courses")
    .select("id")
    .eq("department_id", departmentId)
    .eq("school_id", schoolId);
  if (coursesError) throw coursesError;

  await clearCourseChildren(
    supabase,
    (courseRows ?? []).map((c) => c.id as string),
  );

  const { error: courseError } = await supabase
    .from("courses")
    .delete()
    .eq("department_id", departmentId)
    .eq("school_id", schoolId);
  if (courseError) throw courseError;

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", departmentId)
    .eq("school_id", schoolId);
  if (error) throw error;

  return json({ ok: true }, 200);
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

/**
 * Finds an existing teacher for the school by full name (case-insensitive) or
 * creates one. The first whitespace-delimited word is the first name and the
 * remainder the last name. Returns null when the name is blank.
 */
async function resolveTeacher(
  supabase: Supabase,
  schoolId: string,
  fullName: string,
): Promise<string | null> {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  const [firstName, ...rest] = trimmed.split(" ");
  const lastName = rest.join(" ");

  const { data: existing } = await supabase
    .from("teachers")
    .select("id, first_name, last_name")
    .eq("school_id", schoolId);

  const match = (existing ?? []).find(
    (t) =>
      `${t.first_name} ${t.last_name}`.trim().toLowerCase() ===
      trimmed.toLowerCase(),
  );
  if (match) return match.id as string;

  const { data, error } = await supabase
    .from("teachers")
    .insert({ school_id: schoolId, first_name: firstName, last_name: lastName })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

function courseFields(course: CoursePayload, teacherId: string | null) {
  return {
    title: text(course.title),
    short_description: text(course.shortDescription),
    long_description: text(course.longDescription),
    grade: course.grades ?? [],
    subject: course.subject ?? "",
    department_id: course.departmentId ?? null,
    teacher_id: teacherId,
    max_student_count:
      typeof course.maxStudentCount === "number" ? course.maxStudentCount : -1,
    retakeable: course.retakeable === true,
    prereq_options: course.prereqOptions ?? [],
    coreq_options: course.coreqOptions ?? [],
  };
}

/**
 * Diffs a course's class times and applies changes via the class-time RPCs so
 * rosters and students.times_taken stay consistent. Order: removes, then edits,
 * then adds — so an edit never collides with a block that is on its way out.
 */
async function syncCourseSchedule(
  supabase: Supabase,
  courseId: string,
  previous: ClassTime[],
  times: ClassTimeEdit[],
): Promise<void> {
  const claimedOriginals = new Set(
    times.filter((t) => t.original != null).map((t) => classTimeKey(t.original!)),
  );

  for (const prev of previous) {
    if (claimedOriginals.has(classTimeKey(prev))) continue;
    const { error } = await supabase.rpc("remove_class_time", {
      p_course_id: courseId,
      p_day: prev.day,
      p_start: prev.start,
      p_end: prev.end,
    });
    if (error) throw error;
  }

  for (const edit of times) {
    if (!edit.original) continue;
    if (classTimeKey(edit.original) === classTimeKey(edit.value)) continue;
    const { error } = await supabase.rpc("edit_class_time", {
      p_course_id: courseId,
      p_old_day: edit.original.day,
      p_old_start: edit.original.start,
      p_old_end: edit.original.end,
      p_new_day: edit.value.day,
      p_new_start: edit.value.start,
      p_new_end: edit.value.end,
    });
    if (error) throw error;
  }

  for (const edit of times) {
    if (edit.original != null) continue;
    const { error } = await supabase.rpc("add_class_time", {
      p_course_id: courseId,
      p_day: edit.value.day,
      p_start: edit.value.start,
      p_end: edit.value.end,
    });
    if (error) throw error;
  }
}

/**
 * Reconciles a logical course's offering-rows against the submitted form.
 * Matches on `courseId` (not positional index): updates existing rows by id,
 * inserts rows with a null id, and deletes existing ids absent from the
 * submission. Schedule sync runs before the metadata update so
 * `edit_class_time` resolves term ranks against the terms the existing
 * `times_taken` rows were written under.
 */
async function saveCourseOfferings(
  supabase: Supabase,
  schoolId: string,
  payload: Payload,
): Promise<Response> {
  const course = payload.course ?? {};
  if (!text(course.title)) {
    return json({ error: "Course title is required." }, 400);
  }

  const offerings = (course.offerings ?? []).filter(
    (o) => (o.termOptions ?? []).length > 0,
  );
  if (offerings.length === 0) {
    return json({ error: "Select at least one term for this course." }, 400);
  }

  const ownedCourseIds = await schoolCourseIds(supabase, schoolId);
  const existingRows = (payload.existingRows ?? []).filter(
    (row): row is { courseId: string; schedule?: ClassTime[] } =>
      typeof row.courseId === "string" && ownedCourseIds.has(row.courseId),
  );
  for (const offering of offerings) {
    if (offering.courseId && !ownedCourseIds.has(offering.courseId)) {
      return json({ error: "That course belongs to another school." }, 403);
    }
  }

  const teacherId = await resolveTeacher(
    supabase,
    schoolId,
    course.teacherName ?? "",
  );
  const fields = courseFields(course, teacherId);

  const previousById = new Map(
    existingRows.map((r) => [r.courseId, r.schedule ?? []]),
  );
  const keptIds = new Set<string>();

  for (const offering of offerings) {
    const times = offering.times ?? [];

    if (offering.courseId) {
      keptIds.add(offering.courseId);
      await syncCourseSchedule(
        supabase,
        offering.courseId,
        previousById.get(offering.courseId) ?? [],
        times,
      );

      const { error } = await supabase
        .from("courses")
        .update({ ...fields, term_options: offering.termOptions ?? [] })
        .eq("id", offering.courseId)
        .eq("school_id", schoolId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("courses").insert({
        school_id: schoolId,
        ...fields,
        // `term` is a legacy NOT NULL column; write an empty string so inserts
        // succeed while term data lives entirely in `term_options`.
        term: "",
        term_options: offering.termOptions ?? [],
        // Brand-new rows have no roster, so a direct schedule write is safe.
        schedule: toScheduleArray(times.map((t) => t.value)),
      });
      if (error) throw error;
    }
  }

  for (const row of existingRows) {
    if (keptIds.has(row.courseId)) continue;
    await removeCourse(supabase, schoolId, row.courseId);
  }

  return json({ ok: true }, 200);
}

async function removeCourse(
  supabase: Supabase,
  schoolId: string,
  courseId: string,
): Promise<void> {
  await clearCourseChildren(supabase, [courseId]);
  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("school_id", schoolId);
  if (error) throw error;
}

async function deleteCourse(
  supabase: Supabase,
  schoolId: string,
  payload: Payload,
): Promise<Response> {
  const courseId = text(payload.courseId);
  if (!courseId) return json({ error: "Missing course." }, 400);

  const ownedCourseIds = await schoolCourseIds(supabase, schoolId);
  if (!ownedCourseIds.has(courseId)) {
    return json({ error: "That course was not found." }, 404);
  }

  await removeCourse(supabase, schoolId, courseId);
  return json({ ok: true }, 200);
}
