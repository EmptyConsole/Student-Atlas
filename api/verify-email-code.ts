// Vercel serverless function: verify a 6-digit email verification code.

import {
  createServiceClient,
  hashCode,
  isPurpose,
  isValidEmail,
  json,
  MAX_ATTEMPTS,
  normalizeEmail,
  type EmailVerificationPurpose,
} from "../server/emailVerification";

type Payload = {
  email?: string;
  purpose?: string;
  code?: string;
};

export async function POST(request: Request): Promise<Response> {
  const supabase = createServiceClient();
  if (!supabase) {
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

  const code = (payload.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return json({ error: "Enter the 6-digit code from your email." }, 400);
  }

  const { data: rows, error: lookupError } = await supabase
    .from("email_verification_codes")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (lookupError) {
    console.error("verify lookup error:", lookupError);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }

  const row = rows?.[0];
  if (!row) {
    return json({ error: "No verification code found. Request a new one." }, 404);
  }

  if (new Date(row.expires_at as string).getTime() <= Date.now()) {
    await supabase
      .from("email_verification_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return json({ error: "That code has expired. Request a new one." }, 410);
  }

  if ((row.attempts as number) >= MAX_ATTEMPTS) {
    await supabase
      .from("email_verification_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return json({ error: "Too many attempts. Request a new code." }, 429);
  }

  const expectedHash = hashCode(code, email, purpose);
  if (expectedHash !== (row.code_hash as string)) {
    const nextAttempts = (row.attempts as number) + 1;
    await supabase
      .from("email_verification_codes")
      .update({
        attempts: nextAttempts,
        ...(nextAttempts >= MAX_ATTEMPTS
          ? { consumed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", row.id);

    if (nextAttempts >= MAX_ATTEMPTS) {
      return json({ error: "Too many attempts. Request a new code." }, 429);
    }
    return json({ error: "Incorrect code. Please try again." }, 400);
  }

  const { error: consumeError } = await supabase
    .from("email_verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  if (consumeError) {
    console.error("consume code error:", consumeError);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }

  return json({ ok: true }, 200);
}
