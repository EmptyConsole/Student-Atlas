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

/** Align spring indices so year-long courses share the same rank as in fall. */
function syncSpringToFallRanks(
  fallOrder: string[],
  springOrder: string[],
  courseById: Map<string, Course>,
): string[] {
  const spring = [...springOrder];

  for (const id of fallOrder) {
    const course = courseById.get(id);
    if (!course || !isYearLong(course.term)) continue;

    const fallIdx = fallOrder.indexOf(id);
    const springIdx = spring.indexOf(id);
    if (springIdx === -1 || springIdx === fallIdx) continue;

    spring.splice(springIdx, 1);
    spring.splice(fallIdx, 0, id);
  }

  return spring;
}

export function buildInitialOrders(grade: number): {
  fallOrder: string[];
  springOrder: string[];
} {
  const courseById = new Map(COURSES.map((course) => [course.id, course]));
  const eligible = coursesForGrade(grade);

  const fallOrder = sortByTitle(
    eligible.filter((course) => isFallEligible(course.term)),
  ).map((course) => course.id);

  const springOrder = sortByTitle(
    eligible.filter((course) => isSpringEligible(course.term)),
  ).map((course) => course.id);

  return {
    fallOrder,
    springOrder: syncSpringToFallRanks(fallOrder, springOrder, courseById),
  };
}

export function moveInOrder(
  order: string[],
  index: number,
  dir: -1 | 1,
): string[] {
  const newIndex = index + dir;
  if (newIndex < 0 || newIndex >= order.length) return order;

  const next = [...order];
  [next[index], next[newIndex]] = [next[newIndex], next[index]];
  return next;
}

export function moveCourseLinked(
  fallOrder: string[],
  springOrder: string[],
  column: "fall" | "spring",
  index: number,
  dir: -1 | 1,
  courseById: Map<string, Course>,
): { fallOrder: string[]; springOrder: string[] } {
  const activeOrder = column === "fall" ? fallOrder : springOrder;
  const courseId = activeOrder[index];
  const course = courseById.get(courseId);
  if (!course) return { fallOrder, springOrder };

  const nextFall =
    column === "fall" ? moveInOrder(fallOrder, index, dir) : fallOrder;
  const nextSpring =
    column === "spring" ? moveInOrder(springOrder, index, dir) : springOrder;

  if (!isYearLong(course.term)) {
    return { fallOrder: nextFall, springOrder: nextSpring };
  }

  const otherColumn = column === "fall" ? "spring" : "fall";
  const otherOrder = otherColumn === "fall" ? nextFall : nextSpring;
  const otherIndex = otherOrder.indexOf(courseId);
  if (otherIndex === -1) {
    return { fallOrder: nextFall, springOrder: nextSpring };
  }

  const syncedOther = moveInOrder(otherOrder, otherIndex, dir);
  return otherColumn === "fall"
    ? { fallOrder: syncedOther, springOrder: nextSpring }
    : { fallOrder: nextFall, springOrder: syncedOther };
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
