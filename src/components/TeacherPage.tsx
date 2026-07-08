import { useEffect, useState } from "react";
import TeacherCatalog from "./TeacherCatalog";
import TeacherGate, { type UnlockedSchool } from "./TeacherGate";
import TeacherHeader from "./TeacherHeader";

const STORAGE_KEY = "teacher-unlocked";

function readStoredUnlock(): UnlockedSchool | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.password === "string"
    ) {
      return parsed as UnlockedSchool;
    }
  } catch {
    // Ignore malformed storage.
  }
  return null;
}

function TeacherPage() {
  const [unlocked, setUnlocked] = useState<UnlockedSchool | null>(() =>
    readStoredUnlock(),
  );

  useEffect(() => {
    if (unlocked) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [unlocked]);

  return (
    <div className="flex h-screen flex-col overflow-hidden font-sans">
      <TeacherHeader />
      {unlocked ? (
        <TeacherCatalog
          school={unlocked}
          onSwitchSchool={() => setUnlocked(null)}
          onSchoolDeleted={() => setUnlocked(null)}
          onSchoolUpdated={(name, password) =>
            setUnlocked((cur) => (cur ? { ...cur, name, password } : cur))
          }
          onSwitchToSchool={(school) => setUnlocked(school)}
        />
      ) : (
        <TeacherGate onUnlock={setUnlocked} />
      )}
    </div>
  );
}

export default TeacherPage;
