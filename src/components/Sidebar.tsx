import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark } from "lucide-react";
import { SUBJECTS } from "../data/subjects";
import { COURSES } from "../data/courses";
import SubjectBookmark from "./SubjectBookmark";

type SidebarProps = {
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  activeSubject: string;
  onSelectSubject: (name: string) => void;
};

function Sidebar({
  bookmarks,
  onToggleBookmark,
  activeSubject,
  onSelectSubject,
}: SidebarProps) {
  const activeItemRef = useRef<HTMLLIElement>(null);

  const handleSelect = (name: string) => {
    onSelectSubject(name);
    document
      .getElementById(`subject-${name}`)
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
            const subjectBookmarks = COURSES.filter(
              (c) => c.subject === subject.name && bookmarks.has(c.id),
            );

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
                  {isActive && subjectBookmarks.length > 0 && (
                    <motion.ul
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-1 flex w-[98%] flex-col gap-1 pr-3 pl-[calc(40px+0.85rem)]"
                    >
                      <AnimatePresence initial={false}>
                        {subjectBookmarks.map((course) => (
                          <motion.li
                            key={course.id}
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
                            <button
                              type="button"
                              onClick={() => onToggleBookmark(course.id)}
                              aria-label={`Remove ${course.title} bookmark`}
                              className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-medium transition-colors hover:bg-white/60"
                              style={{ color: subject.accent }}
                            >
                              <Bookmark
                                className="h-3.5 w-3.5 shrink-0"
                                fill={subject.accent}
                              />
                              <span className="truncate">{course.title}</span>
                            </button>
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
