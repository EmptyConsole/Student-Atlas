import { useState } from "react";
import { GraduationCap } from "lucide-react";

type RequirementsBookmarkProps = {
  isActive?: boolean;
  onClick?: () => void;
};

function RequirementsBookmark({
  isActive = false,
  onClick,
}: RequirementsBookmarkProps) {
  const [hovered, setHovered] = useState(false);
  const showColor = isActive || hovered;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative mx-auto block w-[92%] cursor-pointer border-0 bg-transparent p-0 text-left transition-[width] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-main-600 ${
        isActive ? "z-10 w-[98%]" : ""
      }`}
    >
      {isActive && (
        <span
          className="requirements-bookmark-frame absolute -inset-0.5 z-0 rounded-xl"
          aria-hidden="true"
        />
      )}
      <span
        className="relative z-[1] flex h-16 w-full items-center gap-3 rounded-xl border border-detail-300 px-4 shadow-sm transition-colors duration-150"
        style={{
          backgroundColor: showColor ? "#f3e5ab" : "#fffdd0",
          color: "#6b5b2e",
        }}
      >
        <GraduationCap className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-bold leading-tight">Requirements</span>
          <span className="text-xs font-medium leading-snug opacity-70">
            Graduation overview
          </span>
        </span>
      </span>
    </button>
  );
}

export default RequirementsBookmark;
