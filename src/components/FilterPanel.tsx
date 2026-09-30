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
      className={`inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-sm font-medium leading-5 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
        showBoldOutline ? "border-4" : "border-2"
      }`}
      style={{
        backgroundColor: active ? bg : "transparent",
        color: active ? fg : "var(--color-ink-muted)",
        borderColor: showBoldOutline ? fg : bg,
      }}
    >
      {label}
    </button>
  );
}

const YES_CHIP = { bg: "var(--chip-yes-bg)", fg: "var(--chip-yes-fg)" };
const NO_CHIP = { bg: "var(--chip-no-bg)", fg: "var(--chip-no-fg)" };

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
        className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-main-300 bg-surface px-4 text-base font-medium leading-6 text-ink-secondary shadow-raised transition-colors duration-150 ease-out hover:bg-main-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
      >
        <SlidersHorizontal className="h-5 w-5" />
        <span>Filter</span>
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-main-600 px-2 text-xs font-medium text-primary dark:text-ink">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-main-300 bg-surface p-4 shadow-overlay">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-medium leading-5 text-ink-secondary">Grade</h4>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink-secondary"
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
              <h4 className="mt-4 mb-3 text-sm font-medium leading-5 text-ink-secondary">Term</h4>
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

          <h4 className="mt-4 mb-3 text-sm font-medium leading-5 text-ink-secondary">
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
