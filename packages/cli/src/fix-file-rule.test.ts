import { expect, test } from "vitest";
import { type Advisory, inRange } from "./advisories.js";
import {
  commentsOnly,
  declaredReason,
  fixFileRule,
  harmlessStep,
  pinBumps,
  type RuleInput,
  STACK_FILE,
} from "./fix-file-rule.js";

const bumpDiff = (from: string, to: string) => `--- a/${STACK_FILE}
+++ b/${STACK_FILE}
@@ -10 +10 @@ export const STACK_PROFILE = {
-    "better-auth": "${from}",
+    "better-auth": "${to}",
@@ -23 +23 @@
-    srvx: "1.0.7",
+    srvx: "1.0.8",
`;
const KIT = "packages/adapter-tanstack/templates/src/kit/Upload.tsx";
const kitBefore = "export const limit = 10;\n";
const kitAfter = "export const limit = 20;\n";
const advisory = (range: string, patched: string): Advisory => ({
  id: "GHSA-test",
  severity: "high",
  summary: "a hole",
  repository: "better-auth/better-auth",
  affects: [{ name: "better-auth", range, patched }],
});
const input = (over: Partial<RuleInput>): RuleInput => ({
  engine: [STACK_FILE],
  fixes: [],
  diffOf: () => bumpDiff("1.7.13", "1.7.15"),
  filesOf: () => ({ before: kitBefore, after: kitAfter }),
  labelled: false,
  body: "",
  advisories: async () => [],
  inRange,
  ...over,
});

test("a patch bump over no published advisory passes by itself, and says why", async () => {
  const result = await fixFileRule(input({}));
  expect(result.ok).toBe(true);
  expect(result.why).toContain("better-auth 1.7.13 → 1.7.15");
});

test("a bump that leaves an advisory behind is a security fix: a fix file, not a declaration", async () => {
  const over = {
    advisories: async () => [advisory("<1.7.14", "1.7.14")],
    body: "Fix file: none, because it is only a version bump",
  };
  const result = await fixFileRule(input(over));
  expect(result.ok).toBe(false);
  expect(result.why).toContain("security fix");
  expect((await fixFileRule(input({ ...over, fixes: ["fixes/auth.yml"] }))).ok).toBe(true);
});

test("advisories that could not be read pass nothing by themselves", async () => {
  expect((await fixFileRule(input({ advisories: async () => undefined }))).ok).toBe(false);
});

test("a kit change passes with a written declaration, and fails without one", async () => {
  const kit = { engine: [KIT] };
  expect((await fixFileRule(input(kit))).ok).toBe(false);
  const declared = await fixFileRule(
    input({
      ...kit,
      body: "Moves a limit.\n\nFix file: none, because the new limit is behind a setting no app has yet\n",
    }),
  );
  expect(declared).toMatchObject({ ok: true });
  expect(declared.why).toContain("because the new limit");
  // The label still works for people.
  expect((await fixFileRule(input({ ...kit, labelled: true }))).ok).toBe(true);
});

test("a bump together with a kit change is no plain bump", async () => {
  const both = input({
    engine: [STACK_FILE, KIT],
  });
  expect((await fixFileRule(both)).ok).toBe(false);
});

test("comments and documents only pass by themselves", async () => {
  const result = await fixFileRule(
    input({
      engine: [KIT, "packages/adapter-tanstack/templates/README.md"],
      filesOf: () => ({
        before: "// old words\nexport const a = 1; /* one */\n",
        after: "// new words\n\nexport const a = 1; /* the first */\n",
      }),
    }),
  );
  expect(result).toMatchObject({ ok: true });
  expect(result.why).toContain("comments");
});

test("the parts", () => {
  expect(harmlessStep("1.7.13", "1.7.15")).toBe(true);
  expect(harmlessStep("1.7.15", "1.8.0")).toBe(true);
  expect(harmlessStep("0.7.1", "0.8.0")).toBe(false);
  expect(harmlessStep("1.9.0", "2.0.0")).toBe(false);
  expect(harmlessStep("1.7.15", "1.7.13")).toBe(false);
  expect(pinBumps(bumpDiff("1.7.13", "1.7.15"))).toEqual([
    { name: "better-auth", from: "1.7.13", to: "1.7.15" },
    { name: "srvx", from: "1.0.7", to: "1.0.8" },
  ]);
  expect(pinBumps(`-  id: "2026-09",\n+  id: "2026-10",\n`)).toBeUndefined();
  expect(commentsOnly(KIT, kitBefore, kitAfter)).toBe(false);
  // Code that looks like a comment line is code: a product split over two lines.
  expect(commentsOnly(KIT, "const t = a\n  * b;\n", "const t = a\n  * c;\n")).toBe(false);
  // A comment inside a template string is the generator's output: a change (fails closed).
  expect(commentsOnly(KIT, "const s = `// one`;\n", "const s = `// two`;\n")).toBe(false);
  expect(commentsOnly(KIT, "const s = `${a /* x */}`;\n", "const s = `${a /* y */}`;\n")).toBe(
    true,
  );
  expect(commentsOnly(KIT, "const u = 'http://a';\n", "const u = 'http://b';\n")).toBe(false);
  expect(commentsOnly("x.css", "a{}", "a{}")).toBe(false);
  expect(commentsOnly(KIT, undefined, "export {};")).toBe(false);
  expect(declaredReason("Fix file: none, because x")).toBeUndefined();
  expect(declaredReason("fix file: None because tests only change")).toBe("tests only change");
});
