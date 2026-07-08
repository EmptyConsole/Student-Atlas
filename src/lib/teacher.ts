import { supabase } from "./supabase";
import type { Tables } from "../types/database";
import type { Term } from "../data/courses";

export type SchoolRow = Tables<"schools">;
export type DepartmentRow = Tables<"departments">;

export type SchoolInput = {
  name: string;
  website: string;
  city: string;
  state: string;
  password: string;
};

export type DepartmentInput = {
  name: string;
  subtitle: string;
  graduationRequirement: string;
};

export type CourseInput = {
  title: string;
  shortDescription: string;
  longDescription: string;
  grades: number[];
  term: Term;
  /** Department name; also stored on `courses.subject` for UI grouping. */
  subject: string;
  departmentId: string | null;
  /** Free-text teacher name, e.g. "Jane Doe"; resolved to a teachers row. */
  teacherName: string;
  retakeable: boolean;
  /** OR-of-AND groups of course UUIDs / free text. */
  prereqOptions: string[][];
  coreqOptions: string[][];
};

type Result<T = void> = { data?: T; error?: string };

function toMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return err instanceof Error ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

/** Returns true when the supplied password matches the school's stored one. */
export async function verifySchoolPassword(
  schoolId: string,
  password: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("schools")
    .select("password")
    .eq("id", schoolId)
    .single();
  if (error || !data) return false;
  return (data.password ?? "") === password;
}

export async function fetchSchool(schoolId: string): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .single();
  if (error) return null;
  return data ?? null;
}

export async function createSchool(input: SchoolInput): Promise<Result<SchoolRow>> {
  try {
    const { data, error } = await supabase
      .from("schools")
      .insert({
        name: input.name.trim(),
        website: input.website.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        password: input.password,
      })
      .select()
      .single();
    if (error) throw error;
    return { data: data ?? undefined };
  } catch (err) {
    return { error: toMessage(err, "Failed to create school") };
  }
}

export async function updateSchool(
  schoolId: string,
  input: SchoolInput,
): Promise<Result> {
  try {
    const { error } = await supabase
      .from("schools")
      .update({
        name: input.name.trim(),
        website: input.website.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        password: input.password,
      })
      .eq("id", schoolId);
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to update school") };
  }
}

/**
 * Deletes a school and everything scoped to it. Child rows are removed first to
 * satisfy foreign keys; rows in tables that may be locked down or empty are
 * deleted best-effort so a lean (teacher-created) school still deletes cleanly.
 */
export async function deleteSchool(schoolId: string): Promise<Result> {
  try {
    const { data: courseRows } = await supabase
      .from("courses")
      .select("id")
      .eq("school_id", schoolId);
    const courseIds = (courseRows ?? []).map((c) => c.id);

    const { data: studentRows } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId);
    const studentIds = (studentRows ?? []).map((s) => s.id);

    // Best-effort cleanup of rows that reference this school's courses/students.
    if (courseIds.length > 0) {
      const byCourse = [
        "completed_courses",
        "enrolled_courses",
        "bookmarked_courses",
        "course_notes",
        "submitted_courses",
        "course_prerequisites",
        "course_corequisites",
        "graduation_requirements",
      ] as const;
      for (const table of byCourse) {
        await supabase.from(table).delete().in("course_id", courseIds);
      }
      // Legacy prereq join table also references courses via the *_course_id column.
      await supabase
        .from("course_prerequisites")
        .delete()
        .in("prerequisite_course_id", courseIds);
      await supabase
        .from("course_corequisites")
        .delete()
        .in("corequisite_course_id", courseIds);
    }
    if (studentIds.length > 0) {
      await supabase.from("submitted_notes").delete().in("student_id", studentIds);
    }

    const core = [
      supabase.from("courses").delete().eq("school_id", schoolId),
      supabase.from("departments").delete().eq("school_id", schoolId),
      supabase.from("teachers").delete().eq("school_id", schoolId),
      supabase.from("terms").delete().eq("school_id", schoolId),
      supabase.from("students").delete().eq("school_id", schoolId),
    ];
    // These must run in dependency order, so await sequentially.
    for (const op of core) {
      const { error } = await op;
      if (error) throw error;
    }

    const { error } = await supabase.from("schools").delete().eq("id", schoolId);
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to delete school") };
  }
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
  schoolId: string,
  input: DepartmentInput,
): Promise<Result<DepartmentRow>> {
  try {
    const { data, error } = await supabase
      .from("departments")
      .insert({
        school_id: schoolId,
        name: input.name.trim(),
        subtitle: input.subtitle.trim(),
        graduation_requirement: input.graduationRequirement.trim(),
      })
      .select()
      .single();
    if (error) throw error;
    return { data: data ?? undefined };
  } catch (err) {
    return { error: toMessage(err, "Failed to create department") };
  }
}

export async function updateDepartment(
  departmentId: string,
  input: DepartmentInput,
): Promise<Result> {
  try {
    // Keep courses' denormalized `subject` in sync when a department is renamed.
    const { data: existing } = await supabase
      .from("departments")
      .select("name, school_id")
      .eq("id", departmentId)
      .single();

    const { error } = await supabase
      .from("departments")
      .update({
        name: input.name.trim(),
        subtitle: input.subtitle.trim(),
        graduation_requirement: input.graduationRequirement.trim(),
      })
      .eq("id", departmentId);
    if (error) throw error;

    if (existing && existing.name !== input.name.trim()) {
      await supabase
        .from("courses")
        .update({ subject: input.name.trim() })
        .eq("department_id", departmentId);
    }
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to update department") };
  }
}

export async function deleteDepartment(departmentId: string): Promise<Result> {
  try {
    // Detach courses so the FK does not block the delete; the courses remain
    // (ungrouped) rather than being destroyed with the department.
    await supabase
      .from("courses")
      .update({ department_id: null })
      .eq("department_id", departmentId);

    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", departmentId);
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to delete department") };
  }
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

/**
 * Finds an existing teacher for the school by full name (case-insensitive) or
 * creates one. The first whitespace-delimited word is the first name and the
 * remainder the last name. Returns null when the name is blank.
 */
export async function resolveTeacher(
  schoolId: string,
  fullName: string,
): Promise<string | null> {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;

  const [firstWord, ...rest] = trimmed.split(" ");
  const firstName = firstWord;
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
  if (match) return match.id;

  const { data, error } = await supabase
    .from("teachers")
    .insert({
      school_id: schoolId,
      first_name: firstName,
      last_name: lastName,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function createCourse(
  schoolId: string,
  input: CourseInput,
): Promise<Result> {
  try {
    const teacherId = await resolveTeacher(schoolId, input.teacherName);
    const { error } = await supabase.from("courses").insert({
      school_id: schoolId,
      title: input.title.trim(),
      short_description: input.shortDescription.trim(),
      long_description: input.longDescription.trim(),
      grade: input.grades,
      term: input.term,
      subject: input.subject,
      department_id: input.departmentId,
      teacher_id: teacherId,
      retakeable: input.retakeable,
      prereq_options: input.prereqOptions,
      coreq_options: input.coreqOptions,
    });
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to create course") };
  }
}

export async function updateCourse(
  courseId: string,
  schoolId: string,
  input: CourseInput,
): Promise<Result> {
  try {
    const teacherId = await resolveTeacher(schoolId, input.teacherName);
    const { error } = await supabase
      .from("courses")
      .update({
        title: input.title.trim(),
        short_description: input.shortDescription.trim(),
        long_description: input.longDescription.trim(),
        grade: input.grades,
        term: input.term,
        subject: input.subject,
        department_id: input.departmentId,
        teacher_id: teacherId,
        retakeable: input.retakeable,
        prereq_options: input.prereqOptions,
        coreq_options: input.coreqOptions,
      })
      .eq("id", courseId)
      .eq("school_id", schoolId);
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to update course") };
  }
}

export async function deleteCourse(
  courseId: string,
  schoolId: string,
): Promise<Result> {
  try {
    // Remove rows that reference this course before deleting it.
    const byCourse = [
      "completed_courses",
      "enrolled_courses",
      "bookmarked_courses",
      "course_notes",
      "submitted_courses",
      "course_prerequisites",
      "course_corequisites",
      "graduation_requirements",
    ] as const;
    for (const table of byCourse) {
      await supabase.from(table).delete().eq("course_id", courseId);
    }
    await supabase
      .from("course_prerequisites")
      .delete()
      .eq("prerequisite_course_id", courseId);
    await supabase
      .from("course_corequisites")
      .delete()
      .eq("corequisite_course_id", courseId);

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId)
      .eq("school_id", schoolId);
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to delete course") };
  }
}
