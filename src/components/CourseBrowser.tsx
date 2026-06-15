import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup } from "motion/react";
import { Search } from "lucide-react";
import { SUBJECTS } from "../data/subjects";
import { COURSES, matchesSearch, type Filters } from "../data/courses";
import FilterPanel from "./FilterPanel";
import SubjectSection from "./SubjectSection";

type CourseBrowserProps = {
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  activeSubject: string;
  onActiveSubjectChange: (name: string) => void;
};

function CourseBrowser({
  bookmarks,
  onToggleBookmark,
  activeSubject,
  onActiveSubjectChange,
}: CourseBrowserProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({
    grades: new Set(),
    terms: new Set(),
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeSubject);
  activeRef.current = activeSubject;

  const coursesBySubject = useMemo(() => {
    const map = new Map<string, typeof COURSES>();
    for (const subject of SUBJECTS) map.set(subject.name, []);
    for (const course of COURSES) {
      if (!matchesSearch(course, search)) continue;
      map.get(course.subject)?.push(course);
    }
    return map;
  }, [search]);

  const toggleExpand = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

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
        const topmost = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
        if (topmost !== activeRef.current) onActiveSubjectChange(topmost);
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    const sections = root.querySelectorAll("[data-subject]");
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [search, onActiveSubjectChange]);

  const hasResults = SUBJECTS.some(
    (s) => (coursesBySubject.get(s.name)?.length ?? 0) > 0,
  );

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-detail-400">
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-detail-400/95 px-6 pt-6 pb-4 backdrop-blur">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses by title or description..."
            className="h-12 w-full rounded-xl border border-main-400 bg-white pr-4 pl-11 text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500"
          />
        </div>
        <FilterPanel filters={filters} onChange={setFilters} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-2 pb-10">
        <LayoutGroup>
          <div className="flex flex-col gap-8">
            {SUBJECTS.map((subject) => (
              <SubjectSection
                key={subject.name}
                subject={subject}
                courses={coursesBySubject.get(subject.name) ?? []}
                filters={filters}
                expandedId={expandedId}
                bookmarks={bookmarks}
                onToggleExpand={toggleExpand}
                onToggleBookmark={onToggleBookmark}
              />
            ))}

            {!hasResults && (
              <p className="py-16 text-center text-gray-400">
                No courses match "{search}".
              </p>
            )}
          </div>
        </LayoutGroup>
      </div>
    </main>
  );
}

export default CourseBrowser;
