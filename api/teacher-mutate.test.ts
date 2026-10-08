import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeDomains, POST } from "./teacher-mutate";

const SECRET = "teacher-secret";
const SCHOOL = "11111111-1111-4111-8111-111111111111";
process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.TEACHER_SESSION_SECRET = SECRET;

/** Every table write, as `<verb> <table>`. */
const writes = vi.hoisted(() => [] as string[]);
/** Passwords handed to verify_school_password. */
const checked = vi.hoisted(() => [] as string[]);

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      if (fn === "verify_school_password") {
        checked.push(String(args.p_password));
        return Promise.resolve({ data: args.p_password === "right", error: null });
      }
      writes.push(`rpc ${fn}`);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      let verb = "select";
      const builder = {
        select: () => builder,
        update: () => ((verb = "update"), builder),
        insert: () => ((verb = "insert"), builder),
        delete: () => ((verb = "delete"), builder),
        eq: () => builder,
        in: () => builder,
        maybeSingle: () => Promise.resolve({ data: { name: "Science" }, error: null }),
        single: () => Promise.resolve({ data: { id: "x" }, error: null }),
        then: (resolve: (value: unknown) => unknown) => {
          if (verb !== "select") writes.push(`${verb} ${table}`);
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return builder;
    },
  }),
}));

function teacherToken(): string {
  const body = Buffer.from(JSON.stringify({ sid: SCHOOL, exp: Date.now() + 60_000 })).toString(
    "base64url",
  );
  const signature = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/teacher-mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${teacherToken()}` },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  writes.length = 0;
  checked.length = 0;
});

describe("edit confirmation password", () => {
  const school = { name: "Riverside", password: "new-password" };
  const department = { name: "Science" };

  it("refuses a school edit with the wrong current password and writes nothing", async () => {
    const res = await post({ action: "updateSchool", school, terms: [], password: "wrong" });
    expect(res.status).toBe(403);
    expect(checked).toEqual(["wrong"]);
    expect(writes).toEqual([]);
  });

  it("checks the old password, not the new one, when the password changes", async () => {
    const res = await post({ action: "updateSchool", school, terms: [], password: "right" });
    expect(res.status).toBe(200);
    expect(checked).toEqual(["right"]);
    expect(writes).toContain("rpc set_school_password");
  });

  it("refuses a school edit with no password", async () => {
    const res = await post({ action: "updateSchool", school, terms: [] });
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("refuses a department edit with the wrong password and writes nothing", async () => {
    const res = await post({
      action: "updateDepartment",
      departmentId: "d1",
      department,
      password: "wrong",
    });
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("saves a department edit with the right password", async () => {
    const res = await post({
      action: "updateDepartment",
      departmentId: "d1",
      department,
      password: "right",
    });
    expect(res.status).toBe(200);
    expect(writes).toContain("update departments");
  });
});

describe("normalizeDomains", () => {
  it("lowercases, strips a leading @, and drops blanks and duplicates", () => {
    expect(normalizeDomains([" MySchool.org ", "@myschool.org", "", "students.myschool.org"])).toEqual({
      domains: ["myschool.org", "students.myschool.org"],
    });
  });

  it("allows an empty list, which turns Google sign-in off", () => {
    expect(normalizeDomains([])).toEqual({ domains: [] });
  });

  it("rejects something that is not a domain", () => {
    expect(normalizeDomains(["myschool"])).toEqual({
      error: '"myschool" is not a valid domain.',
    });
    expect(normalizeDomains(["ada@myschool.org"])).toHaveProperty("error");
  });

  it("rejects a non-list and more than 10 domains", () => {
    expect(normalizeDomains("myschool.org")).toHaveProperty("error");
    const many = Array.from({ length: 11 }, (_, i) => `school${i}.org`);
    expect(normalizeDomains(many)).toHaveProperty("error");
  });
});
