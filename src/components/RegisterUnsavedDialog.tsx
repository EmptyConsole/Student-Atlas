import { useEffect } from "react";
import { motion } from "motion/react";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
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
        className="w-full max-w-[480px] rounded-2xl border border-main-300 bg-surface p-6 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="register-unsaved-title"
          className="text-xl font-medium leading-7 text-ink"
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
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[20px] border border-main-300 bg-surface px-6 text-base font-medium leading-6 text-primary transition-colors duration-150 ease-out hover:bg-main-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border-0 bg-primary px-4 text-sm font-medium leading-5 text-white transition-colors duration-150 ease-out hover:bg-primary-pressed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            Leave page
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegisterUnsavedDialog;
