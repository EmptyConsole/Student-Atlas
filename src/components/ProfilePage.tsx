import { useState } from "react";
import type { UserProfile } from "../hooks/useProfile";
import ProfileContent from "./ProfileContent";
import ProfileSidebar, { type ProfileSection } from "./ProfileSidebar";

type ProfilePageProps = {
  profile: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<void>;
  onboarding?: boolean;
  onSubmit?: () => Promise<{ error?: string }>;
  onLoginByEmail?: (email: string) => Promise<{ error?: string }>;
  hasUnsavedChanges?: boolean;
  onSaveChanges?: () => Promise<{ error?: string }>;
};

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
}: ProfilePageProps) {
  const [activeSection, setActiveSection] = useState<ProfileSection>("profile");

  return (
    <div className="flex flex-1 overflow-hidden">
      <ProfileSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onSignOut={onSignOut}
        onDeleteAccount={onDeleteAccount}
        showSignOut={!onboarding}
      />
      <main className="flex flex-1 flex-col overflow-hidden bg-detail-400">
        <ProfileContent
          profile={profile}
          onChange={onChange}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onboarding={onboarding}
          onSubmit={onSubmit}
          onLoginByEmail={onLoginByEmail}
          hasUnsavedChanges={hasUnsavedChanges}
          onSaveChanges={onSaveChanges}
        />
      </main>
    </div>
  );
}

export default ProfilePage;
