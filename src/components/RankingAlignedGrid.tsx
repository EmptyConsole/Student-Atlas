import { type ReactNode, useEffect, useRef, useState } from "react";
import { motion, Reorder } from "motion/react";
import { Bookmark, GripVertical, Link2, X } from "lucide-react";
import type { Subject } from "../data/subjects";
import {
  formatGrades,
  TERM_COLORS,
  TERM_LABELS,
  type Course,
} from "../data/courses";
import {
  deriveAlignedRows,
  isAlignPad,
  isLinked,
  MIN_RANKED_COURSES,
  realCourseIds,
  type RankingColumnKey,
  type RankingModel,
} from "../utils/courseRanking";
import { RANKING_ROW_SHELL } from "./RankedCourseRow";
import YearLongConnector from "./YearLongConnector";

type RankingAlignedGridProps = {
  model: RankingModel;
  courseById: Map<string, Course>;
  subjectByName: Map<string, Subject>;
  bookmarks: Set<string>;
  yearLongIds: string[];
  courseNotes: Record<string, string>;
  onReorder: (column: RankingColumnKey, newOrder: string[]) => void;
  onDragStateChange: (active: boolean) => void;
  onToggleBookmark: (courseId: string) => void;
};

// ─── Course detail modal ────────────────────────────────────────────────────

type CourseDetailProps = {
  course: Course;
  subject: Subject;
  note: string;
  onClose: () => void;
};

function CourseDetailModal({ course, subject, note, onClose }: CourseDetailProps) {
  const term = TERM_COLORS[course.term];
  const linked = isLinked(course.term);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-12"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: subject.tint, borderColor: subject.color }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                className="text-xl font-bold leading-tight"
                style={{ color: subject.accent }}
              >
                {course.title}
              </h2>
              <p className="mt-1 text-sm leading-snug text-gray-600">
                {course.shortDescription}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="mt-0.5 shrink-0 cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:bg-black/10 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: subject.color, color: subject.accent }}
            >
              {formatGrades(course.grades)}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: term.bg, color: term.fg }}
            >
              {TERM_LABELS[course.term]}
            </span>
            {linked && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: TERM_COLORS["all-year"].bg,
                  color: TERM_COLORS["all-year"].fg,
                }}
              >
                <Link2 className="h-3 w-3" />
                All Year
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div
          className="border-t px-5 py-4"
          style={{ borderColor: subject.color, backgroundColor: "rgba(255,255,255,0.55)" }}
        >
          <p className="text-sm leading-relaxed text-gray-700">
            {course.longDescription}
          </p>

          <div className="mt-4 space-y-1.5 text-sm text-gray-700">
            <p>
              <span className="font-semibold" style={{ color: subject.accent }}>
                Prerequisites:{" "}
              </span>
              {course.prerequisites.length > 0
                ? course.prerequisites.join(", ")
                : "None"}
            </p>
            <p>
              <span className="font-semibold" style={{ color: subject.accent }}>
                Corequisites:{" "}
              </span>
              {course.corequisites.length > 0
                ? course.corequisites.join(", ")
                : "None"}
            </p>
            {course.teacher && (
              <p>
                <span className="font-semibold" style={{ color: subject.accent }}>
                  Teacher:{" "}
                </span>
                {course.teacher}
              </p>
            )}
            <p>
              <span className="font-semibold" style={{ color: subject.accent }}>
                Retakeable:{" "}
              </span>
              {course.retakeable ? "True" : "False"}
            </p>
          </div>

          {note && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: subject.accent }}>
                Your note
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-700 italic">
                {note}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Ranked row card ────────────────────────────────────────────────────────

type RankedItemProps = {
  column: RankingColumnKey;
  courseId: string;
  rank: number | null;
  pickTier: "top" | "alternate";
  course: Course;
  subject: Subject;
  bookmarked: boolean;
  linked: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCardClick: () => void;
  onUnbookmark: () => void;
};

function AlternatesDividerSpan() {
  return (
    <div className="relative z-[1] py-2" aria-hidden="true">
      <div
        className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-2"
        style={{ width: "calc(200% + 1.5rem)" }}
      >
        <div className="h-px flex-1 bg-main-400" />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Alternates (not submitted)
        </span>
        <div className="h-px flex-1 bg-main-400" />
      </div>
    </div>
  );
}

function AlternatesDividerSpacer() {
  return <div className="py-2" aria-hidden="true" />;
}

function AlignmentSpacer() {
  return (
    <div
      aria-hidden="true"
      className={`${RANKING_ROW_SHELL} shrink-0 border-transparent bg-transparent shadow-none`}
    />
  );
}

function RankedItem({
  column,
  courseId,
  rank,
  pickTier,
  course,
  subject,
  bookmarked,
  linked,
  onDragStart,
  onDragEnd,
  onCardClick,
  onUnbookmark,
}: RankedItemProps) {
  const isDraggingRef = useRef(false);
  const termBadge = linked ? TERM_COLORS["all-year"] : TERM_COLORS[course.term];
  const isTopPick = pickTier === "top";

  return (
    <Reorder.Item
      value={courseId}
      as="div"
      data-course-id={courseId}
      /* Linked cards must snap instantly so they always stay level with their pair */
      transition={
        linked
          ? { layout: { type: "spring", stiffness: 500, damping: 40 } }
          : undefined
      }
      onDragStart={() => {
        isDraggingRef.current = true;
        onDragStart();
      }}
      onDragEnd={() => {
        // Delay reset so the onClick that follows drag-end is suppressed
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
        onDragEnd();
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isDraggingRef.current) onCardClick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isDraggingRef.current) onCardClick();
          }
        }}
        className={`${RANKING_ROW_SHELL} w-full cursor-pointer touch-none select-none text-left active:cursor-grabbing ${
          isTopPick
            ? "border-2 shadow-md"
            : "border border-dashed border-main-400 opacity-70 shadow-none"
        }`}
        style={{
          backgroundColor: isTopPick ? subject.tint : "transparent",
          borderColor: isTopPick ? subject.color : undefined,
        }}
        data-ranking-column={column}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            isTopPick ? "text-white" : "text-gray-400"
          }`}
          style={{
            backgroundColor: isTopPick ? subject.accent : "#e5e7eb",
          }}
        >
          {isTopPick ? rank : "—"}
        </span>

        {bookmarked ? (
          <button
            type="button"
            aria-label="Remove bookmark"
            onClick={(e) => {
              e.stopPropagation();
              onUnbookmark();
            }}
            className="flex shrink-0 cursor-pointer rounded-full p-1 transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2"
            style={{ color: subject.accent }}
          >
            <Bookmark className="h-4 w-4" fill={subject.accent} />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}

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
              style={{ backgroundColor: termBadge.bg, color: termBadge.fg }}
            >
              <Link2 className="h-3 w-3" aria-hidden="true" />
              {TERM_LABELS[course.term]}
            </span>
          )}
        </div>

        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-400" aria-hidden="true" />
      </div>
    </Reorder.Item>
  );
}

// ─── Column rank helper ─────────────────────────────────────────────────────

function courseRankInOrder(order: string[], courseId: string): number {
  let rank = 0;
  for (const id of order) {
    if (isAlignPad(id)) continue;
    rank += 1;
    if (id === courseId) return rank;
  }
  return rank;
}

function isAlternateRank(order: string[], courseId: string): boolean {
  return courseRankInOrder(order, courseId) > MIN_RANKED_COURSES;
}

// ─── Main grid ──────────────────────────────────────────────────────────────

function RankingAlignedGrid({
  model,
  courseById,
  subjectByName,
  bookmarks,
  yearLongIds,
  courseNotes,
  onReorder,
  onDragStateChange,
  onToggleBookmark,
}: RankingAlignedGridProps) {
  const [connectorRoot, setConnectorRoot] = useState<HTMLDivElement | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  const alignedRows = deriveAlignedRows(model);
  const fallCount = realCourseIds(model.fallOrder).length;
  const springCount = realCourseIds(model.springOrder).length;
  const layoutKey = `${model.fallOrder.join(",")}|${model.springOrder.join(",")}`;

  const dividerBeforeRowIndex = alignedRows.findIndex((row) => {
    const fallAlternate =
      row.fall.kind === "course" &&
      isAlternateRank(model.fallOrder, row.fall.id);
    const springAlternate =
      row.spring.kind === "course" &&
      isAlternateRank(model.springOrder, row.spring.id);
    return fallAlternate || springAlternate;
  });
  const showAlternatesDivider =
    dividerBeforeRowIndex >= 0 &&
    (fallCount > MIN_RANKED_COURSES || springCount > MIN_RANKED_COURSES);

  const expandedCourse = expandedCourseId ? courseById.get(expandedCourseId) : null;
  const expandedSubject =
    expandedCourse ? subjectByName.get(expandedCourse.subject) : null;

  const renderColumn = (column: RankingColumnKey, order: string[]) => {
    const draggableIds = realCourseIds(order);

    const cells = alignedRows.flatMap((row, rowIndex) => {
      const rowElements: ReactNode[] = [];

      if (showAlternatesDivider && rowIndex === dividerBeforeRowIndex) {
        rowElements.push(
          column === "fall" ? (
            <AlternatesDividerSpan key={`${column}-alt-divider`} />
          ) : (
            <AlternatesDividerSpacer key={`${column}-alt-divider`} />
          ),
        );
      }

      const cell = column === "fall" ? row.fall : row.spring;
      if (cell.kind === "spacer") {
        rowElements.push(
          <AlignmentSpacer key={`${column}-spacer-${rowIndex}`} />,
        );
        return rowElements;
      }

      const course = courseById.get(cell.id);
      if (!course) return rowElements;
      const subject = subjectByName.get(course.subject);
      if (!subject) return rowElements;

      const rank = courseRankInOrder(order, cell.id);
      const pickTier: "top" | "alternate" =
        rank <= MIN_RANKED_COURSES ? "top" : "alternate";
      const linked = isLinked(course.term);

      rowElements.push(
        <RankedItem
          key={`${column}-${cell.id}`}
          column={column}
          courseId={cell.id}
          rank={pickTier === "top" ? rank : null}
          pickTier={pickTier}
          course={course}
          subject={subject}
          bookmarked={bookmarks.has(cell.id)}
          linked={linked}
          onDragStart={() => onDragStateChange(true)}
          onDragEnd={() => onDragStateChange(false)}
          onCardClick={() => setExpandedCourseId(cell.id)}
          onUnbookmark={() => onToggleBookmark(cell.id)}
        />,
      );

      return rowElements;
    });

    return (
      <Reorder.Group
        axis="y"
        values={draggableIds}
        onReorder={(newOrder) => onReorder(column, newOrder)}
        as="div"
        data-ranking-column={column}
        className="flex min-w-0 flex-col gap-2"
      >
        {cells}
      </Reorder.Group>
    );
  };

  if (fallCount === 0 && springCount === 0) {
    return (
      <div className="col-span-2 flex min-h-[28rem] items-center justify-center rounded-2xl border border-dashed border-main-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
        Bookmark courses on the Courses page to rank them here.
      </div>
    );
  }

  return (
    <>
      <div className="relative col-span-2 rounded-2xl border border-main-300 bg-white p-4 shadow-sm">
        <div className="mb-4 grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-gray-800">Fall</h2>
              <span className="rounded-full bg-main-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {fallCount} bookmarked
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Top{" "}
              <strong className="font-semibold text-[#4169e1]">
                {MIN_RANKED_COURSES}
              </strong>{" "}
              ranked courses are submitted
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-gray-800">Spring</h2>
              <span className="rounded-full bg-main-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {springCount} bookmarked
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Top{" "}
              <strong className="font-semibold text-[#4169e1]">
                {MIN_RANKED_COURSES}
              </strong>{" "}
              ranked courses are submitted
            </p>
          </div>
        </div>

        <div ref={setConnectorRoot} className="relative">
          {/* Year-long connector SVGs */}
          {yearLongIds.map((anchorId) => {
            const course = courseById.get(anchorId);
            const subject = course
              ? subjectByName.get(course.subject)
              : undefined;
            if (!course || !subject) return null;
            return (
              <YearLongConnector
                key={anchorId}
                courseId={anchorId}
                containerEl={connectorRoot}
                subject={subject}
                layoutKey={layoutKey}
              />
            );
          })}

          <div className="relative z-[1] grid grid-cols-2 gap-x-6">
            {renderColumn("fall", model.fallOrder)}
            {renderColumn("spring", model.springOrder)}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-gray-400">
          Click any card to see its full details · Drag to reorder
        </p>
      </div>

      {expandedCourse && expandedSubject && (
        <CourseDetailModal
          course={expandedCourse}
          subject={expandedSubject}
          note={courseNotes[expandedCourse.id] ?? ""}
          onClose={() => setExpandedCourseId(null)}
        />
      )}
    </>
  );
}

export default RankingAlignedGrid;
