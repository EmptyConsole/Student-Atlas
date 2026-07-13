import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  DEFAULT_FILTERS,
  GRADE_COLORS,
  GRADES,
  termColor,
  type Filters,
  type Term,
} from "../data/courses";

type FilterPanelProps = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  /** The school's terms, rendered as dynamic filter chips. */
  terms: Term[];
};

function Chip({
  label,
  active,
  bg,
  fg,
  onClick,
  boldOutlineWhenActive = false,
}: {
  label: string;
  active: boolean;
  bg: string;
  fg: string;
  onClick: () => void;
  boldOutlineWhenActive?: boolean;
}) {
  const showBoldOutline = active && boldOutlineWhenActive;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`cursor-pointer rounded-full px-3 py-1 text-sm font-semibold transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 ${
        showBoldOutline ? "border-4" : "border-2"
      }`}
      style={{
        backgroundColor: active ? bg : "transparent",
        color: active ? fg : "#6b7280",
        borderColor: showBoldOutline ? fg : bg,
      }}
    >
      {label}
    </button>
  );
}

const YES_CHIP = { bg: "#c5ecc0", fg: "#357a3a" };
const NO_CHIP = { bg: "#f7c8d2", fg: "#a83f57" };

function FilterPanel({ filters, onChange, terms }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCount =
    filters.grades.size +
    filters.terms.size +
    (filters.sortByPrerequisites ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const toggleGrade = (grade: number) => {
    const grades = new Set(filters.grades);
    if (grades.has(grade)) grades.delete(grade);
    else grades.add(grade);
    onChange({ ...filters, grades });
  };

  const toggleTerm = (termId: string) => {
    const next = new Set(filters.terms);
    if (next.has(termId)) next.delete(termId);
    else next.add(termId);
    onChange({ ...filters, terms: next });
  };

  const clearAll = () => onChange({ ...DEFAULT_FILTERS, grades: new Set(), terms: new Set() });

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-main-400 bg-white px-4 font-medium text-gray-700 shadow-sm transition-transform duration-150 hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700"
      >
        <SlidersHorizontal className="h-5 w-5" />
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-main-600 px-1.5 text-xs font-bold text-[#2c4a8a]">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-main-300 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-700">Grade</h4>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex cursor-pointer items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {GRADES.map((grade) => (
              <Chip
                key={grade}
                label={`${grade}`}
                active={filters.grades.has(grade)}
                bg={GRADE_COLORS[grade].bg}
                fg={GRADE_COLORS[grade].fg}
                onClick={() => toggleGrade(grade)}
              />
            ))}
          </div>

          {terms.length > 0 && (
            <>
              <h4 className="mt-4 mb-3 text-sm font-bold text-gray-700">Term</h4>
              <div className="flex flex-wrap gap-2">
                {terms.map((term) => {
                  const { bg, fg } = termColor(term.position);
                  return (
                    <Chip
                      key={term.id}
                      label={term.name}
                      active={filters.terms.has(term.id)}
                      bg={bg}
                      fg={fg}
                      onClick={() => toggleTerm(term.id)}
                    />
                  );
                })}
              </div>
            </>
          )}

          <h4 className="mt-4 mb-3 text-sm font-bold text-gray-700">
            Prerequisites
          </h4>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="Yes"
              active={filters.sortByPrerequisites}
              bg={YES_CHIP.bg}
              fg={YES_CHIP.fg}
              boldOutlineWhenActive
              onClick={() =>
                onChange({ ...filters, sortByPrerequisites: true })
              }
            />
            <Chip
              label="No"
              active={!filters.sortByPrerequisites}
              bg={NO_CHIP.bg}
              fg={NO_CHIP.fg}
              boldOutlineWhenActive
              onClick={() =>
                onChange({ ...filters, sortByPrerequisites: false })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
