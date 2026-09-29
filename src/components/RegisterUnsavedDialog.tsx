import { useEffect } from "react";
import { motion } from "motion/react";
import {
  dialogBackdropClass,
  dialogPanelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./controlStyles";

type RegisterUnsavedDialogProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
};

/** Confirms navigating away from Register when rankings/notes are dirty. */
function RegisterUnsavedDialog({
  open,
  onStay,
  onLeave,
}: RegisterUnsavedDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStay();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onStay]);

  if (!open) return null;

  return (
    <div
      className={dialogBackdropClass}
      onClick={onStay}
      role="presentation"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-unsaved-title"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={dialogPanelClass}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="register-unsaved-title"
          className="text-xl leading-7 font-semibold text-ink"
        >
          Unsaved changes
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          You have unsaved changes. Leave this page and discard them?
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onStay}
            className={secondaryButtonClass}
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onLeave}
            className={primaryButtonClass}
          >
            Leave page
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegisterUnsavedDialog;
