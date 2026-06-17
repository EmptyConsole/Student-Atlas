import { useCallback, useMemo, useRef, useState } from "react";
import { COURSES } from "../data/courses";
import { SUBJECTS } from "../data/subjects";
import type { UserProfile } from "../hooks/useProfile";
import {
  applyReorder,
  buildInitialModel,
  courseIds,
  deriveColumns,
  isLinked,
  mergeModelWithBookmarks,
  MIN_RANKED_COURSES,
  validateRanking,
} from "../utils/courseRanking";
import RankingColumn from "./RankingColumn";
import SubmitConfirmDialog from "./SubmitConfirmDialog";
import YearLongConnector from "./YearLongConnector";

type RegisterPageProps = {
  profile: UserProfile;
  bookmarks: Set<string>;
};

function RegisterPage({ profile, bookmarks }: RegisterPageProps) {
  const grade = profile.grade ?? 9;
  const [model, setModel] = useState(() => buildInitialModel(grade, bookmarks));

  // Reconcile the ranked lists when bookmarks or grade change, preserving the
  // user's existing order for courses that remain valid.
  const [prevBookmarks, setPrevBookmarks] = useState(bookmarks);
  const [prevGrade, setPrevGrade] = useState(grade);
  if (bookmarks !== prevBookmarks || grade !== prevGrade) {
    setPrevBookmarks(bookmarks);
    setPrevGrade(grade);
    setModel((prev) => mergeModelWithBookmarks(grade, bookmarks, prev));
  }

  const { fallRows, springRows } = useMemo(() => deriveColumns(model), [model]);
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
    fallRows,
    springRows,
  );

  const handleReorder = useCallback(
    (column: "fall" | "spring", newOrder: string[]) => {
      setModel((prev) => applyReorder(prev, column, newOrder));
    },
    [],
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
      fallOrder: courseIds(fallRows),
      springOrder: courseIds(springRows),
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

        <div className="mb-6 rounded-xl border border-main-300 bg-main-100 px-4 py-3 text-sm leading-relaxed text-gray-700">
          <p>
            Only your <strong>bookmarked courses</strong> appear here. Bookmark
            at least <strong>{MIN_RANKED_COURSES} courses</strong> for{" "}
            <strong>Fall</strong> and <strong>Spring</strong>, then drag them by
            the handle to rank them in each column. Some courses run{" "}
            <strong>all year long</strong> — those stay linked at the same rank
            in both columns.
          </p>
        </div>

        <div ref={columnsRef} className="relative grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RankingColumn
            termLabel="Fall"
            column="fall"
            rows={fallRows}
            courseById={courseById}
            subjectByName={subjectByName}
            bookmarks={bookmarks}
            onReorder={handleReorder}
            onHoverCourse={handleHoverCourse}
            onRegisterRowRef={registerRowRef}
          />
          <RankingColumn
            termLabel="Spring"
            column="spring"
            rows={springRows}
            courseById={courseById}
            subjectByName={subjectByName}
            bookmarks={bookmarks}
            onReorder={handleReorder}
            onHoverCourse={handleHoverCourse}
            onRegisterRowRef={registerRowRef}
          />

          {hoveredYearLongId &&
            hoveredCourse &&
            isLinked(hoveredCourse.term) && (
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
              Bookmark at least {MIN_RANKED_COURSES} fall-eligible and{" "}
              {MIN_RANKED_COURSES} spring-eligible courses to submit. Currently:
              Fall {fallCount}, Spring {springCount}.
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
