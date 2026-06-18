import { Bookmark, GripVertical, Link2 } from "lucide-react";
import type { Subject } from "../data/subjects";
import { TERM_COLORS, TERM_LABELS, type Course } from "../data/courses";

export const RANKING_ROW_SHELL =
  "flex min-h-[3.75rem] items-center gap-2 rounded-xl border px-3 py-2.5";

type PickTier = "top" | "alternate";

type RankedCourseRowProps = {
  course: Course;
  subject: Subject;
  rank: number | null;
  pickTier: PickTier;
  isFirstAlternate?: boolean;
  bookmarked: boolean;
  linked: boolean;
};

function RankedCourseRow({
  course,
  subject,
  rank,
  pickTier,
  isFirstAlternate = false,
  bookmarked,
  linked,
}: RankedCourseRowProps) {
  const termBadge = linked ? TERM_COLORS["all-year"] : TERM_COLORS[course.term];
  const isTopPick = pickTier === "top";

  return (
    <div className={isFirstAlternate ? "pt-2" : undefined}>
      {isFirstAlternate && (
        <div className="mb-2 flex items-center gap-2" aria-hidden="true">
          <div className="h-px flex-1 bg-main-400" />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Alternates (not submitted)
          </span>
          <div className="h-px flex-1 bg-main-400" />
        </div>
      )}
      <div
        className={`${RANKING_ROW_SHELL} cursor-grab touch-none select-none active:cursor-grabbing ${
          isTopPick
            ? "border-2 shadow-md"
            : "border border-dashed border-main-400 bg-detail-400/50 opacity-70 shadow-none"
        }`}
        style={{
          backgroundColor: isTopPick ? subject.tint : undefined,
          borderColor: isTopPick ? subject.color : undefined,
        }}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            isTopPick ? "text-white" : "text-gray-400"
          }`}
          style={
            isTopPick
              ? { backgroundColor: subject.accent }
              : { backgroundColor: "#e5e7eb" }
          }
          aria-label={isTopPick ? `Rank ${rank}` : "Alternate pick"}
        >
          {isTopPick ? rank : "—"}
        </span>

        <span className="flex w-5 shrink-0 items-center justify-center">
          {bookmarked ? (
            <Bookmark
              className="h-4 w-4"
              fill={subject.accent}
              style={{ color: subject.accent }}
              aria-label="Bookmarked"
            />
          ) : (
            <span className="h-4 w-4" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-semibold leading-tight ${
              isTopPick ? "" : "text-gray-500"
            }`}
            style={isTopPick ? { color: subject.accent } : undefined}
          >
            {course.title}
          </p>
          {linked && (
            <span
              className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: termBadge.bg,
                color: termBadge.fg,
              }}
            >
              <Link2 className="h-3 w-3" aria-hidden="true" />
              {TERM_LABELS[course.term]}
            </span>
          )}
        </div>

        <span className="shrink-0 p-1 text-gray-400" aria-hidden="true">
          <GripVertical className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export default RankedCourseRow;
