import ModalShell from "./ModalShell";
import { primaryButtonClass } from "./formStyles";

type CourseEditorHelpProps = {
  onClose: () => void;
};

/**
 * Nested help dialog for the course editor. Explains each section in plain
 * language so teachers can fill the form without leaving the page.
 */
function CourseEditorHelp({ onClose }: CourseEditorHelpProps) {
  return (
    <div className="fixed inset-0 z-[60]">
      <ModalShell
        title="Course editor help"
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
              Title and department
            </h3>
            <p>
              Every course needs a title and a department. Add a department
              first if the list is empty.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Descriptions</h3>
            <p>
              The short description appears on the course card. The long
              description shows when a student expands the card.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Grades</h3>
            <p>Select every grade level that may take this course.</p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Terms offered</h3>
            <p>
              Pick every term this course spans (for example, two terms for a
              year-long course). Use{" "}
              <span className="font-semibold text-gray-700">
                Add another offering
              </span>{" "}
              only when students should rank separate term combinations on their
              own.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Class times</h3>
            <p>
              Day is a rotation-day number (1, 2, …). Start and end times are
              shown in AM/PM.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">
              Prerequisites and corequisites
            </h3>
            <p>
              Items in one box are all required (AND). Separate boxes are
              alternatives (OR). Link a course from the catalog, or type free
              text for anything that is not a catalog course.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">
              Teacher, max students, repeatable
            </h3>
            <p>
              Teacher and max students are optional. Leave max blank if the
              seat limit is unknown. Check Repeatable if students may take the
              course more than once.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-gray-800">Drafts</h3>
            <p>
              Your edits are saved as a draft on this device. If you leave or
              reload, they come back when you reopen the same course.
            </p>
          </section>
        </div>
      </ModalShell>
    </div>
  );
}

export default CourseEditorHelp;
