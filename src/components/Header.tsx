import { CircleUserRound } from "lucide-react";

function Header() {
  return (
    <header className="flex h-16 w-full items-center justify-between bg-main-200 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Student Atlas logo" className="h-10 w-auto" />
        <span className="text-5xl leading-none font-bold text-[#4169e1]">
          Nueva
        </span>
      </div>

      <button
        type="button"
        onClick={() => {}}
        aria-label="Open profile"
        className="cursor-pointer rounded-full p-2 text-gray-600 transition-all duration-150 ease-out hover:scale-105 hover:bg-main-300 active:scale-95 active:bg-main-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
      >
        <CircleUserRound className="h-10 w-10" />
      </button>
    </header>
  );
}

export default Header;
