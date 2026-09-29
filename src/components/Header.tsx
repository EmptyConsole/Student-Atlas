import { CircleUserRound } from "lucide-react";
import type { AppView } from "../types/app";
import AtlasWordmark from "./AtlasWordmark";
import { tabClass, tabIndicatorClass } from "./controlStyles";

type HeaderProps = {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  locked?: boolean;
};

const NAV_TABS: { view: AppView; label: string }[] = [
  { view: "courses", label: "Courses" },
  { view: "register", label: "Register for Electives" },
];

function Header({ activeView, onNavigate, locked = false }: HeaderProps) {
  const profileActive = activeView === "profile";

  return (
    <header className="flex h-16 w-full shrink-0 items-center gap-6 border-b border-line bg-main-200 px-4 sm:px-6">
      <div className="flex shrink-0 items-center gap-3">
        <img
          src="/BetterEmptyConsoleLogo copy.png"
          alt="Student Atlas logo"
          className="h-10 w-10 rounded-lg"
        />
        <AtlasWordmark />
      </div>

      <nav aria-label="Main" className="flex h-full min-w-0 flex-1 items-stretch">
        {NAV_TABS.map(({ view, label }) => {
          const selected = !locked && activeView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onNavigate(view)}
              disabled={locked}
              aria-current={selected ? "page" : undefined}
              className={tabClass(selected, locked)}
            >
              {label}
              {selected && <span className={tabIndicatorClass} aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => onNavigate("profile")}
        disabled={locked}
        aria-label="Profile"
        aria-current={profileActive ? "page" : undefined}
        className={
          locked
            ? "inline-flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-full text-gray-400"
            : `inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600 focus-visible:ring-offset-2 ${
                profileActive
                  ? "bg-white text-primary"
                  : "text-ink-secondary hover:bg-main-300 hover:text-ink"
              }`
        }
      >
        <CircleUserRound className="h-7 w-7" strokeWidth={profileActive ? 2.5 : 2} />
      </button>
    </header>
  );
}

export default Header;
