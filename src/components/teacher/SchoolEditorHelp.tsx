import ModalShell from "./ModalShell";
import { primaryButtonClass } from "./formStyles";

type SchoolEditorHelpProps = {
  onClose: () => void;
};

/**
 * Nested help dialog for the school editor.
 */
function SchoolEditorHelp({ onClose }: SchoolEditorHelpProps) {
  return (
    <div className="fixed inset-0 z-[60]">
      <ModalShell
        title="School editor help"
        onClose={onClose}
        maxWidthClass="max-w-lg"
        footer={
          <button type="button" onClick={onClose} className={primaryButtonClass}>
            Got it
          </button>
        }
      >
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-gray-600">
          <section>
            <h3 className="mb-1 font-semibold text-gray-800">
              Name, website, city, state
            </h3>
            <p>
              Name is required. Website, city, and state are optional details
              about the school.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Teacher password</h3>
            <p>
              Required when creating a school. Teachers enter it to unlock
              editing — keep it away from students. When editing, leave the
              field blank to keep the current password, or type a new one to
              change it. The current password is never shown.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Courses by grade</h3>
            <p>
              For each grade: how many courses a student must rank per term, and
              how many electives the sort assigns them per term. Grades not on
              this list fall back to the lowest grade listed. Assigned cannot be
              higher than rankings.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Terms</h3>
            <p>
              Add every term students register for (for example Fall and
              Spring). Order matters — use the arrows to rearrange. You need at
              least one term before you can create courses. A term that courses
              already use cannot be deleted until those courses are updated.
            </p>
          </section>
        </div>
      </ModalShell>
    </div>
  );
}

export default SchoolEditorHelp;
