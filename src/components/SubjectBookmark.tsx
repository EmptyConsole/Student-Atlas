import { useEffect, useRef, useState } from "react";

type SubjectBookmarkProps = {
  label: string;
  description: string;
  color: string;
  tint: string;
  accent: string;
  isActive?: boolean;
  onClick?: () => void;
};

type MarqueeTextProps = {
  text: string;
  active: boolean;
  className?: string;
};

function MarqueeText({ text, active, className = "" }: MarqueeTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (!active) {
      setOverflowing(false);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, text]);

  if (active && overflowing) {
    return (
      <span className={`block w-full overflow-hidden ${className}`}>
        <span className="marquee-track flex">
          <span className="pr-10">{text}</span>
          <span className="pr-10" aria-hidden="true">
            {text}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span ref={ref} className={`block w-full truncate ${className}`}>
      {text}
    </span>
  );
}

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
      <span
        className="bookmark-tab flex h-20 w-full flex-col justify-center gap-0.5 pr-3 pl-[calc(40px+0.85rem)] shadow-sm transition-colors duration-150"
        style={{
          backgroundColor: showColor ? color : tint,
          color: accent,
        }}
      >
        <MarqueeText
          text={label}
          active={isActive}
          className="text-lg leading-tight font-bold"
        />
        <MarqueeText
          text={description}
          active={isActive}
          className="text-xs leading-snug font-medium opacity-70"
        />
      </span>
    </button>
  );
}

export default SubjectBookmark;
