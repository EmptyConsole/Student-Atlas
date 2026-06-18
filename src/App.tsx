import { useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CourseBrowser from "./components/CourseBrowser";
import ProfilePage from "./components/ProfilePage";
import RegisterPage from "./components/RegisterPage";
import { useProfile } from "./hooks/useProfile";
import { submitProfile } from "./lib/students";
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
    updateProfile,
    updateCourseNote,
    signOut,
  } = useProfile();

  const handleSubmitProfile = async () => {
    const result = await submitProfile(profile);
    if (!result.error) {
      markOnboarded();
      setActiveView("courses");
    }
    return result;
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
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            activeSubject={activeSubject}
            onSelectSubject={setActiveSubject}
          />
          <CourseBrowser
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
          profile={profile}
          bookmarks={bookmarks}
          onNavigateToProfile={() => setActiveView("profile")}
        />
      )}
    </div>
  );
}

export default App;
