import { supabase } from "./supabase";
import type { UserProfile } from "../hooks/useProfile";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** course title → Supabase course UUID */
async function fetchCourseMapByTitles(titles: string[]): Promise<Map<string, string>> {
  if (titles.length === 0) return new Map();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .in("title", titles);
  if (error || !data) return new Map();
  return new Map(data.map((c) => [c.title, c.id]));
}

/** Supabase course UUID → course title */
async function fetchCourseMapByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .in("id", ids);
  if (error || !data) return new Map();
  return new Map(data.map((c) => [c.id, c.title]));
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HydratedStudentData = {
  studentId: string;
  profile: Pick<UserProfile, "name" | "email" | "grade" | "completedCourses" | "courseNotes">;
  bookmarkIds: Set<string>;
};

export type SubmitResult = {
  error?: string;
  studentId?: string;
  hydratedData?: HydratedStudentData;
};

// ---------------------------------------------------------------------------
// Load a student's full data from Supabase
// ---------------------------------------------------------------------------

export async function loadStudentData(studentId: string): Promise<{
  completedCourses: Record<string, "prereq" | "coreq">;
  bookmarkIds: Set<string>;
  courseNotes: Record<string, string>;
}> {
  const [completedRes, enrolledRes, bookmarkedRes, notesRes] = await Promise.all([
    supabase
      .from("completed_courses")
      .select("course_id")
      .eq("student_id", studentId),
    supabase
      .from("enrolled_courses")
      .select("course_id")
      .eq("student_id", studentId),
    supabase
      .from("bookmarked_courses")
      .select("course_id")
      .eq("student_id", studentId),
    supabase
      .from("course_notes")
      .select("course_id, note")
      .eq("student_id", studentId),
  ]);

  const completedIds = (completedRes.data ?? []).map((r) => r.course_id);
  const enrolledIds = (enrolledRes.data ?? []).map((r) => r.course_id);
  const bookmarkedIds = (bookmarkedRes.data ?? []).map((r) => r.course_id);

  const allCourseIds = [...new Set([...completedIds, ...enrolledIds])];
  const idToTitle = await fetchCourseMapByIds(allCourseIds);

  const completedCourses: Record<string, "prereq" | "coreq"> = {};
  for (const id of completedIds) {
    const title = idToTitle.get(id);
    if (title) completedCourses[title] = "prereq";
  }
  for (const id of enrolledIds) {
    const title = idToTitle.get(id);
    if (title) completedCourses[title] = "coreq";
  }

  const courseNotes: Record<string, string> = {};
  for (const row of notesRes.data ?? []) {
    if (row.note) courseNotes[row.course_id] = row.note;
  }

  return { completedCourses, bookmarkIds: new Set(bookmarkedIds), courseNotes };
}

// ---------------------------------------------------------------------------
// Submit profile (new user insert OR returning user hydration)
// ---------------------------------------------------------------------------

export async function submitProfile(profile: UserProfile): Promise<SubmitResult> {
  const name = profile.name.trim();
  const email = profile.email.trim();

  if (!name || !email || profile.grade === null) {
    return { error: "Please fill in your name, email, and grade." };
  }

  try {
    const { data: schools, error: schoolError } = await supabase
      .from("schools")
      .select("id")
      .limit(1);

    if (schoolError) throw schoolError;
    if (!schools || schools.length === 0) {
      return { error: "No school is configured. Please contact support." };
    }

    const schoolId = schools[0].id;

    const { data: existing, error: existingError } = await supabase
      .from("students")
      .select("id, name, email, grade")
      .eq("email", email)
      .limit(1);

    if (existingError) throw existingError;

    // ---- Returning user: load all Supabase data ----
    if (existing && existing.length > 0) {
      const student = existing[0];
      const { completedCourses, bookmarkIds, courseNotes } = await loadStudentData(student.id);
      return {
        studentId: student.id,
        hydratedData: {
          studentId: student.id,
          profile: {
            name: student.name,
            email: student.email,
            grade: student.grade,
            completedCourses,
            courseNotes,
          },
          bookmarkIds,
        },
      };
    }

    // ---- New user: insert ----
    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert({ name, email, grade: profile.grade, school_id: schoolId })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const studentId = inserted.id;

    // Sync any prereq/coreq selections made during onboarding
    await syncStudentCourses(studentId, profile.completedCourses);

    return { studentId };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Sync prereqs → completed_courses, coreqs → enrolled_courses
// ---------------------------------------------------------------------------

export async function syncStudentCourses(
  studentId: string,
  completedCourses: Record<string, "prereq" | "coreq" | null>,
): Promise<void> {
  const prereqTitles: string[] = [];
  const coreqTitles: string[] = [];

  for (const [title, type] of Object.entries(completedCourses)) {
    if (type === "prereq") prereqTitles.push(title);
    else if (type === "coreq") coreqTitles.push(title);
  }

  const allTitles = [...new Set([...prereqTitles, ...coreqTitles])];
  const titleToId = await fetchCourseMapByTitles(allTitles);

  const prereqIds = prereqTitles
    .map((t) => titleToId.get(t))
    .filter((id): id is string => id !== undefined);

  const coreqIds = coreqTitles
    .map((t) => titleToId.get(t))
    .filter((id): id is string => id !== undefined);

  await Promise.all([
    supabase.from("completed_courses").delete().eq("student_id", studentId),
    supabase.from("enrolled_courses").delete().eq("student_id", studentId),
  ]);

  const inserts: Promise<unknown>[] = [];

  if (prereqIds.length > 0) {
    inserts.push(
      supabase
        .from("completed_courses")
        .insert(prereqIds.map((course_id) => ({ student_id: studentId, course_id }))) as unknown as Promise<unknown>,
    );
  }
  if (coreqIds.length > 0) {
    inserts.push(
      supabase
        .from("enrolled_courses")
        .insert(coreqIds.map((course_id) => ({ student_id: studentId, course_id }))) as unknown as Promise<unknown>,
    );
  }

  await Promise.all(inserts);
}

// ---------------------------------------------------------------------------
// Sync bookmarks → bookmarked_courses
// ---------------------------------------------------------------------------

export async function syncStudentBookmarks(
  studentId: string,
  bookmarkIds: Set<string>,
): Promise<void> {
  await supabase.from("bookmarked_courses").delete().eq("student_id", studentId);

  const ids = [...bookmarkIds];
  if (ids.length > 0) {
    await supabase
      .from("bookmarked_courses")
      .insert(ids.map((course_id) => ({ student_id: studentId, course_id })));
  }
}

// ---------------------------------------------------------------------------
// Sync profile fields (name, email, grade) → students row
// ---------------------------------------------------------------------------

export async function syncStudentProfile(
  studentId: string,
  name: string,
  email: string,
  grade: number | null,
): Promise<void> {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  if (!trimmedName || !trimmedEmail || grade === null) return;

  await supabase
    .from("students")
    .update({ name: trimmedName, email: trimmedEmail, grade })
    .eq("id", studentId);
}

// ---------------------------------------------------------------------------
// Sync course notes → course_notes table
// ---------------------------------------------------------------------------

export async function syncCourseNotes(
  studentId: string,
  courseNotes: Record<string, string>,
): Promise<void> {
  await supabase.from("course_notes").delete().eq("student_id", studentId);

  const entries = Object.entries(courseNotes).filter(([, note]) => note.trim());
  if (entries.length > 0) {
    await supabase
      .from("course_notes")
      .insert(
        entries.map(([course_id, note]) => ({
          student_id: studentId,
          course_id,
          note: note.trim(),
        })),
      );
  }
}
