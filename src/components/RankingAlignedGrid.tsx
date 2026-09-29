import { type ReactNode, useEffect, useRef, useState } from "react";
import { motion, Reorder } from "motion/react";
import { Bookmark, GripVertical, Link2, X } from "lucide-react";
import type { Subject } from "../data/subjects";
import {
  formatGrades,
  hasAssignedTeacher,
  hasKnownMaxStudentCount,
  type Course,
  type Term,
} from "../data/courses";
import { deriveAlignedRows, type RankingModel } from "../utils/courseRanking";
import { iconButtonClass, iconButtonCompactClass } from "./controlStyles";
import { RANKING_ROW_SHELL } from "./RankedCourseRow";
import YearLongConnector from "./YearLongConnector";
import CourseRequirements from "./CourseRequirements";
import TermBadges from "./TermBadges";

type RankingAlignedGridProps = {
  model: RankingModel;
  terms: Term[];
  termById: Map<string, Term>;
  requiredRankings: number;
  courseById: Map<string, Course>;
  subjectByName: Map<string, Subject>;
  bookmarks: Set<string>;
  /** Ids of linked (spanning) courses, listed once, for drawing connectors. */
  linkedIds: string[];
  courseNotes: Record<string, string>;
  onReorder: (termId: string, newOrder: string[]) => void;
  onDragStateChange: (active: boolean) => void;
  onToggleBookmark: (courseId: string) => void;
};

// ─── Course detail modal ────────────────────────────────────────────────────

type CourseDetailProps = {
  course: Course;
  subject: Subject;
  termById: Map<string, Term>;
  note: string;
  onClose: () => void;
};

function CourseDetailModal({
  course,
  subject,
  termById,
  note,
  onClose,
}: CourseDetailProps) {
  const linked = course.termOptions.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-12"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: subject.accent }}
          aria-hidden="true"
        />
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl leading-7 font-semibold text-ink">
                {course.title}
              </h2>
              <p className="mt-1 text-sm leading-snug text-ink-secondary">
                {course.shortDescription}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={`${iconButtonClass} -mt-1 -mr-2`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: subject.tint, color: subject.accent }}
            >
              {formatGrades(course.grades)}
            </span>
            <TermBadges offerings={[course.termOptions]} termById={termById} />
            {linked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-main-100 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Link2 className="h-3 w-3" />
                Linked
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-line px-6 py-5">
          <p className="text-sm leading-relaxed text-ink">
            {course.longDescription}
          </p>

          <CourseRequirements course={course} className="mt-4" />

          <div className="mt-1.5 space-y-1.5 text-sm text-ink-secondary">
            {hasAssignedTeacher(course.teacher) && (
              <p>
                <span className="font-semibold text-ink">Teacher: </span>
                {course.teacher}
              </p>
            )}
            {hasKnownMaxStudentCount(course.maxStudentCount) && (
              <p>
                <span className="font-semibold text-ink">Max students: </span>
                {course.maxStudentCount}
              </p>
            )}
            <p>
              <span className="font-semibold text-ink">Retakeable: </span>
              {course.retakeable ? "True" : "False"}
            </p>
          </div>

          {note && (
            <div className="mt-4 rounded-xl bg-surface-muted px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-ink-secondary uppercase">
                Your note
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink italic">
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
  columnKey: string;
  courseId: string;
  rank: number | null;
  pickTier: "top" | "alternate";
  course: Course;
  subject: Subject;
  termById: Map<string, Term>;
  bookmarked: boolean;
  linked: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCardClick: () => void;
  onUnbookmark: () => void;
};

function AlternatesDividerSpan({ span }: { span: string }) {
  return (
    <div className="relative z-[1] py-2" aria-hidden="true">
      <div
        className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-2"
        style={{ width: span }}
      >
        <div className="h-px flex-1 bg-line" />
        <span className="shrink-0 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
          Alternates (not submitted)
        </span>
        <div className="h-px flex-1 bg-line" />
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
  columnKey,
  courseId,
  rank,
  pickTier,
  course,
  subject,
  termById,
  bookmarked,
  linked,
  onDragStart,
  onDragEnd,
  onCardClick,
  onUnbookmark,
}: RankedItemProps) {
  const isDraggingRef = useRef(false);
  const isTopPick = pickTier === "top";

  return (
    <Reorder.Item
      value={courseId}
      as="div"
      data-course-id={courseId}
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
        className={`${RANKING_ROW_SHELL} relative w-full cursor-pointer touch-none overflow-hidden text-left select-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-main-600 active:cursor-grabbing ${
          isTopPick
            ? "border-line bg-white hover:border-main-500"
            : "border-dashed border-line bg-transparent opacity-70"
        }`}
        data-ranking-column={columnKey}
      >
        {isTopPick && (
          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-1"
            style={{ backgroundColor: subject.accent }}
            aria-hidden="true"
          />
        )}
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            isTopPick ? "text-white" : "bg-surface-muted text-ink-muted"
          }`}
          style={isTopPick ? { backgroundColor: subject.accent } : undefined}
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
            className={iconButtonCompactClass}
            style={{ color: subject.accent }}
          >
            <Bookmark className="h-4 w-4" fill={subject.accent} />
          </button>
        ) : (
          <span className="h-8 w-8 shrink-0" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm leading-tight font-semibold ${
              isTopPick ? "text-ink" : "text-ink-secondary"
            }`}
          >
            {course.title}
          </p>
          {linked && (
            <span className="mt-0.5 inline-flex items-center gap-1">
              <Link2
                className="h-3 w-3 shrink-0 text-primary"
                aria-hidden="true"
              />
              <TermBadges
                offerings={[[columnKey]]}
                termById={termById}
              />
            </span>
          )}
        </div>

        <GripVertical
          className="h-4 w-4 shrink-0 cursor-grab text-ink-muted"
          aria-hidden="true"
        />
      </div>
    </Reorder.Item>
  );
}

// ─── Main grid ──────────────────────────────────────────────────────────────

function RankingAlignedGrid({
  model,
  terms,
  termById,
  requiredRankings,
  courseById,
  subjectByName,
  bookmarks,
  linkedIds,
  courseNotes,
  onReorder,
  onDragStateChange,
  onToggleBookmark,
}: RankingAlignedGridProps) {
  const [connectorRoot, setConnectorRoot] = useState<HTMLDivElement | null>(
    null,
  );
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  const termIds = terms.map((t) => t.id);
  const linkedSet = new Set(linkedIds);
  const countFor = (termId: string) => (model.orders[termId] ?? []).length;
  const rankOf = (termId: string, courseId: string) =>
    (model.orders[termId] ?? []).indexOf(courseId) + 1;

  const alignedRows = deriveAlignedRows(model, termIds, linkedSet);

  const layoutKey = termIds
    .map((termId) => (model.orders[termId] ?? []).join(","))
    .join("|");

  const anyOverflow = termIds.some(
    (termId) => countFor(termId) > requiredRankings,
  );
  const dividerBeforeRowIndex = alignedRows.findIndex((row) =>
    termIds.some((termId) => {
      const cell = row.cells[termId];
      return (
        cell &&
        cell.kind === "course" &&
        rankOf(termId, cell.id) > requiredRankings
      );
    }),
  );
  const showAlternatesDivider = dividerBeforeRowIndex >= 0 && anyOverflow;

  const expandedCourse = expandedCourseId
    ? courseById.get(expandedCourseId)
    : null;
  const expandedSubject = expandedCourse
    ? subjectByName.get(expandedCourse.subject)
    : null;

  const columnCount = terms.length;
  const dividerSpan = `calc(${columnCount * 100}% + ${(columnCount - 1) * 1.5}rem)`;
  const gridStyle = {
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
  };

  const renderColumn = (term: Term, columnIndex: number) => {
    const order = model.orders[term.id] ?? [];

    const cells = alignedRows.flatMap((row, rowIndex) => {
      const rowElements: ReactNode[] = [];

      if (showAlternatesDivider && rowIndex === dividerBeforeRowIndex) {
        rowElements.push(
          columnIndex === 0 ? (
            <AlternatesDividerSpan
              key={`${term.id}-alt-divider`}
              span={dividerSpan}
            />
          ) : (
            <AlternatesDividerSpacer key={`${term.id}-alt-divider`} />
          ),
        );
      }

      const cell = row.cells[term.id] ?? { kind: "spacer" as const };
      if (cell.kind === "spacer") {
        rowElements.push(
          <AlignmentSpacer key={`${term.id}-spacer-${rowIndex}`} />,
        );
        return rowElements;
      }

      const course = courseById.get(cell.id);
      if (!course) return rowElements;
      const subject = subjectByName.get(course.subject);
      if (!subject) return rowElements;

      const rank = rankOf(term.id, cell.id);
      const pickTier: "top" | "alternate" =
        rank <= requiredRankings ? "top" : "alternate";

      rowElements.push(
        <RankedItem
          key={`${term.id}-${cell.id}`}
          columnKey={term.id}
          courseId={cell.id}
          rank={pickTier === "top" ? rank : null}
          pickTier={pickTier}
          course={course}
          subject={subject}
          termById={termById}
          bookmarked={bookmarks.has(cell.id)}
          linked={course.termOptions.length > 1}
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
        key={term.id}
        axis="y"
        values={order}
        onReorder={(newOrder) => onReorder(term.id, newOrder)}
        as="div"
        data-ranking-column={term.id}
        className="flex min-w-0 flex-col gap-2"
      >
        {cells}
      </Reorder.Group>
    );
  };

  if (terms.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-ink-secondary">
        This school hasn't set up any terms yet, so there's nothing to rank.
      </div>
    );
  }

  const totalCount = termIds.reduce((sum, termId) => sum + countFor(termId), 0);
  if (totalCount === 0) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-ink-secondary">
        Bookmark courses on the Courses page to rank them here.
      </div>
    );
  }

  return (
    <>
      <div className="relative rounded-2xl border border-line bg-white p-5">
        <div className="mb-4 grid gap-6" style={gridStyle}>
          {terms.map((term) => (
            <div key={term.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl leading-7 font-semibold text-ink">{term.name}</h2>
                <span className="rounded-full bg-main-100 px-3 py-1 text-xs font-medium text-ink-secondary">
                  {countFor(term.id)} bookmarked
                </span>
              </div>
              <p className="text-xs text-ink-secondary">
                Top{" "}
                <strong className="font-semibold text-primary">
                  {requiredRankings}
                </strong>{" "}
                ranked courses are submitted
              </p>
            </div>
          ))}
        </div>

        <div ref={setConnectorRoot} className="relative">
          {linkedIds.map((anchorId) => {
            const course = courseById.get(anchorId);
            const subject = course
              ? subjectByName.get(course.subject)
              : undefined;
            if (!course || !subject) return null;
            const columnKeys = terms
              .filter((term) => course.termOptions.includes(term.id))
              .map((term) => term.id);
            return (
              <YearLongConnector
                key={anchorId}
                courseId={anchorId}
                columnKeys={columnKeys}
                containerEl={connectorRoot}
                subject={subject}
                layoutKey={layoutKey}
              />
            );
          })}

          <div className="relative z-[1] grid gap-x-6" style={gridStyle}>
            {terms.map((term, index) => renderColumn(term, index))}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-ink-muted">
          Click any card to see its full details · Drag to reorder
        </p>
      </div>

      {expandedCourse && expandedSubject && (
        <CourseDetailModal
          course={expandedCourse}
          subject={expandedSubject}
          termById={termById}
          note={courseNotes[expandedCourse.id] ?? ""}
          onClose={() => setExpandedCourseId(null)}
        />
      )}
    </>
  );
}

export default RankingAlignedGrid;
