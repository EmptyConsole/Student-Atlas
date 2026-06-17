import { COURSES, type Course, type Term } from "../data/courses";

export const MIN_RANKED_COURSES = 8;

export function isYearLong(term: Term): boolean {
  return term === "all-year" || term === "both";
}

export function isFallEligible(term: Term): boolean {
  return term === "fall" || term === "both" || term === "all-year";
}

export function isSpringEligible(term: Term): boolean {
  return term === "spring" || term === "both" || term === "all-year";
}

export function coursesForGrade(grade: number): Course[] {
  return COURSES.filter((course) => course.grades.includes(grade));
}

function sortByTitle(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Align the secondary column so year-long courses share the same rank as in
 * the primary column. Used to keep Fall and Spring linked in either direction.
 */
export function syncLinkedColumn(
  primaryOrder: string[],
  secondaryOrder: string[],
  courseById: Map<string, Course>,
): string[] {
  const secondary = [...secondaryOrder];

  primaryOrder.forEach((id, primaryIdx) => {
    const course = courseById.get(id);
    if (!course || !isYearLong(course.term)) return;

    const secondaryIdx = secondary.indexOf(id);
    if (secondaryIdx === -1 || secondaryIdx === primaryIdx) return;

    secondary.splice(secondaryIdx, 1);
    secondary.splice(primaryIdx, 0, id);
  });

  return secondary;
}

export function buildInitialOrders(
  grade: number,
  bookmarks: Set<string>,
): {
  fallOrder: string[];
  springOrder: string[];
} {
  const courseById = new Map(COURSES.map((course) => [course.id, course]));
  const eligible = coursesForGrade(grade).filter((course) =>
    bookmarks.has(course.id),
  );

  const fallOrder = sortByTitle(
    eligible.filter((course) => isFallEligible(course.term)),
  ).map((course) => course.id);

  const springOrder = sortByTitle(
    eligible.filter((course) => isSpringEligible(course.term)),
  ).map((course) => course.id);

  return {
    fallOrder,
    springOrder: syncLinkedColumn(fallOrder, springOrder, courseById),
  };
}

/**
 * Reconcile an existing ranked order with the current bookmarks/grade:
 * keep the relative order of still-valid courses, drop ones no longer
 * bookmarked or eligible, and append newly bookmarked courses alphabetically.
 */
export function mergeOrderWithBookmarks(
  grade: number,
  bookmarks: Set<string>,
  prevFallOrder: string[],
  prevSpringOrder: string[],
): { fallOrder: string[]; springOrder: string[] } {
  const courseById = new Map(COURSES.map((course) => [course.id, course]));
  const eligible = coursesForGrade(grade).filter((course) =>
    bookmarks.has(course.id),
  );

  const mergeColumn = (
    prevOrder: string[],
    columnCourses: Course[],
  ): string[] => {
    const eligibleIds = new Set(columnCourses.map((course) => course.id));
    const kept = prevOrder.filter((id) => eligibleIds.has(id));
    const keptSet = new Set(kept);
    const added = sortByTitle(
      columnCourses.filter((course) => !keptSet.has(course.id)),
    ).map((course) => course.id);
    return [...kept, ...added];
  };

  const fallOrder = mergeColumn(
    prevFallOrder,
    eligible.filter((course) => isFallEligible(course.term)),
  );
  const springOrder = mergeColumn(
    prevSpringOrder,
    eligible.filter((course) => isSpringEligible(course.term)),
  );

  return {
    fallOrder,
    springOrder: syncLinkedColumn(fallOrder, springOrder, courseById),
  };
}

/**
 * Apply a drag reorder to one column and re-sync the other so year-long
 * courses stay locked at the same rank in both columns.
 */
export function applyColumnReorder(
  fallOrder: string[],
  springOrder: string[],
  column: "fall" | "spring",
  newOrder: string[],
  courseById: Map<string, Course>,
): { fallOrder: string[]; springOrder: string[] } {
  if (column === "fall") {
    return {
      fallOrder: newOrder,
      springOrder: syncLinkedColumn(newOrder, springOrder, courseById),
    };
  }

  return {
    fallOrder: syncLinkedColumn(newOrder, fallOrder, courseById),
    springOrder: newOrder,
  };
}

export function validateRanking(
  fallOrder: string[],
  springOrder: string[],
): { valid: boolean; fallCount: number; springCount: number } {
  const fallCount = fallOrder.length;
  const springCount = springOrder.length;
  return {
    valid: fallCount >= MIN_RANKED_COURSES && springCount >= MIN_RANKED_COURSES,
    fallCount,
    springCount,
  };
}
