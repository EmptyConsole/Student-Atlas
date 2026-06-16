import { useEffect, useRef } from "react";
import SubjectBookmark from "./SubjectBookmark";

export type ProfileSection = "profile" | "course-info" | "help";

const PROFILE_NAV: {
  id: ProfileSection;
  label: string;
  description: string;
}[] = [
  { id: "profile", label: "Profile", description: "Your account details" },
  {
    id: "course-info",
    label: "Course Information",
    description: "Your course history",
  },
  { id: "help", label: "Help", description: "Support and FAQs" },
];

const BLUE_TINT = "#edf2fb";
const BLUE_COLOR = "#c1d3fe";
const BLUE_ACCENT = "#4169e1";

type ProfileSidebarProps = {
  activeSection: ProfileSection;
  onSelectSection: (id: ProfileSection) => void;
  onSignOut: () => void;
};

function ProfileSidebar({
  activeSection,
  onSelectSection,
  onSignOut,
}: ProfileSidebarProps) {
  const activeItemRef = useRef<HTMLLIElement>(null);

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

        <div className="mt-auto px-4 pt-4 pb-3">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-600 transition-colors hover:bg-main-200 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700"
          >
            Sign Out
          </button>
        </div>
      </nav>
    </aside>
  );
}

export default ProfileSidebar;
