import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { SchoolInput } from "../../lib/teacher";
import type { Term } from "../../data/courses";
import { DEFAULT_REQUIRED_RANKINGS } from "../../utils/courseRanking";
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
};

/** An editable term row in the form. `id` present means it exists in Supabase. */
export type TermDraft = { key: string; id?: string; name: string };

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
  const [rankings, setRankings] = useState(
    String(initial?.rankings ?? DEFAULT_REQUIRED_RANKINGS),
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
    rankings: String(initial?.rankings ?? DEFAULT_REQUIRED_RANKINGS),
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
      rankings,
      terms: currentTerms,
    };
    return JSON.stringify(current) !== JSON.stringify(initialSnapshot.current);
  }, [name, website, city, stateField, password, rankings, terms]);

  const { requestClose, discardOpen, cancelDiscard, confirmDiscard } =
    useGuardedClose(onClose, isDirty, saving);

  const rankingsValue = Number.parseInt(rankings, 10);
  const trimmedTerms = terms.filter((t) => t.name.trim().length > 0);
  const canSave =
    name.trim().length > 0 &&
    password.trim().length > 0 &&
    Number.isFinite(rankingsValue) &&
    rankingsValue > 0 &&
    trimmedTerms.length > 0;

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
    const result = await onSave(
      {
        name,
        website,
        city,
        state: stateField,
        password,
        rankings: rankingsValue,
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
          <label htmlFor="school-rankings" className={labelClass}>
            # of Courses Required
          </label>
          <input
            id="school-rankings"
            type="number"
            min={1}
            step={1}
            value={rankings}
            onChange={(e) => setRankings(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-gray-400">
            How many ranked courses each student must submit per term.
          </p>
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
