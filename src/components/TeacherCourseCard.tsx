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
import CourseRequirements from "./CourseRequirements";
import TermBadges from "./TermBadges";

const DETAIL_TRANSITION = { type: "spring" as const, stiffness: 350, damping: 32 };

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

  return (
    <motion.div
      id={`course-${course.id}`}
      {...(compact ? {} : { layout: "position" as const })}
      transition={DETAIL_TRANSITION}
      className={`scroll-mt-4 overflow-hidden rounded-2xl border shadow-sm${
        compact ? " self-start w-full" : ""
      }`}
      style={{ backgroundColor: subject.tint, borderColor: subject.color }}
    >
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
        className={`cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          compact ? "p-3" : "p-4"
        }`}
        style={{ outlineColor: subject.accent }}
      >
        <div
          className={
            compact
              ? "flex items-start justify-between gap-2"
              : "flex items-center justify-between gap-3"
          }
        >
          <div className="flex min-w-0 flex-1 items-start gap-1.5">
            <ChevronDown
              className={`shrink-0 transition-transform duration-300 ease-out ${
                compact ? "mt-0.5 h-4 w-4" : "h-5 w-5"
              }`}
              style={{
                color: subject.accent,
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
            <h3
              title={course.title}
              className={`min-w-0 flex-1 truncate font-bold ${
                compact
                  ? "text-base leading-snug"
                  : "text-xl leading-tight"
              }`}
              style={{ color: subject.accent }}
            >
              {course.title}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {!compact && (
              <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                <MetaBadge
                  label={formatGrades(course.grades)}
                  bg={subject.color}
                  fg={subject.accent}
                />
                {prereqLabel && (
                  <MetaBadge
                    label={`Prereq: ${prereqLabel}`}
                    bg="#ffffff"
                    fg={subject.accent}
                    capped
                  />
                )}
                {coreqLabel && (
                  <MetaBadge
                    label={`Coreq: ${coreqLabel}`}
                    bg="#ffffff"
                    fg={subject.accent}
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
              className={`cursor-pointer rounded-full transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 ${
                compact ? "p-1" : "p-1.5"
              }`}
              style={{ color: subject.accent }}
            >
              <Pencil className={compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} />
            </button>
            <button
              type="button"
              aria-label="Delete course"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className={`cursor-pointer rounded-full text-red-500 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 ${
                compact ? "p-1" : "p-1.5"
              }`}
            >
              <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} />
            </button>
          </div>
        </div>

        <motion.p
          layout={false}
          transition={DETAIL_TRANSITION}
          className={`text-gray-600 ${
            compact
              ? "mt-1.5 line-clamp-1 pl-5 text-xs leading-snug"
              : `mt-1 pl-7 text-sm leading-snug${expanded ? "" : " line-clamp-2"}`
          }`}
        >
          {course.shortDescription}
        </motion.p>

        <div
          className={
            compact
              ? "mt-2 flex flex-wrap items-center gap-1 pl-5"
              : "mt-1.5 flex flex-wrap items-center gap-1.5 pl-7 sm:hidden"
          }
        >
          <MetaBadge
            label={formatGrades(course.grades)}
            bg={subject.color}
            fg={subject.accent}
          />
          <TermBadges offerings={offerings} termById={termById} />
          {compact && prereqLabel && (
            <MetaBadge
              label={`Prereq: ${prereqLabel}`}
              bg="#ffffff"
              fg={subject.accent}
              capped
            />
          )}
          {compact && coreqLabel && (
            <MetaBadge
              label={`Coreq: ${coreqLabel}`}
              bg="#ffffff"
              fg={subject.accent}
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
                className={`border-t ${
                  compact ? "mt-2 pt-2 pl-5 text-xs" : "mt-3 pt-3 pl-7 text-sm"
                }`}
                style={{ borderColor: subject.color }}
              >
                <p className="leading-relaxed text-gray-700">
                  {course.longDescription}
                </p>

                <CourseRequirements
                  course={course}
                  accent={subject.accent}
                  className={compact ? "mt-2" : "mt-3"}
                />

                {hasAssignedTeacher(course.teacher) && (
                  <p className={`text-gray-700 ${compact ? "mt-1.5" : "mt-1"}`}>
                    <span className="font-semibold" style={{ color: subject.accent }}>
                      Teacher:{" "}
                    </span>
                    {course.teacher}
                  </p>
                )}

                {hasKnownMaxStudentCount(course.maxStudentCount) && (
                  <p className={`text-gray-700 ${compact ? "mt-1" : "mt-1"}`}>
                    <span className="font-semibold" style={{ color: subject.accent }}>
                      Max students:{" "}
                    </span>
                    {course.maxStudentCount}
                  </p>
                )}

                <p className={`text-gray-700 ${compact ? "mt-1" : "mt-1"}`}>
                  <span className="font-semibold" style={{ color: subject.accent }}>
                    Repeatable:{" "}
                  </span>
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
