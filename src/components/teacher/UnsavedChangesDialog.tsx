import ModalShell from "./ModalShell";
import { primaryButtonClass, secondaryButtonClass } from "./formStyles";

type UnsavedChangesDialogProps = {
  onStay: () => void;
  onDiscard: () => void;
};

/** Confirms discarding edits when a teacher closes a form with unsaved changes. */
function UnsavedChangesDialog({ onStay, onDiscard }: UnsavedChangesDialogProps) {
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
              Discard changes
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-gray-600">
          You have unsaved changes. Discard them and close?
        </p>
      </ModalShell>
    </div>
  );
}

export default UnsavedChangesDialog;
