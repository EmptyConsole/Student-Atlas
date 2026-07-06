import type { Course } from "../data/courses";

/**
 * A course as shown on the Courses page. Identical Fall + Spring rows are merged
 * into a single "group" item displayed as one "Both" card; everything else is a
 * standalone "single".
 */
export type DisplayCourse =
  | { kind: "single"; course: Course }
  | {
      kind: "group";
      id: string;
      representative: Course;
      fallId: string;
      springId: string;
    };

/**
 * Signature of everything that must match for two rows to merge — every field
 * except `id` and `term`.
 */
function signature(course: Course): string {
  return JSON.stringify({
    subject: course.subject,
    title: course.title,
    grades: [...course.grades].sort((a, b) => a - b),
    prerequisites: [...course.prerequisites].sort((a, b) => a.localeCompare(b)),
    corequisites: [...course.corequisites].sort((a, b) => a.localeCompare(b)),
    customPrereq: course.customPrereq ?? null,
    customCoreq: course.customCoreq ?? null,
    teacher: course.teacher ?? null,
    shortDescription: course.shortDescription,
    longDescription: course.longDescription,
  });
}

/** The course used for search, filtering, and card display. */
export function repCourse(item: DisplayCourse): Course {
  return item.kind === "single" ? item.course : item.representative;
}

/**
 * Merge identical Fall + Spring course pairs into a single grouped item. A group
 * is only formed when a signature has exactly one `fall` and one `spring` row;
 * all other courses (including genuine single `both`/`all-year` rows) stay
 * standalone. Original course order is preserved by the position of the first
 * member of each group.
 */
export function buildDisplayCourses(courses: Course[]): DisplayCourse[] {
  const bySignature = new Map<string, Course[]>();
  for (const course of courses) {
    const key = signature(course);
    const bucket = bySignature.get(key);
    if (bucket) bucket.push(course);
    else bySignature.set(key, [course]);
  }

  const grouped = new Set<string>();
  const groupBySignature = new Map<string, DisplayCourse>();

  for (const [key, bucket] of bySignature) {
    const fall = bucket.filter((c) => c.term === "fall");
    const spring = bucket.filter((c) => c.term === "spring");
    if (fall.length === 1 && spring.length === 1 && bucket.length === 2) {
      const fallCourse = fall[0];
      const springCourse = spring[0];
      const id = `group:${fallCourse.id}:${springCourse.id}`;
      groupBySignature.set(key, {
        kind: "group",
        id,
        representative: { ...fallCourse, id, term: "both" },
        fallId: fallCourse.id,
        springId: springCourse.id,
      });
      grouped.add(fallCourse.id);
      grouped.add(springCourse.id);
    }
  }

  const result: DisplayCourse[] = [];
  const emitted = new Set<string>();
  for (const course of courses) {
    if (grouped.has(course.id)) {
      const key = signature(course);
      if (!emitted.has(key)) {
        emitted.add(key);
        const group = groupBySignature.get(key);
        if (group) result.push(group);
      }
      continue;
    }
    result.push({ kind: "single", course });
  }

  return result;
}
