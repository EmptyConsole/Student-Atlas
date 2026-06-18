import { useEffect } from "react";
import { motion } from "motion/react";

type SubmitConfirmDialogProps = {
  open: boolean;
  grade: number;
  fallCount: number;
  springCount: number;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function SubmitConfirmDialog({
  open,
  grade,
  fallCount,
  springCount,
  submitting = false,
  onCancel,
  onConfirm,
}: SubmitConfirmDialogProps) {
  useEffect(() => {
    if (!open || submitting) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={() => {
        if (!submitting) onCancel();
      }}
      role="presentation"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-confirm-title"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-full max-w-md rounded-2xl border border-main-300 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="submit-confirm-title"
          className="text-xl font-bold text-gray-800"
        >
          Submit your rankings?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Are you sure you want to submit your course rankings? This will send
          your preferences to your teachers.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-gray-700">
          <li>
            <span className="font-semibold">Grade:</span> {grade}
          </li>
          <li>
            <span className="font-semibold">Fall courses ranked:</span>{" "}
            {fallCount}
          </li>
          <li>
            <span className="font-semibold">Spring courses ranked:</span>{" "}
            {springCount}
          </li>
        </ul>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-main-400 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-150 hover:scale-105 hover:bg-main-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="cursor-pointer rounded-lg border-0 bg-[#4169e1] px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:scale-105 hover:bg-[#3557c7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Confirm submit"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default SubmitConfirmDialog;
