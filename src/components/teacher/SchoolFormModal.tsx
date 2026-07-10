import { useState } from "react";
import type { SchoolInput } from "../../lib/teacher";
import { DEFAULT_REQUIRED_RANKINGS } from "../../utils/courseRanking";
import ModalShell from "./ModalShell";
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

type SchoolFormModalProps = {
  mode: "add" | "edit";
  initial?: SchoolFormInitial;
  onClose: () => void;
  onSave: (input: SchoolInput) => Promise<{ error?: string }>;
};

function SchoolFormModal({
  mode,
  initial,
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rankingsValue = Number.parseInt(rankings, 10);
  const canSave =
    name.trim().length > 0 &&
    password.trim().length > 0 &&
    Number.isFinite(rankingsValue) &&
    rankingsValue > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    const result = await onSave({
      name,
      website,
      city,
      state: stateField,
      password,
      rankings: rankingsValue,
    });
    setSaving(false);
    if (result.error) setError(result.error);
    else onClose();
  };

  return (
    <ModalShell
      title={mode === "add" ? "Add school" : "Edit school"}
      onClose={onClose}
      busy={saving}
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

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </ModalShell>
  );
}

export default SchoolFormModal;
