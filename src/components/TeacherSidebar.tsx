import { useEffect, useRef } from "react";
import type { Subject } from "../data/subjects";
import ResizableAside from "./ResizableAside";
import SubjectBookmark from "./SubjectBookmark";

type TeacherSidebarProps = {
  subjects: Subject[];
  activeSubject: string;
  onSelectSubject: (name: string) => void;
};

/**
 * Department navigation for the teacher catalog. Mirrors the student Sidebar:
 * one bookmark tab per department, clicking scrolls to that section and the
 * active tab tracks the scroll position.
 */
function TeacherSidebar({
  subjects,
  activeSubject,
  onSelectSubject,
}: TeacherSidebarProps) {
  const activeItemRef = useRef<HTMLLIElement>(null);

  const handleSelect = (name: string) => {
    onSelectSubject(name);
    document
      .getElementById(`subject-${name}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeSubject]);

  return (
    <ResizableAside storageKey="student-atlas-teacher-sidebar-width">
      <nav
        aria-label="Departments"
        className="flex flex-1 flex-col overflow-y-auto py-3"
      >
        {subjects.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400">
            No departments yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {subjects.map((subject) => {
              const isActive = activeSubject === subject.name;
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
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </ResizableAside>
  );
}

export default TeacherSidebar;
