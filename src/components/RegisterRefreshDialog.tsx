import { useEffect } from "react";
import { motion } from "motion/react";
import {
  dialogBackdropClass,
  dialogPanelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./controlStyles";

type RegisterRefreshDialogProps = {
  open: boolean;
  onKeepMine: () => void;
  onLoadNew: () => void;
};

/**
 * Shown when returning to the tab and the rankings saved on the server differ
 * from the ones on screen (e.g. edited in another tab or on another device).
 */
function RegisterRefreshDialog({
  open,
  onKeepMine,
  onLoadNew,
}: RegisterRefreshDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKeepMine();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onKeepMine]);

  if (!open) return null;

  return (
    <div
      className={dialogBackdropClass}
      onClick={onKeepMine}
      role="presentation"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-refresh-title"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={dialogPanelClass}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="register-refresh-title"
          className="text-xl leading-7 font-semibold text-ink"
        >
          Rankings changed elsewhere
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
          Your rankings were updated in another tab or on another device. Load
          the new rankings, or keep the ones on this screen?
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onKeepMine}
            className={secondaryButtonClass}
          >
            Keep these
          </button>
          <button
            type="button"
            onClick={onLoadNew}
            className={primaryButtonClass}
          >
            Load new rankings
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegisterRefreshDialog;
