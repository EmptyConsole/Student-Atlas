/**
 * CLI entry point for elective sort.
 *
 * Usage:
 *   npm run sort -- "The Nueva School"
 *   npm run sort -- <school-uuid>
 *   npm run sort -- "The Nueva School" --dry-run
 *   npm run sort -- "The Nueva School" --seed 42
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/types/database.ts";
import { sort } from "../src/lib/sort.ts";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local");
  process.exit(1);
}

const client = createClient<Database>(supabaseUrl, supabaseKey);

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let dryRun = false;
  let seed: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--seed") {
      const next = argv[i + 1];
      if (next === undefined || Number.isNaN(Number(next))) {
        console.error("--seed requires a numeric value");
        process.exit(1);
      }
      seed = Number(next);
      i += 1;
    } else if (arg.startsWith("--")) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }

  return { query: positional[0], dryRun, seed };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveSchoolId(query: string): Promise<string> {
  if (UUID_RE.test(query)) {
    const { data, error } = await client
      .from("schools")
      .select("id, name")
      .eq("id", query)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`No school with id ${query}`);
    console.log(`Using school: ${data.name} (${data.id})`);
    return data.id;
  }

  const { data, error } = await client
    .from("schools")
    .select("id, name")
    .eq("name", query)
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(`No school named "${query}"`);
  }
  console.log(`Using school: ${data[0]!.name} (${data[0]!.id})`);
  return data[0]!.id;
}

async function main() {
  const { query, dryRun, seed } = parseArgs(process.argv.slice(2));
  if (!query) {
    console.error(
      'Usage: npm run sort -- "<school name or uuid>" [--dry-run] [--seed N]',
    );
    process.exit(1);
  }

  const schoolId = await resolveSchoolId(query);
  console.log(
    dryRun
      ? "Running dry-run (no DB writes)..."
      : "Running sort and applying assignments...",
  );

  const outcome = await sort(schoolId, { client, dryRun, seed });
  if (outcome.error || !outcome.result) {
    console.error("Sort failed:", outcome.error);
    process.exit(1);
  }

  const { result } = outcome;
  const rosterCourses = Object.keys(result.rosters).length;
  const studentsWithTimes = Object.keys(result.timesTaken).length;
  const totalSeats = result.classFills.reduce((sum, f) => sum + f.count, 0);

  console.log(`Seed: ${result.seed}`);
  console.log(`Courses with rosters: ${rosterCourses}`);
  console.log(`Students with times_taken: ${studentsWithTimes}`);
  console.log(`Total seat assignments: ${totalSeats}`);
  console.log(`Shortfalls: ${result.shortfalls.length}`);

  if (result.shortfalls.length > 0) {
    const sample = result.shortfalls.slice(0, 10);
    console.log("Sample shortfalls (up to 10):");
    for (const s of sample) {
      console.log(
        `  student=${s.studentId} term=${s.termId} grade=${s.grade} assigned=${s.assigned}/${s.required}`,
      );
    }
  }

  if (dryRun) {
    console.log("Dry-run complete; database unchanged.");
  } else {
    console.log("Assignments applied.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
