import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import {
  generationReceipt,
  hasGenerationReceipt,
  startGeneration,
  transientGenerationFailure,
} from "./generation-job.js";
import { ensureRepository, git } from "./git.js";
import { defaultAssumptions } from "./new.js";
import { type replaceProject, sync } from "./replace.js";
import { tempDir } from "./test-dir.js";
import { undoableChanges } from "./undo.js";

const quiet = { out: () => {}, err: () => {} };
const setup = () => {
  const dir = tempDir("smithable-generation-");
  writeFileSync(join(dir, "smithable.yml"), "the starter");
  return dir;
};
const settled = async (dir: string, id = "job-1") => {
  await new Promise<void>((done) => setTimeout(done, 0));
  return generationReceipt(dir, id);
};
const make: typeof replaceProject = async (dir, _io, _to, _progress, control) => {
  control?.stage?.("drafting");
  control?.assumptions?.(
    defaultAssumptions("booking", [{ question: "Who uses it?", options: ["A team", "Anyone"] }]),
  );
  control?.usage?.({
    provider: "test",
    model: "test",
    tier: "local",
    inputTokens: 12,
    outputTokens: 3,
    cost: 0,
    currency: "EUR",
  });
  control?.stage?.("building");
  control?.beforeArrival();
  writeFileSync(join(dir, "smithable.yml"), "the generated app");
  return 0;
};

test("a completed generation has a checkpoint; replay keeps later Studio edits", async () => {
  const dir = setup();
  expect(
    startGeneration(
      dir,
      "job-1",
      { describe: "A booking app" },
      true,
      quiet,
      false,
      undefined,
      make,
    ).status,
  ).toBe("running");
  const ready = await settled(dir);
  expect(ready).toMatchObject({ status: "ready", usage: { tokens: 15 } });
  expect(ready?.checkpoint).toMatch(/^[a-f0-9]{40}$/);
  expect(ready?.assumptions[0]).toContain("unconfirmed");
  writeFileSync(join(dir, "smithable.yml"), "Studio's edits");
  expect(
    startGeneration(
      dir,
      "job-1",
      { describe: "A booking app" },
      false,
      quiet,
      false,
      undefined,
      make,
    ).checkpoint,
  ).toBe(ready?.checkpoint);
  expect(readFileSync(join(dir, "smithable.yml"), "utf8")).toBe("Studio's edits");
  expect(() => startGeneration(dir, "job-1", { describe: "Different input" }, true, quiet)).toThrow(
    "another generation",
  );
  expect(() => startGeneration(dir, "job-2", { describe: "A booking app" }, true, quiet)).toThrow(
    "another generation",
  );
});

test("failure before arrival retries only transient errors and preserves cumulative usage", async () => {
  const dir = setup();
  const fail: typeof replaceProject = async (_dir, io, _to, _progress, control) => {
    control?.usage?.({
      provider: "test",
      model: "test",
      tier: "local",
      inputTokens: 20,
      outputTokens: 0,
      cost: 0,
      currency: "EUR",
    });
    io.err("The model answered 503 busy");
    return 1;
  };
  startGeneration(dir, "job-1", { describe: "A booking app" }, true, quiet, false, undefined, fail);
  expect(await settled(dir)).toMatchObject({
    status: "failed",
    retryable: true,
    usage: { tokens: 20 },
  });
  startGeneration(dir, "job-1", { describe: "A booking app" }, false, quiet, true, undefined, make);
  expect(await settled(dir)).toMatchObject({ status: "ready", usage: { tokens: 35 } });
});

test("Studio changes while drafting prevent arrival without overwriting them", async () => {
  const dir = setup();
  const edit: typeof replaceProject = async (dir, _io, _to, _progress, control) => {
    writeFileSync(join(dir, "smithable.yml"), "The owner's edit");
    control?.beforeArrival();
    throw new Error("must not arrive");
  };
  startGeneration(dir, "job-1", { describe: "An app" }, true, quiet, false, undefined, edit);
  expect(await settled(dir)).toMatchObject({ status: "failed", retryable: false });
  expect(readFileSync(join(dir, "smithable.yml"), "utf8")).toBe("The owner's edit");
});

test("restart reconciles a committed checkpoint before a lost receipt update", async () => {
  const dir = setup();
  startGeneration(dir, "job-1", { describe: "An app" }, true, quiet, false, undefined, make);
  const ready = await settled(dir);
  const path = `${resolve(dir)}.generation.json`;
  const receipt = JSON.parse(readFileSync(path, "utf8"));
  delete receipt.checkpoint;
  Object.assign(receipt, { status: "running", stage: "committing" });
  writeFileSync(path, JSON.stringify(receipt));
  writeFileSync(join(dir, "smithable.yml"), "A later committed edit");
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "The owner edits the app"]);
  writeFileSync(join(dir, "smithable.yml"), "A later edit");
  expect(generationReceipt(dir, "job-1")).toMatchObject({
    status: "ready",
    checkpoint: ready?.checkpoint,
  });
  expect(readFileSync(join(dir, "smithable.yml"), "utf8")).toBe("A later edit");
});

test("restart during arrival fails closed; before arrival is recoverable only on untouched base", async () => {
  for (const stage of ["drafting", "arriving"] as const) {
    const dir = setup();
    startGeneration(
      dir,
      "job-1",
      { describe: "An app" },
      true,
      quiet,
      false,
      undefined,
      async () => 1,
    );
    await settled(dir);
    const path = `${resolve(dir)}.generation.json`;
    const receipt = JSON.parse(readFileSync(path, "utf8"));
    Object.assign(receipt, { status: "running", stage });
    writeFileSync(path, JSON.stringify(receipt));
    expect(generationReceipt(dir, "job-1")).toMatchObject({
      status: "failed",
      retryable: stage === "drafting",
    });
  }
});

test("a new generation still requires a replaceable, clean workspace", () => {
  const dir = setup();
  expect(() => startGeneration(dir, "job-1", { describe: "An app" }, false, quiet)).toThrow(
    "not one that can be replaced",
  );
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "Start"]);
  writeFileSync(join(dir, "smithable.yml"), "An existing edit");
  expect(() => startGeneration(dir, "job-1", { describe: "An app" }, true, quiet)).toThrow(
    "has edits",
  );
});

test("a durable receipt remains a legacy-replacement barrier after restart, even if unreadable", async () => {
  const dir = setup();
  expect(hasGenerationReceipt(dir)).toBe(false);
  startGeneration(dir, "job-1", { describe: "An app" }, true, quiet, false, undefined, make);
  await settled(dir);
  expect(hasGenerationReceipt(dir)).toBe(true);
  writeFileSync(`${resolve(dir)}.generation.json`, "interrupted write");
  expect(hasGenerationReceipt(dir)).toBe(true);
});

test.each(["drafting", "unrelated-branch", "fingerprint", "tree", "parent"])(
  "restart rejects spoofed recovery evidence: %s",
  async (attack) => {
    const dir = setup();
    startGeneration(
      dir,
      "job-1",
      { describe: "An app" },
      true,
      quiet,
      false,
      undefined,
      async () => 1,
    );
    await settled(dir);
    const path = `${resolve(dir)}.generation.json`;
    const receipt = JSON.parse(readFileSync(path, "utf8"));
    const initialTree = git(dir, ["rev-parse", "HEAD^{tree}"]).out;
    const branch = git(dir, ["branch", "--show-current"]).out;
    if (attack === "unrelated-branch")
      expect(git(dir, ["checkout", "-q", "-b", "unrelated"]).ok).toBe(true);
    if (attack === "parent")
      expect(
        git(dir, ["commit", "-q", "--allow-empty", "-m", "An unrelated earlier change"]).ok,
      ).toBe(true);
    writeFileSync(join(dir, "smithable.yml"), "A commit that was not the completed generation");
    expect(git(dir, ["add", "-A"]).ok).toBe(true);
    const intendedTree = git(dir, ["write-tree"]).out;
    const fingerprint = attack === "fingerprint" ? "not-the-request" : receipt.fingerprint;
    expect(
      git(dir, [
        "commit",
        "-q",
        "-m",
        `An arbitrary matching trailer\n\nSmithable-Generation: job-1\nSmithable-Generation-Input: ${fingerprint}`,
      ]).ok,
    ).toBe(true);
    if (attack === "unrelated-branch") expect(git(dir, ["checkout", "-q", branch]).ok).toBe(true);
    Object.assign(receipt, {
      status: "running",
      stage: attack === "drafting" ? "drafting" : "committing",
      intendedTree: attack === "tree" ? initialTree : intendedTree,
    });
    writeFileSync(path, JSON.stringify(receipt));
    const before = readFileSync(join(dir, "smithable.yml"), "utf8");
    expect(generationReceipt(dir, "job-1")).toMatchObject({ status: "failed", retryable: false });
    expect(generationReceipt(dir, "job-1")?.checkpoint).toBeUndefined();
    expect(readFileSync(join(dir, "smithable.yml"), "utf8")).toBe(before);
  },
);

test.each([
  ["Earlier network log\nType error at line 512", false],
  ["The input has 500 characters", false],
  ["A network for busy teams", false],
  ["fixture answered 503: unavailable", true],
  ["HTTP 429 Too Many Requests", true],
  ["TypeError: fetch failed", true],
  ["Error: connect ECONNRESET", true],
  ["The model is busy.", true],
])("transient classification uses the terminal diagnostic: %s", (message, retryable) => {
  expect(transientGenerationFailure(message)).toBe(retryable);
});

test("real sync preserves the waiting history and generation is setup rather than an undoable owner change", async () => {
  const dir = setup();
  const incoming = setup();
  ensureRepository(incoming);
  writeFileSync(join(incoming, "smithable.yml"), "The generated source");
  git(incoming, ["add", "-A"]);
  git(incoming, ["commit", "-q", "-m", "Incoming history must stay outside"]);
  let completed = 0;
  startGeneration(
    dir,
    "job-1",
    { describe: "An app" },
    true,
    quiet,
    false,
    () => completed++,
    async (dir, _io, _to, _progress, control) => {
      control?.beforeArrival();
      sync(incoming, dir);
      return 0;
    },
  );
  const stored = JSON.parse(readFileSync(`${resolve(dir)}.generation.json`, "utf8"));
  const ready = await settled(dir);
  expect(ready?.status).toBe("ready");
  expect(git(dir, ["rev-parse", `${ready?.checkpoint}^`]).out).toBe(stored.base);
  expect(undoableChanges(dir)).toEqual([]);
  expect(completed).toBe(1);
  const failed = setup();
  startGeneration(
    failed,
    "job-1",
    { describe: "An app" },
    true,
    quiet,
    false,
    () => completed++,
    async () => 1,
  );
  expect((await settled(failed))?.status).toBe("failed");
  expect(completed).toBe(1);
});
