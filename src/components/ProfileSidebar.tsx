import { useEffect, useRef, useState } from "react";
import SubjectBookmark from "./SubjectBookmark";

export type ProfileSection = "profile";

const PROFILE_NAV: {
  id: ProfileSection;
  label: string;
  description: string;
}[] = [
  { id: "profile", label: "Profile", description: "Your account details" },
];

const BLUE_TINT = "var(--color-main-100)";
const BLUE_COLOR = "var(--color-main-500)";
const BLUE_ACCENT = "var(--profile-tab-accent)";

type ProfileSidebarProps = {
  activeSection: ProfileSection;
  onSelectSection: (id: ProfileSection) => void;
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<{ error?: string }>;
  showSignOut?: boolean;
};

function ProfileSidebar({
  activeSection,
  onSelectSection,
  onSignOut,
  onDeleteAccount,
  showSignOut = true,
}: ProfileSidebarProps) {
  const activeItemRef = useRef<HTMLLIElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSelect = (id: ProfileSection) => {
    onSelectSection(id);
    document
      .getElementById(`section-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeSection]);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-main-100">
      <nav
        aria-label="Profile sections"
        className="flex flex-1 flex-col overflow-y-auto py-3"
      >
        <ul className="flex flex-col gap-2">
          {PROFILE_NAV.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <li
                key={item.id}
                ref={isActive ? activeItemRef : null}
                className="flex flex-col items-end"
              >
                <SubjectBookmark
                  label={item.label}
                  description={item.description}
                  color={BLUE_COLOR}
                  tint={BLUE_TINT}
                  accent={BLUE_ACCENT}
                  isActive={isActive}
                  onClick={() => handleSelect(item.id)}
                />
              </li>
            );
          })}
        </ul>

        {showSignOut && (
          <div className="mt-auto px-4 pt-4 pb-3 flex flex-col gap-1">
            {onDeleteAccount && (
              confirmDelete ? (
                <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                    This will permanently delete your account and all data.
                  </p>
                  {deleteError && (
                    <p className="text-xs text-red-600">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={async () => {
                        setDeleting(true);
                        setDeleteError(null);
                        const { error } = await onDeleteAccount();
                        setDeleting(false);
                        if (error) {
                          setDeleteError(error);
                          return;
                        }
                        setConfirmDelete(false);
                      }}
                      className="flex-1 cursor-pointer rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => {
                        setConfirmDelete(false);
                        setDeleteError(null);
                      }}
                      className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center rounded-[20px] border border-main-300 bg-surface px-3 text-sm font-medium leading-5 text-primary transition-colors duration-150 ease-out hover:bg-main-100 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex h-10 w-full cursor-pointer items-center rounded-lg px-3 text-left text-base font-medium leading-6 text-red-500 transition-colors duration-150 ease-out hover:bg-red-50 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400"
                >
                  Delete Account
                </button>
              )
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-10 w-full cursor-pointer items-center rounded-lg px-3 text-left text-base font-medium leading-6 text-ink-secondary transition-colors duration-150 ease-out hover:bg-main-200 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              Sign Out
            </button>
          </div>
        )}
      </nav>
    </aside>
  );
}

export default ProfileSidebar;
