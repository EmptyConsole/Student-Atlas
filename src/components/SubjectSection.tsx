import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { Subject } from "../data/subjects";
import type { CourseCompletion } from "../hooks/useProfile";
import {
  matchesFilters,
  type Course,
  type Filters,
} from "../data/courses";
import CourseCard from "./CourseCard";

type SubjectSectionProps = {
  subject: Subject;
  courses: Course[];
  filters: Filters;
  completedCourses: Record<string, CourseCompletion | null>;
  expandedId: string | null;
  bookmarks: Set<string>;
  courseNotes: Record<string, string>;
  collapseResetKey: string;
  onToggleExpand: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onUpdateCourseNote: (courseId: string, note: string) => void;
};

function SubjectSection({
  subject,
  courses,
  filters,
  completedCourses,
  expandedId,
  bookmarks,
  courseNotes,
  collapseResetKey,
  onToggleExpand,
  onToggleBookmark,
  onUpdateCourseNote,
}: SubjectSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const decorated = courses.map((course) => ({
    course,
    passes: matchesFilters(course, filters, completedCourses),
  }));

  const passCount = decorated.filter((d) => d.passes).length;

  // On search/filter change, collapse when nothing matches, otherwise expand.
  useEffect(() => {
    setCollapsed(passCount === 0);
  }, [collapseResetKey, passCount]);

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
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? `Expand ${subject.name} courses`
              : `Collapse ${subject.name} courses`
          }
          onClick={() => setCollapsed((c) => !c)}
          className="cursor-pointer rounded-full p-1.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
          style={{ color: subject.accent, outlineColor: subject.accent }}
        >
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
        <h2 className="text-2xl font-bold" style={{ color: subject.accent }}>
          {subject.name}
        </h2>
        <span className="text-sm font-medium text-gray-400">
          {passCount} of {courses.length}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="course-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="overflow-hidden"
          >
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
                    note={courseNotes[course.id] ?? ""}
                    onToggleExpand={() => onToggleExpand(course.id)}
                    onToggleBookmark={() => onToggleBookmark(course.id)}
                    onNoteChange={(note) => onUpdateCourseNote(course.id, note)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default SubjectSection;
