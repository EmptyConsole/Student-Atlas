import { useRef } from "react";
import { Reorder, useDragControls } from "motion/react";
import type { Subject } from "../data/subjects";
import type { Course } from "../data/courses";
import { isYearLong, MIN_RANKED_COURSES } from "../utils/courseRanking";
import RankedCourseRow from "./RankedCourseRow";

type RankingColumnProps = {
  termLabel: string;
  column: "fall" | "spring";
  order: string[];
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
  index: number;
  course: Course;
  subject: Subject;
  bookmarked: boolean;
  yearLong: boolean;
  column: "fall" | "spring";
  onHoverCourse: (courseId: string | null) => void;
  onRegisterRowRef: RankingColumnProps["onRegisterRowRef"];
};

function RankedItem({
  courseId,
  index,
  course,
  subject,
  bookmarked,
  yearLong,
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
        rank={index + 1}
        bookmarked={bookmarked}
        isYearLong={yearLong}
        dragControls={dragControls}
        onHoverStart={() => {
          if (yearLong) onHoverCourse(courseId);
        }}
        onHoverEnd={() => onHoverCourse(null)}
      />
    </Reorder.Item>
  );
}

function RankingColumn({
  termLabel,
  column,
  order,
  courseById,
  subjectByName,
  bookmarks,
  onReorder,
  onHoverCourse,
  onRegisterRowRef,
}: RankingColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={columnRef}
      data-ranking-column={column}
      className="flex min-h-[28rem] flex-col rounded-2xl border border-main-300 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-gray-800">{termLabel}</h2>
        <span className="rounded-full bg-main-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {order.length} bookmarked · {MIN_RANKED_COURSES} minimum
        </span>
      </div>

      {order.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-main-300 px-4 py-8 text-center text-sm text-gray-500">
          Bookmark courses on the Courses page to rank them here.
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={(newOrder) => onReorder(column, newOrder)}
          as="div"
          className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1"
        >
          {order.map((courseId, index) => {
            const course = courseById.get(courseId);
            if (!course) return null;

            const subject = subjectByName.get(course.subject);
            if (!subject) return null;

            return (
              <RankedItem
                key={courseId}
                courseId={courseId}
                index={index}
                course={course}
                subject={subject}
                bookmarked={bookmarks.has(courseId)}
                yearLong={isYearLong(course.term)}
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
