import ModalShell from "./ModalShell";
import { primaryButtonClass } from "./formStyles";

type DepartmentEditorHelpProps = {
  onClose: () => void;
};

/**
 * Nested help dialog for the department editor.
 */
function DepartmentEditorHelp({ onClose }: DepartmentEditorHelpProps) {
  return (
    <div className="fixed inset-0 z-[60]">
      <ModalShell
        title="Department editor help"
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
            <h3 className="mb-1 font-semibold text-gray-800">Name</h3>
            <p>
              Required. This is the department heading students see in the
              catalog and sidebar (for example, Computer Science).
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Subtitle</h3>
            <p>
              Optional short tagline shown under the department name in the
              sidebar.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">
              Graduation requirement
            </h3>
            <p>
              Optional note about how many courses or years students need in
              this department to graduate. Students see it with the department.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Courses</h3>
            <p>
              Every course belongs to one department. Add the department first,
              then add courses under it. Deleting a department also deletes its
              courses.
            </p>
          </section>
        </div>
      </ModalShell>
    </div>
  );
}

export default DepartmentEditorHelp;
