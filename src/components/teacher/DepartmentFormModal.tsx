import { useMemo, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import type { DepartmentInput, DepartmentRow } from "../../lib/teacher";
import ConfirmSaveDialog from "./ConfirmSaveDialog";
import DepartmentEditorHelp from "./DepartmentEditorHelp";
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
  /** `confirmPassword` is the current school password, sent for edits. */
  onSave: (
    input: DepartmentInput,
    confirmPassword?: string,
  ) => Promise<{ error?: string }>;
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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
    useGuardedClose(onClose, isDirty, saving || helpOpen || confirmOpen);

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave || saving) return;
    if (mode === "edit") {
      setConfirmError(null);
      setConfirmOpen(true);
      return;
    }
    void save();
  };

  const save = async (confirmPassword?: string) => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    setConfirmError(null);
    const result = await onSave(
      { name, subtitle, graduationRequirement },
      confirmPassword,
    );
    setSaving(false);
    if (result.error) {
      if (confirmPassword !== undefined) setConfirmError(result.error);
      else setError(result.error);
    } else {
      setConfirmOpen(false);
      onClose();
    }
  };

  return (
    <>
      <ModalShell
        title={mode === "add" ? "Add department" : "Edit department"}
        onClose={requestClose}
        busy={saving || helpOpen}
        headerAction={
          <button
            type="button"
            aria-label="Department editor help"
            disabled={saving}
            onClick={() => setHelpOpen(true)}
            className="cursor-pointer rounded-full p-1 text-ink-muted transition-colors hover:bg-black/10 hover:text-ink-secondary disabled:cursor-not-allowed disabled:opacity-50"
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
      {helpOpen && <DepartmentEditorHelp onClose={() => setHelpOpen(false)} />}
      {confirmOpen && (
        <ConfirmSaveDialog
          kind="department"
          nameToMatch={editingDepartment?.name ?? name}
          busy={saving}
          error={confirmError}
          onCancel={() => {
            if (!saving) setConfirmOpen(false);
          }}
          onConfirm={(confirmPassword) => void save(confirmPassword)}
        />
      )}
    </>
  );
}

export default DepartmentFormModal;
