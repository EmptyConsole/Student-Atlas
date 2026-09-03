import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const POLL_INTERVAL_MS = 15_000;

const CONFLICT_SELECT =
  "id,title,short_description,long_description,grade,subject,department_id,teacher_id,retakeable,prereq_options,coreq_options,max_student_count,term_options,schedule";

type ConflictKind = "changed" | "deleted" | null;

type CourseConflictRow = {
  id: string;
  title: string;
  short_description: string;
  long_description: string;
  grade: unknown;
  subject: string;
  department_id: string | null;
  teacher_id: string | null;
  retakeable: boolean;
  prereq_options: unknown;
  coreq_options: unknown;
  max_student_count: number;
  term_options: unknown;
  schedule: unknown;
};

function fingerprint(rows: CourseConflictRow[]): string {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted);
}

async function fetchRows(
  schoolId: string,
  courseIds: string[],
): Promise<{ rows: CourseConflictRow[]; error?: string }> {
  if (courseIds.length === 0) return { rows: [] };
  const { data, error } = await supabase
    .from("courses")
    .select(CONFLICT_SELECT)
    .eq("school_id", schoolId)
    .in("id", courseIds);

  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as CourseConflictRow[] };
}

/**
 * Polls the editing course rows while the modal is open. Compares a fingerprint
 * against the baseline captured on open (or after remount) so another window's
 * save can surface a warning without blocking the teacher.
 */
export function useCourseConflict(options: {
  enabled: boolean;
  schoolId: string;
  courseIds: string[];
  saving: boolean;
}): { conflict: ConflictKind; resetBaseline: () => void } {
  const { enabled, schoolId, courseIds, saving } = options;
  const [conflict, setConflict] = useState<ConflictKind>(null);
  const baselineRef = useRef<string | null>(null);
  const courseIdsKey = courseIds.slice().sort().join(",");
  const courseIdsRef = useRef(courseIds);
  courseIdsRef.current = courseIds;
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const captureBaseline = useCallback(async () => {
    const ids = courseIdsRef.current;
    if (!enabled || ids.length === 0) {
      baselineRef.current = null;
      setConflict(null);
      return;
    }
    const { rows } = await fetchRows(schoolId, ids);
    if (rows.length === 0) {
      baselineRef.current = fingerprint([]);
      setConflict("deleted");
      return;
    }
    baselineRef.current = fingerprint(rows);
    setConflict(null);
  }, [enabled, schoolId]);

  const resetBaseline = useCallback(() => {
    void captureBaseline();
  }, [captureBaseline]);

  // Capture baseline when the editor opens or the set of ids changes.
  useEffect(() => {
    if (!enabled) {
      baselineRef.current = null;
      setConflict(null);
      return;
    }
    void captureBaseline();
  }, [enabled, schoolId, courseIdsKey, captureBaseline]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (savingRef.current) return;
      if (baselineRef.current == null) return;

      const ids = courseIdsRef.current;
      const { rows, error } = await fetchRows(schoolId, ids);
      if (cancelled || error) return;

      if (rows.length === 0) {
        setConflict("deleted");
        return;
      }

      const next = fingerprint(rows);
      if (next !== baselineRef.current) {
        setConflict("changed");
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, schoolId, courseIdsKey]);

  return { conflict, resetBaseline };
}
