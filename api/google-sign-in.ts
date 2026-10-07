// Vercel serverless function: Sign in with Google for students.
// Self-contained (no imports outside api/) so Vercel's function bundler includes everything.
//
// The browser posts the ID token Google handed its button callback. A token
// that verifies and belongs to one of the school's Workspace domains is
// treated like a correct email code:
//   login  -> a student session for the account with that email
//   signup -> a short-lived email proof for `createStudent` in /api/student

import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { OAuth2Client, type TokenPayload } from "google-auth-library";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PROOF_TTL_MS = 10 * 60 * 1000;

type Purpose = "login" | "signup";

type Payload = {
  credential?: unknown;
  purpose?: unknown;
  schoolId?: unknown;
};

const googleClient = new OAuth2Client();

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isPurpose(value: unknown): value is Purpose {
  return value === "login" || value === "signup";
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Same shape check as api/verify-email-code.ts, which explains the `*` refusal. */
function isValidEmail(email: string): boolean {
  if (email.includes("*")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Escapes `%`, `_`, and `\` so an email can be matched exactly with ILIKE. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Student tokens (kept in sync with api/student.ts and api/verify-email-code.ts)
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

/** Checks signature, audience, issuer, and expiry; null when any fail. */
async function verifyGoogleToken(credential: string): Promise<TokenPayload | null> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.VITE_GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload() ?? null;
  } catch {
    return null;
  }
}

function domainsOf(row: { google_domains?: unknown } | null | undefined): string[] {
  return Array.isArray(row?.google_domains) ? (row.google_domains as string[]) : [];
}

function emailDomainMatches(hostedDomain: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return false;
  const hd = hostedDomain.toLowerCase().trim();
  return allowedDomains.some((d) => {
    const norm = d.toLowerCase().replace(/^@/, "").trim();
    return norm.length > 0 && (hd === norm || hd.endsWith("." + norm));
  });
}

export async function POST(request: Request): Promise<Response> {
  const missing: string[] = [];
  if (!process.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.VITE_GOOGLE_CLIENT_ID) missing.push("VITE_GOOGLE_CLIENT_ID");
  if (missing.length > 0) {
    return json(
      { error: `Server is missing required environment variables: ${missing.join(", ")}` },
      500,
    );
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
  const purpose = payload.purpose;
  if (typeof payload.credential !== "string" || !payload.credential) {
    return json({ error: "Google sign-in failed. Please try again." }, 400);
  }
  if (purpose === "signup" && !isUuid(payload.schoolId)) {
    return json({ error: "Select a school first." }, 400);
  }

  const google = await verifyGoogleToken(payload.credential);
  if (!google) {
    return json({ error: "Google sign-in failed. Please try again." }, 401);
  }
  if (google.email_verified !== true || typeof google.email !== "string") {
    return json({ error: "Your Google account's email isn't verified." }, 403);
  }
  if (typeof google.hd !== "string" || !google.hd) {
    return json(
      { error: "Use your school Google account, or sign in with an email code instead." },
      403,
    );
  }
  const hostedDomain = google.hd.toLowerCase();
  const email = google.email.trim().toLowerCase();
  if (!isValidEmail(email)) {
    return json({ error: "Google sign-in failed. Please try again." }, 400);
  }

  const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const notAllowed = json(
    {
      error:
        "Your school hasn't turned on Google sign-in for this account. Sign in with an email code instead.",
    },
    403,
  );

  if (purpose === "login") {
    const { data: students, error: studentError } = await supabase
      .from("students")
      .select("id, school_id")
      .ilike("email", escapeLike(email))
      .limit(1);
    if (studentError) {
      console.error("google login lookup error:", studentError);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
    const student = students?.[0] as { id: string; school_id: string | null } | undefined;
    if (!student) {
      return json({ error: "No account found with that email." }, 404);
    }
    if (!student.school_id) return notAllowed;

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("google_domains")
      .eq("id", student.school_id)
      .maybeSingle();
    if (schoolError) {
      console.error("google login school error:", schoolError);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
    if (!emailDomainMatches(hostedDomain, domainsOf(school))) return notAllowed;

    const expiresAt = Date.now() + SESSION_TTL_MS;
    return json(
      {
        ok: true,
        email,
        token: signPayload({ typ: "session", stu: student.id, exp: expiresAt }),
        expiresAt,
      },
      200,
    );
  }

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("google_domains")
    .eq("id", payload.schoolId as string)
    .maybeSingle();
  if (schoolError) {
    console.error("google signup school error:", schoolError);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
  if (!school) return json({ error: "That school no longer exists." }, 400);
  if (!emailDomainMatches(hostedDomain, domainsOf(school))) return notAllowed;

  const proof = signPayload({
    typ: "proof",
    purpose: "signup",
    email,
    exp: Date.now() + PROOF_TTL_MS,
  });
  return json({ ok: true, proof, email, name: google.name ?? "" }, 200);
}
