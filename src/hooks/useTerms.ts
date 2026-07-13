import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Term } from "../data/courses";

/**
 * Loads a school's terms (ordered by position) from the `terms` table. Terms
 * define the Register columns and the options a course can be assigned to.
 */
export function useTerms(schoolId: string | null, reloadKey?: number) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(Boolean(schoolId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!schoolId) {
      setTerms([]);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchTerms(schoolId: string) {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("terms")
          .select("id, name, position, created_at")
          .eq("school_id", schoolId)
          .order("position", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });

        if (error) throw error;

        if (isMounted) {
          setTerms(
            (data ?? []).map((row, index) => ({
              id: row.id,
              name: row.name,
              position: row.position ?? index,
            })),
          );
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to fetch terms");
          setTerms([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchTerms(schoolId);

    return () => {
      isMounted = false;
    };
  }, [schoolId, reloadKey]);

  const termById = useMemo(
    () => new Map(terms.map((term) => [term.id, term])),
    [terms],
  );

  return { terms, termById, loading, error };
}
