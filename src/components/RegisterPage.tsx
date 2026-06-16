import { useCallback, useMemo, useRef, useState } from "react";
import { COURSES, GRADE_COLORS, GRADES } from "../data/courses";
import { SUBJECTS } from "../data/subjects";
import type { UserProfile } from "../hooks/useProfile";
import {
  buildInitialOrders,
  isYearLong,
  MIN_RANKED_COURSES,
  moveCourseLinked,
  validateRanking,
} from "../utils/courseRanking";
import RankingColumn from "./RankingColumn";
import SubmitConfirmDialog from "./SubmitConfirmDialog";
import YearLongConnector from "./YearLongConnector";

type RegisterPageProps = {
  profile: UserProfile;
  bookmarks: Set<string>;
};

function GradeChip({
  grade,
  active,
  onClick,
}: {
  grade: number;
  active: boolean;
  onClick: () => void;
}) {
  const { bg, fg } = GRADE_COLORS[grade];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="cursor-pointer rounded-full border-2 px-3 py-1 text-sm font-semibold transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2"
      style={{
        backgroundColor: active ? bg : "transparent",
        color: active ? fg : "#6b7280",
        borderColor: bg,
      }}
    >
      {grade}
    </button>
  );
}

function RegisterPage({ profile, bookmarks }: RegisterPageProps) {
  const defaultGrade = profile.grade ?? 9;
  const initialOrders = buildInitialOrders(defaultGrade);

  const [grade, setGrade] = useState(defaultGrade);
  const [fallOrder, setFallOrder] = useState(initialOrders.fallOrder);
  const [springOrder, setSpringOrder] = useState(initialOrders.springOrder);
  const [appealsNotes, setAppealsNotes] = useState("");
  const [hoveredYearLongId, setHoveredYearLongId] = useState<string | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const columnsRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(
    new Map<string, { fall: HTMLDivElement | null; spring: HTMLDivElement | null }>(),
  );

  const courseById = useMemo(
    () => new Map(COURSES.map((course) => [course.id, course])),
    [],
  );
  const subjectByName = useMemo(
    () => new Map(SUBJECTS.map((subject) => [subject.name, subject])),
    [],
  );

  const { valid, fallCount, springCount } = validateRanking(
    fallOrder,
    springOrder,
  );

  const handleGradeChange = (nextGrade: number) => {
    setGrade(nextGrade);
    const orders = buildInitialOrders(nextGrade);
    setFallOrder(orders.fallOrder);
    setSpringOrder(orders.springOrder);
    setHoveredYearLongId(null);
    setSubmitted(false);
  };

  const handleMove = useCallback(
    (column: "fall" | "spring", index: number, dir: -1 | 1) => {
      const next = moveCourseLinked(
        fallOrder,
        springOrder,
        column,
        index,
        dir,
        courseById,
      );
      setFallOrder(next.fallOrder);
      setSpringOrder(next.springOrder);
    },
    [fallOrder, springOrder, courseById],
  );

  const registerRowRef = useCallback(
    (courseId: string, column: "fall" | "spring", el: HTMLDivElement | null) => {
      const existing = rowRefs.current.get(courseId) ?? {
        fall: null,
        spring: null,
      };
      rowRefs.current.set(courseId, { ...existing, [column]: el });
    },
    [],
  );

  const handleHoverCourse = useCallback((courseId: string | null) => {
    setHoveredYearLongId(courseId);
  }, []);

  const hoveredCourse = hoveredYearLongId
    ? courseById.get(hoveredYearLongId)
    : null;
  const hoveredSubject = hoveredCourse
    ? subjectByName.get(hoveredCourse.subject) ?? null
    : null;
  const hoveredRefs = hoveredYearLongId
    ? rowRefs.current.get(hoveredYearLongId)
    : null;

  const handleConfirmSubmit = () => {
    const payload = {
      grade,
      fallOrder,
      springOrder,
      appealsNotes,
      profile,
    };
    console.log("Course registration submitted:", payload);
    setConfirmOpen(false);
    setSubmitted(true);
  };

  const inputClass =
    "w-full resize-y rounded-xl border border-main-400 bg-white px-4 py-3 text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-main-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-main-500";

  return (
    <main className="flex-1 overflow-y-auto bg-detail-400">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Register for Electives
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Rank your course preferences for the upcoming year.
          </p>
        </div>

        <div className="mb-6">
          <span className="mb-2 block text-sm font-semibold text-gray-700">
            Grade (testing)
          </span>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <GradeChip
                key={g}
                grade={g}
                active={grade === g}
                onClick={() => handleGradeChange(g)}
              />
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-main-300 bg-main-100 px-4 py-3 text-sm leading-relaxed text-gray-700">
          <p>
            Rank at least <strong>{MIN_RANKED_COURSES} courses</strong> for{" "}
            <strong>Fall</strong> and <strong>Spring</strong>. Use the arrows to
            move courses up or down in each column. Some courses run{" "}
            <strong>all year long</strong> — those stay linked at the same rank
            in both columns.
          </p>
        </div>

        <div ref={columnsRef} className="relative grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RankingColumn
            termLabel="Fall"
            column="fall"
            order={fallOrder}
            courseById={courseById}
            subjectByName={subjectByName}
            bookmarks={bookmarks}
            onMove={handleMove}
            onHoverCourse={handleHoverCourse}
            onRegisterRowRef={registerRowRef}
          />
          <RankingColumn
            termLabel="Spring"
            column="spring"
            order={springOrder}
            courseById={courseById}
            subjectByName={subjectByName}
            bookmarks={bookmarks}
            onMove={handleMove}
            onHoverCourse={handleHoverCourse}
            onRegisterRowRef={registerRowRef}
          />

          {hoveredYearLongId &&
            hoveredCourse &&
            isYearLong(hoveredCourse.term) && (
              <YearLongConnector
                hoveredCourseId={hoveredYearLongId}
                fallRowRef={hoveredRefs?.fall ?? null}
                springRowRef={hoveredRefs?.spring ?? null}
                containerRef={columnsRef.current}
                subject={hoveredSubject}
              />
            )}
        </div>

        <section className="mt-8">
          <label
            htmlFor="appeals-notes"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Any appeals/notes you want the teachers to read
          </label>
          <textarea
            id="appeals-notes"
            rows={4}
            value={appealsNotes}
            onChange={(e) => setAppealsNotes(e.target.value)}
            placeholder="Optional notes for your teachers..."
            className={inputClass}
          />
        </section>

        <div className="mt-8 flex flex-col items-start gap-3">
          {!valid && (
            <p className="text-sm text-gray-500">
              You need at least {MIN_RANKED_COURSES} courses in each column.
              Currently: Fall {fallCount}, Spring {springCount}.
            </p>
          )}
          {submitted && (
            <p className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
              Your rankings have been submitted successfully.
            </p>
          )}
          <button
            type="button"
            disabled={!valid}
            onClick={() => setConfirmOpen(true)}
            className="cursor-pointer rounded-xl border-0 bg-[#4169e1] px-6 py-3 text-base font-semibold text-white transition-all duration-150 hover:scale-105 hover:bg-[#3557c7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            Submit rankings
          </button>
        </div>
      </div>

      <SubmitConfirmDialog
        open={confirmOpen}
        grade={grade}
        fallCount={fallCount}
        springCount={springCount}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
      />
    </main>
  );
}

export default RegisterPage;
