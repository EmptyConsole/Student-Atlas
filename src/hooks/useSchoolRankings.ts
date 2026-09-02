import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEFAULT_REQUIRED_RANKINGS } from "../utils/courseRanking";
import { parseGradeSettings, rankingsForGrade } from "../utils/gradeSettings";

/**
 * Loads how many ranked courses a student must submit per term for their
 * school and grade. Reads the per-grade counts in `schools.grade`, falling back
 * to the school-wide `schools.rankings` when the grade has no entry.
 */
export function useSchoolRankings(
  schoolId: string | null,
  grade: number | null,
  reloadKey?: number,
) {
  const [requiredRankings, setRequiredRankings] = useState(DEFAULT_REQUIRED_RANKINGS);
  const [loading, setLoading] = useState(Boolean(schoolId));

  useEffect(() => {
    let isMounted = true;

    if (!schoolId) {
      setRequiredRankings(DEFAULT_REQUIRED_RANKINGS);
      setLoading(false);
      return;
    }

    async function fetchRankings(schoolId: string) {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("schools")
          .select("rankings, grade")
          .eq("id", schoolId)
          .single();

        if (error) throw error;

        if (isMounted) {
          const count = data?.rankings;
          const schoolWide =
            typeof count === "number" && count > 0
              ? count
              : DEFAULT_REQUIRED_RANKINGS;
          setRequiredRankings(
            rankingsForGrade(parseGradeSettings(data?.grade), grade, schoolWide),
          );
        }
      } catch (err) {
        console.error("Error fetching school rankings:", err);
        if (isMounted) {
          setRequiredRankings(DEFAULT_REQUIRED_RANKINGS);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchRankings(schoolId);

    return () => {
      isMounted = false;
    };
  }, [schoolId, grade, reloadKey]);

  return { requiredRankings, loading };
}
