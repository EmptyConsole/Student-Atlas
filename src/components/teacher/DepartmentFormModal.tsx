import { useMemo, useRef, useState } from "react";
import type { DepartmentInput, DepartmentRow } from "../../lib/teacher";
import ModalShell from "./ModalShell";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { useGuardedClose } from "./useGuardedClose";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from "./formStyles";

type DepartmentFormModalProps = {
  mode: "add" | "edit";
  editingDepartment?: DepartmentRow | null;
  onClose: () => void;
  onSave: (input: DepartmentInput) => Promise<{ error?: string }>;
};

function DepartmentFormModal({
  mode,
  editingDepartment,
  onClose,
  onSave,
}: DepartmentFormModalProps) {
  const [name, setName] = useState(editingDepartment?.name ?? "");
  const [subtitle, setSubtitle] = useState(editingDepartment?.subtitle ?? "");
  const [graduationRequirement, setGraduationRequirement] = useState(
    editingDepartment?.graduation_requirement ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialSnapshot = useRef({
    name: editingDepartment?.name ?? "",
    subtitle: editingDepartment?.subtitle ?? "",
    graduationRequirement: editingDepartment?.graduation_requirement ?? "",
  });

  const isDirty = useMemo(
    () =>
      name !== initialSnapshot.current.name ||
      subtitle !== initialSnapshot.current.subtitle ||
      graduationRequirement !== initialSnapshot.current.graduationRequirement,
    [name, subtitle, graduationRequirement],
  );

  const { requestClose, discardOpen, cancelDiscard, confirmDiscard } =
    useGuardedClose(onClose, isDirty, saving);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    const result = await onSave({ name, subtitle, graduationRequirement });
    setSaving(false);
    if (result.error) setError(result.error);
    else onClose();
  };

  return (
    <>
      <ModalShell
        title={mode === "add" ? "Add department" : "Edit department"}
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
            {saving
              ? "Saving…"
              : mode === "add"
                ? "Add department"
                : "Save changes"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="dept-name" className={labelClass}>
            Name
          </label>
          <input
            id="dept-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Computer Science"
            className={inputClass}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="dept-subtitle" className={labelClass}>
            Subtitle
          </label>
          <input
            id="dept-subtitle"
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Short tagline shown in the sidebar"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="dept-gradreq" className={labelClass}>
            Graduation requirement
          </label>
          <textarea
            id="dept-gradreq"
            value={graduationRequirement}
            onChange={(e) => setGraduationRequirement(e.target.value)}
            rows={3}
            placeholder="e.g. Two years required to graduate."
            className={textareaClass}
          />
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

export default DepartmentFormModal;
