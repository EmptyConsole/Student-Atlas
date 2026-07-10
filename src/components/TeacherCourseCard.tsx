import { motion } from "motion/react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { Subject } from "../data/subjects";
import {
  formatGrades,
  formatMaxStudentCount,
  formatRequirementOptions,
  TERM_COLORS,
  TERM_LABELS,
  type Course,
} from "../data/courses";
import CourseRequirements from "./CourseRequirements";

type TeacherCourseCardProps = {
  course: Course;
  subject: Subject;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function MetaBadge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function TeacherCourseCard({
  course,
  subject,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: TeacherCourseCardProps) {
  const term = TERM_COLORS[course.term];
  const prereqLabel = formatRequirementOptions(course.prereqOptions);
  const coreqLabel = formatRequirementOptions(course.coreqOptions);

  return (
    <motion.div
      id={`course-${course.id}`}
      layout
      transition={{ type: "spring", stiffness: 350, damping: 32 }}
      className="scroll-mt-4 overflow-hidden rounded-2xl border shadow-sm"
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
        className="cursor-pointer p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ outlineColor: subject.accent }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ChevronDown
              className="h-5 w-5 shrink-0 transition-transform duration-200"
              style={{
                color: subject.accent,
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
            <h3
              className="truncate text-xl leading-tight font-bold"
              style={{ color: subject.accent }}
            >
              {course.title}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-2">
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
                />
              )}
              {coreqLabel && (
                <MetaBadge
                  label={`Coreq: ${coreqLabel}`}
                  bg="#ffffff"
                  fg={subject.accent}
                />
              )}
              <MetaBadge
                label={TERM_LABELS[course.term]}
                bg={term.bg}
                fg={term.fg}
              />
            </div>

            <button
              type="button"
              aria-label="Edit course"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="cursor-pointer rounded-full p-1.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
              style={{ color: subject.accent }}
            >
              <Pencil className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              aria-label="Delete course"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="cursor-pointer rounded-full p-1.5 text-red-500 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <p className="mt-2 pl-7 text-sm leading-snug text-gray-600">
          {course.shortDescription}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7 sm:hidden">
          <MetaBadge
            label={formatGrades(course.grades)}
            bg={subject.color}
            fg={subject.accent}
          />
          <MetaBadge
            label={TERM_LABELS[course.term]}
            bg={term.bg}
            fg={term.fg}
          />
        </div>

        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mt-3 border-t pt-3 pl-7"
            style={{ borderColor: subject.color }}
          >
            <p className="text-sm leading-relaxed text-gray-700">
              {course.longDescription}
            </p>

            <CourseRequirements
              course={course}
              accent={subject.accent}
              className="mt-3"
            />

            <p className="mt-1 text-sm text-gray-700">
              <span className="font-semibold" style={{ color: subject.accent }}>
                Teacher:{" "}
              </span>
              {course.teacher ?? "Unassigned"}
            </p>

            <p className="mt-1 text-sm text-gray-700">
              <span className="font-semibold" style={{ color: subject.accent }}>
                Max students:{" "}
              </span>
              {formatMaxStudentCount(course.maxStudentCount)}
            </p>

            <p className="mt-1 text-sm text-gray-700">
              <span className="font-semibold" style={{ color: subject.accent }}>
                Repeatable:{" "}
              </span>
              {course.retakeable ? "Yes" : "No"}
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default TeacherCourseCard;
