import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { buildSubjects, type Subject } from "../data/subjects";

/**
 * Loads the school's departments from Supabase and turns them into the app's
 * Subject list (section headers + sidebar tabs). Editing the `departments` table
 * in Supabase is reflected here on the next load; colors are assigned by order
 * and loop once there are more departments than palette entries.
 */
export function useSubjects(schoolId: string | null) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!schoolId) {
      setSubjects([]);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchSubjects(schoolId: string) {
      try {
        setLoading(true);
        setError(null);

        // Order by creation time so the section/tab order is stable and matches
        // the order departments were added in Supabase.
        const { data: departments, error: deptError } = await supabase
          .from("departments")
          .select("name, graduation_requirement, subtitle, created_at")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: true })
          .order("name", { ascending: true });

        if (deptError) throw deptError;

        const inputs = (departments ?? []).map((d) => ({
          name: d.name,
          graduationRequirement: d.graduation_requirement,
          subtitle: d.subtitle,
        }));

        if (isMounted) {
          setSubjects(buildSubjects(inputs));
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "Failed to fetch departments";
          setError(message);
          setSubjects([]);
          console.error("Error fetching departments:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchSubjects(schoolId);

    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  return { subjects, loading, error };
}
