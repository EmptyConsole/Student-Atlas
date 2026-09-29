import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { Subject } from "../data/subjects";
import {
  formatGrades,
  formatRequirementOptions,
  hasAssignedTeacher,
  hasKnownMaxStudentCount,
  type Course,
  type Term,
} from "../data/courses";
import { iconButtonCompactClass } from "./controlStyles";
import CourseRequirements from "./CourseRequirements";
import TermBadges from "./TermBadges";

const DETAIL_TRANSITION = { type: "spring" as const, stiffness: 350, damping: 32 };

const NEUTRAL_BADGE = {
  bg: "var(--color-surface-muted)",
  fg: "var(--color-ink-secondary)",
};

type TeacherCourseCardProps = {
  course: Course;
  subject: Subject;
  /** Term-id arrays for each offering-row of this course, for badges. */
  offerings: string[][];
  termById: Map<string, Term>;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Tighter card for the 3-column teacher grid. */
  compact?: boolean;
};

function MetaBadge({
  label,
  bg,
  fg,
  /** Cap width with ellipsis when the label is long. */
  capped = false,
}: {
  label: string;
  bg: string;
  fg: string;
  capped?: boolean;
}) {
  return (
    <span
      title={capped ? label : undefined}
      className={
        capped
          ? "inline-block max-w-[28rem] overflow-hidden rounded-full px-2.5 py-0.5 text-xs font-semibold"
          : "rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      }
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className={capped ? "block truncate" : undefined}>{label}</span>
    </span>
  );
}

function TeacherCourseCard({
  course,
  subject,
  offerings,
  termById,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  compact = false,
}: TeacherCourseCardProps) {
  const prereqLabel = formatRequirementOptions(course.prereqOptions);
  const coreqLabel = formatRequirementOptions(course.coreqOptions);
  const gradeBadge = { bg: subject.tint, fg: subject.accent };
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <motion.div
      id={`course-${course.id}`}
      {...(compact ? {} : { layout: "position" as const })}
      transition={DETAIL_TRANSITION}
      className={`relative scroll-mt-6 overflow-hidden rounded-2xl border bg-white transition-[border-color,box-shadow] duration-300${
        compact ? " w-full self-start" : ""
      } ${expanded ? "border-main-500 shadow-raised" : "border-line hover:border-main-500"}`}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: subject.accent }}
        aria-hidden="true"
      />
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        className={`cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-main-600 ${
          compact ? "py-3 pr-3 pl-4" : "py-4 pr-4 pl-5"
        }`}
      >
        <div
          className={
            compact
              ? "flex items-start justify-between gap-2"
              : "flex items-center justify-between gap-3"
          }
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <ChevronDown
              className={`shrink-0 text-ink-muted transition-transform duration-300 ease-out ${
                compact ? "mt-0.5 h-4 w-4" : "mt-1 h-5 w-5"
              }`}
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
            <h3
              title={course.title}
              className={`min-w-0 flex-1 truncate font-semibold text-ink ${
                compact ? "text-base leading-snug" : "text-xl leading-7"
              }`}
            >
              {course.title}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {!compact && (
              <div className="mr-1 hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                <MetaBadge
                  label={formatGrades(course.grades)}
                  bg={gradeBadge.bg}
                  fg={gradeBadge.fg}
                />
                {prereqLabel && (
                  <MetaBadge
                    label={`Prereq: ${prereqLabel}`}
                    bg={NEUTRAL_BADGE.bg}
                    fg={NEUTRAL_BADGE.fg}
                    capped
                  />
                )}
                {coreqLabel && (
                  <MetaBadge
                    label={`Coreq: ${coreqLabel}`}
                    bg={NEUTRAL_BADGE.bg}
                    fg={NEUTRAL_BADGE.fg}
                    capped
                  />
                )}
                <TermBadges offerings={offerings} termById={termById} />
              </div>
            )}

            <button
              type="button"
              aria-label="Edit course"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className={`${iconButtonCompactClass} text-ink-secondary hover:text-primary`}
            >
              <Pencil className={iconSize} />
            </button>
            <button
              type="button"
              aria-label="Delete course"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className={`${iconButtonCompactClass} text-red-600`}
            >
              <Trash2 className={iconSize} />
            </button>
          </div>
        </div>

        <motion.p
          layout={false}
          transition={DETAIL_TRANSITION}
          className={`text-ink-secondary ${
            compact
              ? "mt-1.5 line-clamp-1 pl-6 text-xs leading-snug"
              : `mt-1 pl-7 text-sm leading-relaxed${expanded ? "" : " line-clamp-2"}`
          }`}
        >
          {course.shortDescription}
        </motion.p>

        <div
          className={
            compact
              ? "mt-2 flex flex-wrap items-center gap-1 pl-6"
              : "mt-2 flex flex-wrap items-center gap-1.5 pl-7 sm:hidden"
          }
        >
          <MetaBadge
            label={formatGrades(course.grades)}
            bg={gradeBadge.bg}
            fg={gradeBadge.fg}
          />
          <TermBadges offerings={offerings} termById={termById} />
          {compact && prereqLabel && (
            <MetaBadge
              label={`Prereq: ${prereqLabel}`}
              bg={NEUTRAL_BADGE.bg}
              fg={NEUTRAL_BADGE.fg}
              capped
            />
          )}
          {compact && coreqLabel && (
            <MetaBadge
              label={`Coreq: ${coreqLabel}`}
              bg={NEUTRAL_BADGE.bg}
              fg={NEUTRAL_BADGE.fg}
              capped
            />
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={DETAIL_TRANSITION}
              className="overflow-hidden"
            >
              <div
                className={`border-t border-line ${
                  compact ? "mt-3 pt-3 pl-6 text-xs" : "mt-4 pt-4 pl-7 text-sm"
                }`}
              >
                <p className="leading-relaxed text-ink">{course.longDescription}</p>

                <CourseRequirements course={course} className={compact ? "mt-2" : "mt-3"} />

                {hasAssignedTeacher(course.teacher) && (
                  <p className={`text-ink-secondary ${compact ? "mt-1.5" : "mt-1"}`}>
                    <span className="font-semibold text-ink">Teacher: </span>
                    {course.teacher}
                  </p>
                )}

                {hasKnownMaxStudentCount(course.maxStudentCount) && (
                  <p className="mt-1 text-ink-secondary">
                    <span className="font-semibold text-ink">Max students: </span>
                    {course.maxStudentCount}
                  </p>
                )}

                <p className="mt-1 text-ink-secondary">
                  <span className="font-semibold text-ink">Repeatable: </span>
                  {course.retakeable ? "Yes" : "No"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default TeacherCourseCard;
