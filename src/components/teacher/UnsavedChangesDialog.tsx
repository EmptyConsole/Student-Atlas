import ModalShell from "./ModalShell";
import { primaryButtonClass, secondaryButtonClass } from "./formStyles";

type UnsavedChangesDialogProps = {
  onStay: () => void;
  onDiscard: () => void;
  /** Optional body copy; defaults to the close-without-saving prompt. */
  message?: string;
  /** Label for the destructive confirm button. */
  confirmLabel?: string;
};

/** Confirms discarding edits when a teacher closes a form with unsaved changes. */
function UnsavedChangesDialog({
  onStay,
  onDiscard,
  message = "You have unsaved changes. Discard them and close?",
  confirmLabel = "Discard changes",
}: UnsavedChangesDialogProps) {
  return (
    <div className="fixed inset-0 z-[60]">
      <ModalShell
        title="Unsaved changes"
        onClose={onStay}
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={onStay}
              className={secondaryButtonClass}
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className={primaryButtonClass}
            >
              {confirmLabel}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-gray-600">{message}</p>
      </ModalShell>
    </div>
  );
}

export default UnsavedChangesDialog;
