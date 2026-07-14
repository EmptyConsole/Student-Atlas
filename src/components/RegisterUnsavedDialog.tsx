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
        className="w-full max-w-md rounded-2xl border border-main-300 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="register-unsaved-title"
          className="text-xl font-bold text-gray-800"
        >
          Unsaved changes
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          You have unsaved changes. Leave this page and discard them?
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onStay}
            className="cursor-pointer rounded-lg border border-main-400 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-150 hover:scale-105 hover:bg-main-100 active:scale-95"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="cursor-pointer rounded-lg border-0 bg-[#4169e1] px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:scale-105 hover:bg-[#3557c7] active:scale-95"
          >
            Leave page
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegisterUnsavedDialog;
