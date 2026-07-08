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
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </span>

      {value.length === 0 && (
        <p className="mb-2 text-xs text-gray-400">
          No requirement. Add an option below.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {value.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && (
              <div className="my-1 flex items-center gap-2">
                <span className="h-px flex-1 bg-main-300" />
                <span className="text-xs font-bold tracking-wide text-gray-400">
                  OR
                </span>
                <span className="h-px flex-1 bg-main-300" />
              </div>
            )}

            <div className="rounded-xl border border-main-300 bg-main-100/50 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {group.length === 0 && (
                    <span className="text-xs text-gray-400">
                      Empty group — add a course or text (all required).
                    </span>
                  )}
                  {group.map((item, itemIndex) => (
                    <span
                      key={itemKey(item, itemIndex)}
                      className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold"
                      style={{ borderColor: accent, color: accent }}
                    >
                      {item.kind === "course" ? item.title : `"${item.text}"`}
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => removeItem(groupIndex, itemIndex)}
                        className="cursor-pointer rounded-full p-0.5 hover:bg-black/10"
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
                  className="shrink-0 cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:bg-black/10 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value=""
                  onChange={(e) => {
                    addCourse(groupIndex, e.target.value);
                    e.target.value = "";
                  }}
                  className="h-9 flex-1 rounded-lg border border-main-300 bg-white px-2 text-sm text-gray-700 focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500"
                >
                  <option value="">+ Add course…</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>

                <div className="flex flex-1 gap-1.5">
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
                    className="h-9 min-w-0 flex-1 rounded-lg border border-main-300 bg-white px-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500"
                  />
                  <button
                    type="button"
                    onClick={() => addText(groupIndex)}
                    className="shrink-0 cursor-pointer rounded-lg border border-main-300 bg-white px-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-main-100"
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
        className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-main-400 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-main-100"
      >
        <Plus className="h-3.5 w-3.5" />
        {value.length === 0 ? "Add requirement" : "Add OR alternative"}
      </button>
    </div>
  );
}

export default RequirementBuilder;
