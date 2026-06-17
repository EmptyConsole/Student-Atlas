import { useRef } from "react";
import { Reorder } from "motion/react";
import { GripVertical } from "lucide-react";
import type { Subject } from "../data/subjects";
import type { Course } from "../data/courses";
import { courseIds, isLinked, MIN_RANKED_COURSES, type RankingRow } from "../utils/courseRanking";
import RankedCourseRow, { RANKING_ROW_SHELL } from "./RankedCourseRow";

type RankingColumnProps = {
  termLabel: string;
  column: "fall" | "spring";
  rows: RankingRow[];
  courseById: Map<string, Course>;
  subjectByName: Map<string, Subject>;
  bookmarks: Set<string>;
  onReorder: (column: "fall" | "spring", newOrder: string[]) => void;
  onDragStateChange: (active: boolean) => void;
};

type RankedItemProps = {
  courseId: string;
  rank: number | null;
  course: Course;
  subject: Subject;
  bookmarked: boolean;
  linked: boolean;
  onDragStateChange: (active: boolean) => void;
};

function RankedItem({
  courseId,
  rank,
  course,
  subject,
  bookmarked,
  linked,
  onDragStateChange,
}: RankedItemProps) {
  return (
    <Reorder.Item
      value={courseId}
      as="div"
      onDragStart={() => onDragStateChange(true)}
      onDragEnd={() => onDragStateChange(false)}
    >
      <RankedCourseRow
        course={course}
        subject={subject}
        rank={rank}
        bookmarked={bookmarked}
        linked={linked}
      />
    </Reorder.Item>
  );
}

/**
 * Empty slot used to keep linked courses aligned across columns. It is a full
 * drag target like any other row (so a course can be dropped into it) and reads
 * as a "None" card so empty ranks are explicit rather than invisible.
 */
function PlaceholderRow({
  value,
  rank,
  onDragStateChange,
}: {
  value: string;
  rank: number | null;
  onDragStateChange: (active: boolean) => void;
}) {
  return (
    <Reorder.Item
      value={value}
      as="div"
      onDragStart={() => onDragStateChange(true)}
      onDragEnd={() => onDragStateChange(false)}
    >
      <div
        aria-label="Empty rank slot"
        className={`${RANKING_ROW_SHELL} cursor-grab touch-none select-none border-dashed border-main-300 bg-main-100/40 transition-colors duration-150 hover:border-main-500 hover:bg-main-100/70 active:cursor-grabbing`}
      >
        <span className="w-6 shrink-0 text-center text-sm font-semibold text-gray-300">
          {rank ?? ""}
        </span>
        <span className="w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium italic leading-tight text-gray-400">
          None
        </span>
        <span className="shrink-0 p-1 text-gray-300" aria-hidden="true">
          <GripVertical className="h-4 w-4" />
        </span>
      </div>
    </Reorder.Item>
  );
}

function RankingColumn({
  termLabel,
  column,
  rows,
  courseById,
  subjectByName,
  bookmarks,
  onReorder,
  onDragStateChange,
}: RankingColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  // Every row (course + placeholder) participates in the reorder values so the
  // group's children stay homogeneous. Placeholder ids are kept in the order
  // passed up so applyReorder can tell how far an anchor moved through blank
  // slots; they are stripped there before regrouping real courses.
  const values = rows.map((row) => row.id);
  const courseCount = courseIds(rows).length;

  const handleReorder = (newOrder: string[]) => {
    onReorder(column, newOrder);
  };

  const displayRank = (index: number): number | null =>
    index + 1 <= MIN_RANKED_COURSES ? index + 1 : null;

  return (
    <div
      ref={columnRef}
      data-ranking-column={column}
      className="flex min-h-[28rem] flex-col rounded-2xl border border-main-300 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-gray-800">{termLabel}</h2>
        <span className="rounded-full bg-main-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {courseCount} bookmarked · {MIN_RANKED_COURSES} minimum
        </span>
      </div>

      {courseCount === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-main-300 px-4 py-8 text-center text-sm text-gray-500">
          Bookmark courses on the Courses page to rank them here.
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={values}
          onReorder={handleReorder}
          as="div"
          className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1"
        >
          {rows.map((row, index) => {
            if (row.kind === "placeholder") {
              return (
                <PlaceholderRow
                  key={row.id}
                  value={row.id}
                  rank={displayRank(index)}
                  onDragStateChange={onDragStateChange}
                />
              );
            }

            const course = courseById.get(row.id);
            if (!course) return null;

            const subject = subjectByName.get(course.subject);
            if (!subject) return null;

            return (
              <RankedItem
                key={row.id}
                courseId={row.id}
                rank={displayRank(index)}
                course={course}
                subject={subject}
                bookmarked={bookmarks.has(row.id)}
                linked={isLinked(course.term)}
                onDragStateChange={onDragStateChange}
              />
            );
          })}
        </Reorder.Group>
      )}
    </div>
  );
}

export default RankingColumn;
