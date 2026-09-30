import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ReqGroup, ReqItem, ReqOptions } from "../../data/courses";

type CourseOption = { id: string; title: string };

type RequirementBuilderProps = {
  label: string;
  value: ReqOptions;
  onChange: (next: ReqOptions) => void;
  /** Courses in the school that can be linked (excludes the edited course). */
  courses: CourseOption[];
  accent: string;
};

function itemKey(item: ReqItem, index: number): string {
  return item.kind === "course" ? `c-${item.courseId}-${index}` : `t-${index}`;
}

/**
 * Editor for prerequisites/corequisites in disjunctive normal form: a list of
 * OR-alternatives, each an AND-group of items. Every item is either a linked
 * course (from the school) or free text.
 */
function RequirementBuilder({
  label,
  value,
  onChange,
  courses,
  accent,
}: RequirementBuilderProps) {
  const [textDrafts, setTextDrafts] = useState<Record<number, string>>({});

  const updateGroup = (groupIndex: number, next: ReqGroup) => {
    const groups = value.map((g, i) => (i === groupIndex ? next : g));
    onChange(groups);
  };

  const addGroup = () => onChange([...value, []]);

  const removeGroup = (groupIndex: number) =>
    onChange(value.filter((_, i) => i !== groupIndex));

  const addCourse = (groupIndex: number, courseId: string) => {
    if (!courseId) return;
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;
    const group = value[groupIndex] ?? [];
    if (group.some((i) => i.kind === "course" && i.courseId === courseId)) return;
    updateGroup(groupIndex, [
      ...group,
      { kind: "course", courseId, title: course.title },
    ]);
  };

  const addText = (groupIndex: number) => {
    const text = (textDrafts[groupIndex] ?? "").trim();
    if (!text) return;
    const group = value[groupIndex] ?? [];
    updateGroup(groupIndex, [...group, { kind: "text", text }]);
    setTextDrafts((d) => ({ ...d, [groupIndex]: "" }));
  };

  const removeItem = (groupIndex: number, itemIndex: number) => {
    const group = value[groupIndex] ?? [];
    updateGroup(
      groupIndex,
      group.filter((_, i) => i !== itemIndex),
    );
  };

  return (
    <div>
      <span className="mb-2 block text-sm font-medium leading-5 text-ink-secondary">
        {label}
      </span>

      {value.length === 0 && (
        <p className="mb-2 text-xs text-ink-muted">
          No requirement. Add an option below.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {value.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && (
              <div className="my-1 flex items-center gap-2">
                <span className="h-px flex-1 bg-main-300" />
                <span className="text-xs font-bold tracking-wide text-ink-muted">
                  OR
                </span>
                <span className="h-px flex-1 bg-main-300" />
              </div>
            )}

            <div className="rounded-xl border border-main-300 bg-main-100/50 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {group.length === 0 && (
                    <span className="text-xs text-ink-muted">
                      Empty group — add a course or text (all required).
                    </span>
                  )}
                  {group.map((item, itemIndex) => (
                    <span
                      key={itemKey(item, itemIndex)}
                      className="inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-1 text-xs font-semibold"
                      style={{ borderColor: accent, color: accent }}
                    >
                      {item.kind === "course" ? item.title : `"${item.text}"`}
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => removeItem(groupIndex, itemIndex)}
                        className="cursor-pointer rounded-full p-1 text-ink-muted transition-colors duration-150 ease-out hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Remove option"
                  onClick={() => removeGroup(groupIndex)}
                  className="shrink-0 cursor-pointer rounded-full p-1 text-ink-muted transition-colors hover:bg-black/10 hover:text-ink-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    addCourse(groupIndex, e.target.value);
                    e.target.value = "";
                  }}
                  className="h-9 w-full min-w-0 rounded-lg border border-main-300 bg-surface px-2 text-sm text-ink-secondary focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  <option value="">+ Add course…</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>

                <div className="flex min-w-0 gap-2">
                  <input
                    type="text"
                    value={textDrafts[groupIndex] ?? ""}
                    onChange={(e) =>
                      setTextDrafts((d) => ({
                        ...d,
                        [groupIndex]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addText(groupIndex);
                      }
                    }}
                    placeholder="or free text…"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-main-300 bg-surface px-3 text-sm leading-5 text-ink-secondary placeholder:text-ink-muted focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => addText(groupIndex)}
                    className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-lg border border-main-300 bg-surface px-3 text-sm font-medium leading-5 text-primary transition-colors duration-150 ease-out hover:bg-main-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addGroup}
        className="mt-2 inline-flex h-10 cursor-pointer items-center gap-2 rounded-[20px] border border-dashed border-main-300 px-6 text-base font-medium leading-6 text-primary transition-colors duration-150 ease-out hover:bg-main-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        {value.length === 0 ? "Add requirement" : "Add OR alternative"}
      </button>
    </div>
  );
}

export default RequirementBuilder;
