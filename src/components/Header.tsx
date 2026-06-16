import { CircleUserRound } from "lucide-react";
import type { AppView } from "../types/app";

type HeaderProps = {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
};

function Header({ activeView, onNavigate }: HeaderProps) {
  const navButtonClass = (view: AppView) =>
    `cursor-pointer rounded-lg border-0 bg-transparent px-3 py-2 text-base text-gray-700 transition-all duration-150 ease-out hover:scale-105 hover:text-[#4169e1] active:scale-95 active:text-[#3557c7] focus:outline-none focus-visible:ring-2 focus-visible:ring-main-700 ${
      activeView === view ? "font-bold text-[#4169e1]" : "font-semibold"
    }`;

  const profileActive = activeView === "profile";

  return (
    <header className="flex h-16 w-full items-center justify-between bg-main-200 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Student Atlas logo" className="h-10 w-auto" />
        <span className="text-5xl leading-none font-bold text-[#4169e1]">
          Nueva
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate("courses")}
          aria-current={activeView === "courses" ? "page" : undefined}
          className={navButtonClass("courses")}
        >
          Courses
        </button>

        <button
          type="button"
          onClick={() => onNavigate("register")}
          aria-current={activeView === "register" ? "page" : undefined}
          className={navButtonClass("register")}
        >
          Register for Electives
        </button>

        <button
          type="button"
          onClick={() => onNavigate("profile")}
          aria-label="Profile"
          aria-current={profileActive ? "page" : undefined}
          className="cursor-pointer rounded-full p-2 text-gray-600 transition-all duration-150 ease-out hover:scale-105 hover:bg-main-300 active:scale-95 active:bg-main-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
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
