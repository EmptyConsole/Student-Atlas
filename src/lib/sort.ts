/**
 * Orchestrates elective assignment for a school: load → run → apply.
 */

import { applyElectiveAssignments } from "./applyElectiveAssignments";
import {
  loadElectiveData,
  type ElectiveClient,
} from "./loadElectiveData";
import {
  runElectiveSort,
  type ElectiveSortResult,
} from "../utils/electiveSort";

export type SortOptions = {
  /** Optional RNG seed for reproducible runs. */
  seed?: number;
  /** Injectable Supabase client (CLI / tests). */
  client?: ElectiveClient;
  /**
   * When true, compute assignments but do not write to the database.
   * Useful for dry-runs from the CLI.
   */
  dryRun?: boolean;
};

export type SortResult =
  | { result: ElectiveSortResult; error?: undefined }
  | { result?: undefined; error: string };

/*
 * ---------------------------------------------------------------------------
 * LEGACY sort (commented out — unused)
 * Previously: load → greedy grade→term→round runElectiveSort → apply.
 * The new entry point below uses the round-fair DA engine instead.
 * ---------------------------------------------------------------------------
 *
 * export async function sortLegacy(
 *   schoolId: string,
 *   options: SortOptions = {},
 * ): Promise<SortResult> {
 *   const loaded = await loadElectiveData(schoolId, options.client);
 *   if (loaded.error || !loaded.data) {
 *     return { error: loaded.error ?? "Failed to load elective data" };
 *   }
 *   const result = runElectiveSort(loaded.data, options.seed);
 *   if (!options.dryRun) {
 *     const applied = await applyElectiveAssignments(
 *       schoolId,
 *       result,
 *       options.client,
 *     );
 *     if (applied.error) return { error: applied.error };
 *   }
 *   return { result };
 * }
 */

/**
 * Sort students at `schoolId` into elective classes.
 * Single entry point for the CLI and a future teacher-page button.
 *
 * Uses the round-fair deferred-acceptance engine in `electiveSort.ts`.
 */
export async function sort(
  schoolId: string,
  options: SortOptions = {},
): Promise<SortResult> {
  const loaded = await loadElectiveData(schoolId, options.client);
  if (loaded.error || !loaded.data) {
    return { error: loaded.error ?? "Failed to load elective data" };
  }

  const result = runElectiveSort(loaded.data, options.seed);

  if (!options.dryRun) {
    const applied = await applyElectiveAssignments(
      schoolId,
      result,
      options.client,
    );
    if (applied.error) {
      return { error: applied.error };
    }
  }

  return { result };
}
