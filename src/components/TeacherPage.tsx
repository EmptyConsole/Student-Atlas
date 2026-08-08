import { useEffect, useState } from "react";
import TeacherCatalog from "./TeacherCatalog";
import TeacherGate from "./TeacherGate";
import TeacherHeader from "./TeacherHeader";
import type { UnlockedSession } from "../lib/teacher";

const STORAGE_KEY = "teacher-unlocked";

/**
 * The stored session is a signed token, not a password: it only proves the
 * gate was passed, expires on its own, and is useless without the server.
 */
function readStoredUnlock(): UnlockedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.token === "string" &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Date.now()
    ) {
      return parsed as UnlockedSession;
    }
  } catch {
    // Ignore malformed storage.
  }
  return null;
}

function TeacherPage() {
  const [unlocked, setUnlocked] = useState<UnlockedSession | null>(() =>
    readStoredUnlock(),
  );

  useEffect(() => {
    if (unlocked) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [unlocked]);

  // Drop the teacher back to the gate the moment the token stops being valid.
  useEffect(() => {
    if (!unlocked) return;
    const remaining = Math.max(0, unlocked.expiresAt - Date.now());
    const timer = setTimeout(() => setUnlocked(null), remaining);
    return () => clearTimeout(timer);
  }, [unlocked]);

  return (
    <div className="flex h-screen flex-col overflow-hidden font-sans">
      <TeacherHeader
        onSwitchSchool={unlocked ? () => setUnlocked(null) : undefined}
      />
      {unlocked ? (
        <TeacherCatalog
          school={unlocked}
          onSchoolDeleted={() => setUnlocked(null)}
          onSessionExpired={() => setUnlocked(null)}
          onSchoolRenamed={(name) =>
            setUnlocked((cur) => (cur ? { ...cur, name } : cur))
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
