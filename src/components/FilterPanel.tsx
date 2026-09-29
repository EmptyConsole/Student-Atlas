import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  DEFAULT_FILTERS,
  GRADES,
  gradeColor,
  termColor,
  type Filters,
  type Term,
} from "../data/courses";
import { chipClass, toolbarButtonClass } from "./controlStyles";

type FilterPanelProps = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  /** The school's terms, rendered as dynamic filter chips. */
  terms: Term[];
  /**
   * Grade levels the school uses (`schools.grade` keys). Falls back to the
   * default 8-12 list when the school has no per-grade settings yet.
   */
  grades: number[];
};

function Chip({
  label,
  active,
  bg,
  fg,
  onClick,
}: {
  label: string;
  active: boolean;
  bg: string;
  fg: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${chipClass} ${
        active
          ? "font-semibold"
          : "border-line bg-white font-medium text-ink-secondary hover:bg-main-100 hover:text-ink"
      }`}
      style={active ? { backgroundColor: bg, color: fg, borderColor: fg } : undefined}
    >
      {label}
    </button>
  );
}

const YES_CHIP = { bg: "#c5ecc0", fg: "#357a3a" };
const NO_CHIP = { bg: "#f7c8d2", fg: "#a83f57" };

function FilterPanel({ filters, onChange, terms, grades }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const gradeOptions = grades.length > 0 ? grades : [...GRADES];

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
        aria-expanded={open}
        aria-haspopup="dialog"
        className={toolbarButtonClass(open)}
      >
        <SlidersHorizontal className="h-5 w-5" />
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-line bg-white p-5 shadow-overlay">
          <div className="mb-3 flex h-6 items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">Grade</h4>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="-mr-2 flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:bg-main-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {gradeOptions.map((grade) => {
              const { bg, fg } = gradeColor(grade);
              return (
                <Chip
                  key={grade}
                  label={`${grade}`}
                  active={filters.grades.has(grade)}
                  bg={bg}
                  fg={fg}
                  onClick={() => toggleGrade(grade)}
                />
              );
            })}
          </div>

          {terms.length > 0 && (
            <>
              <h4 className="mt-5 mb-3 text-sm font-semibold text-ink">Term</h4>
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

          <h4 className="mt-5 mb-3 text-sm font-semibold text-ink">
            Prerequisites
          </h4>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="Yes"
              active={filters.sortByPrerequisites}
              bg={YES_CHIP.bg}
              fg={YES_CHIP.fg}
              onClick={() =>
                onChange({ ...filters, sortByPrerequisites: true })
              }
            />
            <Chip
              label="No"
              active={!filters.sortByPrerequisites}
              bg={NO_CHIP.bg}
              fg={NO_CHIP.fg}
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
