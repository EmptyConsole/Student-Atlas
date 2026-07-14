import { createHash, randomInt } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const FROM_ADDRESS = "Student Atlas <noreply@emptyconsole.com>";
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

export type EmailVerificationPurpose = "signup" | "login" | "email_change";

const PURPOSE_SET = new Set<EmailVerificationPurpose>([
  "signup",
  "login",
  "email_change",
]);

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  // Practical check — not a full RFC parser.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isPurpose(value: unknown): value is EmailVerificationPurpose {
  return typeof value === "string" && PURPOSE_SET.has(value as EmailVerificationPurpose);
}

function otpPepper(): string {
  return process.env.EMAIL_OTP_PEPPER || process.env.RESEND_API_KEY || "email-otp-pepper";
}

export function hashCode(code: string, email: string, purpose: string): string {
  return createHash("sha256")
    .update(`${otpPepper()}:${purpose}:${email}:${code}`)
    .digest("hex");
}

export function generateSixDigitCode(): string {
  return String(randomInt(100000, 1000000));
}

export function createServiceClient(): SupabaseClient | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Lists which server env vars are missing for the OTP APIs. */
export function missingEmailVerificationEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  return missing;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildVerificationEmailHtml(code: string, purpose: EmailVerificationPurpose): string {
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

export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: EmailVerificationPurpose,
): Promise<{ error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { error: "Server is missing required environment variables" };

  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Your Student Atlas verification code",
    html: buildVerificationEmailHtml(code, purpose),
  });

  if (error) {
    console.error("Resend error:", error);
    return { error: "Failed to send email" };
  }
  return {};
}
