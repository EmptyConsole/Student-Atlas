import { useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import CourseBrowser from "./components/CourseBrowser";
import { SUBJECTS } from "./data/subjects";

function App() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [activeSubject, setActiveSubject] = useState<string>(SUBJECTS[0].name);

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
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          bookmarks={bookmarks}
          onToggleBookmark={toggleBookmark}
          activeSubject={activeSubject}
          onSelectSubject={setActiveSubject}
        />
        <CourseBrowser
          bookmarks={bookmarks}
          onToggleBookmark={toggleBookmark}
          activeSubject={activeSubject}
          onActiveSubjectChange={setActiveSubject}
        />
      </div>
    </div>
  );
}

export default App;
