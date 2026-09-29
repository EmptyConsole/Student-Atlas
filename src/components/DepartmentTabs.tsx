import { GraduationCap } from "lucide-react";
import { REQUIREMENTS_KEY, type Subject } from "../data/subjects";
import { departmentChipClass } from "./controlStyles";

type DepartmentTabsProps = {
  subjects: Subject[];
  activeSubject: string;
  onSelectSubject: (name: string) => void;
  /** Adds a leading Requirements chip (student catalog only). */
  showRequirements?: boolean;
  className?: string;
};

/**
 * Wrapping row of department chips above the catalog. Clicking scrolls to the
 * department's section; the active chip follows the catalog's scroll position.
 */
function DepartmentTabs({
  subjects,
  activeSubject,
  onSelectSubject,
  showRequirements = false,
  className = "",
}: DepartmentTabsProps) {
  const handleSelect = (name: string) => {
    onSelectSubject(name);
    document
      .getElementById(`subject-${name}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav aria-label="Departments" className={className}>
      <div className="flex flex-wrap gap-2">
        {showRequirements && (
          <button
            type="button"
            onClick={() => handleSelect(REQUIREMENTS_KEY)}
            aria-current={activeSubject === REQUIREMENTS_KEY ? "true" : undefined}
            className={departmentChipClass(activeSubject === REQUIREMENTS_KEY)}
          >
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            Requirements
          </button>
        )}
        {subjects.map((subject) => {
          const selected = activeSubject === subject.name;
          return (
            <button
              key={subject.name}
              type="button"
              title={subject.description || undefined}
              onClick={() => handleSelect(subject.name)}
              aria-current={selected ? "true" : undefined}
              className={departmentChipClass(selected)}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: subject.accent }}
                aria-hidden="true"
              />
              {subject.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default DepartmentTabs;
