import type { Course } from "../data/courses";
import type { ClassTime } from "./classTime";

/** A single offering-row of a logical course: its DB id, terms, and schedule. */
export type Offering = {
  courseId: string;
  termOptions: string[];
  schedule: ClassTime[];
};

/**
 * A course as shown on the Courses page. Rows that are identical except for
 * their `termOptions` are merged into one "group" with multiple offerings the
 * student can pick between; a course with a single row stays a "single".
 */
export type DisplayCourse =
  | { kind: "single"; course: Course }
  | {
      kind: "group";
      id: string;
      representative: Course;
      offerings: Offering[];
    };

/** Database course ids represented by a display item (one per offering row). */
export function courseIdsInItem(item: DisplayCourse): string[] {
  return item.kind === "group"
    ? item.offerings.map((o) => o.courseId)
    : [item.course.id];
}

/** Term-id arrays for each offering-row of the item (one entry per course row). */
export function offeringsOf(item: DisplayCourse): string[][] {
  return item.kind === "group"
    ? item.offerings.map((o) => o.termOptions)
    : [item.course.termOptions];
}

/**
 * Full offering rows (id + terms + schedule) for a display item. Used by the
 * teacher save path so schedule diffs target the correct `courses` row.
 */
export function offeringRowsOf(item: DisplayCourse): Offering[] {
  return item.kind === "group"
    ? item.offerings.map((o) => ({
        courseId: o.courseId,
        termOptions: o.termOptions,
        schedule: o.schedule,
      }))
    : [
        {
          courseId: item.course.id,
          termOptions: item.course.termOptions,
          schedule: item.course.schedule ?? [],
        },
      ];
}

/**
 * Signature of everything that must match for two rows to merge — every field
 * except `id`, `termOptions`, and `schedule`. Schedule is intentionally omitted
 * so rows that differ only in class times still appear as one course to
 * students (who never see class times).
 */
function signature(course: Course): string {
  return JSON.stringify({
    subject: course.subject,
    title: course.title,
    grades: [...course.grades].sort((a, b) => a - b),
    prereqOptions: course.prereqOptions ?? [],
    coreqOptions: course.coreqOptions ?? [],
    teacher: course.teacher ?? null,
    maxStudentCount: course.maxStudentCount ?? -1,
    shortDescription: course.shortDescription,
    longDescription: course.longDescription,
  });
}

/** The course used for search, filtering, and card display. */
export function repCourse(item: DisplayCourse): Course {
  return item.kind === "single" ? item.course : item.representative;
}

/**
 * Merge rows that share a signature into a single grouped item carrying one
 * offering per row. Rows with a unique signature stay standalone. Original
 * course order is preserved by the position of each group's first member.
 */
export function buildDisplayCourses(courses: Course[]): DisplayCourse[] {
  const bySignature = new Map<string, Course[]>();
  for (const course of courses) {
    const key = signature(course);
    const bucket = bySignature.get(key);
    if (bucket) bucket.push(course);
    else bySignature.set(key, [course]);
  }

  const result: DisplayCourse[] = [];
  const emitted = new Set<string>();
  for (const course of courses) {
    const key = signature(course);
    const bucket = bySignature.get(key);
    if (!bucket || bucket.length === 1) {
      result.push({ kind: "single", course });
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    result.push({
      kind: "group",
      id: `group:${bucket.map((c) => c.id).join(":")}`,
      representative: bucket[0],
      offerings: bucket.map((c) => ({
        courseId: c.id,
        termOptions: c.termOptions,
        schedule: c.schedule ?? [],
      })),
    });
  }

  return result;
}
