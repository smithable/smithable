import { expect, test } from "vitest";

// The kit's access.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/access.ts";
type Viewer = { id: string; name: string; email: string; role: string };
type Rule = { public: boolean; roles: string[]; owner: boolean; where?: Record<string, string> };
const kit = (await import(path)) as {
  readScope(rule: Rule, viewer: Viewer | null): "all" | "own" | "public" | "none";
};

const key: Viewer = { id: "key:k1", name: "Monitor", email: "", role: "staff" };
const person: Viewer = { id: "u1", name: "Maja", email: "maja@example.com", role: "staff" };

test("a key reads by its role, else what is public, else nothing: never as an owner (T809)", () => {
  // A private kind its role does not read: refused (the data functions answer 403).
  expect(kit.readScope({ public: false, roles: ["admin"], owner: true }, key)).toBe("none");
  // Public where a condition holds: the public records.
  expect(
    kit.readScope(
      { public: true, roles: ["admin"], owner: true, where: { status: "published" } },
      key,
    ),
  ).toBe("public");
  // A kind its role reads: all of it.
  expect(kit.readScope({ public: false, roles: ["staff"], owner: true }, key)).toBe("all");
  // A person of the same role still reads their own.
  expect(kit.readScope({ public: false, roles: ["admin"], owner: true }, person)).toBe("own");
});
