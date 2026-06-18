import { useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CourseBrowser from "./components/CourseBrowser";
import ProfilePage from "./components/ProfilePage";
import RegisterPage from "./components/RegisterPage";
import { useProfile } from "./hooks/useProfile";
import { SUBJECTS } from "./data/subjects";
import type { AppView } from "./types/app";

function App() {
  const [activeView, setActiveView] = useState<AppView>("courses");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [activeSubject, setActiveSubject] = useState<string>(SUBJECTS[0].name);
  const { profile, updateProfile, updateCourseNote, signOut } = useProfile();

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
