import { useState } from "react";
import type { UserProfile } from "../hooks/useProfile";
import {
  cardClass,
  dangerButtonClass,
  dangerOutlineButtonClass,
  secondaryButtonClass,
} from "./controlStyles";
import ProfileContent from "./ProfileContent";

type ProfilePageProps = {
  profile: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<{ error?: string }>;
  onboarding?: boolean;
  onSubmit?: () => Promise<{ error?: string }>;
  onLoginByEmail?: (email: string) => Promise<{ error?: string }>;
  hasUnsavedChanges?: boolean;
  onSaveChanges?: () => Promise<{ error?: string }>;
  savedEmail?: string | null;
};

function AccountActions({
  onSignOut,
  onDeleteAccount,
}: {
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<{ error?: string }>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!onDeleteAccount) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await onDeleteAccount();
    setDeleting(false);
    if (error) {
      setDeleteError(error);
      return;
    }
    setConfirmDelete(false);
  };

  return (
    <section aria-labelledby="account-heading" className={`${cardClass} p-6`}>
      <h2 id="account-heading" className="text-xl leading-7 font-semibold text-ink">
        Account
      </h2>

      {confirmDelete ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">
            This will permanently delete your account and all data.
          </p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className={dangerButtonClass}
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
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={onSignOut} className={secondaryButtonClass}>
            Sign Out
          </button>
          {onDeleteAccount && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={dangerOutlineButtonClass}
            >
              Delete Account
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ProfilePage({
  profile,
  onChange,
  onSignOut,
  onDeleteAccount,
  onboarding = false,
  onSubmit,
  onLoginByEmail,
  hasUnsavedChanges = false,
  onSaveChanges,
  savedEmail = null,
}: ProfilePageProps) {
  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-detail-400">
      <ProfileContent
        profile={profile}
        onChange={onChange}
        onboarding={onboarding}
        onSubmit={onSubmit}
        onLoginByEmail={onLoginByEmail}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveChanges={onSaveChanges}
        savedEmail={savedEmail}
        accountSection={
          onboarding ? null : (
            <AccountActions onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} />
          )
        }
      />
    </main>
  );
}

export default ProfilePage;
