import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { Subject } from "../data/subjects";
import type { CourseCompletion } from "../hooks/useProfile";
import {
  matchesFilters,
  type Filters,
} from "../data/courses";
import { repCourse, type DisplayCourse } from "../utils/courseGrouping";
import CourseCard, { type BookmarkControl } from "./CourseCard";

type SubjectSectionProps = {
  subject: Subject;
  items: DisplayCourse[];
  filters: Filters;
  completedCourses: Record<string, CourseCompletion | null>;
  expandedId: string | null;
  bookmarks: Set<string>;
  courseNotes: Record<string, string>;
  collapseResetKey: string;
  onToggleExpand: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onApplyGroupBookmark: (
    fallId: string,
    springId: string,
    selection: "fall" | "spring" | "both" | "clear",
  ) => void;
  onUpdateCourseNote: (courseId: string, note: string) => void;
};

function SubjectSection({
  subject,
  items,
  filters,
  completedCourses,
  expandedId,
  bookmarks,
  courseNotes,
  collapseResetKey,
  onToggleExpand,
  onToggleBookmark,
  onApplyGroupBookmark,
  onUpdateCourseNote,
}: SubjectSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const decorated = items.map((item) => ({
    item,
    passes: matchesFilters(repCourse(item), filters, completedCourses),
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

  if (items.length === 0) return null;

  return (
    <section
      id={`subject-${subject.name}`}
      data-subject={subject.name}
      className="scroll-mt-4"
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className="mt-1 h-6 w-2 shrink-0 rounded-full"
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
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-3">
            <h2
              className="text-2xl font-bold"
              style={{ color: subject.accent }}
            >
              {subject.name}
            </h2>
            <span className="text-sm font-medium text-gray-400">
              {passCount} of {items.length}
            </span>
          </div>
          {!collapsed && subject.graduationRequirement && (
            <p className="text-sm leading-snug text-gray-600">
              <span className="font-bold">Graduation Requirement: </span>
              {subject.graduationRequirement}
            </p>
          )}
        </div>
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
                {ordered.map(({ item, passes }) => {
                  const course = repCourse(item);
                  // Grouped cards key notes on the fall UUID so they persist.
                  const noteId =
                    item.kind === "group" ? item.fallId : course.id;
                  const bookmark: BookmarkControl =
                    item.kind === "group"
                      ? {
                          kind: "group",
                          fall: bookmarks.has(item.fallId),
                          spring: bookmarks.has(item.springId),
                          onSelect: (selection) =>
                            onApplyGroupBookmark(
                              item.fallId,
                              item.springId,
                              selection,
                            ),
                        }
                      : {
                          kind: "single",
                          bookmarked: bookmarks.has(course.id),
                          onToggle: () => onToggleBookmark(course.id),
                        };
                  return (
                    <CourseCard
                      key={course.id}
                      course={course}
                      subject={subject}
                      dimmed={!passes}
                      expanded={expandedId === course.id}
                      bookmark={bookmark}
                      note={courseNotes[noteId] ?? ""}
                      onToggleExpand={() => onToggleExpand(course.id)}
                      onNoteChange={(note) => onUpdateCourseNote(noteId, note)}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default SubjectSection;
