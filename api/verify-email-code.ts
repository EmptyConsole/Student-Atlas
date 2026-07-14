// Vercel serverless function: verify a 6-digit email verification code.
// Self-contained (no imports outside api/) so Vercel's function bundler includes everything.

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 5;

type EmailVerificationPurpose = "signup" | "login" | "email_change";

type Payload = {
  email?: string;
  purpose?: string;
  code?: string;
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isPurpose(value: unknown): value is EmailVerificationPurpose {
  return value === "signup" || value === "login" || value === "email_change";
}

function hashCode(code: string, email: string, purpose: string): string {
  const pepper =
    process.env.EMAIL_OTP_PEPPER || process.env.RESEND_API_KEY || "email-otp-pepper";
  return createHash("sha256")
    .update(`${pepper}:${purpose}:${email}:${code}`)
    .digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  const missing: string[] = [];
  if (!process.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    return json(
      { error: `Server is missing required environment variables: ${missing.join(", ")}` },
      500,
    );
  }

  const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!isPurpose(payload.purpose)) {
    return json({ error: "Invalid purpose" }, 400);
  }
  const purpose = payload.purpose;

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
