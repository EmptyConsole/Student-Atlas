import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CourseBrowser from "./components/CourseBrowser";
import ProfilePage from "./components/ProfilePage";
import RegisterPage from "./components/RegisterPage";
import { useProfile } from "./hooks/useProfile";
import { useCourses } from "./hooks/useCourses";
import {
  submitProfile,
  loadStudentData,
  syncStudentCourses,
  syncStudentBookmarks,
  syncStudentProfile,
  syncCourseNotes,
} from "./lib/students";
import { SUBJECTS } from "./data/subjects";
import type { AppView } from "./types/app";

function App() {
  const [activeView, setActiveView] = useState<AppView>("courses");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [activeSubject, setActiveSubject] = useState<string>(SUBJECTS[0].name);

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
  const { courses, loading: coursesLoading, error: coursesError } = useCourses();

  // Prevents sync effects from overwriting Supabase with stale localStorage data
  // before the initial Supabase hydration completes on app open.
  const syncEnabled = useRef(false);

  // On mount: if already onboarded, reload the student's Supabase data so
  // bookmarks and prereq/coreq selections are restored across sessions.
  useEffect(() => {
    if (!onboarded || !studentId) {
      // Fresh session — sync is safe to enable immediately (no historical data
      // to protect yet).
      syncEnabled.current = true;
      return;
    }

    loadStudentData(studentId).then(({ completedCourses, bookmarkIds, courseNotes }) => {
      updateProfile({ completedCourses, courseNotes });
      setBookmarks(bookmarkIds);
      syncEnabled.current = true;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once on mount

  // Sync prereq/coreq changes → completed_courses / enrolled_courses
  useEffect(() => {
    if (!studentId || !syncEnabled.current) return;
    syncStudentCourses(studentId, profile.completedCourses);
  }, [studentId, profile.completedCourses]);

  // Sync bookmark changes → bookmarked_courses
  useEffect(() => {
    if (!studentId || !syncEnabled.current) return;
    syncStudentBookmarks(studentId, bookmarks);
  }, [studentId, bookmarks]);

  // Sync profile field changes (name/email/grade) → students row.
  // Debounced so rapid typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (!studentId || !syncEnabled.current) return;
    const timer = setTimeout(() => {
      syncStudentProfile(studentId, profile.name, profile.email, profile.grade);
    }, 800);
    return () => clearTimeout(timer);
  }, [studentId, profile.name, profile.email, profile.grade]);

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
    } else if (result.studentId) {
      // New user — just record the ID (courses were synced inside submitProfile)
      setStudentId(result.studentId);
    }

    // Enable sync after login so subsequent changes propagate.
    syncEnabled.current = true;
    markOnboarded();
    setActiveView("courses");
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
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
          />
          <CourseBrowser
            courses={courses}
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
        />
      )}
      {activeView === "register" && (
        <RegisterPage
          courses={courses}
          profile={profile}
          bookmarks={bookmarks}
          onNavigateToProfile={() => setActiveView("profile")}
        />
      )}
    </div>
  );
}

export default App;
