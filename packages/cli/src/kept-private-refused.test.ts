// When closing kinds of record is refused (T791): the last try closes everything, and should even
// that be refused, the records stay public with an assumption that says so, never quietly.

import { expect, test, vi } from "vitest";

const refuse = vi.hoisted(() => ({
  when: (_steps: { op: string; args: unknown }[]): boolean => false,
}));

vi.mock("@smithable/core", async (original) => {
  const core = await original<typeof import("@smithable/core")>();
  return {
    ...core,
    applyOperations: (
      files: Parameters<typeof core.applyOperations>[0],
      steps: Parameters<typeof core.applyOperations>[1],
    ) =>
      refuse.when(steps)
        ? { ok: false as const, message: "refused for the test", diagnostics: [] }
        : core.applyOperations(files, steps),
  };
});

const { validateAuth, validateSpec } = await import("@smithable/core");
const { keptPrivate } = await import("./new.js");
const { STARTERS } = await import("./starters.gen.js");

const nobody = "A tool library where neighbors lend each other tools.";
const marketplace = STARTERS.marketplace as Record<string, string>;
const publicOf = (files: Record<string, string>) => {
  const ir = validateSpec({ path: "smithable.yml", text: files["smithable.yml"] ?? "" }).ir;
  const auth = ir
    ? validateAuth({ path: "smithable.auth.yml", text: files["smithable.auth.yml"] ?? "" }, ir).auth
    : undefined;
  return { pages: auth?.public.pages ?? [], read: auth?.public.read ?? [] };
};

test("a refused step, then refused untouched pages: everything is closed", () => {
  // Every try that keeps a page open is refused; only the last, closing all, goes through.
  refuse.when = (steps) =>
    !steps.some((s) => s.op === "setPublic" && (s.args as { pages: string[] }).pages.length === 0);
  const kept = keptPrivate(marketplace, nobody, marketplace);
  expect(publicOf(kept.files)).toEqual({ pages: [], read: [] });
  expect(kept.assumption?.chosen).toMatch(/kept private/);
});

test("when even closing everything is refused, the records stay public and it is said", () => {
  refuse.when = () => true;
  const kept = keptPrivate(marketplace, nobody, marketplace);
  expect(publicOf(kept.files).read).toEqual(["Item"]);
  expect(kept.assumption?.chosen).toMatch(
    /^Anyone can read the Item records without signing in: they could not be closed/,
  );
  expect(kept.assumption?.options).toEqual(["Keep them private"]);
});
