import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Bookmark, Search } from "lucide-react";
import type { Subject } from "../data/subjects";
import {
  DEFAULT_FILTERS,
  matchesSearch,
  type Course,
  type Filters,
  type Term,
} from "../data/courses";
import type { UserProfile } from "../hooks/useProfile";
import { buildDisplayCourses, repCourse, type DisplayCourse } from "../utils/courseGrouping";
import { BOOKMARKS_PANEL_ID } from "./BookmarksPanel";
import CatalogLayoutToggle, {
  LAYOUT_SWITCH_TRANSITION,
} from "./CatalogLayoutToggle";
import {
  searchInputClass,
  spinnerClass,
  toolbarButtonClass,
} from "./controlStyles";
import DepartmentTabs from "./DepartmentTabs";
import FilterPanel from "./FilterPanel";
import RequirementsSection from "./RequirementsSection";
import SubjectSection from "./SubjectSection";

type CourseBrowserProps = {
  courses: Course[];
  subjects: Subject[];
  terms: Term[];
  termById: Map<string, Term>;
  /** Grade levels the school uses, for the grade filter chips. */
  schoolGrades: number[];
  loading: boolean;
  error: string | null;
  profile: UserProfile;
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  onUpdateCourseNote: (courseId: string, note: string) => void;
  activeSubject: string;
  onActiveSubjectChange: (name: string) => void;
  bookmarksOpen: boolean;
  onToggleBookmarksPanel: () => void;
};

type BrowserLayout = "full" | "compact";

const BROWSER_LAYOUT_KEY = "student-atlas-browser-layout";

function loadBrowserLayout(): BrowserLayout {
  try {
    const stored = localStorage.getItem(BROWSER_LAYOUT_KEY);
    if (stored === "full" || stored === "compact") return stored;
  } catch {
    /* ignore */
  }
  return "full";
}

function CourseBrowser({
  courses,
  subjects,
  terms,
  termById,
  schoolGrades,
  loading,
  error,
  profile,
  bookmarks,
  onToggleBookmark,
  onUpdateCourseNote,
  activeSubject,
  onActiveSubjectChange,
  bookmarksOpen,
  onToggleBookmarksPanel,
}: CourseBrowserProps) {
  const [search, setSearch] = useState("");
  const [browserLayout, setBrowserLayout] = useState<BrowserLayout>(loadBrowserLayout);
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    grades: new Set(),
    terms: new Set(),
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeSubject);
  activeRef.current = activeSubject;

  const compact = browserLayout === "compact";

  const bookmarkCount = useMemo(
    () => courses.filter((course) => bookmarks.has(course.id)).length,
    [courses, bookmarks],
  );

  const itemsBySubject = useMemo(() => {
    const map = new Map<string, DisplayCourse[]>();
    for (const subject of subjects) map.set(subject.name, []);
    for (const item of buildDisplayCourses(courses)) {
      const rep = repCourse(item);
      if (!matchesSearch(rep, search)) continue;
      map.get(rep.subject)?.push(item);
    }
    return map;
  }, [search, courses, subjects]);

  const toggleExpand = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  const toggleBrowserLayout = () => {
    setBrowserLayout((prev) => {
      const next: BrowserLayout = prev === "full" ? "compact" : "full";
      try {
        localStorage.setItem(BROWSER_LAYOUT_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const collapseResetKey = useMemo(
    () =>
      JSON.stringify({
        search,
        grades: [...filters.grades].sort(),
        terms: [...filters.terms].sort(),
        sortByPrerequisites: filters.sortByPrerequisites,
      }),
    [search, filters],
  );

  // Scroll spy: update the active subject as sections cross the top of the list.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const name = entry.target.getAttribute("data-subject");
          if (!name) continue;
          if (entry.isIntersecting) {
            visible.set(name, entry.boundingClientRect.top);
          } else {
            visible.delete(name);
          }
        }
        if (visible.size === 0) return;
        const topmost = [...visible.entries()].sort(
          (a, b) => a[1] - b[1],
        )[0][0];
        if (topmost !== activeRef.current) onActiveSubjectChange(topmost);
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    const sections = root.querySelectorAll("[data-subject]");
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [search, onActiveSubjectChange, browserLayout]);

  const hasResults = subjects.some(
    (s) => (itemsBySubject.get(s.name)?.length ?? 0) > 0,
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-detail-400">
      <div className="z-20 shrink-0 border-b border-line bg-detail-400">
        <div className="mx-auto w-full max-w-[1280px] px-4 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses by title or description..."
                aria-label="Search courses"
                className={searchInputClass}
              />
            </div>
            <CatalogLayoutToggle compact={compact} onToggle={toggleBrowserLayout} />
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              terms={terms}
              grades={schoolGrades}
            />
            <button
              type="button"
              onClick={onToggleBookmarksPanel}
              aria-expanded={bookmarksOpen}
              aria-controls={BOOKMARKS_PANEL_ID}
              className={toolbarButtonClass(bookmarksOpen)}
            >
              <Bookmark className="h-5 w-5" fill={bookmarksOpen ? "currentColor" : "none"} />
              <span className="hidden sm:inline">Bookmarks</span>
              {bookmarkCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                  {bookmarkCount}
                </span>
              )}
            </button>
          </div>
          <DepartmentTabs
            subjects={subjects}
            activeSubject={activeSubject}
            onSelectSubject={onActiveSubjectChange}
            showRequirements
            className="mt-3 pb-4"
          />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-12 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <p className="mb-2 text-ink-secondary">Loading courses...</p>
              <div className={spinnerClass} />
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <p className="mb-2 font-semibold text-red-600">
                Error loading courses
              </p>
              <p className="text-sm text-ink-secondary">{error}</p>
            </div>
          </div>
        ) : (
          <LayoutGroup>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={browserLayout}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={LAYOUT_SWITCH_TRANSITION}
                className="flex flex-col gap-8"
              >
                <RequirementsSection subjects={subjects} />
                {subjects.map((subject) => (
                  <SubjectSection
                    key={subject.name}
                    subject={subject}
                    items={itemsBySubject.get(subject.name) ?? []}
                    filters={filters}
                    termById={termById}
                    completedCourses={profile.completedCourses}
                    expandedId={expandedId}
                    bookmarks={bookmarks}
                    courseNotes={profile.courseNotes}
                    collapseResetKey={collapseResetKey}
                    compact={compact}
                    onToggleExpand={toggleExpand}
                    onToggleBookmark={onToggleBookmark}
                    onUpdateCourseNote={onUpdateCourseNote}
                  />
                ))}

                {!hasResults && (
                  <p className="py-16 text-center text-ink-muted">
                    No courses match "{search}".
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </LayoutGroup>
        )}
        </div>
      </div>
    </main>
  );
}

export default CourseBrowser;
