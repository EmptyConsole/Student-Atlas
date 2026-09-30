import { LogOut } from "lucide-react";
import AtlasWordmark from "./AtlasWordmark";
import ThemeToggle from "./ThemeToggle";

type TeacherHeaderProps = {
  onSwitchSchool?: () => void;
};

function TeacherHeader({ onSwitchSchool }: TeacherHeaderProps) {
  return (
    <header className="flex h-16 w-full items-center bg-main-200 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <img
          src="/BetterEmptyConsoleLogo copy.png"
          alt="Student Atlas logo"
          className="h-10 w-10 rounded-lg"
        />
        <AtlasWordmark />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        {onSwitchSchool && (
          <button
            type="button"
            onClick={onSwitchSchool}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-base font-medium leading-6 text-ink-secondary transition-colors duration-150 ease-out hover:bg-main-100 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            <LogOut className="h-4 w-4" />
            Switch school
          </button>
        )}
      </div>
    </header>
  );
}

export default TeacherHeader;
