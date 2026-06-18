import { motion } from "motion/react";
import { Bookmark, ChevronDown } from "lucide-react";
import type { Subject } from "../data/subjects";
import {
  formatGrades,
  TERM_COLORS,
  TERM_LABELS,
  type Course,
} from "../data/courses";

type CourseCardProps = {
  course: Course;
  subject: Subject;
  dimmed: boolean;
  expanded: boolean;
  bookmarked: boolean;
  note: string;
  onToggleExpand: () => void;
  onToggleBookmark: () => void;
  onNoteChange: (note: string) => void;
};

function MetaBadge({
  label,
  bg,
  fg,
}: {
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function CourseCard({
  course,
  subject,
  dimmed,
  expanded,
  bookmarked,
  note,
  onToggleExpand,
  onToggleBookmark,
  onNoteChange,
}: CourseCardProps) {
  const term = TERM_COLORS[course.term];
  const hasNote = note.trim().length > 0;

  return (
    <motion.div
      id={`course-${course.id}`}
      layout
      transition={{ type: "spring", stiffness: 350, damping: 32 }}
      className={`scroll-mt-4 overflow-hidden rounded-2xl border shadow-sm transition-opacity duration-300 ${
        dimmed ? "opacity-45" : "opacity-100"
      }`}
      style={{
        backgroundColor: subject.tint,
        borderColor: subject.color,
      }}
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
              {course.prerequisites.length > 0 && (
                <MetaBadge
                  label={`Prereq: ${course.prerequisites.join(", ")}`}
                  bg="#ffffff"
                  fg={subject.accent}
                />
              )}
              {course.corequisites.length > 0 && (
                <MetaBadge
                  label={`Coreq: ${course.corequisites.join(", ")}`}
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
              aria-pressed={bookmarked}
              aria-label={
                bookmarked ? "Remove bookmark" : "Bookmark this course"
              }
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark();
              }}
              className="cursor-pointer rounded-full p-1.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
              style={{ color: subject.accent }}
            >
              <Bookmark
                className="h-5 w-5"
                fill={bookmarked ? subject.accent : "none"}
              />
            </button>
          </div>
        </div>

        <p className="mt-2 pl-7 text-sm leading-snug text-gray-600">
          {course.shortDescription}
        </p>

        {!expanded && hasNote && (
          <p className="mt-2 pl-7 text-sm leading-snug text-gray-700 italic">
            <span className="font-semibold not-italic" style={{ color: subject.accent }}>
              Note:{" "}
            </span>
            {note}
          </p>
        )}

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

            <p className="mt-3 text-sm text-gray-700">
              <span
                className="font-semibold"
                style={{ color: subject.accent }}
              >
                Prerequisites:{" "}
              </span>
              {course.prerequisites.length > 0
                ? course.prerequisites.join(", ")
                : "None"}
            </p>

            <p className="mt-1 text-sm text-gray-700">
              <span className="font-semibold" style={{ color: subject.accent }}>
                Corequisites:{" "}
              </span>
              {course.corequisites.length > 0
                ? course.corequisites.join(", ")
                : "None"}
            </p>

            {course.teacher && (
              <p className="mt-1 text-sm text-gray-700">
                <span
                  className="font-semibold"
                  style={{ color: subject.accent }}
                >
                  Teacher:{" "}
                </span>
                {course.teacher}
              </p>
            )}

            <div
              className="mt-4"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <label
                htmlFor={`note-${course.id}`}
                className="text-sm font-semibold"
                style={{ color: subject.accent }}
              >
                Your note
              </label>
              <textarea
                id={`note-${course.id}`}
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Add a personal note about this course..."
                rows={3}
                className="mt-1.5 w-full resize-y rounded-lg border bg-white/70 px-3 py-2 text-sm leading-relaxed text-gray-700 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2"
                style={{
                  borderColor: subject.color,
                  outlineColor: subject.accent,
                }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default CourseCard;
