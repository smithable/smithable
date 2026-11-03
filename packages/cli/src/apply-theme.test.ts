import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { generate } from "./generate.js";
import { ensureRepository, git } from "./git.js";
import { runOperation } from "./op.js";
import { projectRevision } from "./project-revision.js";
import { redo } from "./redo.js";
import { captureIo } from "./test-io.js";
import { undo } from "./undo.js";

vi.mock("./generate.js", () => ({ generate: vi.fn(async () => 0) }));
const roots: string[] = [];
const text =
  '# source comment\nsmithableTheme: 0.1\nname: paper\nmodes: light\nlight: { background: "#ffffff", foreground: "#101522", primary: "#335588" }\n';
const flags = { yes: true, reportLater: true };
beforeEach(() => {
  vi.mocked(generate).mockReset().mockResolvedValue(0);
});
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(history = true) {
  const dir = mkdtempSync(join(tmpdir(), "smithable-theme-transaction-"));
  roots.push(dir);
  writeFileSync(join(dir, ".gitignore"), "data/\n");
  writeFileSync(
    join(dir, "smithable.yml"),
    "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item: { fields: { name: string! } }\npages:\n  items: { crud: Item }\n",
  );
  writeFileSync(join(dir, "smithable.ux.yml"), "smithableUx: 0.1\ntheme: { preset: modern }\n");
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, ".smithable/files.json"), '{"files":{}}\n');
  if (history) ensureRepository(dir);
  return dir;
}
const head = (dir: string) => git(dir, ["rev-parse", "HEAD"]).out;
const args = (_dir?: string) => ({ name: "paper", text, mode: "create" });
/** The host's envelope beside the operation: the source revision the draft opened on, the request's id. */
const request = (dir: string, requestId = "request_123") => ({
  ...flags,
  expectedRevision: projectRevision(dir),
  requestId,
});

test("create/use is one checkpoint; retry, no-op and one-step undo preserve transaction boundaries", async () => {
  const dir = fixture();
  const before = head(dir);
  const envelope = request(dir);
  const first = captureIo();
  expect(await runOperation(dir, first, "applyTheme", args(dir), envelope), first.stderr).toBe(0);
  const committed = head(dir);
  expect(committed).not.toBe(before);
  expect(git(dir, ["rev-list", "--count", `${before}..HEAD`]).out).toBe("1");
  expect(readFileSync(join(dir, "smithable.ux.yml"), "utf8")).toContain("preset: paper");
  // The envelope is in a trailer of its own, never in the operation's record or the log.
  const body = git(dir, ["log", "-1", "--format=%B"]).out;
  expect(body).toContain(
    `Smithable-Apply: ${JSON.stringify({ requestId: "request_123", revision: envelope.expectedRevision })}`,
  );
  expect(body).toContain(`Smithable-Op: ${JSON.stringify({ op: "applyTheme", args: args(dir) })}`);
  expect(readFileSync(join(dir, ".smithable/oplog.jsonl"), "utf8")).not.toMatch(
    /requestId|expectedRevision/,
  );
  const retry = captureIo();
  expect(
    await runOperation(
      dir,
      retry,
      "applyTheme",
      Object.fromEntries(Object.entries(args(dir)).reverse()),
      envelope,
    ),
    retry.stderr,
  ).toBe(0);
  expect(retry.stdout).toContain("already committed");
  expect(head(dir)).toBe(committed);
  expect(vi.mocked(generate)).toHaveBeenCalledTimes(1);
  // The same id against another source revision is a conflict, not that Apply again.
  const conflict = captureIo();
  expect(
    await runOperation(dir, conflict, "applyTheme", args(dir), {
      ...envelope,
      expectedRevision: "0".repeat(64),
    }),
  ).toBe(1);
  expect(conflict.stderr).toContain("another version of the project source");
  expect(head(dir)).toBe(committed);
  const noop = captureIo();
  expect(
    await runOperation(
      dir,
      noop,
      "applyTheme",
      { ...args(dir), mode: "update" },
      request(dir, "noop_request"),
    ),
    noop.stderr,
  ).toBe(0);
  expect(head(dir)).toBe(committed);
  expect(vi.mocked(generate)).toHaveBeenCalledTimes(1);
  expect(undo(dir, captureIo())).toBe(0);
  expect(existsSync(join(dir, "themes", "paper.yml"))).toBe(false);
  expect(readFileSync(join(dir, "smithable.ux.yml"), "utf8")).toContain("preset: modern");
  const redoIo = captureIo();
  expect(await redo(dir, redoIo), redoIo.stderr).toBe(0);
  expect(readFileSync(join(dir, "themes", "paper.yml"), "utf8")).toBe(text);
  expect(readFileSync(join(dir, "smithable.ux.yml"), "utf8")).toContain("preset: paper");
});

test("external working bytes invalidate Apply even without a commit", async () => {
  const dir = fixture();
  const envelope = request(dir);
  const before = head(dir);
  writeFileSync(join(dir, "smithable.ux.yml"), "smithableUx: 0.1\ntheme: { preset: playful }\n");
  const io = captureIo();
  expect(await runOperation(dir, io, "applyTheme", args(dir), envelope)).toBe(1);
  expect(io.stderr).toContain("source changed");
  expect(head(dir)).toBe(before);
  expect(existsSync(join(dir, "themes", "paper.yml"))).toBe(false);
  expect(readFileSync(join(dir, "smithable.ux.yml"), "utf8")).toContain("playful");
  expect(vi.mocked(generate)).not.toHaveBeenCalled();
});

test("two simultaneous Apply requests create one checkpoint and regenerate once", async () => {
  const dir = fixture();
  const before = head(dir);
  const envelope = request(dir);
  const first = captureIo();
  const second = captureIo();
  expect(
    await Promise.all([
      runOperation(dir, first, "applyTheme", args(dir), envelope),
      runOperation(dir, second, "applyTheme", args(dir), envelope),
    ]),
  ).toEqual([0, 0]);
  expect(git(dir, ["rev-list", "--count", `${before}..HEAD`]).out).toBe("1");
  expect(vi.mocked(generate)).toHaveBeenCalledTimes(1);
});

test("generation failure restores source/theme selection and the database together", async () => {
  const dir = fixture();
  const before = head(dir);
  mkdirSync(join(dir, "data", "db"), { recursive: true });
  const path = join(dir, "data", "db", "app.db");
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE items (name TEXT); INSERT INTO items VALUES ('before')");
  db.close();
  vi.mocked(generate).mockImplementationOnce(async () => {
    const current = new DatabaseSync(path);
    current.exec("INSERT INTO items VALUES ('during')");
    current.close();
    return 1;
  });
  const io = captureIo();
  expect(await runOperation(dir, io, "applyTheme", args(dir), flags)).toBe(1);
  expect(io.stderr).toContain("Nothing was changed");
  expect(head(dir)).toBe(before);
  expect(existsSync(join(dir, "themes", "paper.yml"))).toBe(false);
  expect(readFileSync(join(dir, "smithable.ux.yml"), "utf8")).toContain("modern");
  const restored = new DatabaseSync(path);
  expect(restored.prepare("SELECT name FROM items").all()).toEqual([{ name: "before" }]);
  restored.close();
});

test("an external source edit during generation is preserved and incomplete rollback is explicit", async () => {
  const dir = fixture();
  const before = head(dir);
  const external = "smithableUx: 0.1\ntheme: { preset: playful }\n";
  vi.mocked(generate).mockImplementationOnce(async () => {
    writeFileSync(join(dir, "smithable.ux.yml"), external);
    return 1;
  });
  const io = captureIo();
  expect(await runOperation(dir, io, "applyTheme", args(dir), flags)).toBe(1);
  expect(io.stderr).toContain("was not rolled back");
  expect(io.stderr).toContain("changed by something else: smithable.ux.yml.");
  expect(io.stderr).toContain("Operations are refused until");
  expect(readFileSync(join(dir, "smithable.ux.yml"), "utf8")).toBe(external);
  expect(head(dir)).toBe(before);
});

test("untracked and custom editor files created during generation are neither committed nor removed", async () => {
  const dir = fixture();
  const before = head(dir);
  vi.mocked(generate).mockImplementationOnce(async () => {
    writeFileSync(join(dir, "editor-notes.txt"), "newer notes");
    return 1;
  });
  const io = captureIo();
  expect(await runOperation(dir, io, "applyTheme", args(dir), flags)).toBe(1);
  expect(io.stderr).toContain("was not rolled back");
  expect(io.stderr).toContain("changed by something else: editor-notes.txt.");
  expect(readFileSync(join(dir, "editor-notes.txt"), "utf8")).toBe("newer notes");
  expect(head(dir)).toBe(before);
});

test("an unchanged built-in selection is a source/commit no-op", async () => {
  const dir = fixture(false);
  const before = head(dir);
  const { BUILT_IN_THEMES, hexOf, SHADOWS } = await import("@smithable/core");

  const modern = BUILT_IN_THEMES.find((theme) => theme.name === "modern");
  if (!modern) throw new Error("missing fixture theme");
  const io = captureIo();
  expect(
    await runOperation(
      dir,
      io,
      "applyTheme",
      {
        ...args(dir),
        name: "modern",
        text: JSON.stringify({
          smithableTheme: 0.1,
          name: modern.name,
          font: modern.font,
          radius: modern.radius,
          shadow: Object.entries(SHADOWS).find(([, css]) => css === modern.shadow)?.[0],
          density: modern.density,
          motion: modern.motion,
          chroma: modern.chroma,
          headings: modern.style.headings,
          labels: modern.style.labels,
          surfaces: modern.style.surfaces,
          buttons: modern.style.buttons,
          pictures: modern.style.pictures,
          tables: modern.style.tables,
          light: Object.fromEntries(Object.entries(modern.light).map(([k, v]) => [k, hexOf(v)])),
          dark: Object.fromEntries(Object.entries(modern.dark).map(([k, v]) => [k, hexOf(v)])),
        }),
        mode: "select",
      },
      flags,
    ),
    io.stderr,
  ).toBe(0);
  expect(head(dir)).toBe(before);
  expect(existsSync(join(dir, ".git"))).toBe(false);
  expect(vi.mocked(generate)).not.toHaveBeenCalled();
});

test("a fresh generated project initializes history only for a real Apply", async () => {
  const dir = fixture(false);
  const io = captureIo();
  const before = projectRevision(dir);
  expect(existsSync(join(dir, ".git"))).toBe(false);
  expect(await runOperation(dir, io, "applyTheme", args(dir), flags), io.stderr).toBe(0);
  expect(projectRevision(dir)).not.toBe(before);
  expect(git(dir, ["rev-list", "--count", "HEAD"]).out).toBe("2");
  expect(readFileSync(join(dir, "smithable.ux.yml"), "utf8")).toContain("preset: paper");
  expect(undo(dir, captureIo())).toBe(0);
  expect(existsSync(join(dir, "themes/paper.yml"))).toBe(false);
});

test("a competing ordinary operation waits for Apply and preserves its selection", async () => {
  const dir = fixture();
  const before = head(dir);
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.mocked(generate).mockImplementationOnce(async () => {
    started?.();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return 0;
  });
  const apply = runOperation(dir, captureIo(), "applyTheme", args(dir), flags);
  await entered;
  const chat = runOperation(dir, captureIo(), "setTheme", { primary: "#334455" }, flags);
  release?.();
  expect(await Promise.all([apply, chat])).toEqual([0, 0]);
  const saved = readFileSync(join(dir, "smithable.ux.yml"), "utf8");
  expect(saved).toContain("preset: paper");
  expect(saved).toContain("#334455");
  expect(git(dir, ["rev-list", "--count", `${before}..HEAD`]).out).toBe("2");
});

test("a queued editor Save refuses a replaced project identity before any file or checkpoint", async () => {
  const dir = fixture();
  let opened = "project-one";
  let release: () => void = () => {};
  let entered: () => void = () => {};
  const started = new Promise<void>((resolve) => (entered = resolve));
  vi.mocked(generate).mockImplementationOnce(async () => {
    entered();
    await new Promise<void>((resolve) => (release = resolve));
    return 0;
  });
  const applying = runOperation(dir, captureIo(), "applyTheme", args(dir), flags);
  await started;
  const captured = opened;
  const io = captureIo();
  const saving = runOperation(
    dir,
    io,
    "addTheme",
    { name: "second", text: text.replace("name: paper", "name: second") },
    { ...flags, projectCheck: () => opened === captured },
  );
  opened = "project-two";
  release();
  expect(await applying).toBe(0);
  const committed = head(dir);
  expect(await saving).toBe(1);
  expect(io.stderr).toMatch(/current project changed/);
  expect(existsSync(join(dir, "themes/second.yml"))).toBe(false);
  expect(head(dir)).toBe(committed);
  expect(vi.mocked(generate)).toHaveBeenCalledTimes(1);
});
