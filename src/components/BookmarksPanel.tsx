import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, X } from "lucide-react";
import type { Subject } from "../data/subjects";
import type { Course, Term } from "../data/courses";
import { buildDisplayCourses, repCourse } from "../utils/courseGrouping";
import { iconButtonClass } from "./controlStyles";
import MarqueeText, { Marquee } from "./MarqueeText";
import ResizableAside from "./ResizableAside";
import TermBadges from "./TermBadges";

export const BOOKMARKS_PANEL_ID = "bookmarks-panel";

type BookmarksPanelProps = {
  courses: Course[];
  subjects: Subject[];
  termById: Map<string, Term>;
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  onSelectSubject: (name: string) => void;
  onClose: () => void;
};

type BookmarkEntry = {
  scrollId: string;
  title: string;
  /** Bookmarked offering rows for multi-row courses (term badges). */
  offerings?: string[][];
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

function BookmarkRow({
  entry,
  accent,
  termById,
  onSelect,
}: {
  entry: BookmarkEntry;
  accent: string;
  termById: Map<string, Term>;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex w-full items-start gap-1 rounded-lg px-1 py-1 transition-colors hover:bg-main-100"
    >
      <button
        type="button"
        onClick={entry.onRemove}
        aria-label={`Remove ${entry.title} bookmark`}
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600"
        style={{ color: accent }}
      >
        <Bookmark className="h-4 w-4" fill={accent} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 cursor-pointer py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600"
      >
        <MarqueeText
          text={entry.title}
          active={hovered}
          className="text-sm font-medium text-ink"
        />
        {entry.offerings && entry.offerings.length > 0 && (
          <Marquee active={hovered} className="mt-1">
            <TermBadges
              offerings={entry.offerings}
              termById={termById}
              wrap={false}
              className="origin-left scale-90"
            />
          </Marquee>
        )}
      </button>
    </div>
  );
}

/** Right-side panel listing bookmarked courses, grouped by department. */
function BookmarksPanel({
  courses,
  subjects,
  termById,
  bookmarks,
  onToggleBookmark,
  onSelectSubject,
  onClose,
}: BookmarksPanelProps) {
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
        const bookmarkedOfferings = sortedOfferings.filter((o) =>
          bookmarks.has(o.courseId),
        );
        if (bookmarkedOfferings.length === 0) continue;

        map.get(course.subject)?.push({
          scrollId: course.id,
          title: course.title,
          offerings: bookmarkedOfferings.map((o) => o.termOptions),
          onRemove: () => {
            for (const offering of bookmarkedOfferings) {
              onToggleBookmark(offering.courseId);
            }
          },
        });
        continue;
      }

      if (!bookmarks.has(course.id)) continue;
      map.get(course.subject)?.push({
        scrollId: course.id,
        title: course.title,
        onRemove: () => onToggleBookmark(course.id),
      });
    }

    return map;
  }, [courses, subjects, termById, bookmarks, onToggleBookmark]);

  const total = [...entriesBySubject.values()].reduce(
    (sum, list) => sum + list.length,
    0,
  );

  const handleBookmarkSelect = (courseId: string, subjectName: string) => {
    onSelectSubject(subjectName);
    document
      .getElementById(`course-${courseId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <ResizableAside
      id={BOOKMARKS_PANEL_ID}
      side="right"
      label="Bookmarked courses"
      storageKey="student-atlas-bookmarks-width"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line pr-2 pl-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          Bookmarks
          <span className="rounded-full bg-main-200 px-2 py-0.5 text-xs font-medium text-ink-secondary">
            {total}
          </span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close bookmarks"
          className={iconButtonClass}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {total === 0 ? (
          <p className="px-1 text-sm leading-relaxed text-ink-muted">
            No bookmarks yet. Use the bookmark icon on a course to save it here.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {subjects.map((subject) => {
                const entries = entriesBySubject.get(subject.name) ?? [];
                if (entries.length === 0) return null;
                return (
                  <motion.section
                    key={subject.name}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="mb-1 flex items-center gap-2 px-1 text-xs font-semibold tracking-wide text-ink-secondary uppercase">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: subject.accent }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{subject.name}</span>
                    </h3>
                    <ul className="flex flex-col gap-0.5">
                      <AnimatePresence initial={false}>
                        {entries.map((entry) => (
                          <motion.li
                            key={entry.scrollId}
                            layout
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 12 }}
                            transition={{ type: "spring", stiffness: 400, damping: 34 }}
                          >
                            <BookmarkRow
                              entry={entry}
                              accent={subject.accent}
                              termById={termById}
                              onSelect={() =>
                                handleBookmarkSelect(entry.scrollId, subject.name)
                              }
                            />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </motion.section>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </ResizableAside>
  );
}

export default BookmarksPanel;
