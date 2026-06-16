import { useState } from "react";
import type { UserProfile } from "../hooks/useProfile";
import ProfileContent from "./ProfileContent";
import ProfileSidebar, { type ProfileSection } from "./ProfileSidebar";

type ProfilePageProps = {
  profile: UserProfile;
  onChange: (patch: Partial<UserProfile>) => void;
  onSignOut: () => void;
};

function ProfilePage({ profile, onChange, onSignOut }: ProfilePageProps) {
  const [activeSection, setActiveSection] = useState<ProfileSection>("profile");

  return (
    <div className="flex flex-1 overflow-hidden">
      <ProfileSidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onSignOut={onSignOut}
      />
      <main className="flex flex-1 flex-col overflow-hidden bg-detail-400">
        <ProfileContent
          profile={profile}
          onChange={onChange}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </main>
    </div>
  );
}

export default ProfilePage;
