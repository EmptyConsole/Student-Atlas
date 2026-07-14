import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Course, type Term } from "../data/courses";
import { type Subject } from "../data/subjects";
import { isProfileComplete, type UserProfile } from "../hooks/useProfile";
import {
  loadSubmittedCourses,
  loadSubmittedNotes,
  sendRankingsEmail,
  syncSubmittedCourses,
  syncSubmittedNotes,
} from "../lib/students";
import { useSchoolRankings } from "../hooks/useSchoolRankings";
import {
  applyReorder,
  buildInitialModel,
  buildModelFromPreferences,
  columnIds,
  linkedCourseIds,
  linkedIdSet,
  mergeModelWithBookmarks,
  validateRanking,
} from "../utils/courseRanking";
import RankingAlignedGrid from "./RankingAlignedGrid";
import SubmitConfirmDialog from "./SubmitConfirmDialog";

type RegisterPageProps = {
  courses: Course[];
  subjects: Subject[];
  terms: Term[];
  termById: Map<string, Term>;
  profile: UserProfile;
  bookmarks: Set<string>;
  studentId: string | null;
  onNavigateToProfile?: () => void;
  onToggleBookmark: (courseId: string) => void;
  onUnsavedChange?: (dirty: boolean) => void;
};

function snapshotColumns(columns: string[][]): string {
  return JSON.stringify(columns);
}

function RegisterPage({
  courses,
  subjects,
  terms,
  termById,
  profile,
  bookmarks,
  studentId,
  onNavigateToProfile,
  onToggleBookmark,
  onUnsavedChange,
}: RegisterPageProps) {
  const profileComplete = isProfileComplete(profile);
  const grade = profile.grade ?? 9;
  const { requiredRankings } = useSchoolRankings(profile.schoolId);

  const termIds = useMemo(() => terms.map((t) => t.id), [terms]);
  const [model, setModel] = useState(() =>
    buildInitialModel(bookmarks, courses, termIds),
  );

  // Reconcile the ranked lists when bookmarks (or the term list) change,
  // preserving the user's existing order for courses that remain bookmarked.
  const termKey = termIds.join(",");
  const [prevKey, setPrevKey] = useState({ bookmarks, termKey });
  if (prevKey.bookmarks !== bookmarks || prevKey.termKey !== termKey) {
    setPrevKey({ bookmarks, termKey });
    setModel((prev) => mergeModelWithBookmarks(bookmarks, prev, courses, termIds));
  }

  const [appealsNotes, setAppealsNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(!studentId);
  const [savedEpoch, setSavedEpoch] = useState(0);

  const savedColumnsRef = useRef(snapshotColumns([]));
  const skipNextDraftSave = useRef(false);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const subjectByName = useMemo(
    () => new Map(subjects.map((subject) => [subject.name, subject])),
    [subjects],
  );

  const { valid, counts } = validateRanking(model, termIds, requiredRankings);

  const linkedSet = useMemo(
    () => linkedIdSet(bookmarks, courses),
    [bookmarks, courses],
  );
  const linkedIds = useMemo(
    () => linkedCourseIds(model, termIds, linkedSet),
    [model, termIds, linkedSet],
  );

  // Per-term ranked ids capped at the required count (what actually submits).
  const submittedColumns = useMemo(
    () => termIds.map((termId) => columnIds(model, termId).slice(0, requiredRankings)),
    [model, termIds, requiredRankings],
  );

  const coursesReady = courses.length > 0 && termIds.length > 0;

  // Restore official submitted=true rankings (and note) when opening Register.
  useEffect(() => {
    if (!studentId) {
      setHydrated(true);
      return;
    }
    if (!coursesReady) return;

    let cancelled = false;
    setHydrated(false);

    void (async () => {
      const [coursesRes, notesRes] = await Promise.all([
        loadSubmittedCourses(studentId),
        loadSubmittedNotes(studentId),
      ]);
      if (cancelled) return;

      const preferenceByCourseId = new Map<string, number>();
      for (const row of coursesRes.rankings) {
        if (preferenceByCourseId.has(row.course_id)) continue;
        preferenceByCourseId.set(
          row.course_id,
          row.preference ?? Number.MAX_SAFE_INTEGER,
        );
      }

      const nextModel =
        preferenceByCourseId.size > 0
          ? buildModelFromPreferences(
              bookmarks,
              courses,
              termIds,
              preferenceByCourseId,
            )
          : buildInitialModel(bookmarks, courses, termIds);

      const cols = termIds.map((termId) =>
        columnIds(nextModel, termId).slice(0, requiredRankings),
      );
      const note = notesRes.note ?? "";

      setModel(nextModel);
      setAppealsNotes(note);
      setSavedNotes(note);
      savedColumnsRef.current = snapshotColumns(cols);
      skipNextDraftSave.current = true;
      setSavedEpoch((n) => n + 1);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
    // Only re-hydrate when the student/catalog readiness changes — not on every
    // bookmark tweak (those are merged into the live model instead).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, coursesReady, requiredRankings, termKey]);

  const handleReorder = useCallback(
    (termId: string, newOrder: string[]) => {
      setModel((prev) => applyReorder(prev, termId, newOrder, termIds, linkedSet));
    },
    [termIds, linkedSet],
  );

  const handleDragStateChange = useCallback(() => {
    // Drag state is tracked inside RankingAlignedGrid for connector updates.
  }, []);

  // Auto-save draft rankings (submitted=false). Leaves any official
  // submitted=true rows intact until the student confirms submit.
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !studentId) return;

    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    const cols = submittedColumns;
    draftTimerRef.current = setTimeout(() => {
      void syncSubmittedCourses(studentId, cols, false).then(({ error }) => {
        if (!error) {
          savedColumnsRef.current = snapshotColumns(cols);
          setSavedEpoch((n) => n + 1);
        }
      });
    }, 600);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [hydrated, studentId, submittedColumns]);

  const columnsDirty =
    hydrated && snapshotColumns(submittedColumns) !== savedColumnsRef.current;
  const notesDirty = hydrated && appealsNotes.trim() !== savedNotes.trim();
  // savedEpoch is bumped after hydrate / draft save / submit so this re-evaluates.
  const hasUnsaved = savedEpoch >= 0 && (columnsDirty || notesDirty);

  useEffect(() => {
    onUnsavedChange?.(hasUnsaved);
  }, [hasUnsaved, onUnsavedChange]);

  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  const handleConfirmSubmit = async () => {
    if (!studentId) {
      setConfirmOpen(false);
      setSubmitError("Please log in again from Profile.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const noteValue = appealsNotes.trim() || null;
    const cols = submittedColumns;

    const [coursesResult, notesResult] = await Promise.all([
      syncSubmittedCourses(studentId, cols, true),
      syncSubmittedNotes(studentId, noteValue),
    ]);

    setSubmitting(false);
    setConfirmOpen(false);

    const combinedError = coursesResult.error ?? notesResult.error;
    if (combinedError) {
      setSubmitError(combinedError);
      return;
    }

    // Email the student a copy of their rankings (non-blocking; the
    // submission already succeeded even if the email fails).
    void sendRankingsEmail(
      studentId,
      terms.map((term, i) => ({
        termName: term.name,
        courseIds: cols[i] ?? [],
      })),
      noteValue,
    );

    savedColumnsRef.current = snapshotColumns(cols);
    setSavedNotes(noteValue ?? "");
    setSavedEpoch((n) => n + 1);
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
            rank — your <strong>top {requiredRankings}</strong> in each term
            (numbered <strong>1–{requiredRankings}</strong>) are what gets
            submitted. Courses below the line are alternates only. Courses that
            span multiple terms stay on the same row across those columns.
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
            terms={terms}
            termById={termById}
            requiredRankings={requiredRankings}
            courseById={courseById}
            subjectByName={subjectByName}
            bookmarks={bookmarks}
            linkedIds={linkedIds}
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
              Bookmark at least {requiredRankings} courses eligible for each
              term to submit. Currently:{" "}
              {terms.map((t) => `${t.name} ${counts[t.id] ?? 0}`).join(", ")}.
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
        termCounts={terms.map((t) => ({
          label: t.name,
          count: (counts[t.id] ?? 0),
        }))}
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
