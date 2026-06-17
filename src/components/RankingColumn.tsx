import { useRef } from "react";
import { Reorder, useDragControls } from "motion/react";
import type { Subject } from "../data/subjects";
import type { Course } from "../data/courses";
import { courseIds, isLinked, MIN_RANKED_COURSES, type RankingRow } from "../utils/courseRanking";
import RankedCourseRow from "./RankedCourseRow";

type RankingColumnProps = {
  termLabel: string;
  column: "fall" | "spring";
  rows: RankingRow[];
  courseById: Map<string, Course>;
  subjectByName: Map<string, Subject>;
  bookmarks: Set<string>;
  onReorder: (column: "fall" | "spring", newOrder: string[]) => void;
  onHoverCourse: (courseId: string | null) => void;
  onRegisterRowRef: (
    courseId: string,
    column: "fall" | "spring",
    el: HTMLDivElement | null,
  ) => void;
};

type RankedItemProps = {
  courseId: string;
  rank: number;
  course: Course;
  subject: Subject;
  bookmarked: boolean;
  linked: boolean;
  column: "fall" | "spring";
  onHoverCourse: (courseId: string | null) => void;
  onRegisterRowRef: RankingColumnProps["onRegisterRowRef"];
};

function RankedItem({
  courseId,
  rank,
  course,
  subject,
  bookmarked,
  linked,
  column,
  onHoverCourse,
  onRegisterRowRef,
}: RankedItemProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={courseId}
      as="div"
      dragListener={false}
      dragControls={dragControls}
    >
      <RankedCourseRow
        ref={(el) => onRegisterRowRef(courseId, column, el)}
        course={course}
        subject={subject}
        rank={rank}
        bookmarked={bookmarked}
        linked={linked}
        dragControls={dragControls}
        onHoverStart={() => {
          if (linked) onHoverCourse(courseId);
        }}
        onHoverEnd={() => onHoverCourse(null)}
      />
    </Reorder.Item>
  );
}

/**
 * Inert reorder item used to keep linked courses aligned across columns. It is
 * a Reorder.Item (so the group only ever contains items, which motion requires)
 * but is not draggable.
 */
function PlaceholderRow({ value }: { value: string }) {
  return (
    <Reorder.Item value={value} as="div" dragListener={false} drag={false}>
      <div
        aria-hidden="true"
        className="flex items-center rounded-xl border border-dashed border-main-300 bg-main-100/40 px-3 py-2.5"
      >
        <span className="text-sm leading-tight">&nbsp;</span>
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
  onHoverCourse,
  onRegisterRowRef,
}: RankingColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  // Every row (course + placeholder) participates in the reorder values so the
  // group's children stay homogeneous; placeholders are stripped on reorder.
  const values = rows.map((row) => row.id);
  const courseCount = courseIds(rows).length;

  const handleReorder = (newOrder: string[]) => {
    onReorder(
      column,
      newOrder.filter((id) => courseById.has(id)),
    );
  };

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
              return <PlaceholderRow key={row.id} value={row.id} />;
            }

            const course = courseById.get(row.id);
            if (!course) return null;

            const subject = subjectByName.get(course.subject);
            if (!subject) return null;

            return (
              <RankedItem
                key={row.id}
                courseId={row.id}
                rank={index + 1}
                course={course}
                subject={subject}
                bookmarked={bookmarks.has(row.id)}
                linked={isLinked(course.term)}
                column={column}
                onHoverCourse={onHoverCourse}
                onRegisterRowRef={onRegisterRowRef}
              />
            );
          })}
        </Reorder.Group>
      )}
    </div>
  );
}

export default RankingColumn;
