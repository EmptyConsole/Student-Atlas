import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("./supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { deleteDepartment } from "./teacher";

describe("deleteDepartment", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("deletes the department's courses before removing the department", async () => {
    const tables: string[] = [];
    const deleteCalls: string[] = [];

    fromMock.mockImplementation((table: string) => {
      tables.push(table);
      const builder = {
        delete: () => builder,
        select: () => builder,
        eq: async (_column: string, value: unknown) => {
          deleteCalls.push(`${table}:${String(value)}`);
          return { error: null };
        },
        in: async (_column: string, values: unknown[]) => {
          deleteCalls.push(`${table}:in:${values.join(",")}`);
          return { error: null };
        },
      };
      return builder;
    });

    const result = await deleteDepartment("dept-1");

    expect(result.error).toBeUndefined();
    expect(tables.filter((table) => table === "courses")).toHaveLength(2);
    expect(tables.at(-1)).toBe("departments");
    expect(deleteCalls.filter((call) => call.startsWith("courses"))).toContain(
      "courses:dept-1",
    );
    expect(deleteCalls.at(-1)).toBe("departments:dept-1");
  });
});
