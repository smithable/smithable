import { expect, test, vi } from "vitest";
import { safeRelative } from "./backup.js";
import { tempDir } from "./test-dir.js";

test("a restored file stays inside the restore folder", () => {
  expect(safeRelative("db/app.db")).toBe("db/app.db");
  for (const key of ["../../etc/passwd", "/etc/passwd", "db/../../x", "a//b", "..\\x"])
    expect(() => safeRelative(key)).toThrow(/unsafe file name/);
});

test("restore takes the newest backup, not a stray folder that sorts after the times", async () => {
  const { mkdirSync, readFileSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { restore } = await import("./backup.js");
  const root = tempDir("restore-");
  const project = join(root, "project");
  mkdirSync(project);
  writeFileSync(join(project, "package.json"), JSON.stringify({ name: "acme-crm" }));
  for (const [folder, content] of [
    ["20261001-120000", "old"],
    ["20261002-120000", "new"],
  ] as const) {
    mkdirSync(join(root, "store", "acme-crm", folder), { recursive: true });
    writeFileSync(join(root, "store", "acme-crm", folder, "app.db"), content);
  }
  // An earlier `--to <folder>/acme-crm` nests a folder of the app's name: not a backup.
  mkdirSync(join(root, "store", "acme-crm", "acme-crm", "20261003-120000"), { recursive: true });
  const io = { out: () => {}, err: () => {} };
  expect(await restore(project, io, { from: join(root, "store") })).toBe(0);
  expect(readFileSync(join(project, "data", "db", "app.db"), "utf8")).toBe("new");
});

// Drive backup through Docker results without a daemon or a real database.
const subprocess = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: subprocess.run }));
vi.mock("./build.js", () => ({ appName: () => "acme-crm" }));

test.each([
  "snapshot",
  "database copy",
  "uploads probe",
  "uploads copy",
  "cleanup",
  "spawn error",
  "signal",
  "null status",
])("container backup fails visibly on %s", async (failure) => {
  const { existsSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { backup } = await import("./backup.js");
  const root = tempDir("backup-");
  const calls: string[] = [];
  subprocess.run.mockImplementation((_command: string, args: string[]) => {
    const script = args.at(-1) ?? "";
    const step = script.includes("capture-control-stop-v1")
      ? "capture stop"
      : args[0] === "cp"
        ? args[1]?.endsWith(".db.uploads")
          ? "uploads copy"
          : "database copy"
        : script.includes("try{fs.statSync(")
          ? "uploads probe"
          : script.includes("rmSync")
            ? "cleanup"
            : "snapshot";
    calls.push(step);
    if (step === "database copy") writeFileSync(script, "database");
    if (step === failure) return { status: 1, stderr: `broken ${step}` };
    if (step === "snapshot" && failure === "spawn error")
      return { status: null, error: new Error("spawn failed"), stderr: "" };
    if (step === "snapshot" && (failure === "signal" || failure === "null status"))
      return { status: null, signal: failure === "signal" ? "SIGTERM" : null, stderr: "" };
    return { status: 0, stderr: "", stdout: "finished" };
  });
  const io = { out: vi.fn(), err: vi.fn() };
  expect(await backup(root, io, { container: "test", to: join(root, "store") })).toBe(1);
  expect(io.out).not.toHaveBeenCalled();
  expect(io.err.mock.calls.flat().join("")).toMatch(/failed/i);
  expect(existsSync(join(root, "store"))).toBe(false);
  expect(calls).toContain("cleanup");
});

test.each([true, false])("container backup succeeds with uploads present=%s", async (present) => {
  const { mkdirSync, writeFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { backup } = await import("./backup.js");
  const root = tempDir("backup-");
  subprocess.run.mockImplementation((_command: string, args: string[]) => {
    if (args[0] === "cp") {
      const dest = args.at(-1) ?? "";
      if (args[1]?.endsWith(".db.uploads")) {
        mkdirSync(dest);
        writeFileSync(join(dest, "blob"), "upload");
      } else writeFileSync(dest, "database");
    }
    return {
      status: args.at(-1)?.includes("try{fs.statSync(") && !present ? 3 : 0,
      stderr: "",
      stdout: "finished",
    };
  });
  const io = { out: vi.fn(), err: vi.fn() };
  expect(await backup(root, io, { container: "test", to: join(root, "store") })).toBe(0);
  expect(io.err).not.toHaveBeenCalled();
  const [stamp] = readdirSync(join(root, "store", "acme-crm"));
  expect(readdirSync(join(root, "store", "acme-crm", stamp ?? "")).sort()).toEqual(
    present
      ? ["app.db", "complete", "manifest.json", "uploads"]
      : ["app.db", "complete", "manifest.json"],
  );
});

test("cleanup failure preserves the primary backup error", async () => {
  const { backup } = await import("./backup.js");
  subprocess.run.mockReturnValue({ status: 1, stderr: "broken" });
  const io = { out: vi.fn(), err: vi.fn() };
  expect(await backup(tempDir(), io, { container: "test", to: "unused" })).toBe(1);
  const errors = io.err.mock.calls.flat().join("");
  expect(errors).toContain("Snapshot cleanup failed");
  expect(errors).toContain("The snapshot failed");
  expect(io.out).not.toHaveBeenCalled();
});

test.each(["stop", "run", "start"])("restore checks Docker %s failure", async (failed) => {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { restore } = await import("./backup.js");
  const root = tempDir("restore-failure-");
  const folder = join(root, "store", "acme-crm", "20261001-120000");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "app.db"), "fixture");
  const calls: string[] = [];
  subprocess.run.mockImplementation((_command: string, args: string[]) => {
    calls.push(args[0] ?? "");
    return {
      status: args[0] === failed ? 1 : 0,
      stdout: args[0] === "inspect" ? "image|volume" : "",
      stderr: `fixture ${failed} failure`,
    };
  });
  const io = { out: vi.fn(), err: vi.fn() };
  expect(await restore(root, io, { container: "fixture", from: join(root, "store") })).toBe(1);
  expect(io.out).not.toHaveBeenCalled();
  expect(io.err.mock.calls.flat().join("")).toContain(`Docker ${failed} failed`);
  if (failed === "stop") expect(calls).not.toContain("run");
  if (failed === "run") expect(calls).not.toContain("start");
});
