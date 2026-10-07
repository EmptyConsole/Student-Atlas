import { readScreenMode, type ScreenMode } from "../hooks/useTheme";
import type { UserProfile } from "../hooks/useProfile";

// Every student read and write goes through /api/student with the session
// token issued by /api/verify-email-code. The anon key has no access to the
// student tables, and the server only ever touches the token's own student.

// ---------------------------------------------------------------------------
// Session + email proofs
// ---------------------------------------------------------------------------

const SESSION_KEY = "student-atlas-session";

type StoredSession = { token: string; expiresAt: number };

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token !== "string" || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function storeSession(token: string, expiresAt: number) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt }));
}

export function hasStudentSession(): boolean {
  return readSession() !== null;
}

export function clearStudentSession() {
  localStorage.removeItem(SESSION_KEY);
  pendingProofs.clear();
}

let onSessionExpired: (() => void) | null = null;

/** Called when the server rejects the session, so the app can sign out. */
export function setStudentSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

/**
 * Email proofs from verified signup / email-change codes, keyed by purpose.
 * Kept in memory only: they are single-use and expire after a few minutes.
 */
const pendingProofs = new Map<"signup" | "email_change", { email: string; proof: string }>();

function takeProof(purpose: "signup" | "email_change", email: string): string | null {
  const entry = pendingProofs.get(purpose);
  if (!entry || entry.email !== email.trim().toLowerCase()) return null;
  return entry.proof;
}

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

/** Runs one /api/student action with the stored session. */
async function callStudentApi(
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<{ data?: ApiResponse; error?: string }> {
  const session = readSession();
  if (!session) {
    onSessionExpired?.();
    return { error: "Your session expired. Log in again." };
  }

  let status: number;
  let payload: ApiResponse;
  try {
    ({ status, body: payload } = await postJson("/api/student", body, session.token));
  } catch {
    return { error: `${fallbackError}. Check your connection and try again.` };
  }

  if (status === 401) {
    clearStudentSession();
    onSessionExpired?.();
    return { error: payload.error ?? "Your session expired. Log in again." };
  }
  if (status >= 400) {
    return { error: payload.error ?? fallbackError };
  }
  return { data: payload };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HydratedStudentData = {
  studentId: string;
  profile: Pick<
    UserProfile,
    "schoolId" | "name" | "email" | "grade" | "screenMode" | "completedCourses" | "courseNotes"
  >;
  bookmarkIds: Set<string>;
};

export type SubmitResult = {
  error?: string;
  studentId?: string;
  hydratedData?: HydratedStudentData;
};

type Snapshot = {
  studentId: string;
  profile: Pick<UserProfile, "schoolId" | "name" | "email" | "grade" | "screenMode">;
  completedCourses: Record<string, "prereq" | "coreq">;
  bookmarkIds: string[];
  courseNotes: Record<string, string>;
};

function hydrate(snapshot: Snapshot): HydratedStudentData {
  return {
    studentId: snapshot.studentId,
    profile: {
      ...snapshot.profile,
      completedCourses: snapshot.completedCourses,
      courseNotes: snapshot.courseNotes,
    },
    bookmarkIds: new Set(snapshot.bookmarkIds),
  };
}

// ---------------------------------------------------------------------------
// Load the signed-in student's data
// ---------------------------------------------------------------------------

export async function loadStudentData(): Promise<{
  completedCourses: Record<string, "prereq" | "coreq">;
  bookmarkIds: Set<string>;
  courseNotes: Record<string, string>;
  screenMode: ScreenMode;
}> {
  const { data } = await callStudentApi({ action: "load" }, "Failed to load your data");
  const snapshot = data as Snapshot | undefined;
  return {
    completedCourses: snapshot?.completedCourses ?? {},
    bookmarkIds: new Set(snapshot?.bookmarkIds ?? []),
    courseNotes: snapshot?.courseNotes ?? {},
    screenMode: snapshot?.profile.screenMode ?? readScreenMode(),
  };
}

// ---------------------------------------------------------------------------
// Submit profile (new user insert OR returning user hydration)
// ---------------------------------------------------------------------------

/** Runs after the signup email code is verified; uses its email proof. */
export async function submitProfile(profile: UserProfile): Promise<SubmitResult> {
  const name = profile.name.trim();
  const email = profile.email.trim();

  if (!profile.schoolId || !name || !email || profile.grade === null) {
    return { error: "Please select a school and fill in your name, email, and grade." };
  }

  const proof = takeProof("signup", email);
  if (!proof) {
    return { error: "Verify your email before creating your profile." };
  }

  try {
    const { status, body } = await postJson("/api/student", {
      action: "createStudent",
      proof,
      name,
      grade: profile.grade,
      schoolId: profile.schoolId,
      screenMode: profile.screenMode,
      completedCourses: profile.completedCourses,
    });
    if (status >= 400 || typeof body.token !== "string") {
      return { error: body.error ?? "Something went wrong. Please try again." };
    }
    pendingProofs.delete("signup");
    storeSession(body.token, body.expiresAt as number);

    const snapshot = body.snapshot as Snapshot;
    if (body.existing) {
      return { studentId: snapshot.studentId, hydratedData: hydrate(snapshot) };
    }
    return { studentId: snapshot.studentId };
  } catch {
    return { error: "Something went wrong. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Sync prereqs → completed_courses, coreqs → enrolled_courses
// ---------------------------------------------------------------------------

export async function syncStudentCourses(
  completedCourses: Record<string, "prereq" | "coreq" | null>,
): Promise<{ error?: string }> {
  const { error } = await callStudentApi(
    { action: "saveCourses", completedCourses },
    "Failed to save your courses",
  );
  return error ? { error } : {};
}

// ---------------------------------------------------------------------------
// Sync bookmarks → bookmarked_courses
// ---------------------------------------------------------------------------

export async function syncStudentBookmarks(bookmarkIds: Set<string>): Promise<{ error?: string }> {
  const { error } = await callStudentApi(
    { action: "saveBookmarks", courseIds: [...bookmarkIds] },
    "Failed to save your bookmarks",
  );
  return error ? { error } : {};
}

// ---------------------------------------------------------------------------
// Sync profile fields (name, email, grade, screen mode) → students row
// ---------------------------------------------------------------------------

/** A changed email is only accepted with the proof from its verification code. */
export async function syncStudentProfile(
  name: string,
  email: string,
  grade: number | null,
  schoolId: string | null,
  screenMode: ScreenMode,
): Promise<{ error?: string }> {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  if (!trimmedName || !trimmedEmail || grade === null || !schoolId) return {};

  const { error } = await callStudentApi(
    {
      action: "saveProfile",
      name: trimmedName,
      email: trimmedEmail,
      grade,
      schoolId,
      screenMode,
      emailProof: takeProof("email_change", trimmedEmail),
    },
    "Failed to save your profile",
  );
  if (error) return { error };
  pendingProofs.delete("email_change");
  return {};
}

// ---------------------------------------------------------------------------
// Submitted course rankings → submitted_courses table
// ---------------------------------------------------------------------------

type RankingRow = { course_id: string; preference: number | null };

/**
 * Loads the student's official rankings (`submitted = true`) and drafts
 * (`submitted = false`), each ordered by preference ascending, plus their
 * latest submission note. Used to restore the Register page on open.
 */
export async function loadRankings(): Promise<{
  submitted: RankingRow[];
  drafts: RankingRow[];
  note: string;
  error?: string;
}> {
  const { data, error } = await callStudentApi(
    { action: "loadRankings" },
    "Failed to load your rankings",
  );
  if (error || !data) return { submitted: [], drafts: [], note: "", error };
  return {
    submitted: (data.submitted as RankingRow[]) ?? [],
    drafts: (data.drafts as RankingRow[]) ?? [],
    note: (data.note as string) ?? "",
  };
}

/**
 * Persists the student's ranked courses. `columnOrders` is one ordered list of
 * course ids per term column; each column's preference numbering restarts at 1,
 * and a course that appears in multiple columns keeps its first occurrence.
 *
 * Draft saves (`submitted: false`) replace only draft rows so an official
 * submitted snapshot can coexist. Final submit (`submitted: true`) deletes all
 * of the student's rows (draft + prior submitted) then inserts the new official
 * set.
 */
export async function syncSubmittedCourses(
  columnOrders: string[][],
  submitted: boolean,
): Promise<{ error?: string }> {
  const { error } = await callStudentApi(
    { action: "saveRankings", columnOrders, submitted },
    "Failed to save your rankings",
  );
  return error ? { error } : {};
}

// ---------------------------------------------------------------------------
// Email the student a copy of their submitted rankings (Vercel fn → Resend)
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget confirmation email. `columns` mirrors what was submitted:
 * one ordered list of course ids per term, with the term's display name.
 * Failures are logged but never surface to the student — the submission
 * itself already succeeded.
 */
export async function sendRankingsEmail(
  columns: { termName: string; courseIds: string[] }[],
  note: string | null,
): Promise<void> {
  const { error } = await callStudentApi(
    { action: "sendConfirmation", columns, note },
    "Failed to send rankings email",
  );
  if (error) console.error("Failed to send rankings email:", error);
}

// ---------------------------------------------------------------------------
// Sync course notes → course_notes table
// ---------------------------------------------------------------------------

export async function syncCourseNotes(
  courseNotes: Record<string, string>,
): Promise<{ error?: string }> {
  const { error } = await callStudentApi(
    { action: "saveNotes", courseNotes },
    "Failed to save your notes",
  );
  return error ? { error } : {};
}

// ---------------------------------------------------------------------------
// Sync submission note → submitted_notes table (one row per student)
// ---------------------------------------------------------------------------

export async function syncSubmittedNotes(note: string | null): Promise<{ error?: string }> {
  const { error } = await callStudentApi(
    { action: "saveSubmissionNote", note },
    "Failed to save your note",
  );
  return error ? { error } : {};
}

// ---------------------------------------------------------------------------
// Email OTP verification (Vercel fn → Resend)
// ---------------------------------------------------------------------------

export type EmailVerificationPurpose = "signup" | "login" | "email_change";

export async function sendEmailVerification(
  email: string,
  purpose: EmailVerificationPurpose,
): Promise<{ error?: string }> {
  try {
    const res = await fetch("/api/send-email-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), purpose }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      return { error: body.error ?? "Failed to send verification code." };
    }
    return {};
  } catch {
    return { error: "Failed to send verification code. Please try again." };
  }
}

/**
 * Checks the code. A login code starts a session; signup and email-change
 * codes leave an email proof for the save that follows.
 */
export async function verifyEmailCode(
  email: string,
  purpose: EmailVerificationPurpose,
  code: string,
): Promise<{ error?: string }> {
  try {
    const { status, body } = await postJson(
      "/api/verify-email-code",
      { email: email.trim(), purpose, code: code.trim() },
      purpose === "email_change" ? readSession()?.token : undefined,
    );
    if (status >= 400) {
      return { error: body.error ?? "Verification failed." };
    }

    if (purpose === "login") {
      if (typeof body.token !== "string") return { error: "Verification failed." };
      storeSession(body.token, body.expiresAt as number);
    } else {
      if (typeof body.proof !== "string") return { error: "Verification failed." };
      pendingProofs.set(purpose, { email: email.trim().toLowerCase(), proof: body.proof });
    }
    return {};
  } catch {
    return { error: "Verification failed. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Sign in with Google — the Google ID token stands in for an email code
// ---------------------------------------------------------------------------

export type GoogleSignInResult = { error?: string; email?: string; name?: string };

/**
 * Login starts a session; signup leaves an email proof for `createStudent`,
 * just as a verified email code does. `schoolId` is required for signup.
 */
export async function signInWithGoogle(
  credential: string,
  purpose: "login" | "signup",
  schoolId?: string,
): Promise<GoogleSignInResult> {
  try {
    const { status, body } = await postJson("/api/google-sign-in", {
      credential,
      purpose,
      schoolId,
    });
    if (status >= 400) {
      return { error: body.error ?? "Google sign-in failed. Please try again." };
    }
    if (typeof body.email !== "string") {
      return { error: "Google sign-in failed. Please try again." };
    }

    if (purpose === "login") {
      if (typeof body.token !== "string") {
        return { error: "Google sign-in failed. Please try again." };
      }
      storeSession(body.token, body.expiresAt as number);
      return { email: body.email };
    }

    if (typeof body.proof !== "string") {
      return { error: "Google sign-in failed. Please try again." };
    }
    pendingProofs.set("signup", { email: body.email.toLowerCase(), proof: body.proof });
    return { email: body.email, name: typeof body.name === "string" ? body.name : "" };
  } catch {
    return { error: "Google sign-in failed. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Log in by email — hydrate the account the verified login code signed into
// ---------------------------------------------------------------------------

export type LoginByEmailResult = {
  error?: string;
  studentId?: string;
  hydratedData?: HydratedStudentData;
};

export async function loginByEmail(email: string): Promise<LoginByEmailResult> {
  if (!email.trim()) return { error: "Please enter your email." };

  const { data, error } = await callStudentApi({ action: "load" }, "Failed to load your account");
  if (error || !data) return { error: error ?? "Something went wrong. Please try again." };

  const snapshot = data as Snapshot;
  return { studentId: snapshot.studentId, hydratedData: hydrate(snapshot) };
}

// ---------------------------------------------------------------------------
// Delete the signed-in student's account and all associated data
// ---------------------------------------------------------------------------

export async function deleteStudentAccount(): Promise<{ error?: string }> {
  const { error } = await callStudentApi(
    { action: "deleteAccount" },
    "Failed to delete account",
  );
  return error ? { error } : {};
}
