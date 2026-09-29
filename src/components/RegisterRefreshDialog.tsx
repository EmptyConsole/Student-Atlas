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
        className="w-full max-w-md rounded-2xl border border-main-300 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="register-refresh-title"
          className="text-xl font-bold text-gray-800"
        >
          Rankings changed elsewhere
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          Your rankings were updated in another tab or on another device. Load
          the new rankings, or keep the ones on this screen?
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onKeepMine}
            className="cursor-pointer rounded-lg border border-main-400 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-150 hover:scale-105 hover:bg-main-100 active:scale-95"
          >
            Keep these
          </button>
          <button
            type="button"
            onClick={onLoadNew}
            className="cursor-pointer rounded-lg border-0 bg-[#4169e1] px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:scale-105 hover:bg-[#3557c7] active:scale-95"
          >
            Load new rankings
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default RegisterRefreshDialog;
