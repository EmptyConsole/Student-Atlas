import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { Subject } from "../data/subjects";
import {
  formatGrades,
  formatMaxStudentCount,
  formatRequirementOptions,
  type Course,
  type Term,
} from "../data/courses";
import CourseRequirements from "./CourseRequirements";
import MarqueeText from "./MarqueeText";
import TermBadges from "./TermBadges";

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
};

function MetaBadge({
  label,
  bg,
  fg,
  /** Cap width; marquee when `marqueeActive`, otherwise truncate. */
  capped = false,
  marqueeActive = false,
}: {
  label: string;
  bg: string;
  fg: string;
  capped?: boolean;
  marqueeActive?: boolean;
}) {
  return (
    <span
      title={capped && !marqueeActive ? label : undefined}
      className={
        capped
          ? "inline-block max-w-[28rem] overflow-hidden rounded-full px-2.5 py-0.5 text-xs font-semibold"
          : "rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      }
      style={{ backgroundColor: bg, color: fg }}
    >
      {capped ? (
        <MarqueeText text={label} active={marqueeActive} />
      ) : (
        label
      )}
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
}: TeacherCourseCardProps) {
  const prereqLabel = formatRequirementOptions(course.prereqOptions);
  const coreqLabel = formatRequirementOptions(course.coreqOptions);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      id={`course-${course.id}`}
      layout
      transition={{ type: "spring", stiffness: 350, damping: 32 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ChevronDown
              className="h-5 w-5 shrink-0 transition-transform duration-200"
              style={{
                color: subject.accent,
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
            <h3 className="min-w-0 flex-1" style={{ color: subject.accent }}>
              <MarqueeText
                text={course.title}
                active={hovered}
                className="text-xl leading-tight font-bold"
              />
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
                  capped
                  marqueeActive={hovered}
                />
              )}
              {coreqLabel && (
                <MetaBadge
                  label={`Coreq: ${coreqLabel}`}
                  bg="#ffffff"
                  fg={subject.accent}
                  capped
                  marqueeActive={hovered}
                />
              )}
              <TermBadges offerings={offerings} termById={termById} />
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

        <p className="mt-1 pl-7 text-sm leading-snug text-gray-600">
          {course.shortDescription}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-7 sm:hidden">
          <MetaBadge
            label={formatGrades(course.grades)}
            bg={subject.color}
            fg={subject.accent}
          />
          <TermBadges offerings={offerings} termById={termById} />
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
