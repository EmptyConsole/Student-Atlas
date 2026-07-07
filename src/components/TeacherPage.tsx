import { useState } from "react";
import TeacherContent from "./TeacherContent";
import TeacherHeader from "./TeacherHeader";
import TeacherSidebar, { type TeacherSection } from "./TeacherSidebar";

function TeacherPage() {
  const [activeSection, setActiveSection] = useState<TeacherSection>("course");

  return (
    <div className="flex h-screen flex-col overflow-hidden font-sans">
      <TeacherHeader />
      <div className="flex flex-1 overflow-hidden">
        <TeacherSidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
        />
        <main className="flex flex-1 flex-col overflow-hidden bg-detail-400">
          <TeacherContent
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        </main>
      </div>
    </div>
  );
}

export default TeacherPage;
