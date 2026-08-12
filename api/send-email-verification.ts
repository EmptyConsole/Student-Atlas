// Vercel serverless function: send a 6-digit email verification code via Resend.
// Imports stay under api/ so Vercel's function bundler includes everything.

import { createHash, randomInt } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendOrSkip, type SkippedEmailKind } from "./resend-helpers";

const CODE_TTL_MS = 10 * 60 * 1000;

type EmailVerificationPurpose = "signup" | "login" | "email_change";

type Payload = {
  email?: string;
  purpose?: string;
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

function missingEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  return missing;
}

function hashCode(code: string, email: string, purpose: string): string {
  const pepper =
    process.env.EMAIL_OTP_PEPPER || process.env.RESEND_API_KEY || "email-otp-pepper";
  return createHash("sha256")
    .update(`${pepper}:${purpose}:${email}:${code}`)
    .digest("hex");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailHtml(code: string, purpose: EmailVerificationPurpose): string {
  const action =
    purpose === "signup"
      ? "creating your Student Atlas account"
      : purpose === "login"
        ? "signing into your Student Atlas account"
        : "updating your Student Atlas email";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#faf9f6;">
      <div style="background:#ffffff;border:1px solid #d7e3fc;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#1f2937;">Verify your email</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
          Use this code for ${escapeHtml(action)}. It expires in 10 minutes.
        </p>
        <p style="margin:0;font-size:32px;letter-spacing:0.35em;font-weight:700;color:#4169e1;text-align:center;">
          ${escapeHtml(code)}
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
          If you didn't request this, you can ignore this email.
        </p>
      </div>
    </div>`;
}

export async function POST(request: Request): Promise<Response> {
  const missing = missingEnv();
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

  const code = String(randomInt(100000, 1000000));
  const codeHash = hashCode(code, email, purpose);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: invalidateError } = await supabase
    .from("email_verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  if (invalidateError) {
    console.error("invalidate codes error:", invalidateError);
    return json(
      {
        error:
          "Failed to create verification code. Confirm email_verification_codes exists (run scripts/email-verification-codes.sql).",
      },
      500,
    );
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
    return json(
      {
        error:
          "Failed to create verification code. Confirm email_verification_codes exists (run scripts/email-verification-codes.sql).",
      },
      500,
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const kind: SkippedEmailKind = `otp_${purpose}`;
  const { skipped } = await sendOrSkip({
    resend,
    supabase,
    to: email,
    subject: "Your Student Atlas verification code",
    html: buildEmailHtml(code, purpose),
    kind,
  });

  if (skipped) {
    // No orphan OTP — consume the row we just inserted so verify cannot succeed.
    const { error: consumeError } = await supabase
      .from("email_verification_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", email)
      .eq("purpose", purpose)
      .eq("code_hash", codeHash)
      .is("consumed_at", null);
    if (consumeError) {
      console.error("Failed to consume OTP after Resend skip:", consumeError);
    }
    return json({ ok: true, skipped: true }, 200);
  }

  return json({ ok: true }, 200);
}
