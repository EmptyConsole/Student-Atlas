import { useEffect, useRef, useState, type ReactNode } from "react";
import ModalShell from "./ModalShell";
import {
  inputClass,
  labelClass,
  dangerButtonClass,
  secondaryButtonClass,
} from "./formStyles";

type ConfirmDeleteDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** When true, the school password must be typed; the server checks it. */
  requirePassword?: boolean;
  /** When set, the exact name must be typed to enable deletion. */
  nameToMatch?: string | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (password: string) => void;
};

function ConfirmDeleteDialog({
  title,
  message,
  confirmLabel = "Delete",
  requirePassword = false,
  nameToMatch = null,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [passwordInput, setPasswordInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  // Correctness is decided server-side, so the button only waits on a
  // non-empty entry; a wrong password comes back as an error.
  const passwordOk = !requirePassword || passwordInput.length > 0;
  const nameOk = nameToMatch == null || nameInput.trim() === nameToMatch.trim();
  const canConfirm = passwordOk && nameOk;

  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
  const shakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopShake = () => {
    if (shakeTimerRef.current != null) {
      clearInterval(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    setShakeOffset({ x: 0, y: 0 });
  };

  const startShake = () => {
    if (busy || !canConfirm) return;
    stopShake();
    const jitter = () => {
      setShakeOffset({
        x: Math.round((Math.random() - 0.5) * 10),
        y: Math.round((Math.random() - 0.5) * 10),
      });
    };
    jitter();
    shakeTimerRef.current = setInterval(jitter, 45);
  };

  useEffect(
    () => () => {
      if (shakeTimerRef.current != null) {
        clearInterval(shakeTimerRef.current);
      }
    },
    [],
  );

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
            onClick={() => onConfirm(passwordInput)}
            disabled={!canConfirm || busy}
            onMouseEnter={startShake}
            onMouseLeave={stopShake}
            style={{
              transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`,
            }}
            className={dangerButtonClass}
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-sm leading-relaxed text-gray-600">{message}</div>

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

        {requirePassword && (
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
