import { useEffect, useRef } from "react";
import SubjectBookmark from "./SubjectBookmark";

export type TeacherSection = "course" | "department" | "school";

const TEACHER_NAV: {
  id: TeacherSection;
  label: string;
  description: string;
}[] = [
  { id: "course", label: "Course", description: "Course details" },
  { id: "department", label: "Department", description: "Department details" },
  { id: "school", label: "School", description: "School details" },
];

const BLUE_TINT = "#edf2fb";
const BLUE_COLOR = "#c1d3fe";
const BLUE_ACCENT = "#4169e1";

type TeacherSidebarProps = {
  activeSection: TeacherSection;
  onSelectSection: (id: TeacherSection) => void;
};

function TeacherSidebar({
  activeSection,
  onSelectSection,
}: TeacherSidebarProps) {
  const activeItemRef = useRef<HTMLLIElement>(null);

  const handleSelect = (id: TeacherSection) => {
    onSelectSection(id);
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeSection]);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-main-100">
      <nav
        aria-label="Teacher sections"
        className="flex flex-1 flex-col overflow-y-auto py-3"
      >
        <ul className="flex flex-col gap-1.5">
          {TEACHER_NAV.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <li
                key={item.id}
                ref={isActive ? activeItemRef : null}
                className="flex flex-col items-end"
              >
                <SubjectBookmark
                  label={item.label}
                  description={item.description}
                  color={BLUE_COLOR}
                  tint={BLUE_TINT}
                  accent={BLUE_ACCENT}
                  isActive={isActive}
                  onClick={() => handleSelect(item.id)}
                />
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default TeacherSidebar;
