import { Bookmark } from "lucide-react";

export type SplitBookmarkState = "none" | "fall" | "spring" | "both";

type SplitBookmarkProps = {
  state: SplitBookmarkState;
  color: string;
  size?: number;
};

/**
 * Bookmark icon whose fill reflects which term(s) of a grouped course are
 * bookmarked: left half = fall, right half = spring, full = both, empty = none.
 */
function SplitBookmark({ state, color, size = 20 }: SplitBookmarkProps) {
  const filledClip =
    state === "fall"
      ? "inset(0 50% 0 0)"
      : state === "spring"
        ? "inset(0 0 0 50%)"
        : undefined;

  return (
    <span
      className="relative inline-block"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Bookmark
        className="absolute inset-0"
        style={{ width: size, height: size, color }}
        fill="none"
      />
      {state !== "none" && (
        <Bookmark
          className="absolute inset-0"
          style={{ width: size, height: size, color, clipPath: filledClip }}
          fill={color}
        />
      )}
    </span>
  );
}

export default SplitBookmark;
