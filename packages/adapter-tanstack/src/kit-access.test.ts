import { expect, test } from "vitest";

// The kit's access.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/access.ts";
type Viewer = { id: string; name: string; email: string; role: string; system?: boolean };
type Rule = { public: boolean; roles: string[]; owner: boolean; where?: Record<string, string> };
const kit = (await import(path)) as {
  allows(rule: Rule, viewer: Viewer | null, ownerId?: string | null): boolean;
};

const member: Viewer = { id: "u1", name: "Maja", email: "maja@example.com", role: "member" };
const key: Viewer = { id: "key:k1", name: "Key", email: "", role: "member" };

test("a rule public only where a condition holds lets no visitor in by itself (T803)", () => {
  const published: Rule = { public: true, roles: [], owner: true, where: { status: "published" } };
  expect(kit.allows(published, null)).toBe(false);
  expect(kit.allows({ ...published, where: undefined }, null)).toBe(true);
  // The record's owner still reads their own, conditional or not.
  expect(kit.allows(published, member, "u1")).toBe(true);
});

test("a key is never a record's owner (T803)", () => {
  const own: Rule = { public: false, roles: [], owner: true };
  expect(kit.allows(own, key, "key:k1")).toBe(false);
  expect(kit.allows(own, member, "u1")).toBe(true);
});
