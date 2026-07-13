import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark } from "lucide-react";
import { REQUIREMENTS_KEY, type Subject } from "../data/subjects";
import type { Course, Term } from "../data/courses";
import {
  buildDisplayCourses,
  repCourse,
  type Offering,
} from "../utils/courseGrouping";
import MarqueeText from "./MarqueeText";
import RequirementsBookmark from "./RequirementsBookmark";
import SubjectBookmark from "./SubjectBookmark";

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
  scrollId: string;
  title: string;
  /** Shown for multi-row courses; lists bookmarked offering term(s). */
  termLabel?: string;
  subject: string;
  onRemove: () => void;
};

function offeringSortKey(
  termOptions: string[],
  termById: Map<string, Term>,
): number {
  const positions = termOptions
    .map((id) => termById.get(id)?.position ?? 999)
    .sort((a, b) => a - b);
  return positions[0] ?? 999;
}

function termNamesForOffering(
  termOptions: string[],
  termById: Map<string, Term>,
): string {
  return termOptions
    .map((id) => termById.get(id)?.name ?? "?")
    .join(" + ");
}

/** Label for bookmarked rows of a grouped course, e.g. "Trimester 2" or "T1 / T3". */
function bookmarkedTermLabel(
  offerings: Offering[],
  bookmarks: Set<string>,
  termById: Map<string, Term>,
): string {
  return offerings
    .filter((o) => bookmarks.has(o.courseId))
    .map((o) => termNamesForOffering(o.termOptions, termById))
    .join(" / ");
}

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

  const entriesBySubject = useMemo(() => {
    const map = new Map<string, BookmarkEntry[]>();
    for (const subject of subjects) map.set(subject.name, []);

    for (const item of buildDisplayCourses(courses)) {
      const course = repCourse(item);

      if (item.kind === "group") {
        const sortedOfferings = [...item.offerings].sort(
          (a, b) =>
            offeringSortKey(a.termOptions, termById) -
            offeringSortKey(b.termOptions, termById),
        );
        if (!sortedOfferings.some((o) => bookmarks.has(o.courseId))) continue;

        const termLabel = bookmarkedTermLabel(
          sortedOfferings,
          bookmarks,
          termById,
        );

        map.get(course.subject)?.push({
          scrollId: course.id,
          title: course.title,
          termLabel,
          subject: course.subject,
          onRemove: () => {
            for (const offering of sortedOfferings) {
              if (bookmarks.has(offering.courseId)) {
                onToggleBookmark(offering.courseId);
              }
            }
          },
        });
        continue;
      }

      if (!bookmarks.has(course.id)) continue;
      map.get(course.subject)?.push({
        scrollId: course.id,
        title: course.title,
        subject: course.subject,
        onRemove: () => onToggleBookmark(course.id),
      });
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
                            key={entry.scrollId}
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
                            <div className="flex w-full items-start gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-white/60">
                              <button
                                type="button"
                                onClick={entry.onRemove}
                                aria-label={`Remove ${entry.title} bookmark`}
                                className="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
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
                                  handleBookmarkSelect(
                                    entry.scrollId,
                                    subject.name,
                                  )
                                }
                                className="min-w-0 flex-1 cursor-pointer text-left focus:outline-none focus-visible:ring-2"
                                style={{ color: subject.accent }}
                              >
                                <MarqueeText
                                  text={entry.title}
                                  className="text-xs font-medium"
                                />
                                {entry.termLabel && (
                                  <MarqueeText
                                    text={entry.termLabel}
                                    className="text-[10px] font-medium opacity-70"
                                  />
                                )}
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
