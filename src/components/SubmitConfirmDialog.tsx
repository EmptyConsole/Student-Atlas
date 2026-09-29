import { useEffect } from "react";
import { motion } from "motion/react";
import {
  dialogBackdropClass,
  dialogPanelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./controlStyles";

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
      className={dialogBackdropClass}
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
        className={dialogPanelClass}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="submit-confirm-title"
          className="text-xl leading-7 font-semibold text-ink"
        >
          Submit your rankings?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Are you sure you want to submit your course rankings? This will send
          your preferences to your teachers.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-ink">
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
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className={primaryButtonClass}
          >
            {submitting ? "Submitting…" : "Confirm submit"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default SubmitConfirmDialog;
