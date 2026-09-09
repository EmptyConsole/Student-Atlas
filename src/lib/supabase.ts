import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey
);

/* Schema, RLS, and RPCs: see SUPABASE.md and scripts/supabase-schema.sql. */