import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEFAULT_REQUIRED_RANKINGS } from "../utils/courseRanking";

/**
 * Loads how many ranked courses a student must submit per term for their school.
 * Mirrors `schools.rankings` in Supabase.
 */
export function useSchoolRankings(schoolId: string | null) {
  const [requiredRankings, setRequiredRankings] = useState(DEFAULT_REQUIRED_RANKINGS);
  const [loading, setLoading] = useState(Boolean(schoolId));

  useEffect(() => {
    let isMounted = true;

    if (!schoolId) {
      setRequiredRankings(DEFAULT_REQUIRED_RANKINGS);
      setLoading(false);
      return;
    }

    async function fetchRankings() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("schools")
          .select("rankings")
          .eq("id", schoolId)
          .single();

        if (error) throw error;

        if (isMounted) {
          const count = data?.rankings;
          setRequiredRankings(
            typeof count === "number" && count > 0
              ? count
              : DEFAULT_REQUIRED_RANKINGS,
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

    void fetchRankings();

    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  return { requiredRankings, loading };
}
