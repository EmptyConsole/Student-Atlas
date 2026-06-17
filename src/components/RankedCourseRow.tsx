import { motion } from "motion/react";
import { Bookmark, GripVertical, Link2 } from "lucide-react";
import type { Subject } from "../data/subjects";
import { TERM_COLORS, TERM_LABELS, type Course } from "../data/courses";

/** Shared layout for ranked rows and empty placeholder slots so both are the
 * same size. Each consumer adds its own border color, background, and shadow. */
export const RANKING_ROW_SHELL =
  "flex min-h-[3.75rem] items-center gap-2 rounded-xl border px-3 py-2.5";

type RankedCourseRowProps = {
  course: Course;
  subject: Subject;
  rank: number | null;
  bookmarked: boolean;
  linked: boolean;
};

function RankedCourseRow({
  course,
  subject,
  rank,
  bookmarked,
  linked,
}: RankedCourseRowProps) {
  const termBadge = linked ? TERM_COLORS["all-year"] : TERM_COLORS[course.term];

  return (
    <motion.div
      data-course-id={course.id}
      whileHover={{ scale: 1.015, y: -1 }}
      className={`${RANKING_ROW_SHELL} cursor-grab touch-none select-none shadow-sm active:cursor-grabbing`}
      style={{
        backgroundColor: subject.tint,
        borderColor: subject.color,
      }}
    >
      <span className="w-6 shrink-0 text-center text-sm font-semibold text-gray-400">
        {rank ?? ""}
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
    </motion.div>
  );
}

export default RankedCourseRow;
