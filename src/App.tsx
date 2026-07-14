import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CourseBrowser from "./components/CourseBrowser";
import ProfilePage from "./components/ProfilePage";
import RegisterPage from "./components/RegisterPage";
import { useProfile, type UserProfile } from "./hooks/useProfile";
import { useCourses } from "./hooks/useCourses";
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

  // Courses are lifted here so both CourseBrowser and Sidebar share the same
  // Supabase data (and therefore the same UUID-based course IDs for bookmarks).
  // Scoped to the student's selected school.
  const { courses, loading: coursesLoading, error: coursesError } = useCourses(
    profile.schoolId,
  );

  // Subjects (sections + sidebar tabs) come from the Supabase `departments`
  // table so the catalog reflects whatever is configured there.
  const { subjects } = useSubjects(profile.schoolId);

  // Terms drive term badges, filter chips, and the Register columns.
  const { terms, termById } = useTerms(profile.schoolId);

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

  const handleDeleteAccount = async () => {
    if (!studentId) return;
    await deleteStudentAccount(studentId);
    signOut();
    setActiveView("courses");
  };

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      <Header activeView={activeView} onNavigate={setActiveView} />
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
            loading={coursesLoading}
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
          onSignOut={() => {
            signOut();
            setActiveView("courses");
          }}
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
          onNavigateToProfile={() => setActiveView("profile")}
          onToggleBookmark={toggleBookmark}
        />
      )}
    </div>
  );
}

export default App;
