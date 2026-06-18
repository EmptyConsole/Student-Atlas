import { supabase } from "./supabase";
import type { UserProfile } from "../hooks/useProfile";

type SubmitResult = { error?: string };

/**
 * Persists an onboarding profile to the Supabase `students` table.
 * Links the student to the first available school and rejects duplicate emails.
 */
export async function submitProfile(profile: UserProfile): Promise<SubmitResult> {
  const name = profile.name.trim();
  const email = profile.email.trim();

  if (!name || !email || profile.grade === null) {
    return { error: "Please fill in your name, email, and grade." };
  }

  try {
    const { data: schools, error: schoolError } = await supabase
      .from("schools")
      .select("id")
      .limit(1);

    if (schoolError) throw schoolError;
    if (!schools || schools.length === 0) {
      return { error: "No school is configured. Please contact support." };
    }

    const schoolId = schools[0].id;

    const { data: existing, error: existingError } = await supabase
      .from("students")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      return { error: "An account with this email already exists." };
    }

    const { error: insertError } = await supabase.from("students").insert({
      name,
      email,
      grade: profile.grade,
      school_id: schoolId,
    });

    if (insertError) throw insertError;

    return {};
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { error: message };
  }
}
