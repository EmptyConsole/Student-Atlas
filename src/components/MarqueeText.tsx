import { useEffect, useRef, useState } from "react";

type MarqueeTextProps = {
  text: string;
  /** When false, overflowing text is truncated instead of scrolling. */
  active?: boolean;
  className?: string;
};

/**
 * Truncates text when it fits; when `active` and overflowing, scrolls horizontally
 * in a loop so the full string is readable in a narrow container.
 */
function MarqueeText({
  text,
  active = true,
  className = "",
}: MarqueeTextProps) {
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

export default MarqueeText;
