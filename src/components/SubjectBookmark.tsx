import { useState } from "react";
import MarqueeText from "./MarqueeText";

type SubjectBookmarkProps = {
  label: string;
  description: string;
  color: string;
  tint: string;
  accent: string;
  isActive?: boolean;
  onClick?: () => void;
};

function SubjectBookmark({
  label,
  description,
  color,
  tint,
  accent,
  isActive = false,
  onClick,
}: SubjectBookmarkProps) {
  const [hovered, setHovered] = useState(false);
  const showColor = isActive || hovered;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative ml-auto block cursor-pointer border-0 bg-transparent p-0 text-left transition-[width] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        isActive ? "z-10 w-[98%]" : "w-[80%]"
      }`}
      style={{ outlineColor: accent }}
    >
      {isActive && (
        <span
          className="bookmark-tab-frame absolute -inset-0.5 z-0"
          aria-hidden="true"
        />
      )}
      <span
        className="bookmark-tab relative z-[1] flex h-20 w-full flex-col justify-center gap-0.5 pr-3 pl-[calc(40px+0.85rem)] shadow-sm transition-colors duration-150"
        style={{
          backgroundColor: showColor ? color : tint,
          color: accent,
        }}
      >
        <MarqueeText
          text={label}
          active={isActive || hovered}
          className="text-lg leading-tight font-bold"
        />
        <MarqueeText
          text={description}
          active={isActive || hovered}
          className="text-xs leading-snug font-medium opacity-70"
        />
      </span>
    </button>
  );
}

export default SubjectBookmark;
