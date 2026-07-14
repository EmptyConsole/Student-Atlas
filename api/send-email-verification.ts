// Vercel serverless function: send a 6-digit email verification code via Resend.
// Used for signup, login, and email-change flows.

import {
  CODE_TTL_MS,
  createServiceClient,
  generateSixDigitCode,
  hashCode,
  isPurpose,
  isValidEmail,
  json,
  normalizeEmail,
  sendVerificationEmail,
  type EmailVerificationPurpose,
} from "../server/emailVerification";

type Payload = {
  email?: string;
  purpose?: string;
};

export async function POST(request: Request): Promise<Response> {
  const supabase = createServiceClient();
  if (!supabase || !process.env.RESEND_API_KEY) {
    return json({ error: "Server is missing required environment variables" }, 500);
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!isPurpose(payload.purpose)) {
    return json({ error: "Invalid purpose" }, 400);
  }
  const purpose: EmailVerificationPurpose = payload.purpose;

  const email = normalizeEmail(payload.email ?? "");
  if (!email || !isValidEmail(email)) {
    return json({ error: "Please enter a valid email." }, 400);
  }

  if (purpose === "login") {
    const { data: existing, error } = await supabase
      .from("students")
      .select("id")
      .ilike("email", email)
      .limit(1);

    if (error) {
      console.error("students lookup error:", error);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
    if (!existing || existing.length === 0) {
      return json({ error: "No account found with that email." }, 404);
    }
  }

  if (purpose === "email_change") {
    const { data: taken, error } = await supabase
      .from("students")
      .select("id")
      .ilike("email", email)
      .limit(1);

    if (error) {
      console.error("students lookup error:", error);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
    if (taken && taken.length > 0) {
      return json({ error: "That email is already in use." }, 409);
    }
  }

  const code = generateSixDigitCode();
  const codeHash = hashCode(code, email, purpose);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // Invalidate any previous unused codes for this email + purpose.
  const { error: invalidateError } = await supabase
    .from("email_verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  if (invalidateError) {
    console.error("invalidate codes error:", invalidateError);
    return json({ error: "Failed to create verification code" }, 500);
  }

  const { error: insertError } = await supabase.from("email_verification_codes").insert({
    email,
    purpose,
    code_hash: codeHash,
    attempts: 0,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("insert code error:", insertError);
    return json({ error: "Failed to create verification code" }, 500);
  }

  const sendResult = await sendVerificationEmail(email, code, purpose);
  if (sendResult.error) {
    return json({ error: sendResult.error }, 502);
  }

  return json({ ok: true }, 200);
}
