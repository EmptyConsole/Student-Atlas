import { supabase } from "./supabase";
import type { Tables } from "../types/database";
import type { Term } from "../data/courses";
import {
  classTimeKey,
  toScheduleArray,
  type ClassTime,
} from "../utils/classTime";

export type SchoolRow = Tables<"schools">;
export type DepartmentRow = Tables<"departments">;
export type TermRow = Tables<"terms">;

export type SchoolInput = {
  name: string;
  website: string;
  city: string;
  state: string;
  password: string;
  rankings: number;
};

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

/** A single course row: shared fields plus the term ids this offering covers. */
export type CourseInput = CourseBaseInput & {
  /** Term ids (from the `terms` table) covered by this row. */
  termOptions: string[];
  /** Class times for a brand-new row (written directly on INSERT). */
  schedule?: ClassTime[];
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
        rankings: input.rankings,
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
        rankings: input.rankings,
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

/** Creates a term with the given name; position is appended to the end. */
export async function createTerm(
  schoolId: string,
  name: string,
): Promise<Result<Term>> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Term name is required." };

    const { data: existing } = await supabase
      .from("terms")
      .select("position")
      .eq("school_id", schoolId);
    const nextPosition =
      (existing ?? []).reduce(
        (max, row) => Math.max(max, row.position ?? 0),
        -1,
      ) + 1;

    const { data, error } = await supabase
      .from("terms")
      .insert({
        school_id: schoolId,
        name: trimmed,
        position: nextPosition,
      })
      .select("id, name, position")
      .single();
    if (error) throw error;
    return {
      data: data
        ? { id: data.id, name: data.name, position: data.position ?? nextPosition }
        : undefined,
    };
  } catch (err) {
    return { error: toMessage(err, "Failed to create term") };
  }
}

export async function renameTerm(termId: string, name: string): Promise<Result> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Term name is required." };
    const { error } = await supabase
      .from("terms")
      .update({ name: trimmed })
      .eq("id", termId);
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to rename term") };
  }
}

/**
 * Deletes a term unless a course still uses it. A course "uses" a term when its
 * `term_options` array contains the term id.
 */
export async function deleteTerm(
  schoolId: string,
  termId: string,
): Promise<Result> {
  try {
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select("id, term_options")
      .eq("school_id", schoolId);
    if (coursesError) throw coursesError;

    const inUse = (courses ?? []).some((c) =>
      Array.isArray(c.term_options) && c.term_options.includes(termId),
    );
    if (inUse) {
      return {
        error: "This term is used by one or more courses and cannot be deleted.",
      };
    }

    const { error } = await supabase.from("terms").delete().eq("id", termId);
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to delete term") };
  }
}

/**
 * Persists the given term ordering via the reorder_terms RPC, which remaps
 * students.times_taken term ranks and writes 0-based positions atomically.
 */
export async function reorderTerms(
  schoolId: string,
  orderedTermIds: string[],
): Promise<Result> {
  try {
    const { error } = await supabase.rpc("reorder_terms", {
      p_school_id: schoolId,
      p_ordered_term_ids: orderedTermIds,
    });
    if (error) throw error;
    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to reorder terms") };
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
    const { data: courseRows } = await supabase
      .from("courses")
      .select("id")
      .eq("department_id", departmentId);
    const courseIds = (courseRows ?? []).map((course) => course.id);

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
        const { error } = await supabase
          .from(table)
          .delete()
          .in("course_id", courseIds);
        if (error) throw error;
      }

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

    const { error: courseError } = await supabase
      .from("courses")
      .delete()
      .eq("department_id", departmentId);
    if (courseError) throw courseError;

    const { error: departmentError } = await supabase
      .from("departments")
      .delete()
      .eq("id", departmentId);
    if (departmentError) throw departmentError;

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
      // `term` is a legacy NOT NULL column; write an empty string so inserts
      // succeed while term data lives entirely in `term_options`.
      term: "",
      term_options: input.termOptions,
      subject: input.subject,
      department_id: input.departmentId,
      teacher_id: teacherId,
      max_student_count: input.maxStudentCount,
      retakeable: input.retakeable,
      prereq_options: input.prereqOptions,
      coreq_options: input.coreqOptions,
      // Brand-new rows have no roster, so a direct schedule write is safe.
      schedule: toScheduleArray(input.schedule ?? []),
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
        term_options: input.termOptions,
        subject: input.subject,
        department_id: input.departmentId,
        teacher_id: teacherId,
        max_student_count: input.maxStudentCount,
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

/**
 * Diffs a course's class times and applies changes via the class-time RPCs so
 * rosters and students.times_taken stay consistent. Order: removes, then edits,
 * then adds — so an edit never collides with a block that is on its way out.
 */
export async function syncCourseSchedule(
  courseId: string,
  previous: ClassTime[],
  times: ClassTimeEdit[],
): Promise<Result> {
  try {
    const claimedOriginals = new Set(
      times
        .filter((t) => t.original != null)
        .map((t) => classTimeKey(t.original!)),
    );

    // 1. Remove every previous key that no draft row claims as its original.
    for (const prev of previous) {
      const key = classTimeKey(prev);
      if (claimedOriginals.has(key)) continue;
      const { error } = await supabase.rpc("remove_class_time", {
        p_course_id: courseId,
        p_day: prev.day,
        p_start: prev.start,
        p_end: prev.end,
      });
      if (error) throw error;
    }

    // 2. Edit rows whose original key differs from the new value.
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

    // 3. Add newly created rows.
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

    return {};
  } catch (err) {
    return { error: toMessage(err, "Failed to update class times") };
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
export async function saveCourseOfferings(
  schoolId: string,
  existingRows: ExistingOfferingRow[],
  submit: CourseFormSubmit,
): Promise<Result> {
  const offerings = submit.offerings.filter((o) => o.termOptions.length > 0);
  if (offerings.length === 0) {
    return { error: "Select at least one term for this course." };
  }

  const base: CourseBaseInput = {
    title: submit.title,
    shortDescription: submit.shortDescription,
    longDescription: submit.longDescription,
    grades: submit.grades,
    subject: submit.subject,
    departmentId: submit.departmentId,
    teacherName: submit.teacherName,
    maxStudentCount: submit.maxStudentCount,
    retakeable: submit.retakeable,
    prereqOptions: submit.prereqOptions,
    coreqOptions: submit.coreqOptions,
  };

  const previousById = new Map(
    existingRows.map((r) => [r.courseId, r.schedule]),
  );
  const keptIds = new Set<string>();

  for (const offering of offerings) {
    const scheduleValues = offering.times.map((t) => t.value);

    if (offering.courseId) {
      keptIds.add(offering.courseId);
      const previous = previousById.get(offering.courseId) ?? [];
      const syncResult = await syncCourseSchedule(
        offering.courseId,
        previous,
        offering.times,
      );
      if (syncResult.error) return { error: syncResult.error };

      const result = await updateCourse(offering.courseId, schoolId, {
        ...base,
        termOptions: offering.termOptions,
      });
      if (result.error) return { error: result.error };
    } else {
      const result = await createCourse(schoolId, {
        ...base,
        termOptions: offering.termOptions,
        schedule: scheduleValues,
      });
      if (result.error) return { error: result.error };
    }
  }

  // Delete rows that are no longer needed.
  for (const row of existingRows) {
    if (keptIds.has(row.courseId)) continue;
    const result = await deleteCourse(row.courseId, schoolId);
    if (result.error) return { error: result.error };
  }

  return {};
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
