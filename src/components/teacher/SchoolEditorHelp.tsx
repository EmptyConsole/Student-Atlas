// import { useState } from "react";
import ModalShell from "./ModalShell";
import { primaryButtonClass } from "./formStyles";

type SchoolEditorHelpProps = {
  onClose: () => void;
};

/* Google sign-in hidden for now.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function CopyClientId({ clientId }: { clientId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clientId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the id is still selectable text.
    }
  };
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <code className="rounded-md bg-surface-muted px-2 py-1 text-xs break-all text-ink select-all">
        {clientId}
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        className="cursor-pointer rounded-full border border-main-300 bg-surface px-3 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-main-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
*/

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
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink-secondary">
          <section>
            <h3 className="mb-1 font-semibold text-ink">
              Name, website, city, state
            </h3>
            <p>
              Name is required. Website, city, and state are optional details
              about the school.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-ink">Teacher password</h3>
            <p>
              Required when creating a school. Teachers enter it to unlock
              editing — keep it away from students. When editing, leave the
              field blank to keep the current password, or type a new one to
              change it. The current password is never shown.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-ink">
              Allowed student email domains
            </h3>
            <p>
              The email domains students must use to sign up for this school,
              such as myschool.org or students.myschool.org. Leave blank to allow
              students to sign up with any email domain.
            </p>
          </section>

          {/* Google sign-in approval steps hidden for now.

          <section>
            <h3 className="mb-1 font-semibold text-ink">
              Approving Student Atlas in Google Workspace
            </h3>
            <p className="mb-2">
              Google blocks unapproved apps for students under 18, so your
              school's Google Workspace admin has to approve Student Atlas once.
              Until they do, students see a "blocked" message when they sign in
              with Google. Send these steps to your admin:
            </p>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              <li>
                Sign in to{" "}
                <a
                  href="https://admin.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  admin.google.com
                </a>{" "}
                with an admin account that has the Service Settings privilege.
              </li>
              <li>
                Open the menu and go to <strong>Security</strong>, then{" "}
                <strong>Access and data control</strong>, then{" "}
                <strong>API controls</strong>.
              </li>
              <li>
                Click <strong>Manage App Access</strong> (sometimes labeled
                Manage Third-Party App Access).
              </li>
              <li>
                Under <strong>Configured apps</strong>, click{" "}
                <strong>Configure new app</strong>.
              </li>
              <li>
                Paste this client ID, click <strong>Search</strong>, and pick{" "}
                <strong>Student Atlas</strong> from the results:
                {GOOGLE_CLIENT_ID ? (
                  <CopyClientId clientId={GOOGLE_CLIENT_ID} />
                ) : (
                  <span className="mt-1 block text-ink-muted">
                    (Google sign-in isn't set up on this site yet, so there is
                    no client ID to show.)
                  </span>
                )}
              </li>
              <li>
                For <strong>Scope</strong>, leave the top organizational unit
                selected to approve it for everyone, or click{" "}
                <strong>Select org units</strong> and check only your student
                organizational units. Click <strong>Continue</strong>.
              </li>
              <li>
                For <strong>Access to Google data</strong>, choose{" "}
                <strong>Limited</strong>. Student Atlas only reads a student's
                name and email. Click <strong>Continue</strong>.
              </li>
              <li>
                Review the settings and click <strong>Finish</strong>.
              </li>
            </ol>
            <p className="mt-2">
              Changes can take up to 24 hours to reach every account, though
              they are usually faster. Follow your school's own parental
              consent rules before turning this on for students.
            </p>
          </section>
          */}

          <section>
            <h3 className="mb-1 font-semibold text-ink">Courses by grade</h3>
            <p>
              For each grade: how many courses a student must rank per term, and
              how many electives the sort assigns them per term. Grades not on
              this list fall back to the lowest grade listed. Assigned cannot be
              higher than rankings.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-ink">Terms</h3>
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
