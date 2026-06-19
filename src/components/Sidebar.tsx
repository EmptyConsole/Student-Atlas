import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark } from "lucide-react";
import { SUBJECTS } from "../data/subjects";
import type { Course } from "../data/courses";
import { buildDisplayCourses, repCourse } from "../utils/courseGrouping";
import SplitBookmark, { type SplitBookmarkState } from "./SplitBookmark";
import SubjectBookmark from "./SubjectBookmark";

type SidebarProps = {
  courses: Course[];
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  onApplyGroupBookmark: (
    fallId: string,
    springId: string,
    selection: "fall" | "spring" | "both" | "clear",
  ) => void;
  activeSubject: string;
  onSelectSubject: (name: string) => void;
};

type BookmarkEntry = {
  id: string;
  title: string;
  subject: string;
  state: SplitBookmarkState;
  onRemove: () => void;
};

function Sidebar({
  courses,
  bookmarks,
  onToggleBookmark,
  onApplyGroupBookmark,
  activeSubject,
  onSelectSubject,
}: SidebarProps) {
  const activeItemRef = useRef<HTMLLIElement>(null);

  // Bookmarked display items (Fall/Spring duplicates merged) grouped by subject.
  const entriesBySubject = useMemo(() => {
    const map = new Map<string, BookmarkEntry[]>();
    for (const subject of SUBJECTS) map.set(subject.name, []);
    for (const item of buildDisplayCourses(courses)) {
      const course = repCourse(item);
      if (item.kind === "group") {
        const fall = bookmarks.has(item.fallId);
        const spring = bookmarks.has(item.springId);
        if (!fall && !spring) continue;
        map.get(course.subject)?.push({
          id: item.id,
          title: course.title,
          subject: course.subject,
          state: fall && spring ? "both" : fall ? "fall" : "spring",
          onRemove: () =>
            onApplyGroupBookmark(item.fallId, item.springId, "clear"),
        });
      } else {
        if (!bookmarks.has(course.id)) continue;
        map.get(course.subject)?.push({
          id: course.id,
          title: course.title,
          subject: course.subject,
          state: "both",
          onRemove: () => onToggleBookmark(course.id),
        });
      }
    }
    return map;
  }, [courses, bookmarks, onToggleBookmark, onApplyGroupBookmark]);

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
          {SUBJECTS.map((subject) => {
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
                                {entry.state === "both" ? (
                                  <Bookmark
                                    className="h-3.5 w-3.5"
                                    fill={subject.accent}
                                  />
                                ) : (
                                  <SplitBookmark
                                    state={entry.state}
                                    color={subject.accent}
                                    size={14}
                                  />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleBookmarkSelect(entry.id, subject.name)
                                }
                                className="min-w-0 flex-1 cursor-pointer truncate text-left text-xs font-medium focus:outline-none focus-visible:ring-2"
                                style={{ color: subject.accent }}
                              >
                                {entry.title}
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
