import { useRef } from "react";
import { LayoutGroup } from "motion/react";
import type { Subject } from "../data/subjects";
import type { Course } from "../data/courses";
import { isYearLong } from "../utils/courseRanking";
import RankedCourseRow from "./RankedCourseRow";

type RankingColumnProps = {
  termLabel: string;
  column: "fall" | "spring";
  order: string[];
  courseById: Map<string, Course>;
  subjectByName: Map<string, Subject>;
  bookmarks: Set<string>;
  onMove: (column: "fall" | "spring", index: number, dir: -1 | 1) => void;
  onHoverCourse: (courseId: string | null) => void;
  onRegisterRowRef: (
    courseId: string,
    column: "fall" | "spring",
    el: HTMLDivElement | null,
  ) => void;
};

function RankingColumn({
  termLabel,
  column,
  order,
  courseById,
  subjectByName,
  bookmarks,
  onMove,
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
          {order.length} courses · 8 minimum
        </span>
      </div>

      <LayoutGroup id={`ranking-${column}`}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {order.map((courseId, index) => {
            const course = courseById.get(courseId);
            if (!course) return null;

            const subject = subjectByName.get(course.subject);
            if (!subject) return null;

            const yearLong = isYearLong(course.term);

            return (
              <RankedCourseRow
                key={courseId}
                ref={(el) => onRegisterRowRef(courseId, column, el)}
                layoutId={`ranked-${column}-${courseId}`}
                course={course}
                subject={subject}
                rank={index + 1}
                bookmarked={bookmarks.has(courseId)}
                isYearLong={yearLong}
                canMoveUp={index > 0}
                canMoveDown={index < order.length - 1}
                onMoveUp={() => onMove(column, index, -1)}
                onMoveDown={() => onMove(column, index, 1)}
                onHoverStart={() => {
                  if (yearLong) onHoverCourse(courseId);
                }}
                onHoverEnd={() => onHoverCourse(null)}
              />
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}

export default RankingColumn;
