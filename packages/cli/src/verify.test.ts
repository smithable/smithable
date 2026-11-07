import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkOf, setCheck, unverified } from "@smithable/core";
import { expect, test } from "vitest";
import { run } from "./cli.js";
import { git } from "./git.js";
import { tempDir } from "./test-dir.js";
import { captureIo } from "./test-io.js";
import { browserFromReport, dataCheck, keep, keptPath, readKept, verify } from "./verify.js";

const env = { where: "local" as const, engine: "test" };

/** A project with a spec, an auth file and one commit. */
function project(): string {
  const dir = tempDir("smithable-verify-");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item: { fields: { name: string! } }\npages:\n  items: { crud: Item }\n",
  );
  writeFileSync(join(dir, "smithable.auth.yml"), "smithableAuth: 0.1\nsignIn: none\n");
  writeFileSync(join(dir, ".gitignore"), "data\n");
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "smithable: start of history"]);
  return dir;
}

test("the data check: counts held pass, a lost value fails, a confirmed loss is said", () => {
  const before = { Item: 3, "Item.name": 3, "Item.note": 2, "Item.old": 1 };
  expect(dataCheck(before, { ...before }, [], new Set())).toMatchObject({
    state: "passed",
    says: "3 items kept their values.",
  });
  // A column the spec no longer has (old) is not compared.
  const lost = dataCheck(before, { Item: 3, "Item.name": 3, "Item.note": 1 }, [], new Set());
  expect(lost).toMatchObject({ state: "failed", says: "Values were lost: Item.note 2 → 1." });
  const confirmed = dataCheck(
    before,
    { Item: 3, "Item.name": 3, "Item.note": 1 },
    [],
    new Set(["Item.note"]),
  );
  expect(confirmed.state).toBe("passed");
  expect(confirmed.says).toContain("confirmed to remove (Item.note 2 → 1)");
  // A rename: counted under the old name before and the new one after.
  const renamed = dataCheck(
    { Item: 3, "Item.note": 2 },
    { Thing: 3, "Thing.memo": 2 },
    [
      { kind: "rename-model", from: "Item", to: "Thing" },
      { kind: "rename-field", model: "Thing", from: "note", to: "memo", storage: "value" },
    ],
    new Set(),
  );
  expect(renamed.state).toBe("passed");
  expect(dataCheck(undefined, undefined, [], new Set()).says).toContain("no records to keep");
  expect(
    dataCheck({ Item: 0, "Item.name": 0 }, { Item: 0, "Item.name": 0 }, [], new Set()),
  ).toEqual({ state: "passed", says: "No records to keep." });
  expect(dataCheck({ Item: null }, { Item: 3 }, [], new Set()).state).toBe("inconclusive");
  // A model the spec no longer has is named once with its count, never "no records to keep".
  expect(dataCheck({ Item: 12, "Item.name": 12 }, {}, [], new Set()).says).toBe(
    "Removed with the spec's change: Item (12).",
  );
  // The trash emptied: the model's rows and every field of them may go.
  expect(
    dataCheck({ Item: 3, "Item.name": 3 }, { Item: 1, "Item.name": 1 }, [], new Set(["Item"]))
      .state,
  ).toBe("passed");
});

test("a result is kept per revision and place; one without a revision is not", () => {
  const dir = tempDir("smithable-kept-");
  const failed = unverified("b", env, "change");
  keep(dir, failed);
  expect(existsSync(join(dir, "data/.smithable/verified"))).toBe(false);
  const v = { ...unverified("b", env, "change"), revision: "abc123" };
  setCheck(v, "spec", "passed", "ok");
  keep(dir, v);
  expect(keptPath(dir, "abc123", "local")).toMatch(
    /data\/\.smithable\/verified\/abc123-local\.json$/,
  );
  expect(readKept(dir, "abc123", "local")?.checks[0]?.state).toBe("passed");
  expect(readKept(dir, "abc123", "studio")).toBeUndefined();
  expect(readKept(dir, "def456", "local")).toBeUndefined();
});

test("a sampleusers report is refused for another revision and mapped onto the browser check", () => {
  const v = { ...unverified("b", env, "browser"), revision: "abc123" };
  expect(browserFromReport(v, { revision: "zzz", status: "passed" }, "r.json")).toContain(
    "not abc123",
  );
  expect(browserFromReport(v, { status: "passed" }, "r.json")).toContain("names no revision");
  expect(checkOf(v, "browser").state).toBe("not-run");
  const steps = [
    { status: "passed", name: "open" },
    { status: "blocked", name: "save", reason: "no button" },
  ];
  browserFromReport(v, { revision: "abc123", status: "blocked", steps }, "r.json");
  expect(checkOf(v, "browser")).toMatchObject({
    state: "not-run",
    reason: "blocked at save: no button",
  });
  // Passed needs steps that ran, none failed; a report for another environment is refused.
  browserFromReport(v, { revision: "abc123", status: "passed", steps: [] }, "r.json");
  expect(checkOf(v, "browser").state).toBe("inconclusive");
  expect(
    browserFromReport(v, { revision: "abc123", environment: { where: "hosted" } }, "r.json"),
  ).toContain("hosted environment");
  for (const [status, state] of [
    ["passed", "passed"],
    ["failed", "failed"],
    ["budget exhausted", "inconclusive"],
    ["cancelled", "inconclusive"],
  ]) {
    browserFromReport(v, { revision: "abc123", status, steps: [{ status: "passed" }] }, "r.json");
    expect(checkOf(v, "browser").state).toBe(state);
  }
});

test("verify keeps a result for the committed revision and refuses uncommitted edits", () => {
  const dir = project();
  const io = captureIo();
  expect(verify(dir, io, { json: true })).toBe(0);
  const v = JSON.parse(io.stdout);
  const head = git(dir, ["rev-parse", "HEAD"]).out.trim();
  expect(v.revision).toBe(head);
  expect(checkOf(v, "spec").state).toBe("passed");
  expect(checkOf(v, "generate")).toMatchObject({ state: "not-run" });
  expect(checkOf(v, "generate").reason).toContain("no result from one");
  expect(readdirSync(join(dir, "data/.smithable/verified"))).toEqual([`${head}-local.json`]);

  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\napp: { name: Changed }\n");
  const dirty = captureIo();
  expect(verify(dir, dirty, { json: true })).toBe(1);
  expect(dirty.stderr).toContain("Commit or discard these changes first");
  expect(JSON.parse(dirty.stdout).revision).toBe("");
  expect(verify(dir, captureIo(), { depth: "deep" })).toBe(2);
});

test("op --json prints the operation's result alone on stdout, its words on stderr", async () => {
  const dir = project();
  const io = captureIo();
  const code = await run(["op", "removeField", "Item", "nope", "--json", "--dir", dir], io);
  expect(code).toBe(1);
  const result = JSON.parse(io.stdout);
  expect(result).toMatchObject({ ok: false });
  expect(result.message).toContain("nope");
  expect(result.files).toBeUndefined();
  const v = result.verification;
  expect(v.revision).toBe("");
  expect(checkOf(v, "spec").state).toBe("failed");
  expect(io.stderr).toContain("nope");
  expect(existsSync(join(dir, "data/.smithable/verified"))).toBe(false);
  // Refused before it had a result: still one JSON document, with what it said.
  const unknown = captureIo();
  expect(await run(["op", "noSuchOperation", "--json", "--dir", dir], unknown)).toBe(2);
  expect(JSON.parse(unknown.stdout)).toMatchObject({ ok: false, diagnostics: [] });
  expect(JSON.parse(unknown.stdout).message).toContain('Unknown operation "noSuchOperation".');
  const bad = captureIo();
  expect(
    await run(["op", "removeField", "Item", "name", "--verify", "deep", "--dir", dir], bad),
  ).toBe(2);
});
