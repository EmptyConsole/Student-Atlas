import { useEffect } from "react";
import { motion } from "motion/react";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
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
        className="w-full max-w-[480px] rounded-2xl border border-main-300 bg-white p-6 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="register-refresh-title"
          className="text-xl font-medium leading-7 text-ink"
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
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[20px] border border-main-300 bg-white px-6 text-base font-medium leading-6 text-primary transition-colors duration-150 ease-out hover:bg-main-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            Keep these
          </button>
          <button
            type="button"
            onClick={onLoadNew}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border-0 bg-primary px-4 text-sm font-medium leading-5 text-white transition-colors duration-150 ease-out hover:bg-primary-pressed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            Load new rankings
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegisterRefreshDialog;
