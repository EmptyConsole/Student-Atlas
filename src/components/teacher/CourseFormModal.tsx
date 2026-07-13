import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  GRADE_COLORS,
  GRADES,
  reqOptionsToRaw,
  termColor,
  type Course,
  type ReqOptions,
  type Term,
} from "../../data/courses";
import type { CourseFormSubmit, DepartmentRow } from "../../lib/teacher";
import {
  offeringsOf,
  repCourse,
  type DisplayCourse,
} from "../../utils/courseGrouping";
import ModalShell from "./ModalShell";
import RequirementBuilder from "./RequirementBuilder";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { useGuardedClose } from "./useGuardedClose";
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
  terms: Term[];
  editingItem?: DisplayCourse | null;
  onClose: () => void;
  onSave: (input: CourseFormSubmit) => Promise<{ error?: string }>;
};

function normalizeOfferings(offerings: string[][]): string[][] {
  return offerings
    .map((o) => [...o].sort())
    .sort((a, b) => a.join("\0").localeCompare(b.join("\0")));
}

function CourseFormModal({
  mode,
  departments,
  courses,
  terms,
  editingItem,
  onClose,
  onSave,
}: CourseFormModalProps) {
  const editingCourse = editingItem ? repCourse(editingItem) : null;
  const editingIds = useMemo(
    () =>
      editingItem
        ? editingItem.kind === "group"
          ? editingItem.offerings.map((o) => o.courseId)
          : [editingItem.course.id]
        : [],
    [editingItem],
  );

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
  const [offerings, setOfferings] = useState<string[][]>(() => {
    const initial = editingItem ? offeringsOf(editingItem) : [];
    return initial.length > 0 ? initial.map((o) => [...o]) : [[]];
  });
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

  const initialSnapshot = useRef({
    title: editingCourse?.title ?? "",
    shortDescription: editingCourse?.shortDescription ?? "",
    longDescription: editingCourse?.longDescription ?? "",
    grades: [...(editingCourse?.grades ?? [])].sort((a, b) => a - b),
    offerings: normalizeOfferings(
      editingItem ? offeringsOf(editingItem) : [[]],
    ),
    departmentId: initialDepartmentId,
    teacherName: editingCourse?.teacher ?? "",
    maxStudentCountInput:
      editingCourse?.maxStudentCount != null &&
      editingCourse.maxStudentCount >= 0
        ? String(editingCourse.maxStudentCount)
        : "",
    retakeable: editingCourse?.retakeable ?? false,
    prereq: editingCourse?.prereqOptions ?? [],
    coreq: editingCourse?.coreqOptions ?? [],
  });

  const isDirty = useMemo(() => {
    const current = {
      title,
      shortDescription,
      longDescription,
      grades: [...grades].sort((a, b) => a - b),
      offerings: normalizeOfferings(offerings),
      departmentId,
      teacherName,
      maxStudentCountInput,
      retakeable,
      prereq,
      coreq,
    };
    return JSON.stringify(current) !== JSON.stringify(initialSnapshot.current);
  }, [
    title,
    shortDescription,
    longDescription,
    grades,
    offerings,
    departmentId,
    teacherName,
    maxStudentCountInput,
    retakeable,
    prereq,
    coreq,
  ]);

  const { requestClose, discardOpen, cancelDiscard, confirmDiscard } =
    useGuardedClose(onClose, isDirty, saving);

  const builderCourses = useMemo(
    () =>
      courses
        .filter((c) => !editingIds.includes(c.id))
        .map((c) => ({ id: c.id, title: c.title }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [courses, editingIds],
  );

  const toggleGrade = (grade: number) =>
    setGrades((prev) =>
      prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade].sort((a, b) => a - b),
    );

  const toggleTerm = (offeringIndex: number, termId: string) =>
    setOfferings((prev) =>
      prev.map((offering, i) => {
        if (i !== offeringIndex) return offering;
        return offering.includes(termId)
          ? offering.filter((id) => id !== termId)
          : [...offering, termId];
      }),
    );

  const addOffering = () => setOfferings((prev) => [...prev, []]);

  const removeOffering = (index: number) =>
    setOfferings((prev) => prev.filter((_, i) => i !== index));

  const hasValidOffering = offerings.some((o) => o.length > 0);
  const canSave =
    title.trim().length > 0 &&
    departmentId !== "" &&
    terms.length > 0 &&
    hasValidOffering;

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
      subject: department.name,
      departmentId,
      teacherName,
      maxStudentCount,
      retakeable,
      prereqOptions: reqOptionsToRaw(prereq),
      coreqOptions: reqOptionsToRaw(coreq),
      offerings,
    });
    setSaving(false);
    if (result.error) setError(result.error);
    else onClose();
  };

  return (
    <>
      <ModalShell
        title={mode === "add" ? "Add course" : "Edit course"}
        onClose={requestClose}
        busy={saving}
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={requestClose}
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
          <span className={labelClass}>Terms offered</span>
          {terms.length === 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This school has no terms yet. Add at least one term in{" "}
              <span className="font-semibold">Edit school</span> before creating
              courses.
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-400">
                Each row is one class offering. Pick every term it spans (e.g.
                pick two terms for a year-long class). Use "Add another class"
                for a separate offering that students rank independently.
              </p>
              <div className="flex flex-col gap-2">
                {offerings.map((offering, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 rounded-xl border border-main-300 bg-white p-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      {terms.map((term) => {
                        const active = offering.includes(term.id);
                        const { bg, fg } = termColor(term.position);
                        return (
                          <button
                            key={term.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleTerm(index, term.id)}
                            className="cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-semibold transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2"
                            style={{
                              backgroundColor: active ? bg : "transparent",
                              color: active ? fg : "#6b7280",
                              borderColor: bg,
                            }}
                          >
                            {term.name}
                          </button>
                        );
                      })}
                    </div>
                    {offerings.length > 1 && (
                      <button
                        type="button"
                        aria-label="Remove this offering"
                        onClick={() => removeOffering(index)}
                        className="ml-auto shrink-0 cursor-pointer rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOffering}
                className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-lg border border-main-400 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-main-100"
              >
                <Plus className="h-4 w-4" />
                Add another class
              </button>
            </>
          )}
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
      {discardOpen && (
        <UnsavedChangesDialog
          onStay={cancelDiscard}
          onDiscard={confirmDiscard}
        />
      )}
    </>
  );
}

export default CourseFormModal;
