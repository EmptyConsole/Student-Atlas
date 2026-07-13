import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Bookmark, ChevronDown } from "lucide-react";
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

/** One selectable offering in a grouped course's bookmark popup. */
export type BookmarkOffering = {
  courseId: string;
  termOptions: string[];
  bookmarked: boolean;
};

/**
 * Bookmark behavior for a card. `single` is a plain toggle; `group` exposes a
 * popup that lets the student bookmark any subset of the course's offerings.
 */
export type BookmarkControl =
  | { kind: "single"; bookmarked: boolean; onToggle: () => void }
  | {
      kind: "group";
      offerings: BookmarkOffering[];
      onToggle: (courseId: string) => void;
    };

type CourseCardProps = {
  course: Course;
  subject: Subject;
  /** Term-id arrays for each offering-row, for the term badges. */
  offerings: string[][];
  termById: Map<string, Term>;
  dimmed: boolean;
  expanded: boolean;
  bookmark: BookmarkControl;
  note: string;
  onToggleExpand: () => void;
  onNoteChange: (note: string) => void;
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

function GroupBookmarkButton({
  offerings,
  accent,
  termById,
  onToggle,
}: {
  offerings: BookmarkOffering[];
  accent: string;
  termById: Map<string, Term>;
  onToggle: (courseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(
    null,
  );

  const bookmarkedCount = offerings.filter((o) => o.bookmarked).length;
  const fillState =
    bookmarkedCount === 0
      ? "none"
      : bookmarkedCount === offerings.length
        ? "all"
        : "partial";

  useEffect(() => {
    if (!open) return;

    const updateCoords = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        setCoords({ top: rect.top, right: window.innerWidth - rect.right });
      }
    };
    updateCoords();

    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose offerings to bookmark"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="cursor-pointer rounded-full p-1.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
        style={{ color: accent }}
      >
        <Bookmark
          className="h-5 w-5"
          fill={fillState === "none" ? "none" : accent}
          style={{ opacity: fillState === "partial" ? 0.5 : 1 }}
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 flex flex-col gap-1 rounded-xl border bg-white p-1.5 shadow-lg"
            style={{
              borderColor: accent,
              top: coords.top,
              right: coords.right,
              transform: "translateY(calc(-100% - 0.5rem))",
            }}
          >
            {offerings.map((offering) => (
              <button
                key={offering.courseId}
                type="button"
                role="menuitemcheckbox"
                aria-checked={offering.bookmarked}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(offering.courseId);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors hover:opacity-90"
                style={{
                  backgroundColor: offering.bookmarked ? accent : "transparent",
                }}
              >
                <TermBadges
                  offerings={[offering.termOptions]}
                  termById={termById}
                />
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function CourseCard({
  course,
  subject,
  offerings,
  termById,
  dimmed,
  expanded,
  bookmark,
  note,
  onToggleExpand,
  onNoteChange,
}: CourseCardProps) {
  const hasNote = note.trim().length > 0;
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
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ChevronDown
              className="h-5 w-5 shrink-0 transition-transform duration-200"
              style={{
                color: subject.accent,
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
            <h3
              className="min-w-0 flex-1"
              style={{ color: subject.accent }}
            >
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

            {bookmark.kind === "single" ? (
              <button
                type="button"
                aria-pressed={bookmark.bookmarked}
                aria-label={
                  bookmark.bookmarked ? "Remove bookmark" : "Bookmark this course"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  bookmark.onToggle();
                }}
                className="cursor-pointer rounded-full p-1.5 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
                style={{ color: subject.accent }}
              >
                <Bookmark
                  className="h-5 w-5"
                  fill={bookmark.bookmarked ? subject.accent : "none"}
                />
              </button>
            ) : (
              <GroupBookmarkButton
                offerings={bookmark.offerings}
                accent={subject.accent}
                termById={termById}
                onToggle={bookmark.onToggle}
              />
            )}
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
              <span
                className="font-semibold"
                style={{ color: subject.accent }}
              >
                Teacher:{" "}
              </span>
              {course.teacher ?? "Unknown"}
            </p>

            <p className="mt-1 text-sm text-gray-700">
              <span className="font-semibold" style={{ color: subject.accent }}>
                Max students:{" "}
              </span>
              {formatMaxStudentCount(course.maxStudentCount)}
            </p>

            <p className="mt-1 text-sm text-gray-700">
              <span className="font-semibold" style={{ color: subject.accent }}>
                Retakeable:{" "}
              </span>
              {course.retakeable ? "True" : "False"}
            </p>

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
