/**
 * Persist elective-sort results via the apply_elective_assignments RPC.
 */

import type { Json } from "../types/database";
import type { ElectiveSortResult } from "../utils/electiveSort";
import type { ElectiveClient } from "./loadElectiveData";

export type ApplyResult = { error?: string };

async function resolveClient(client?: ElectiveClient): Promise<ElectiveClient> {
  if (client) return client;
  const { supabase } = await import("./supabase");
  return supabase;
}

/**
 * Serialize algorithm output and write it atomically for one school.
 * The RPC validates that every id belongs to the school, then clears and
 * rewrites rosters + times_taken in a single transaction.
 */
export async function applyElectiveAssignments(
  schoolId: string,
  result: ElectiveSortResult,
  client?: ElectiveClient,
): Promise<ApplyResult> {
  const db = await resolveClient(client);

  const rosters: Json = Object.entries(result.rosters).map(
    ([course_id, students]) => ({
      course_id,
      students,
    }),
  );

  const times: Json = Object.entries(result.timesTaken).map(
    ([student_id, times_taken]) => ({
      student_id,
      times_taken,
    }),
  );

  const { error } = await db.rpc("apply_elective_assignments", {
    p_school_id: schoolId,
    p_rosters: rosters,
    p_times: times,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}
