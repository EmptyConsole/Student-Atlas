import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type School = {
  id: string;
  name: string;
  city: string;
  state: string;
  /** Google Workspace domains allowed for student Google sign-in. */
  googleDomains: string[];
};

type SchoolRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  google_domains?: string[] | null;
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

        const withDomains = await supabase
          .from("schools")
          .select("id, name, city, state, google_domains")
          .order("name", { ascending: true });
        // Databases without scripts/school-google-domains.sql lack the column;
        // keep the picker working and leave Google sign-in off.
        const result = withDomains.error
          ? await supabase
              .from("schools")
              .select("id, name, city, state")
              .order("name", { ascending: true })
          : withDomains;

        if (result.error) throw result.error;

        if (isMounted) {
          setSchools(
            ((result.data ?? []) as SchoolRow[]).map((row) => ({
              id: row.id,
              name: row.name,
              city: row.city,
              state: row.state,
              googleDomains: row.google_domains ?? [],
            })),
          );
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
