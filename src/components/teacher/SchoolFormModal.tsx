import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { SchoolInput } from "../../lib/teacher";
import { GRADES, type Term } from "../../data/courses";
import { DEFAULT_REQUIRED_RANKINGS } from "../../utils/courseRanking";
import type { GradeSettings } from "../../utils/gradeSettings";
import ModalShell from "./ModalShell";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { useGuardedClose } from "./useGuardedClose";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./formStyles";

export type SchoolFormInitial = {
  name: string;
  website: string;
  city: string;
  state: string;
  password: string;
  rankings: number;
  electivesAssigned: number;
  gradeSettings: GradeSettings;
};

/** An editable term row in the form. `id` present means it exists in Supabase. */
export type TermDraft = { key: string; id?: string; name: string };

/** An editable per-grade row. Values stay strings while the teacher types. */
type GradeDraft = {
  key: string;
  grade: string;
  rankings: string;
  assigned: string;
};

type SchoolFormModalProps = {
  mode: "add" | "edit";
  initial?: SchoolFormInitial;
  initialTerms?: Term[];
  /** Term ids referenced by at least one course; those terms cannot be deleted. */
  usedTermIds?: Set<string>;
  onClose: () => void;
  onSave: (input: SchoolInput, terms: TermDraft[]) => Promise<{ error?: string }>;
};

let draftCounter = 0;
function newDraftKey(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

/** Shared column layout for the grade table header and rows. */
const GRADE_ROW_GRID =
  "grid grid-cols-[5rem_5rem_5.5rem_1.75rem] items-center justify-items-center gap-x-3 gap-y-3";

const gradeStepperInputClass =
  "h-7 w-10 shrink-0 rounded-md border border-main-400 bg-white px-0.5 text-center text-sm text-gray-700 shadow-sm focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const gradeStepperButtonClass =
  "shrink-0 cursor-pointer rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30";

function GradeStepper({
  label,
  value,
  onChange,
  min,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  invalid?: boolean;
}) {
  const parsed = Number.parseInt(value, 10);
  const current = Number.isFinite(parsed) ? parsed : min;

  const bump = (delta: number) => {
    onChange(String(Math.max(min, current + delta)));
  };

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => bump(1)}
          className={gradeStepperButtonClass}
        >
          <ArrowUp className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={current <= min}
          onClick={() => bump(-1)}
          className={gradeStepperButtonClass}
        >
          <ArrowDown className="h-2.5 w-2.5" />
        </button>
      </div>
      <input
        type="number"
        min={min}
        step={1}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${gradeStepperInputClass} ${invalid ? "border-red-400" : ""}`}
      />
    </div>
  );
}

/** Existing settings as form rows; a new school starts with every app grade. */
function toGradeDrafts(
  settings: GradeSettings | undefined,
  fallbackRankings: number,
  fallbackAssigned: number,
): GradeDraft[] {
  if (!settings || settings.size === 0) {
    return GRADES.map((grade) => ({
      key: newDraftKey(),
      grade: String(grade),
      rankings: String(fallbackRankings),
      assigned: String(fallbackAssigned),
    }));
  }
  return [...settings.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grade, entry]) => ({
      key: newDraftKey(),
      grade: String(grade),
      rankings: String(entry.rankings),
      assigned: String(entry.assigned),
    }));
}

/** Form rows back to a lookup; assumes the rows already passed validation. */
function toGradeSettings(rows: GradeDraft[]): GradeSettings {
  const settings: GradeSettings = new Map();
  for (const row of rows) {
    settings.set(Number.parseInt(row.grade, 10), {
      rankings: Number.parseInt(row.rankings, 10),
      assigned: Number.parseInt(row.assigned, 10),
    });
  }
  return settings;
}

/** Stable shape for dirty-checking, independent of row keys. */
function gradeSnapshot(rows: GradeDraft[]): string[] {
  return rows.map((r) => `${r.grade}:${r.rankings}:${r.assigned}`);
}

function isCount(value: string, min: number): boolean {
  const parsed = Number.parseInt(value, 10);
  return (
    /^\d+$/.test(value.trim()) && Number.isFinite(parsed) && parsed >= min
  );
}

function SchoolFormModal({
  mode,
  initial,
  initialTerms,
  usedTermIds,
  onClose,
  onSave,
}: SchoolFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [stateField, setStateField] = useState(initial?.state ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [gradeRows, setGradeRows] = useState<GradeDraft[]>(() =>
    toGradeDrafts(
      initial?.gradeSettings,
      initial?.rankings ?? DEFAULT_REQUIRED_RANKINGS,
      initial?.electivesAssigned ?? 0,
    ),
  );
  const [terms, setTerms] = useState<TermDraft[]>(() =>
    (initialTerms ?? []).map((t) => ({ key: newDraftKey(), id: t.id, name: t.name })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialSnapshot = useRef({
    name: initial?.name ?? "",
    website: initial?.website ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    password: initial?.password ?? "",
    grades: gradeSnapshot(gradeRows),
    terms: (initialTerms ?? []).map((t) => ({ id: t.id, name: t.name })),
  });

  const isDirty = useMemo(() => {
    const currentTerms = terms
      .filter((t) => t.name.trim().length > 0)
      .map((t) => ({ id: t.id, name: t.name.trim() }));
    const current = {
      name,
      website,
      city,
      state: stateField,
      password,
      grades: gradeSnapshot(gradeRows),
      terms: currentTerms,
    };
    return JSON.stringify(current) !== JSON.stringify(initialSnapshot.current);
  }, [name, website, city, stateField, password, gradeRows, terms]);

  const { requestClose, discardOpen, cancelDiscard, confirmDiscard } =
    useGuardedClose(onClose, isDirty, saving);

  const duplicateGrades = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const row of gradeRows) {
      const key = row.grade.trim();
      if (seen.has(key)) dupes.add(key);
      seen.add(key);
    }
    return dupes;
  }, [gradeRows]);

  const gradesValid =
    gradeRows.length > 0 &&
    duplicateGrades.size === 0 &&
    gradeRows.every(
      (row) =>
        isCount(row.grade, 1) &&
        isCount(row.rankings, 1) &&
        isCount(row.assigned, 0) &&
        Number.parseInt(row.assigned, 10) <= Number.parseInt(row.rankings, 10),
    );

  const trimmedTerms = terms.filter((t) => t.name.trim().length > 0);
  const canSave =
    name.trim().length > 0 &&
    password.trim().length > 0 &&
    gradesValid &&
    trimmedTerms.length > 0;

  const addGrade = () =>
    setGradeRows((prev) => {
      const highest = prev.reduce((max, row) => {
        const value = Number.parseInt(row.grade, 10);
        return Number.isFinite(value) && value > max ? value : max;
      }, 0);
      return [
        ...prev,
        {
          key: newDraftKey(),
          grade: String(highest > 0 ? highest + 1 : GRADES[0]),
          rankings: String(DEFAULT_REQUIRED_RANKINGS),
          assigned: "0",
        },
      ];
    });

  const updateGrade = (key: string, field: keyof GradeDraft, value: string) =>
    setGradeRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );

  const removeGrade = (key: string) =>
    setGradeRows((prev) => prev.filter((row) => row.key !== key));

  const addTerm = () =>
    setTerms((prev) => [...prev, { key: newDraftKey(), name: "" }]);

  const updateTermName = (key: string, value: string) =>
    setTerms((prev) =>
      prev.map((t) => (t.key === key ? { ...t, name: value } : t)),
    );

  const removeTerm = (key: string) =>
    setTerms((prev) => prev.filter((t) => t.key !== key));

  const moveTerm = (index: number, direction: -1 | 1) =>
    setTerms((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    const gradeSettings = toGradeSettings(gradeRows);
    // Lowest grade doubles as the school-wide fallback for unlisted grades.
    const lowestGrade = Math.min(...gradeSettings.keys());
    const result = await onSave(
      {
        name,
        website,
        city,
        state: stateField,
        password,
        rankings:
          gradeSettings.get(lowestGrade)?.rankings ?? DEFAULT_REQUIRED_RANKINGS,
        gradeSettings,
      },
      trimmedTerms.map((t) => ({ ...t, name: t.name.trim() })),
    );
    setSaving(false);
    if (result.error) setError(result.error);
    else onClose();
  };

  return (
    <>
      <ModalShell
        title={mode === "add" ? "Add school" : "Edit school"}
        onClose={requestClose}
        busy={saving}
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
            {saving ? "Saving…" : mode === "add" ? "Create school" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="school-name" className={labelClass}>
            Name
          </label>
          <input
            id="school-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Riverside High School"
            className={inputClass}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="school-website" className={labelClass}>
            Website
          </label>
          <input
            id="school-website"
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="school-city" className={labelClass}>
              City
            </label>
            <input
              id="school-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="sm:w-32">
            <label htmlFor="school-state" className={labelClass}>
              State
            </label>
            <input
              id="school-state"
              type="text"
              value={stateField}
              onChange={(e) => setStateField(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="school-password" className={labelClass}>
            Teacher password
          </label>
          <input
            id="school-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Locks the teacher side from students"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Teachers must enter this to edit the school. Keep it away from
            students.
          </p>
        </div>

        <div>
          <span className={labelClass}>Courses by grade</span>
          <p className="mb-2 text-xs text-gray-400">
            Per grade: how many courses a student must rank per term, and how
            many electives the sort assigns them per term. Grades left off this
            list fall back to the lowest grade listed.
          </p>
          <div className="flex flex-col gap-3">
            <div
              className={`${GRADE_ROW_GRID} text-center text-xs font-semibold leading-tight text-gray-500`}
            >
              <span>Grade</span>
              <span>Rankings</span>
              <span>Assigned per term</span>
              <span aria-hidden="true" />
            </div>
            {gradeRows.map((row) => {
              const duplicate = duplicateGrades.has(row.grade.trim());
              return (
                <div key={row.key} className={GRADE_ROW_GRID}>
                  <GradeStepper
                    label="Grade"
                    value={row.grade}
                    min={1}
                    invalid={duplicate}
                    onChange={(value) => updateGrade(row.key, "grade", value)}
                  />
                  <GradeStepper
                    label="Rankings"
                    value={row.rankings}
                    min={1}
                    onChange={(value) => updateGrade(row.key, "rankings", value)}
                  />
                  <GradeStepper
                    label="Assigned per term"
                    value={row.assigned}
                    min={0}
                    onChange={(value) => updateGrade(row.key, "assigned", value)}
                  />
                  <button
                    type="button"
                    aria-label="Delete grade"
                    title="Delete grade"
                    onClick={() => removeGrade(row.key)}
                    className="cursor-pointer justify-self-center rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          {duplicateGrades.size > 0 && (
            <p className="mt-2 text-xs font-medium text-red-600">
              Each grade can only appear once.
            </p>
          )}
          <button
            type="button"
            onClick={addGrade}
            className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-lg border border-main-400 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-main-100"
          >
            <Plus className="h-4 w-4" />
            Add grade
          </button>
        </div>

        <div>
          <span className={labelClass}>Terms</span>
          <p className="mb-2 text-xs text-gray-400">
            Terms are the columns students rank courses in (e.g. Fall, Spring,
            Quarter 1). At least one term is required.
          </p>
          <div className="flex flex-col gap-2">
            {terms.map((term, index) => {
              const locked = Boolean(term.id && usedTermIds?.has(term.id));
              return (
                <div key={term.key} className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label="Move term up"
                      disabled={index === 0}
                      onClick={() => moveTerm(index, -1)}
                      className="cursor-pointer rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move term down"
                      disabled={index === terms.length - 1}
                      onClick={() => moveTerm(index, 1)}
                      className="cursor-pointer rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={term.name}
                    onChange={(e) => updateTermName(term.key, e.target.value)}
                    placeholder={`Term ${index + 1}`}
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    aria-label="Delete term"
                    title={
                      locked
                        ? "This term is used by a course and cannot be deleted"
                        : "Delete term"
                    }
                    disabled={locked}
                    onClick={() => removeTerm(term.key)}
                    className="shrink-0 cursor-pointer rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addTerm}
            className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-lg border border-main-400 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-main-100"
          >
            <Plus className="h-4 w-4" />
            Add term
          </button>
        </div>

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

export default SchoolFormModal;
