import { LogOut } from "lucide-react";
import AtlasWordmark from "./AtlasWordmark";
import { textButtonClass } from "./controlStyles";

type TeacherHeaderProps = {
  onSwitchSchool?: () => void;
};

function TeacherHeader({ onSwitchSchool }: TeacherHeaderProps) {
  return (
    <header className="flex h-16 w-full shrink-0 items-center gap-4 border-b border-line bg-main-200 px-4 sm:px-6">
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
          className={`${textButtonClass} ml-auto`}
        >
          <LogOut className="h-4 w-4" />
          Switch school
        </button>
      )}
    </header>
  );
}

export default TeacherHeader;
