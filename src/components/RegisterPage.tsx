import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Course } from "../data/courses";
import { SUBJECTS } from "../data/subjects";
import { isProfileComplete, type UserProfile } from "../hooks/useProfile";
import {
  loadSubmittedStatus,
  syncSubmittedCourses,
  syncSubmittedNotes,
} from "../lib/students";
import {
  applyReorder,
  buildInitialModel,
  courseIds,
  deriveColumns,
  mergeModelWithBookmarks,
  MIN_RANKED_COURSES,
  validateRanking,
  yearLongCourseIds,
  yearLongIdSet,
} from "../utils/courseRanking";
import RankingAlignedGrid from "./RankingAlignedGrid";
import SubmitConfirmDialog from "./SubmitConfirmDialog";

type RegisterPageProps = {
  courses: Course[];
  profile: UserProfile;
  bookmarks: Set<string>;
  studentId: string | null;
  onNavigateToProfile?: () => void;
  onToggleBookmark: (courseId: string) => void;
};

function RegisterPage({
  courses,
  profile,
  bookmarks,
  studentId,
  onNavigateToProfile,
  onToggleBookmark,
}: RegisterPageProps) {
  const profileComplete = isProfileComplete(profile);
  const grade = profile.grade ?? 9;
  const [model, setModel] = useState(() => buildInitialModel(bookmarks, courses));

  // Reconcile the ranked lists when bookmarks change, preserving the user's
  // existing order for courses that remain bookmarked.
  const [prevBookmarks, setPrevBookmarks] = useState(bookmarks);
  if (bookmarks !== prevBookmarks) {
    setPrevBookmarks(bookmarks);
    setModel((prev) => mergeModelWithBookmarks(bookmarks, prev, courses));
  }

  const { fallRows, springRows } = useMemo(() => deriveColumns(model), [model]);
  const [appealsNotes, setAppealsNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const subjectByName = useMemo(
    () => new Map(SUBJECTS.map((subject) => [subject.name, subject])),
    [],
  );

  const { valid, fallCount, springCount } = validateRanking(
    fallRows,
    springRows,
  );

  const yearLongIds = useMemo(
    () => yearLongCourseIds(bookmarks, model.fallOrder, model.springOrder, courses),
    [bookmarks, model.fallOrder, model.springOrder, courses],
  );

  const yearLongSet = useMemo(() => yearLongIdSet(bookmarks, courses), [bookmarks, courses]);

  const handleReorder = useCallback(
    (column: "fall" | "spring", newOrder: string[]) => {
      setModel((prev) => applyReorder(prev, column, newOrder, yearLongSet));
    },
    [yearLongSet],
  );

  const handleDragStateChange = useCallback((_active: boolean) => {
    // Drag state is tracked inside RankingAlignedGrid for connector updates.
  }, []);

  // Determine initial mode: locked once a submitted=true row exists, otherwise
  // the page stays in draft mode and auto-saves reorders.
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    loadSubmittedStatus(studentId).then(({ hasSubmitted: locked }) => {
      if (!cancelled && locked) setHasSubmitted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // Auto-save the in-progress draft on every reorder while not yet submitted.
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (hasSubmitted || !studentId) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const fall = courseIds(fallRows).slice(0, MIN_RANKED_COURSES);
      const spring = courseIds(springRows).slice(0, MIN_RANKED_COURSES);
      void syncSubmittedCourses(studentId, fall, spring, false);
    }, 600);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [model, hasSubmitted, studentId, fallRows, springRows]);

  const handleConfirmSubmit = async () => {
    if (!studentId) {
      setConfirmOpen(false);
      setSubmitError("Please log in again from Profile.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const fallSubmitted = courseIds(fallRows).slice(0, MIN_RANKED_COURSES);
    const springSubmitted = courseIds(springRows).slice(0, MIN_RANKED_COURSES);
    const noteValue = appealsNotes.trim() || null;

    const [coursesResult, notesResult] = await Promise.all([
      syncSubmittedCourses(studentId, fallSubmitted, springSubmitted, true),
      syncSubmittedNotes(studentId, noteValue),
    ]);

    setSubmitting(false);
    setConfirmOpen(false);

    const combinedError = coursesResult.error ?? notesResult.error;
    if (combinedError) {
      setSubmitError(combinedError);
      return;
    }

    setHasSubmitted(true);
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
            Only your <strong>bookmarked courses</strong> appear here. Drag to
            rank — your <strong>top {MIN_RANKED_COURSES}</strong> in each column
            (numbered <strong>1–{MIN_RANKED_COURSES}</strong>) are what gets
            submitted. Courses below the line are alternates only. All-year
            courses stay on the same row in both columns.
          </p>
        </div>

        {!profileComplete && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>
              You must sign in with details to register for electives.
            </p>
            {onNavigateToProfile && (
              <button
                type="button"
                onClick={onNavigateToProfile}
                className="shrink-0 cursor-pointer rounded-lg border border-amber-400 bg-white px-4 py-1.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
              >
                Go to Profile
              </button>
            )}
          </div>
        )}

        <div
          className={
            profileComplete
              ? undefined
              : "pointer-events-none select-none opacity-50"
          }
          aria-disabled={!profileComplete}
        >
          <RankingAlignedGrid
            model={model}
            courseById={courseById}
            subjectByName={subjectByName}
            bookmarks={bookmarks}
            yearLongIds={yearLongIds}
            courseNotes={profile.courseNotes}
            onReorder={handleReorder}
            onDragStateChange={handleDragStateChange}
            onToggleBookmark={onToggleBookmark}
          />

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
            disabled={!profileComplete}
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
          {submitError && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
              {submitError}
            </p>
          )}
          {submitted && (
            <p className="rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
              Your rankings have been submitted successfully.
            </p>
          )}
          <button
            type="button"
            disabled={!valid || !profileComplete || submitting}
            onClick={() => {
              if (profileComplete) setConfirmOpen(true);
            }}
            className="cursor-pointer rounded-xl border-0 bg-[#4169e1] px-6 py-3 text-base font-semibold text-white transition-all duration-150 hover:scale-105 hover:bg-[#3557c7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {submitting ? "Submitting…" : "Submit rankings"}
          </button>
        </div>
        </div>
      </div>

      <SubmitConfirmDialog
        open={confirmOpen}
        grade={grade}
        fallCount={fallCount}
        springCount={springCount}
        submitting={submitting}
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onConfirm={handleConfirmSubmit}
      />
    </main>
  );
}

export default RegisterPage;
