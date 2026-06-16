import { forwardRef } from "react";
import { motion } from "motion/react";
import { Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import type { Subject } from "../data/subjects";
import { TERM_COLORS, TERM_LABELS, type Course } from "../data/courses";

type RankedCourseRowProps = {
  course: Course;
  subject: Subject;
  rank: number;
  bookmarked: boolean;
  isYearLong: boolean;
  layoutId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
};

const RankedCourseRow = forwardRef<HTMLDivElement, RankedCourseRowProps>(
  function RankedCourseRow(
    {
      course,
      subject,
      rank,
      bookmarked,
      isYearLong,
      layoutId,
      canMoveUp,
      canMoveDown,
      onMoveUp,
      onMoveDown,
      onHoverStart,
      onHoverEnd,
    },
    ref,
  ) {
    const termBadge = isYearLong ? TERM_COLORS["all-year"] : TERM_COLORS[course.term];

    return (
      <motion.div
        ref={ref}
        layout
        layoutId={layoutId}
        data-course-id={course.id}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        whileHover={{ scale: 1.015, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        className="flex items-center gap-2 rounded-xl border px-3 py-2.5 shadow-sm"
        style={{
          backgroundColor: subject.tint,
          borderColor: subject.color,
        }}
      >
        <span className="w-6 shrink-0 text-center text-sm font-semibold text-gray-400">
          {rank}
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
            className="truncate text-sm font-semibold leading-tight"
            style={{ color: subject.accent }}
          >
            {course.title}
          </p>
          {isYearLong && (
            <span
              className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: termBadge.bg,
                color: termBadge.fg,
              }}
            >
              {TERM_LABELS[course.term]}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            aria-label={`Move ${course.title} up`}
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className="cursor-pointer rounded-md p-0.5 text-gray-500 transition-all duration-150 hover:scale-110 hover:bg-white/60 hover:text-gray-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Move ${course.title} down`}
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className="cursor-pointer rounded-md p-0.5 text-gray-500 transition-all duration-150 hover:scale-110 hover:bg-white/60 hover:text-gray-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  },
);

export default RankedCourseRow;
