import { useState } from "react";
import ModalShell from "./ModalShell";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./formStyles";

type ConfirmSaveDialogProps = {
  kind: "school" | "department";
  /** The saved name (before this edit) that must be typed to confirm. */
  nameToMatch: string;
  /** The form changes the school password, so the old one is asked for. */
  passwordChanged?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  /** `password` is the current school password; the server checks it. */
  onConfirm: (password: string) => void;
};

/**
 * Second step before saving school or department edits: the teacher retypes
 * the name being edited and the current school password.
 */
function ConfirmSaveDialog({
  kind,
  nameToMatch,
  passwordChanged = false,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: ConfirmSaveDialogProps) {
  const [nameInput, setNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const nameOk = nameInput.trim() === nameToMatch.trim();
  const canConfirm = nameOk && passwordInput.length > 0 && !busy;

  const submit = () => {
    if (canConfirm) onConfirm(passwordInput);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <ModalShell
        title={kind === "school" ? "Confirm school changes" : "Confirm department changes"}
        onClose={onCancel}
        busy={busy}
        maxWidthClass="max-w-[480px]"
        footer={
          <>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canConfirm}
              className={primaryButtonClass}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        <div
          className="flex flex-col gap-4"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        >
          <div>
            <label htmlFor="confirm-save-name" className={labelClass}>
              Type the {kind} name{" "}
              <span className="font-normal text-ink-muted">({nameToMatch})</span>{" "}
              to confirm
            </label>
            <input
              id="confirm-save-name"
              type="text"
              autoComplete="off"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="confirm-save-password" className={labelClass}>
              {passwordChanged
                ? "Enter the old school password to confirm"
                : "Enter the school password to confirm"}
            </label>
            <input
              id="confirm-save-password"
              type="password"
              autoComplete="current-password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className={inputClass}
            />
            {passwordChanged && (
              <p className="mt-1.5 text-xs text-ink-muted">
                You're changing the password, so enter the current one, not the
                new one.
              </p>
            )}
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>
      </ModalShell>
    </div>
  );
}

export default ConfirmSaveDialog;
