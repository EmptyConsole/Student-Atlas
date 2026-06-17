import { forwardRef } from "react";
import { motion, type DragControls } from "motion/react";
import { Bookmark, GripVertical, Link2 } from "lucide-react";
import type { Subject } from "../data/subjects";
import { TERM_COLORS, TERM_LABELS, type Course } from "../data/courses";

type RankedCourseRowProps = {
  course: Course;
  subject: Subject;
  rank: number;
  bookmarked: boolean;
  isYearLong: boolean;
  dragControls: DragControls;
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
      dragControls,
      onHoverStart,
      onHoverEnd,
    },
    ref,
  ) {
    const termBadge = isYearLong ? TERM_COLORS["all-year"] : TERM_COLORS[course.term];

    return (
      <motion.div
        ref={ref}
        data-course-id={course.id}
        whileHover={{ scale: 1.015, y: -1 }}
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

        <button
          type="button"
          aria-label={`Drag to reorder ${course.title}`}
          onPointerDown={(e) => dragControls.start(e)}
          className="shrink-0 cursor-grab touch-none rounded-md p-1 text-gray-400 transition-colors duration-150 hover:bg-white/60 hover:text-gray-700 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </motion.div>
    );
  },
);

export default RankedCourseRow;
