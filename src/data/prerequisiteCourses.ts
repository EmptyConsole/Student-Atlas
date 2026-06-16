import { COURSES, type Course } from "./courses";

/** Sorted unique course titles referenced as prerequisites across all courses. */
export const PREREQUISITE_COURSES: string[] = [
  ...new Set(COURSES.flatMap((c) => c.prerequisites)),
].sort((a, b) => a.localeCompare(b));

const titleToCourse = new Map<string, Course>(
  COURSES.map((c) => [c.title, c]),
);

/** Resolve a prerequisite title to its course record, if one exists. */
export function getPrerequisiteCourse(title: string): Course | undefined {
  return titleToCourse.get(title);
}
