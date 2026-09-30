import { useEffect } from "react";
import { motion } from "motion/react";

type SubmitConfirmDialogProps = {
  open: boolean;
  grade: number;
  /** One entry per term: its name and how many courses are ranked in it. */
  termCounts: { label: string; count: number }[];
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function SubmitConfirmDialog({
  open,
  grade,
  termCounts,
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
        className="w-full max-w-[480px] rounded-2xl border border-main-300 bg-surface p-6 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="submit-confirm-title"
          className="text-xl font-medium leading-7 text-ink"
        >
          Submit your rankings?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Are you sure you want to submit your course rankings? This will send
          your preferences to your teachers.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-ink-secondary">
          <li>
            <span className="font-semibold">Grade:</span> {grade}
          </li>
          {termCounts.map((term) => (
            <li key={term.label}>
              <span className="font-semibold">{term.label} courses ranked:</span>{" "}
              {term.count}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[20px] border border-main-300 bg-surface px-6 text-base font-medium leading-6 text-primary transition-colors duration-150 ease-out hover:bg-main-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border-0 bg-primary px-4 text-sm font-medium leading-5 text-white transition-colors duration-150 ease-out hover:bg-primary-pressed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Confirm submit"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default SubmitConfirmDialog;
