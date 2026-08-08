import { supabase } from "./supabase";
import type { Tables } from "../types/database";
import type { Term } from "../data/courses";
import type { ClassTime } from "../utils/classTime";
import {
  serializeGradeSettings,
  type GradeSettings,
} from "../utils/gradeSettings";

/**
 * Teacher catalog data access.
 *
 * Reads go straight to Supabase with the anon key. Writes cannot: the anon
 * role has SELECT-only access to the catalog tables (scripts/teacher-auth.sql),
 * so every mutation posts to /api/teacher-mutate with the session token issued
 * by /api/teacher-login, and the server performs the write with the service
 * role key. No password or hash is ever sent to the browser.
 */

export type SchoolRow = Tables<"schools">;
export type DepartmentRow = Tables<"departments">;
export type TermRow = Tables<"terms">;

export type SchoolInput = {
  name: string;
  website: string;
  city: string;
  state: string;
  /** New password. Blank when editing means "keep the current one". */
  password: string;
  /** School-wide fallback for grades absent from `gradeSettings`. */
  rankings: number;
  gradeSettings: GradeSettings;
};

/** One term row the school form submits; `id` absent means "create it". */
export type TermInput = { id?: string; name: string };

export type DepartmentInput = {
  name: string;
  subtitle: string;
  graduationRequirement: string;
};

/** Fields shared across every offering-row of a logical course. */
export type CourseBaseInput = {
  title: string;
  shortDescription: string;
  longDescription: string;
  grades: number[];
  /** Department name; also stored on `courses.subject` for UI grouping. */
  subject: string;
  departmentId: string | null;
  /** Free-text teacher name, e.g. "Jane Doe"; resolved to a teachers row. */
  teacherName: string;
  /** Max enrollment; -1 means unknown / not set. */
  maxStudentCount: number;
  retakeable: boolean;
  /** OR-of-AND groups of course UUIDs / free text. */
  prereqOptions: string[][];
  coreqOptions: string[][];
};

/**
 * One draft class-time row from the form. `original` is the value loaded from
 * the DB (null for newly added rows); `value` is what the teacher submitted.
 */
export type ClassTimeEdit = {
  original: ClassTime | null;
  value: ClassTime;
};

/** One offering row the form submits: existing course id (or null), terms, times. */
export type OfferingInput = {
  courseId: string | null;
  termOptions: string[];
  times: ClassTimeEdit[];
};

/**
 * What the course form submits: shared fields plus one offering per `courses`
 * row. Each offering carries its own terms and class times.
 */
export type CourseFormSubmit = CourseBaseInput & {
  offerings: OfferingInput[];
};

/** Existing offering rows the save path reconciles against. */
export type ExistingOfferingRow = {
  courseId: string;
  schedule: ClassTime[];
};

/** `expired` means the session token is gone or stale; re-unlock the school. */
type Result<T = void> = { data?: T; error?: string; expired?: boolean };

export type UnlockedSession = {
  id: string;
  name: string;
  token: string;
  expiresAt: number;
};

// ---------------------------------------------------------------------------
// Server API plumbing
// ---------------------------------------------------------------------------

type ApiResponse = Record<string, unknown> & { error?: string };

async function postJson(
  path: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; body: ApiResponse }> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as ApiResponse;
  return { status: res.status, body: parsed };
}

/** Runs one teacher mutation, mapping a rejected token to `expired`. */
async function mutate<T = void>(
  token: string,
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<Result<T>> {
  let status: number;
  let payload: ApiResponse;
  try {
    ({ status, body: payload } = await postJson(
      "/api/teacher-mutate",
      body,
      token,
    ));
  } catch {
    return { error: `${fallbackError}. Check your connection and try again.` };
  }

  if (status === 401) {
    return { error: payload.error ?? "Your session expired.", expired: true };
  }
  if (status >= 400) {
    return { error: payload.error ?? fallbackError };
  }
  return { data: payload as T };
}

function schoolPayload(input: SchoolInput) {
  return {
    name: input.name.trim(),
    website: input.website.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    password: input.password,
    rankings: input.rankings,
    grade: serializeGradeSettings(input.gradeSettings),
  };
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

/**
 * Exchanges a school password for a session token. The password is checked in
 * Postgres; the browser only ever learns whether it was right.
 */
export async function loginToSchool(
  schoolId: string,
  password: string,
): Promise<{ token?: string; expiresAt?: number; error?: string }> {
  try {
    const { status, body } = await postJson("/api/teacher-login", {
      action: "login",
      schoolId,
      password,
    });
    if (status >= 400 || typeof body.token !== "string") {
      return { error: body.error ?? "Incorrect password for this school." };
    }
    return { token: body.token, expiresAt: body.expiresAt as number };
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }
}

/** Creates a school with its terms and returns a session for editing it. */
export async function createSchool(
  input: SchoolInput,
  terms: TermInput[],
): Promise<Result<UnlockedSession>> {
  try {
    const { status, body } = await postJson("/api/teacher-login", {
      action: "createSchool",
      school: schoolPayload(input),
      terms: terms.map((t) => t.name),
    });
    if (status >= 400 || typeof body.token !== "string") {
      return { error: body.error ?? "Failed to create school" };
    }
    return {
      data: {
        id: body.schoolId as string,
        name: body.name as string,
        token: body.token,
        expiresAt: body.expiresAt as number,
      },
    };
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

export async function fetchSchool(schoolId: string): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .single();
  if (error) return null;
  return data ?? null;
}

/** Saves school settings and reconciles its terms in one request. */
export async function updateSchool(
  token: string,
  input: SchoolInput,
  terms: TermInput[],
): Promise<Result> {
  return mutate(
    token,
    {
      action: "updateSchool",
      school: schoolPayload(input),
      terms: terms.map((t) => ({ id: t.id ?? null, name: t.name })),
    },
    "Failed to update school",
  );
}

/** Deletes a school and everything scoped to it. Re-checks the password. */
export async function deleteSchool(
  token: string,
  password: string,
): Promise<Result> {
  return mutate(
    token,
    { action: "deleteSchool", password },
    "Failed to delete school",
  );
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export async function fetchTerms(schoolId: string): Promise<Term[]> {
  const { data, error } = await supabase
    .from("terms")
    .select("id, name, position, created_at")
    .eq("school_id", schoolId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row, index) => ({
    id: row.id,
    name: row.name,
    position: row.position ?? index,
  }));
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function fetchDepartments(
  schoolId: string,
): Promise<DepartmentRow[]> {
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createDepartment(
  token: string,
  input: DepartmentInput,
): Promise<Result<{ department: DepartmentRow }>> {
  return mutate(
    token,
    { action: "createDepartment", department: input },
    "Failed to create department",
  );
}

export async function updateDepartment(
  token: string,
  departmentId: string,
  input: DepartmentInput,
): Promise<Result> {
  return mutate(
    token,
    { action: "updateDepartment", departmentId, department: input },
    "Failed to update department",
  );
}

/** Deletes a department and its courses. Re-checks the school password. */
export async function deleteDepartment(
  token: string,
  departmentId: string,
  password: string,
): Promise<Result> {
  return mutate(
    token,
    { action: "deleteDepartment", departmentId, password },
    "Failed to delete department",
  );
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

/**
 * Reconciles a logical course's offering-rows against the submitted form. The
 * server matches on `courseId`, syncs class times through the class-time RPCs
 * so rosters stay consistent, and deletes offering rows the form dropped.
 */
export async function saveCourseOfferings(
  token: string,
  existingRows: ExistingOfferingRow[],
  submit: CourseFormSubmit,
): Promise<Result> {
  return mutate(
    token,
    { action: "saveCourseOfferings", existingRows, course: submit },
    "Failed to save course",
  );
}

export async function deleteCourse(
  token: string,
  courseId: string,
): Promise<Result> {
  return mutate(
    token,
    { action: "deleteCourse", courseId },
    "Failed to delete course",
  );
}
