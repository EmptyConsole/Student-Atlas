import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type School = {
  id: string;
  name: string;
  city: string;
  state: string;
};

/**
 * Loads every school from Supabase so the profile page can offer a searchable
 * picker. Selecting a school scopes the rest of the app (courses, departments,
 * prerequisites) to that school's `id`.
 */
export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSchools() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: schoolError } = await supabase
          .from("schools")
          .select("id, name, city, state")
          .order("name", { ascending: true });

        if (schoolError) throw schoolError;

        if (isMounted) {
          setSchools(data ?? []);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "Failed to fetch schools";
          setError(message);
          setSchools([]);
          console.error("Error fetching schools:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchSchools();

    return () => {
      isMounted = false;
    };
  }, []);

  return { schools, loading, error };
}
