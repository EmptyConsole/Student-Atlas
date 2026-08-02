/**
 * CLI entry point for testsort (in-memory only, no DB writes).
 *
 * Usage:
 *   npm run testsort -- "The Nueva School"
 *   npm run testsort -- <school-uuid>
 *   npm run testsort -- "The Nueva School" --seed 42
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/types/database.ts";
import { testsort } from "../src/lib/testSort.ts";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local",
  );
  process.exit(1);
}

const client = createClient<Database>(supabaseUrl, supabaseKey);

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let seed: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--seed") {
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

  return { query: positional[0], seed };
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
  const { query, seed } = parseArgs(process.argv.slice(2));
  if (!query) {
    console.error(
      'Usage: npm run testsort -- "<school name or uuid>" [--seed N]',
    );
    process.exit(1);
  }

  const schoolId = await resolveSchoolId(query);
  console.log("Running testsort (reads Supabase, writes nothing)...");

  const outcome = await testsort(schoolId, { client, seed });
  if (outcome.error || !outcome.report) {
    console.error("testsort failed:", outcome.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
