import { useEffect, type ReactNode } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";

type ModalShellProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional footer, typically the action buttons. */
  footer?: ReactNode;
  /** When true, backdrop clicks and Escape do not close the modal. */
  busy?: boolean;
  maxWidthClass?: string;
};

/**
 * Shared overlay used by the teacher forms. Matches the student app's modal
 * conventions: dimmed backdrop, spring-animated white card, Escape/backdrop
 * close, and click-through protection on the panel.
 */
function ModalShell({
  title,
  onClose,
  children,
  footer,
  busy = false,
  maxWidthClass = "max-w-lg",
}: ModalShellProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-12"
      onClick={() => {
        if (!busy) onClose();
      }}
      role="presentation"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className={`relative w-full ${maxWidthClass} rounded-2xl border border-main-300 bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-main-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:bg-black/10 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-3 border-t border-main-200 px-6 py-4">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default ModalShell;
