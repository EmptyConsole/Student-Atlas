import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { gradesFromSettings, parseGradeSettings } from "../utils/gradeSettings";

/**
 * Loads the grade levels configured for a school (`schools.grade` keys).
 * Returns an empty list when the school has no per-grade settings yet.
 */
export function useSchoolGrades(schoolId: string | null, reloadKey?: number) {
  const [grades, setGrades] = useState<number[]>([]);
  const [loading, setLoading] = useState(Boolean(schoolId));

  useEffect(() => {
    let isMounted = true;

    if (!schoolId) {
      setGrades([]);
      setLoading(false);
      return;
    }

    async function fetchGrades(schoolId: string) {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("schools")
          .select("grade")
          .eq("id", schoolId)
          .single();

        if (error) throw error;

        if (isMounted) {
          setGrades(gradesFromSettings(parseGradeSettings(data?.grade)));
        }
      } catch (err) {
        console.error("Error fetching school grades:", err);
        if (isMounted) {
          setGrades([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchGrades(schoolId);

    return () => {
      isMounted = false;
    };
  }, [schoolId, reloadKey]);

  return { grades, loading };
}
