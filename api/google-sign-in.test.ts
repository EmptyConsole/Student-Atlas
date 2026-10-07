import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.VITE_GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";

/** What the mocked Google verifier returns; `null` makes verification throw. */
const google = vi.hoisted(() => ({ payload: null as Record<string, unknown> | null }));
/** Rows the mocked Supabase hands back per table. */
const db = vi.hoisted(() => ({
  students: [] as { id: string; school_id: string | null }[],
  school: null as { google_domains: string[] } | null,
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken({ audience }: { audience: string }) {
      if (!google.payload || audience !== process.env.VITE_GOOGLE_CLIENT_ID) {
        return Promise.reject(new Error("Invalid token"));
      }
      return Promise.resolve({ getPayload: () => google.payload });
    }
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (table: string) => tableBuilder(table) }),
}));

/** Minimal stand-in for a PostgREST query builder: chainable and thenable. */
function tableBuilder(table: string) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    ilike: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve({ data: db.school, error: null }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({
        data: table === "students" ? db.students : null,
        error: null,
      }).then(resolve, reject),
  };
  return builder;
}

const { POST } = await import("./google-sign-in");

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/google-sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function decode(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
}

beforeEach(() => {
  google.payload = {
    email: "Ada@MySchool.org",
    email_verified: true,
    hd: "myschool.org",
    name: "Ada Lovelace",
  };
  db.students = [{ id: "student-1", school_id: SCHOOL_ID }];
  db.school = { google_domains: ["myschool.org"] };
});

describe("token checks", () => {
  it("rejects a token Google does not verify", async () => {
    google.payload = null;
    const res = await post({ credential: "jwt", purpose: "login" });
    expect(res.status).toBe(401);
  });

  it("rejects a personal account with no hosted domain", async () => {
    google.payload = { email: "ada@gmail.com", email_verified: true };
    const res = await post({ credential: "jwt", purpose: "login" });
    expect(res.status).toBe(403);
  });

  it("rejects an unverified email", async () => {
    google.payload = { ...google.payload, email_verified: false };
    const res = await post({ credential: "jwt", purpose: "login" });
    expect(res.status).toBe(403);
  });

  it("rejects a domain the school has not allowed", async () => {
    google.payload = { ...google.payload, hd: "otherschool.org" };
    const res = await post({ credential: "jwt", purpose: "signup", schoolId: SCHOOL_ID });
    expect(res.status).toBe(403);
  });

  it("rejects every account when the school has Google turned off", async () => {
    db.school = { google_domains: [] };
    const res = await post({ credential: "jwt", purpose: "login" });
    expect(res.status).toBe(403);
  });
});

describe("login", () => {
  it("returns 404 for an email without an account", async () => {
    db.students = [];
    const res = await post({ credential: "jwt", purpose: "login" });
    expect(res.status).toBe(404);
  });

  it("issues a session for the matching student", async () => {
    const res = await post({ credential: "jwt", purpose: "login" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; email: string };
    expect(body.email).toBe("ada@myschool.org");
    expect(decode(body.token)).toMatchObject({ typ: "session", stu: "student-1" });
  });
});

describe("signup", () => {
  it("requires a school", async () => {
    const res = await post({ credential: "jwt", purpose: "signup" });
    expect(res.status).toBe(400);
  });

  it("issues a signup proof plus the Google name", async () => {
    const res = await post({ credential: "jwt", purpose: "signup", schoolId: SCHOOL_ID });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proof: string; email: string; name: string };
    expect(body.name).toBe("Ada Lovelace");
    expect(decode(body.proof)).toMatchObject({
      typ: "proof",
      purpose: "signup",
      email: "ada@myschool.org",
    });
  });
});
