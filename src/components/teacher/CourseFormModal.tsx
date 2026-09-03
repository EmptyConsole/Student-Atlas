import { useCallback, useMemo, useRef, useState } from "react";
import { HelpCircle, Plus, X } from "lucide-react";
import {
  GRADE_COLORS,
  GRADES,
  reqOptionsToRaw,
  termColor,
  type Course,
  type ReqOptions,
  type Term,
} from "../../data/courses";
import type {
  ClassTimeEdit,
  CourseFormSubmit,
  DepartmentRow,
  OfferingInput,
} from "../../lib/teacher";
import {
  offeringRowsOf,
  type DisplayCourse,
} from "../../utils/courseGrouping";
import {
  classTimeKey,
  minutesToTimeValue,
  timeValueToMinutes,
  type ClassTime,
} from "../../utils/classTime";
import CourseEditorHelp from "./CourseEditorHelp";
import ModalShell from "./ModalShell";
import RequirementBuilder from "./RequirementBuilder";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { useGuardedClose } from "./useGuardedClose";
import {
  clearCourseDraft,
  courseDraftId,
  readCourseDraft,
  useCourseDraft,
  type CourseDraftForm,
} from "./useCourseDraft";
import { useCourseConflict } from "./useCourseConflict";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from "./formStyles";

type CourseFormModalProps = {
  mode: "add" | "edit";
  schoolId: string;
  departments: DepartmentRow[];
  courses: Course[];
  terms: Term[];
  editingItem?: DisplayCourse | null;
  onClose: () => void;
  onSave: (input: CourseFormSubmit) => Promise<{ error?: string }>;
  /** Refetch catalog + remount this form with fresh server values. */
  onReloadFromServer?: () => void;
};

type TimeDraft = {
  key: string;
  day: string;
  start: string;
  end: string;
  original: ClassTime | null;
};

/** Term-offering row only — class times live in a separate shared list. */
type OfferingDraft = {
  courseId: string | null;
  terms: string[];
  /** Schedule on this row when the form opened; used to sync RPCs on save. */
  previousSchedule: ClassTime[];
};

let draftKeyCounter = 0;
function nextDraftKey(): string {
  draftKeyCounter += 1;
  return `t-${draftKeyCounter}`;
}

function classTimeToDraft(t: ClassTime): TimeDraft {
  return {
    key: nextDraftKey(),
    day: String(t.day),
    start: minutesToTimeValue(t.start),
    end: minutesToTimeValue(t.end),
    original: t,
  };
}

function emptyTimeDraft(): TimeDraft {
  return {
    key: nextDraftKey(),
    day: "1",
    start: "",
    end: "",
    original: null,
  };
}

function initialOfferings(
  editingItem: DisplayCourse | null | undefined,
): OfferingDraft[] {
  if (!editingItem) {
    return [{ courseId: null, terms: [], previousSchedule: [] }];
  }
  const rows = offeringRowsOf(editingItem);
  if (rows.length === 0) {
    return [{ courseId: null, terms: [], previousSchedule: [] }];
  }
  return rows.map((r) => ({
    courseId: r.courseId,
    terms: [...r.termOptions],
    previousSchedule: r.schedule,
  }));
}

/** Seed the shared times editor from the first offering's schedule. */
function initialTimes(
  editingItem: DisplayCourse | null | undefined,
): TimeDraft[] {
  if (!editingItem) return [];
  const rows = offeringRowsOf(editingItem);
  return (rows[0]?.schedule ?? []).map(classTimeToDraft);
}

function normalizeOfferingsSnapshot(offerings: OfferingDraft[]) {
  return offerings
    .map((o) => ({
      courseId: o.courseId,
      terms: [...o.terms].sort(),
    }))
    .sort((a, b) =>
      (a.courseId ?? "").localeCompare(b.courseId ?? "") ||
      a.terms.join("\0").localeCompare(b.terms.join("\0")),
    );
}

function normalizeTimesSnapshot(times: TimeDraft[]) {
  return times
    .map((t) => ({
      day: t.day,
      start: t.start,
      end: t.end,
      originalKey: t.original ? classTimeKey(t.original) : null,
    }))
    .sort((a, b) =>
      `${a.day}|${a.start}|${a.end}`.localeCompare(
        `${b.day}|${b.start}|${b.end}`,
      ),
    );
}

function parseTimeDraft(t: TimeDraft): { value?: ClassTime; error?: string } {
  const day = Number.parseInt(t.day.trim(), 10);
  if (!Number.isFinite(day) || day < 1) {
    return { error: "Each class time needs a day number of 1 or higher." };
  }
  const start = timeValueToMinutes(t.start);
  const end = timeValueToMinutes(t.end);
  if (start == null || end == null) {
    return { error: "Each class time needs a start and end time." };
  }
  if (start >= end) {
    return { error: "Class time start must be before end." };
  }
  return { value: { day, start, end } };
}

/**
 * Map the shared time drafts onto one offering's previous schedule so RPC
 * remove/edit/add still target the right blocks on that row.
 */
function editsForOffering(
  previous: ClassTime[],
  drafts: { original: ClassTime | null; value: ClassTime }[],
): ClassTimeEdit[] {
  const prevKeys = new Set(previous.map(classTimeKey));
  return drafts.map((d) => {
    if (d.original && prevKeys.has(classTimeKey(d.original))) {
      return { original: d.original, value: d.value };
    }
    if (prevKeys.has(classTimeKey(d.value))) {
      return { original: d.value, value: d.value };
    }
    return { original: null, value: d.value };
  });
}

function CourseFormModal({
  mode,
  schoolId,
  departments,
  courses,
  terms,
  editingItem,
  onClose,
  onSave,
  onReloadFromServer,
}: CourseFormModalProps) {
  const editingCourse = editingItem
    ? editingItem.kind === "single"
      ? editingItem.course
      : editingItem.representative
    : null;
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

  const draftId = courseDraftId(schoolId, mode, editingCourse?.id ?? null);
  const restoredDraft = useRef(readCourseDraft(draftId)).current;
  const [showRestoreBanner, setShowRestoreBanner] = useState(
    () => restoredDraft != null,
  );

  const serverOfferings = useMemo(
    () => initialOfferings(editingItem),
    [editingItem],
  );
  const serverTimes = useMemo(() => initialTimes(editingItem), [editingItem]);

  const [title, setTitle] = useState(
    () => restoredDraft?.title ?? editingCourse?.title ?? "",
  );
  const [shortDescription, setShortDescription] = useState(
    () =>
      restoredDraft?.shortDescription ?? editingCourse?.shortDescription ?? "",
  );
  const [longDescription, setLongDescription] = useState(
    () =>
      restoredDraft?.longDescription ?? editingCourse?.longDescription ?? "",
  );
  const [grades, setGrades] = useState<number[]>(
    () => restoredDraft?.grades ?? editingCourse?.grades ?? [],
  );
  const [offerings, setOfferings] = useState<OfferingDraft[]>(() => {
    if (restoredDraft?.offerings) {
      return restoredDraft.offerings.map((o) => ({
        courseId: o.courseId,
        terms: [...o.terms],
        previousSchedule: o.previousSchedule ?? [],
      }));
    }
    return initialOfferings(editingItem);
  });
  const [classTimes, setClassTimes] = useState<TimeDraft[]>(() => {
    if (restoredDraft?.classTimes) {
      return restoredDraft.classTimes.map((t) => ({
        key: nextDraftKey(),
        day: t.day,
        start: t.start,
        end: t.end,
        original: t.original,
      }));
    }
    return initialTimes(editingItem);
  });
  const [departmentId, setDepartmentId] = useState(
    () => restoredDraft?.departmentId ?? initialDepartmentId,
  );
  const [teacherName, setTeacherName] = useState(
    () => restoredDraft?.teacherName ?? editingCourse?.teacher ?? "",
  );
  const [maxStudentCountInput, setMaxStudentCountInput] = useState(() => {
    if (restoredDraft) return restoredDraft.maxStudentCountInput;
    const count = editingCourse?.maxStudentCount;
    return count != null && count >= 0 ? String(count) : "";
  });
  const [retakeable, setRetakeable] = useState(
    () => restoredDraft?.retakeable ?? editingCourse?.retakeable ?? false,
  );
  const [prereq, setPrereq] = useState<ReqOptions>(
    () => restoredDraft?.prereq ?? editingCourse?.prereqOptions ?? [],
  );
  const [coreq, setCoreq] = useState<ReqOptions>(
    () => restoredDraft?.coreq ?? editingCourse?.coreqOptions ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);

  const initialSnapshot = useRef({
    title: editingCourse?.title ?? "",
    shortDescription: editingCourse?.shortDescription ?? "",
    longDescription: editingCourse?.longDescription ?? "",
    grades: [...(editingCourse?.grades ?? [])].sort((a, b) => a - b),
    offerings: normalizeOfferingsSnapshot(serverOfferings),
    classTimes: normalizeTimesSnapshot(serverTimes),
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
      offerings: normalizeOfferingsSnapshot(offerings),
      classTimes: normalizeTimesSnapshot(classTimes),
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
    classTimes,
    departmentId,
    teacherName,
    maxStudentCountInput,
    retakeable,
    prereq,
    coreq,
  ]);

  const draftForm: CourseDraftForm = useMemo(
    () => ({
      title,
      shortDescription,
      longDescription,
      grades,
      offerings: offerings.map((o) => ({
        courseId: o.courseId,
        terms: o.terms,
        previousSchedule: o.previousSchedule,
      })),
      classTimes: classTimes.map((t) => ({
        day: t.day,
        start: t.start,
        end: t.end,
        original: t.original,
      })),
      departmentId,
      teacherName,
      maxStudentCountInput,
      retakeable,
      prereq,
      coreq,
    }),
    [
      title,
      shortDescription,
      longDescription,
      grades,
      offerings,
      classTimes,
      departmentId,
      teacherName,
      maxStudentCountInput,
      retakeable,
      prereq,
      coreq,
    ],
  );

  useCourseDraft(draftId, draftForm, isDirty);

  const { conflict } = useCourseConflict({
    enabled: mode === "edit" && editingIds.length > 0,
    schoolId,
    courseIds: editingIds,
    saving,
  });

  const {
    requestClose,
    discardOpen,
    cancelDiscard,
    confirmDiscard: rawConfirmDiscard,
  } = useGuardedClose(onClose, isDirty, saving || helpOpen);

  const confirmDiscard = useCallback(() => {
    clearCourseDraft(draftId);
    rawConfirmDiscard();
  }, [draftId, rawConfirmDiscard]);

  const discardRestoredDraft = useCallback(() => {
    clearCourseDraft(draftId);
    setShowRestoreBanner(false);
    setTitle(initialSnapshot.current.title);
    setShortDescription(initialSnapshot.current.shortDescription);
    setLongDescription(initialSnapshot.current.longDescription);
    setGrades([...initialSnapshot.current.grades]);
    setOfferings(
      serverOfferings.map((o) => ({
        courseId: o.courseId,
        terms: [...o.terms],
        previousSchedule: o.previousSchedule,
      })),
    );
    setClassTimes(
      serverTimes.map((t) => ({
        ...t,
        key: nextDraftKey(),
      })),
    );
    setDepartmentId(initialSnapshot.current.departmentId);
    setTeacherName(initialSnapshot.current.teacherName);
    setMaxStudentCountInput(initialSnapshot.current.maxStudentCountInput);
    setRetakeable(initialSnapshot.current.retakeable);
    setPrereq(initialSnapshot.current.prereq);
    setCoreq(initialSnapshot.current.coreq);
    setError(null);
  }, [draftId, serverOfferings, serverTimes]);

  const performReloadFromServer = useCallback(() => {
    clearCourseDraft(draftId);
    setShowRestoreBanner(false);
    setReloadConfirmOpen(false);
    onReloadFromServer?.();
  }, [draftId, onReloadFromServer]);

  const requestReloadFromServer = useCallback(() => {
    if (isDirty) setReloadConfirmOpen(true);
    else performReloadFromServer();
  }, [isDirty, performReloadFromServer]);

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
        return {
          ...offering,
          terms: offering.terms.includes(termId)
            ? offering.terms.filter((id) => id !== termId)
            : [...offering.terms, termId],
        };
      }),
    );

  const addOffering = () =>
    setOfferings((prev) => [
      ...prev,
      { courseId: null, terms: [], previousSchedule: [] },
    ]);

  const removeOffering = (index: number) =>
    setOfferings((prev) => prev.filter((_, i) => i !== index));

  const addTime = () => setClassTimes((prev) => [...prev, emptyTimeDraft()]);

  const removeTime = (timeKey: string) =>
    setClassTimes((prev) => prev.filter((t) => t.key !== timeKey));

  const updateTime = (
    timeKey: string,
    patch: Partial<Pick<TimeDraft, "day" | "start" | "end">>,
  ) =>
    setClassTimes((prev) =>
      prev.map((t) => (t.key === timeKey ? { ...t, ...patch } : t)),
    );

  const hasValidOffering = offerings.some((o) => o.terms.length > 0);
  const canSave =
    title.trim().length > 0 &&
    departmentId !== "" &&
    terms.length > 0 &&
    hasValidOffering;

  const buildOfferingInputs = ():
    | { offerings: OfferingInput[] }
    | { error: string } => {
    const sharedDrafts: { original: ClassTime | null; value: ClassTime }[] =
      [];
    const seen = new Set<string>();
    for (const draft of classTimes) {
      const parsed = parseTimeDraft(draft);
      if (parsed.error || !parsed.value) {
        return { error: parsed.error ?? "Invalid class time." };
      }
      const key = classTimeKey(parsed.value);
      if (seen.has(key)) {
        return {
          error:
            "Two class times cannot share the same day and time.",
        };
      }
      seen.add(key);
      sharedDrafts.push({ original: draft.original, value: parsed.value });
    }

    const result: OfferingInput[] = [];
    for (const offering of offerings) {
      if (offering.terms.length === 0) continue;
      result.push({
        courseId: offering.courseId,
        termOptions: offering.terms,
        times: editsForOffering(offering.previousSchedule, sharedDrafts),
      });
    }
    if (result.length === 0) {
      return { error: "Select at least one term for this course." };
    }
    return { offerings: result };
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    const department = departments.find((d) => d.id === departmentId);
    if (!department) {
      setError("Choose a department for this course.");
      return;
    }
    const built = buildOfferingInputs();
    if ("error" in built) {
      setError(built.error);
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
      teacherName: teacherName.trim(),
      maxStudentCount,
      retakeable,
      prereqOptions: reqOptionsToRaw(prereq),
      coreqOptions: reqOptionsToRaw(coreq),
      offerings: built.offerings,
    });
    setSaving(false);
    if (result.error) setError(result.error);
    else {
      clearCourseDraft(draftId);
      onClose();
    }
  };

  return (
    <>
      <ModalShell
        title={mode === "add" ? "Add course" : "Edit course"}
        onClose={requestClose}
        busy={saving || helpOpen || reloadConfirmOpen}
        maxWidthClass="max-w-2xl"
        headerAction={
          <button
            type="button"
            aria-label="Course editor help"
            disabled={saving}
            onClick={() => setHelpOpen(true)}
            className="cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:bg-black/10 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        }
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
              {saving
                ? "Saving…"
                : mode === "add"
                  ? "Add course"
                  : "Save changes"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {showRestoreBanner && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-main-300 bg-main-100 px-4 py-3 text-sm text-gray-700">
              <span>Restored your unsaved changes.</span>
              <button
                type="button"
                onClick={discardRestoredDraft}
                className="cursor-pointer rounded-lg border border-main-400 bg-white px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-main-100"
              >
                Discard
              </button>
            </div>
          )}

          {conflict === "changed" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                This course was edited in another window. Your draft is still
                here — load their version to replace it, or save to overwrite.
              </span>
              {onReloadFromServer && (
                <button
                  type="button"
                  onClick={requestReloadFromServer}
                  className="shrink-0 cursor-pointer rounded-lg border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                >
                  Load their version
                </button>
              )}
            </div>
          )}

          {conflict === "deleted" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                This course was deleted in another window. Saving may fail.
              </span>
              {onReloadFromServer && (
                <button
                  type="button"
                  onClick={requestReloadFromServer}
                  className="shrink-0 cursor-pointer rounded-lg border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                >
                  Close and refresh
                </button>
              )}
            </div>
          )}

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
                <span className="font-semibold">Edit school</span> before
                creating courses.
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-400">
                  Pick every term this course spans (e.g. two terms for a
                  year-long course). Use "Add another offering" only when
                  students should rank separate term combinations
                  independently.
                </p>
                <div className="flex flex-col gap-2">
                  {offerings.map((offering, index) => (
                    <div
                      key={offering.courseId ?? `new-${index}`}
                      className="flex items-start gap-2 rounded-xl border border-main-300 bg-white p-3"
                    >
                      <div className="flex flex-wrap gap-2">
                        {terms.map((term) => {
                          const active = offering.terms.includes(term.id);
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
                  Add another offering
                </button>
              </>
            )}
          </div>

          <div>
            <span className={labelClass}>Class times</span>
            <p className="mb-2 text-xs text-gray-400">
              Day is a rotation-day number (1, 2, …). Times are shown in AM/PM
              and stored as minutes from midnight.
            </p>
            {classTimes.length > 0 && (
              <div className="mb-2 flex flex-col gap-2">
                {classTimes.map((time) => (
                  <div
                    key={time.key}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-main-300 bg-white p-3"
                  >
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      Day
                      <input
                        type="number"
                        min={1}
                        value={time.day}
                        onChange={(e) =>
                          updateTime(time.key, { day: e.target.value })
                        }
                        className={`${inputClass} w-20`}
                        aria-label="Day number"
                      />
                    </label>
                    <input
                      type="time"
                      value={time.start}
                      onChange={(e) =>
                        updateTime(time.key, { start: e.target.value })
                      }
                      className={`${inputClass} w-auto`}
                      aria-label="Start time"
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <input
                      type="time"
                      value={time.end}
                      onChange={(e) =>
                        updateTime(time.key, { end: e.target.value })
                      }
                      className={`${inputClass} w-auto`}
                      aria-label="End time"
                    />
                    <button
                      type="button"
                      aria-label="Remove this class time"
                      onClick={() => removeTime(time.key)}
                      className="ml-auto cursor-pointer rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addTime}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-main-400 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-main-100"
            >
              <Plus className="h-4 w-4" />
              Add time
            </button>
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
              Teacher <span className="font-normal text-gray-500">(optional)</span>
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
              Max number of students{" "}
              <span className="font-normal text-gray-500">(optional)</span>
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

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}
        </div>
      </ModalShell>
      {discardOpen && (
        <UnsavedChangesDialog
          onStay={cancelDiscard}
          onDiscard={confirmDiscard}
        />
      )}
      {reloadConfirmOpen && (
        <UnsavedChangesDialog
          onStay={() => setReloadConfirmOpen(false)}
          onDiscard={performReloadFromServer}
          message={
            conflict === "deleted"
              ? "You have unsaved changes. Discard them and close this editor?"
              : "You have unsaved changes. Discard them and load the version from the other window?"
          }
          confirmLabel={
            conflict === "deleted" ? "Discard and close" : "Load their version"
          }
        />
      )}
      {helpOpen && <CourseEditorHelp onClose={() => setHelpOpen(false)} />}
    </>
  );
}

export default CourseFormModal;
