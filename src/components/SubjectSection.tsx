import { AnimatePresence } from "motion/react";
import type { Subject } from "../data/subjects";
import { matchesFilters, type Course, type Filters } from "../data/courses";
import CourseCard from "./CourseCard";

type SubjectSectionProps = {
  subject: Subject;
  courses: Course[];
  filters: Filters;
  expandedId: string | null;
  bookmarks: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleBookmark: (id: string) => void;
};

function SubjectSection({
  subject,
  courses,
  filters,
  expandedId,
  bookmarks,
  onToggleExpand,
  onToggleBookmark,
}: SubjectSectionProps) {
  const decorated = courses.map((course) => ({
    course,
    passes: matchesFilters(course, filters),
  }));

  // Matching courses keep their order on top; filtered-out ones sink to the bottom.
  const ordered = [
    ...decorated.filter((d) => d.passes),
    ...decorated.filter((d) => !d.passes),
  ];

  if (courses.length === 0) return null;

  return (
    <section
      id={`subject-${subject.name}`}
      data-subject={subject.name}
      className="scroll-mt-4"
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className="h-6 w-2 rounded-full"
          style={{ backgroundColor: subject.color }}
          aria-hidden="true"
        />
        <h2 className="text-2xl font-bold" style={{ color: subject.accent }}>
          {subject.name}
        </h2>
        <span className="text-sm font-medium text-gray-400">
          {decorated.filter((d) => d.passes).length} of {courses.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {ordered.map(({ course, passes }) => (
            <CourseCard
              key={course.id}
              course={course}
              subject={subject}
              dimmed={!passes}
              expanded={expandedId === course.id}
              bookmarked={bookmarks.has(course.id)}
              onToggleExpand={() => onToggleExpand(course.id)}
              onToggleBookmark={() => onToggleBookmark(course.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default SubjectSection;
