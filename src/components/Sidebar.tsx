import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark } from "lucide-react";
import { REQUIREMENTS_KEY, type Subject } from "../data/subjects";
import type { Course, Term } from "../data/courses";
import {
  buildDisplayCourses,
  repCourse,
} from "../utils/courseGrouping";
import RequirementsBookmark from "./RequirementsBookmark";
import SubjectBookmark from "./SubjectBookmark";
import TermBadges from "./TermBadges";

type SidebarProps = {
  courses: Course[];
  subjects: Subject[];
  termById: Map<string, Term>;
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  activeSubject: string;
  onSelectSubject: (name: string) => void;
};

type BookmarkEntry = {
  id: string;
  title: string;
  termOptions?: string[];
  subject: string;
  onRemove: () => void;
};

function Sidebar({
  courses,
  subjects,
  termById,
  bookmarks,
  onToggleBookmark,
  activeSubject,
  onSelectSubject,
}: SidebarProps) {
  const activeItemRef = useRef<HTMLLIElement>(null);

  // Bookmarked offerings grouped by subject (one entry per bookmarked row).
  const entriesBySubject = useMemo(() => {
    const map = new Map<string, BookmarkEntry[]>();
    for (const subject of subjects) map.set(subject.name, []);
    for (const item of buildDisplayCourses(courses)) {
      const course = repCourse(item);
      if (item.kind === "group") {
        for (const offering of item.offerings) {
          if (!bookmarks.has(offering.courseId)) continue;
          map.get(course.subject)?.push({
            id: offering.courseId,
            title: course.title,
            termOptions: offering.termOptions,
            subject: course.subject,
            onRemove: () => onToggleBookmark(offering.courseId),
          });
        }
      } else {
        if (!bookmarks.has(course.id)) continue;
        map.get(course.subject)?.push({
          id: course.id,
          title: course.title,
          termOptions:
            course.termOptions.length > 0 ? course.termOptions : undefined,
          subject: course.subject,
          onRemove: () => onToggleBookmark(course.id),
        });
      }
    }
    return map;
  }, [courses, subjects, termById, bookmarks, onToggleBookmark]);

  const handleSelectRequirements = () => {
    onSelectSubject(REQUIREMENTS_KEY);
    document
      .getElementById(`subject-${REQUIREMENTS_KEY}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSelect = (name: string) => {
    onSelectSubject(name);
    document
      .getElementById(`subject-${name}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleBookmarkSelect = (courseId: string, subjectName: string) => {
    onSelectSubject(subjectName);
    document
      .getElementById(`course-${courseId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Keep the highlighted bookmark visible within the sidebar as it changes.
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeSubject]);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-main-100">
      <nav aria-label="Course subjects" className="flex-1 overflow-y-auto py-3">
        <ul className="flex flex-col gap-1.5">
          <li
            ref={activeSubject === REQUIREMENTS_KEY ? activeItemRef : null}
            className="flex flex-col items-end"
          >
            <RequirementsBookmark
              isActive={activeSubject === REQUIREMENTS_KEY}
              onClick={handleSelectRequirements}
            />
          </li>
          {subjects.map((subject) => {
            const isActive = activeSubject === subject.name;
            const subjectBookmarks = entriesBySubject.get(subject.name) ?? [];

            return (
              <li
                key={subject.name}
                ref={isActive ? activeItemRef : null}
                className="flex flex-col items-end"
              >
                <SubjectBookmark
                  label={subject.name}
                  description={subject.description}
                  color={subject.color}
                  tint={subject.tint}
                  accent={subject.accent}
                  isActive={isActive}
                  onClick={() => handleSelect(subject.name)}
                />

                <AnimatePresence initial={false}>
                  {subjectBookmarks.length > 0 && (
                    <motion.ul
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-1 flex w-[98%] flex-col gap-1 pr-3 pl-[calc(40px+0.85rem)]"
                    >
                      <AnimatePresence initial={false}>
                        {subjectBookmarks.map((entry) => (
                          <motion.li
                            key={entry.id}
                            layout
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 12 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 34,
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <div className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-white/60">
                              <button
                                type="button"
                                onClick={entry.onRemove}
                                aria-label={`Remove ${entry.title} bookmark`}
                                className="shrink-0 cursor-pointer rounded p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
                                style={{ color: subject.accent }}
                              >
                                <Bookmark
                                  className="h-3.5 w-3.5"
                                  fill={subject.accent}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleBookmarkSelect(entry.id, subject.name)
                                }
                                className="min-w-0 flex-1 cursor-pointer text-left text-xs font-medium focus:outline-none focus-visible:ring-2"
                                style={{ color: subject.accent }}
                              >
                                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <span className="truncate">{entry.title}</span>
                                  {entry.termOptions &&
                                    entry.termOptions.length > 0 && (
                                      <TermBadges
                                        offerings={[entry.termOptions]}
                                        termById={termById}
                                      />
                                    )}
                                </span>
                              </button>
                            </div>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
