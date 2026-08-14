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

const BLUE_TINT = "#edf2fb";
const BLUE_COLOR = "#c1d3fe";
const BLUE_ACCENT = "#4169e1";

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
        <ul className="flex flex-col gap-1.5">
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
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-red-700">
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
                      className="flex-1 cursor-pointer rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
                      className="flex-1 cursor-pointer rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-600 border border-gray-200 transition-colors hover:bg-gray-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  Delete Account
                </button>
              )
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-600 transition-colors hover:bg-main-200 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700"
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
