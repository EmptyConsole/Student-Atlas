import { LogOut } from "lucide-react";
import AtlasWordmark from "./AtlasWordmark";

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
      {onSwitchSchool && (
        <button
          type="button"
          onClick={onSwitchSchool}
          className="ml-auto flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-main-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500"
        >
          <LogOut className="h-4 w-4" />
          Switch school
        </button>
      )}
    </header>
  );
}

export default TeacherHeader;
