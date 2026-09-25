// Vercel serverless function: verify a 6-digit email verification code.
// Self-contained (no imports outside api/) so Vercel's function bundler includes everything.
//
// A correct code is the only way to get student credentials for /api/student:
//   login        -> a student session for the account with that email
//   signup       -> a short-lived email proof for `createStudent`
//   email_change -> a short-lived email proof for the new address (requires
//                   the student's current session)

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PROOF_TTL_MS = 10 * 60 * 1000;

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

// ---------------------------------------------------------------------------
// Student tokens (kept in sync with api/student.ts)
// ---------------------------------------------------------------------------

function sessionSecret(): string {
  return (
    process.env.STUDENT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signPayload(payload: Record<string, unknown>): string {
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(
    createHmac("sha256", sessionSecret()).update(`student.${body}`).digest(),
  );
  return `${body}.${signature}`;
}

function studentIdFromSession(token: string): string | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = base64url(
    createHmac("sha256", sessionSecret()).update(`student.${body}`).digest(),
  );
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      typ?: unknown;
      stu?: unknown;
      exp?: unknown;
    };
    if (parsed.typ !== "session" || typeof parsed.stu !== "string") return null;
    if (typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null;
    return parsed.stu;
  } catch {
    return null;
  }
}

/** Escapes `%`, `_`, and `\` so an email can be matched exactly with ILIKE. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
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

  // Checked before the code is consumed so an expired session doesn't burn it.
  if (purpose === "email_change") {
    const header = request.headers.get("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (!token || !studentIdFromSession(token)) {
      return json({ error: "Your session expired. Log in again." }, 401);
    }
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

  if (purpose === "login") {
    const { data: students, error: studentError } = await supabase
      .from("students")
      .select("id")
      .ilike("email", escapeLike(email))
      .limit(1);
    if (studentError) {
      console.error("login lookup error:", studentError);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
    const studentId = students?.[0]?.id as string | undefined;
    if (!studentId) {
      return json({ error: "No account found with that email." }, 404);
    }
    const expiresAt = Date.now() + SESSION_TTL_MS;
    return json(
      {
        ok: true,
        token: signPayload({ typ: "session", stu: studentId, exp: expiresAt }),
        expiresAt,
      },
      200,
    );
  }

  const proof = signPayload({
    typ: "proof",
    purpose,
    email,
    exp: Date.now() + PROOF_TTL_MS,
  });
  return json({ ok: true, proof }, 200);
}
