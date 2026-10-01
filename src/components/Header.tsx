import { CircleUserRound } from "lucide-react";
import type { AppView } from "../types/app";
import AtlasWordmark from "./AtlasWordmark";

type HeaderProps = {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  locked?: boolean;
};

function Header({ activeView, onNavigate, locked = false }: HeaderProps) {
  const navButtonClass = (view: AppView) =>
    locked
      ? "inline-flex h-10 cursor-not-allowed items-center rounded-lg border-0 bg-transparent px-3 text-base font-medium leading-6 text-ink-muted focus:outline-none"
      : `inline-flex h-10 cursor-pointer items-center rounded-lg border-0 bg-transparent px-3 text-base font-medium leading-6 transition-colors duration-150 ease-out hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
          activeView === view ? "text-primary" : "text-ink-secondary"
        }`;

  const profileActive = activeView === "profile";

  return (
    <header className="flex h-16 w-full items-center justify-between bg-main-200 px-4 sm:px-6">
      <div className="flex items-center gap-1">
        <img
          src="/newLogoAtlas.png"
          alt=""
          className="h-10 w-10 rounded-lg"
        />
        <AtlasWordmark />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate("courses")}
          disabled={locked}
          aria-current={activeView === "courses" ? "page" : undefined}
          className={navButtonClass("courses")}
        >
          Courses
        </button>

        <button
          type="button"
          onClick={() => onNavigate("register")}
          disabled={locked}
          aria-current={activeView === "register" ? "page" : undefined}
          className={navButtonClass("register")}
        >
          Register for Electives
        </button>

        <button
          type="button"
          onClick={() => onNavigate("profile")}
          disabled={locked}
          aria-label="Profile"
          aria-current={profileActive ? "page" : undefined}
          className={
            locked
              ? "cursor-not-allowed rounded-full p-2 text-ink-muted focus:outline-none"
              : "cursor-pointer rounded-full p-2 text-ink-secondary transition-colors duration-150 ease-out hover:bg-main-300 active:bg-main-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          }
        >
          <CircleUserRound
            className="h-10 w-10"
            strokeWidth={profileActive ? 2.75 : 2}
          />
        </button>
      </div>
    </header>
  );
}

export default Header;
