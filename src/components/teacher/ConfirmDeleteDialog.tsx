import { useState } from "react";
import ModalShell from "./ModalShell";
import { inputClass, labelClass, dangerButtonClass, secondaryButtonClass } from "./formStyles";

type ConfirmDeleteDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  /** When set, the exact password must be typed to enable deletion. */
  passwordToMatch?: string | null;
  /** When set, the exact name must be typed to enable deletion. */
  nameToMatch?: string | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmDeleteDialog({
  title,
  message,
  confirmLabel = "Delete",
  passwordToMatch = null,
  nameToMatch = null,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [passwordInput, setPasswordInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  const passwordOk =
    passwordToMatch == null || passwordInput === passwordToMatch;
  const nameOk = nameToMatch == null || nameInput.trim() === nameToMatch.trim();
  const canConfirm = passwordOk && nameOk;

  return (
    <ModalShell
      title={title}
      onClose={onCancel}
      busy={busy}
      maxWidthClass="max-w-md"
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
            onClick={onConfirm}
            disabled={!canConfirm || busy}
            className={dangerButtonClass}
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-gray-600">{message}</p>

        {nameToMatch != null && (
          <div>
            <label htmlFor="delete-name" className={labelClass}>
              Type the school name{" "}
              <span className="font-normal text-gray-400">
                ({nameToMatch})
              </span>{" "}
              to confirm
            </label>
            <input
              id="delete-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </div>
        )}

        {passwordToMatch != null && (
          <div>
            <label htmlFor="delete-password" className={labelClass}>
              Enter the school password to confirm
            </label>
            <input
              id="delete-password"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </ModalShell>
  );
}

export default ConfirmDeleteDialog;
