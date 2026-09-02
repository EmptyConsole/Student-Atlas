import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CourseBrowser from "./components/CourseBrowser";
import ProfilePage from "./components/ProfilePage";
import RegisterPage from "./components/RegisterPage";
import RegisterUnsavedDialog from "./components/RegisterUnsavedDialog";
import { useProfile, type UserProfile } from "./hooks/useProfile";
import { useCourses } from "./hooks/useCourses";
import { useRefreshOnVisible } from "./hooks/useRefreshOnVisible";
import { useSchoolGrades } from "./hooks/useSchoolGrades";
import { useSubjects } from "./hooks/useSubjects";
import { useTerms } from "./hooks/useTerms";
import {
  submitProfile,
  loginByEmail,
  loadStudentData,
  syncStudentCourses,
  syncStudentBookmarks,
  syncStudentProfile,
  syncCourseNotes,
  deleteStudentAccount,
} from "./lib/students";
import type { AppView } from "./types/app";

// Snapshot of the profile fields that the Profile page edits and that only get
// pushed to Supabase when the student clicks "Save Changes".
type ProfileSnapshot = Pick<
  UserProfile,
  "schoolId" | "name" | "email" | "grade" | "completedCourses"
>;

function snapshotProfile(profile: UserProfile): ProfileSnapshot {
  return {
    schoolId: profile.schoolId,
    name: profile.name,
    email: profile.email,
    grade: profile.grade,
    completedCourses: { ...profile.completedCourses },
  };
}

// Treats unchecked (null) and absent entries as equal so toggling a course
// on then off again doesn't register as an unsaved change.
function completedCoursesEqual(
  a: UserProfile["completedCourses"],
  b: UserProfile["completedCourses"],
): boolean {
  const norm = (c: UserProfile["completedCourses"]) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(c)) if (v) out[k] = v;
    return out;
  };
  const na = norm(a);
  const nb = norm(b);
  const ka = Object.keys(na);
  const kb = Object.keys(nb);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => na[k] === nb[k]);
}

function profileSnapshotsEqual(a: ProfileSnapshot, b: ProfileSnapshot): boolean {
  return (
    a.schoolId === b.schoolId &&
    a.name === b.name &&
    a.email === b.email &&
    a.grade === b.grade &&
    completedCoursesEqual(a.completedCourses, b.completedCourses)
  );
}

function App() {
  const [activeView, setActiveView] = useState<AppView>("courses");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [registerDirty, setRegisterDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<AppView | null>(null);

  const {
    profile,
    onboarded,
    markOnboarded,
    studentId,
    setStudentId,
    updateProfile,
    updateCourseNote,
    signOut,
  } = useProfile();

  // Bumps whenever the user returns to this tab so all Supabase data refetches
  // — updates made in another tab or on another computer come in automatically.
  const refreshKey = useRefreshOnVisible();

  // Courses are lifted here so both CourseBrowser and Sidebar share the same
  // Supabase data (and therefore the same UUID-based course IDs for bookmarks).
  // Scoped to the student's selected school.
  const { courses, loading: coursesLoading, error: coursesError } = useCourses(
    profile.schoolId,
    refreshKey,
  );

  // Subjects (sections + sidebar tabs) come from the Supabase `departments`
  // table so the catalog reflects whatever is configured there.
  const { subjects } = useSubjects(profile.schoolId, refreshKey);

  // Terms drive term badges, filter chips, and the Register columns.
  const { terms, termById } = useTerms(profile.schoolId, refreshKey);

  // Grade levels the school actually uses (`schools.grade` keys) so filter
  // chips only offer grades the school allows.
  const { grades: schoolGrades } = useSchoolGrades(profile.schoolId, refreshKey);

  // Default the active subject to the first one once departments load.
  useEffect(() => {
    if (!activeSubject && subjects.length > 0) {
      setActiveSubject(subjects[0].name);
    }
  }, [subjects, activeSubject]);

  // Prevents sync effects from overwriting Supabase with stale localStorage data
  // before the initial Supabase hydration completes on app open.
  const syncEnabled = useRef(false);

  // The last profile state that has been persisted to Supabase. Profile-page
  // edits (school/name/email/grade/completed courses) are NOT auto-synced; they
  // are only pushed when the student clicks "Save Changes", which advances this
  // snapshot. Comparing it to the live profile tells us if there are unsaved
  // changes.
  const [savedProfile, setSavedProfile] = useState<ProfileSnapshot | null>(null);

  // On mount: if already onboarded, reload the student's Supabase data so
  // bookmarks and prereq/coreq selections are restored across sessions.
  useEffect(() => {
    if (!onboarded || !studentId) {
      // Fresh session — sync is safe to enable immediately (no historical data
      // to protect yet).
      syncEnabled.current = true;
      setSavedProfile(snapshotProfile(profile));
      return;
    }

    loadStudentData(studentId).then(({ completedCourses, bookmarkIds, courseNotes }) => {
      updateProfile({ completedCourses, courseNotes });
      setBookmarks(bookmarkIds);
      setSavedProfile({
        schoolId: profile.schoolId,
        name: profile.name,
        email: profile.email,
        grade: profile.grade,
        completedCourses,
      });
      syncEnabled.current = true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once on mount

  // Sync bookmark changes → bookmarked_courses
  useEffect(() => {
    if (!studentId || !syncEnabled.current) return;
    syncStudentBookmarks(studentId, bookmarks);
  }, [studentId, bookmarks]);

  // Sync course notes → course_notes table.
  // Debounced for the same reason.
  useEffect(() => {
    if (!studentId || !syncEnabled.current) return;
    const timer = setTimeout(() => {
      syncCourseNotes(studentId, profile.courseNotes);
    }, 800);
    return () => clearTimeout(timer);
  }, [studentId, profile.courseNotes]);

  const handleSubmitProfile = async (): Promise<{ error?: string }> => {
    const result = await submitProfile(profile);

    if (result.error) return { error: result.error };

    if (result.hydratedData) {
      // Returning user — restore everything from Supabase
      const { studentId: id, profile: hydratedProfile, bookmarkIds } = result.hydratedData;
      setStudentId(id);
      updateProfile(hydratedProfile);
      setBookmarks(bookmarkIds);
      setSavedProfile({
        schoolId: hydratedProfile.schoolId,
        name: hydratedProfile.name,
        email: hydratedProfile.email,
        grade: hydratedProfile.grade,
        completedCourses: hydratedProfile.completedCourses,
      });
    } else if (result.studentId) {
      // New user — just record the ID (courses were synced inside submitProfile)
      setStudentId(result.studentId);
      setSavedProfile(snapshotProfile(profile));
    }

    // Enable sync after login so subsequent changes propagate.
    syncEnabled.current = true;
    markOnboarded();
    setActiveView("profile");
    return {};
  };

  // Whether the Profile page has edits that haven't been pushed to Supabase yet.
  const hasUnsavedChanges = savedProfile
    ? !profileSnapshotsEqual(snapshotProfile(profile), savedProfile)
    : false;

  // On returning to the tab, re-pull the student's Supabase data (bookmarks,
  // completed courses, notes) so changes made in another tab/computer show up.
  // Skipped while the Profile page has unsaved edits so they aren't clobbered.
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  hasUnsavedRef.current = hasUnsavedChanges;

  useEffect(() => {
    if (refreshKey === 0) return;
    if (!studentId || !syncEnabled.current || hasUnsavedRef.current) return;

    let cancelled = false;
    loadStudentData(studentId).then(
      ({ completedCourses, bookmarkIds, courseNotes }) => {
        if (cancelled) return;
        updateProfile({ completedCourses, courseNotes });
        setBookmarks(bookmarkIds);
        // The refresh only ran with no unsaved edits, so just advance the
        // completed-courses part of the saved snapshot.
        setSavedProfile((prev) =>
          prev ? { ...prev, completedCourses } : prev,
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey, studentId, updateProfile]);

  // Push the Profile page edits to Supabase and advance the saved snapshot.
  const handleSaveProfileChanges = async (): Promise<{ error?: string }> => {
    if (!studentId) return {};

    const profileResult = await syncStudentProfile(
      studentId,
      profile.name,
      profile.email,
      profile.grade,
      profile.schoolId,
    );
    if (profileResult.error) return { error: profileResult.error };

    const coursesResult = await syncStudentCourses(
      studentId,
      profile.completedCourses,
    );
    if (coursesResult.error) return { error: coursesResult.error };

    setSavedProfile(snapshotProfile(profile));
    return {};
  };

  const handleLoginByEmail = async (email: string): Promise<{ error?: string }> => {
    const result = await loginByEmail(email);

    if (result.error) return { error: result.error };

    if (result.hydratedData) {
      const { studentId: id, profile: hydratedProfile, bookmarkIds } = result.hydratedData;
      setStudentId(id);
      updateProfile(hydratedProfile);
      setBookmarks(bookmarkIds);
      setSavedProfile({
        schoolId: hydratedProfile.schoolId,
        name: hydratedProfile.name,
        email: hydratedProfile.email,
        grade: hydratedProfile.grade,
        completedCourses: hydratedProfile.completedCourses,
      });
      syncEnabled.current = true;
      markOnboarded();
      setActiveView("profile");
    }

    return {};
  };

  // Signs out and wipes per-account browser state (bookmarks live in App
  // state, so `signOut` alone would leave them behind for the next login).
  const handleSignOut = () => {
    syncEnabled.current = false;
    setBookmarks(new Set());
    setSavedProfile(null);
    signOut();
    setActiveView("courses");
  };

  const handleDeleteAccount = async (): Promise<{ error?: string }> => {
    if (!studentId) return {};
    // Stop bookmark/note sync first so nothing is re-written to Supabase while
    // (or after) the account rows are being deleted.
    syncEnabled.current = false;
    const result = await deleteStudentAccount(studentId);
    if (result.error) {
      syncEnabled.current = true;
      return { error: result.error };
    }
    handleSignOut();
    return {};
  };

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = (view: AppView) => {
    if (activeView === "register" && registerDirty && view !== "register") {
      setPendingNav(view);
      return;
    }
    setActiveView(view);
  };

  if (!onboarded) {
    return (
      <div className="flex h-screen flex-col overflow-hidden font-sans">
        <Header activeView="profile" onNavigate={setActiveView} locked />
        <ProfilePage
          profile={profile}
          onChange={updateProfile}
          onSignOut={signOut}
          onboarding
          onSubmit={handleSubmitProfile}
          onLoginByEmail={handleLoginByEmail}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden font-sans">
      <Header activeView={activeView} onNavigate={handleNavigate} />
      {activeView === "courses" && (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            courses={courses}
            subjects={subjects}
            termById={termById}
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
          />
          <CourseBrowser
            courses={courses}
            subjects={subjects}
            terms={terms}
            termById={termById}
            schoolGrades={schoolGrades}
            loading={coursesLoading && courses.length === 0}
            error={coursesError}
            profile={profile}
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            onUpdateCourseNote={updateCourseNote}
            activeSubject={activeSubject}
            onActiveSubjectChange={setActiveSubject}
          />
        </div>
      )}
      {activeView === "profile" && (
        <ProfilePage
          profile={profile}
          onChange={updateProfile}
          onSignOut={handleSignOut}
          onDeleteAccount={handleDeleteAccount}
          hasUnsavedChanges={hasUnsavedChanges}
          onSaveChanges={handleSaveProfileChanges}
          savedEmail={savedProfile?.email ?? null}
        />
      )}
      {activeView === "register" && (
        <RegisterPage
          courses={courses}
          subjects={subjects}
          terms={terms}
          termById={termById}
          profile={profile}
          bookmarks={bookmarks}
          studentId={studentId}
          refreshKey={refreshKey}
          onNavigateToProfile={() => handleNavigate("profile")}
          onToggleBookmark={toggleBookmark}
          onUnsavedChange={setRegisterDirty}
        />
      )}

      <RegisterUnsavedDialog
        open={pendingNav !== null}
        onStay={() => setPendingNav(null)}
        onLeave={() => {
          if (pendingNav) {
            setRegisterDirty(false);
            setActiveView(pendingNav);
            setPendingNav(null);
          }
        }}
      />
    </div>
  );
}

export default App;
