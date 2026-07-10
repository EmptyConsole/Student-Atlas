import { useMemo, useState } from "react";
import {
  GRADE_COLORS,
  GRADES,
  TERM_LABELS,
  TERM_COLORS,
  reqOptionsToRaw,
  type Course,
  type ReqOptions,
  type Term,
} from "../../data/courses";
import type { CourseInput, DepartmentRow } from "../../lib/teacher";
import ModalShell from "./ModalShell";
import RequirementBuilder from "./RequirementBuilder";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from "./formStyles";

type CourseFormModalProps = {
  mode: "add" | "edit";
  departments: DepartmentRow[];
  courses: Course[];
  editingCourse?: Course | null;
  onClose: () => void;
  onSave: (input: CourseInput) => Promise<{ error?: string }>;
};

const TERMS: Term[] = ["fall", "spring", "both", "all-year"];

function CourseFormModal({
  mode,
  departments,
  courses,
  editingCourse,
  onClose,
  onSave,
}: CourseFormModalProps) {
  const initialDepartmentId = useMemo(() => {
    if (!editingCourse) return departments[0]?.id ?? "";
    const match = departments.find((d) => d.name === editingCourse.subject);
    return match?.id ?? "";
  }, [editingCourse, departments]);

  const [title, setTitle] = useState(editingCourse?.title ?? "");
  const [shortDescription, setShortDescription] = useState(
    editingCourse?.shortDescription ?? "",
  );
  const [longDescription, setLongDescription] = useState(
    editingCourse?.longDescription ?? "",
  );
  const [grades, setGrades] = useState<number[]>(editingCourse?.grades ?? []);
  const [term, setTerm] = useState<Term>(editingCourse?.term ?? "fall");
  const [departmentId, setDepartmentId] = useState(initialDepartmentId);
  const [teacherName, setTeacherName] = useState(editingCourse?.teacher ?? "");
  const [maxStudentCountInput, setMaxStudentCountInput] = useState(() => {
    const count = editingCourse?.maxStudentCount;
    return count != null && count >= 0 ? String(count) : "";
  });
  const [retakeable, setRetakeable] = useState(
    editingCourse?.retakeable ?? false,
  );
  const [prereq, setPrereq] = useState<ReqOptions>(
    editingCourse?.prereqOptions ?? [],
  );
  const [coreq, setCoreq] = useState<ReqOptions>(
    editingCourse?.coreqOptions ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const builderCourses = useMemo(
    () =>
      courses
        .filter((c) => c.id !== editingCourse?.id)
        .map((c) => ({ id: c.id, title: c.title }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [courses, editingCourse],
  );

  const toggleGrade = (grade: number) =>
    setGrades((prev) =>
      prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade].sort((a, b) => a - b),
    );

  const canSave = title.trim().length > 0 && departmentId !== "";

  const handleSave = async () => {
    if (!canSave || saving) return;
    const department = departments.find((d) => d.id === departmentId);
    if (!department) {
      setError("Choose a department for this course.");
      return;
    }
    setSaving(true);
    setError(null);
    const trimmedMax = maxStudentCountInput.trim();
    const maxStudentCount =
      trimmedMax === ""
        ? -1
        : Math.max(0, Number.parseInt(trimmedMax, 10) || -1);
    const result = await onSave({
      title,
      shortDescription,
      longDescription,
      grades,
      term,
      subject: department.name,
      departmentId,
      teacherName,
      maxStudentCount,
      retakeable,
      prereqOptions: reqOptionsToRaw(prereq),
      coreqOptions: reqOptionsToRaw(coreq),
    });
    setSaving(false);
    if (result.error) setError(result.error);
    else onClose();
  };

  return (
    <ModalShell
      title={mode === "add" ? "Add course" : "Edit course"}
      onClose={onClose}
      busy={saving}
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={primaryButtonClass}
          >
            {saving ? "Saving…" : mode === "add" ? "Add course" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {departments.length === 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Add a department first — every course belongs to one.
          </div>
        )}

        <div>
          <label htmlFor="course-title" className={labelClass}>
            Title
          </label>
          <input
            id="course-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Intro to Programming"
            className={inputClass}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="course-department" className={labelClass}>
            Department
          </label>
          <select
            id="course-department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="course-short" className={labelClass}>
            Short description
          </label>
          <textarea
            id="course-short"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            rows={2}
            placeholder="One-line summary shown on the course card."
            className={textareaClass}
          />
        </div>

        <div>
          <label htmlFor="course-long" className={labelClass}>
            Long description
          </label>
          <textarea
            id="course-long"
            value={longDescription}
            onChange={(e) => setLongDescription(e.target.value)}
            rows={4}
            placeholder="Full description shown when the card is expanded."
            className={textareaClass}
          />
        </div>

        <div>
          <span className={labelClass}>Grades</span>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((grade) => {
              const active = grades.includes(grade);
              const { bg, fg } = GRADE_COLORS[grade];
              return (
                <button
                  key={grade}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleGrade(grade)}
                  className="cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-semibold transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2"
                  style={{
                    backgroundColor: active ? bg : "transparent",
                    color: active ? fg : "#6b7280",
                    borderColor: bg,
                  }}
                >
                  {grade}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className={labelClass}>Time of year</span>
          <div className="flex flex-wrap gap-2">
            {TERMS.map((t) => {
              const active = term === t;
              const { bg, fg } = TERM_COLORS[t];
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTerm(t)}
                  className="cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-semibold transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2"
                  style={{
                    backgroundColor: active ? bg : "transparent",
                    color: active ? fg : "#6b7280",
                    borderColor: bg,
                  }}
                >
                  {TERM_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>

        <RequirementBuilder
          label="Prerequisites"
          value={prereq}
          onChange={setPrereq}
          courses={builderCourses}
          accent="#4169e1"
        />

        <RequirementBuilder
          label="Corequisites"
          value={coreq}
          onChange={setCoreq}
          courses={builderCourses}
          accent="#4169e1"
        />

        <div>
          <label htmlFor="course-teacher" className={labelClass}>
            Teacher
          </label>
          <input
            id="course-teacher"
            type="text"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            placeholder="e.g. Jane Doe (leave blank if unassigned)"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="course-max-students" className={labelClass}>
            Max number of students
          </label>
          <input
            id="course-max-students"
            type="number"
            min={0}
            value={maxStudentCountInput}
            onChange={(e) => setMaxStudentCountInput(e.target.value)}
            placeholder="Leave blank if unknown"
            className={inputClass}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-main-300 bg-white px-4 py-3 shadow-sm">
          <input
            type="checkbox"
            checked={retakeable}
            onChange={(e) => setRetakeable(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-[#4169e1]"
          />
          <span className="text-sm font-medium text-gray-800">
            Repeatable (students may take this more than once)
          </span>
        </label>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </ModalShell>
  );
}

export default CourseFormModal;
