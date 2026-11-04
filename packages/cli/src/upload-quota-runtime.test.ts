import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, expect, test, vi } from "vitest";
import { tempDir } from "./test-dir.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function fixture(failWrite: boolean | "partial" = false, Scanner: unknown = Worker) {
  const dir = tempDir("quota-");
  vi.stubEnv("UPLOADS_MAX_BYTES", "100");
  const source = stripTypeScriptTypes(
    fs
      .readFileSync(
        new URL("../../adapter-tanstack/templates/src/kit/uploads.ts", import.meta.url),
        "utf8",
      )
      .replace(/^import[\s\S]*?;\n/gm, "")
      .replace(/\bexport /g, ""),
  );
  const kit = new Function(
    ...Object.keys(fs).filter((k) => k !== "default"),
    "Worker",
    "createHash",
    "randomUUID",
    "join",
    "ownDataDir",
    "dataDir",
    "w",
    "log",
    `${source};return {roomFor, reserveUpload, release, saveFile, deleteFile, scanned, savePicture};`,
  )(
    ...Object.entries(fs)
      .filter(([k]) => k !== "default")
      .map(([k, v]) =>
        k === "writeFileSync" && failWrite
          ? (...args: Parameters<typeof fs.writeFileSync>) => {
              if (!failWrite) return fs.writeFileSync(...args);
              if (failWrite === "partial") {
                fs.writeFileSync(args[0], new Uint8Array(10).fill(120));
                failWrite = false;
              }
              throw new Error("disk full");
            }
          : v,
      ),
    Scanner,
    createHash,
    randomUUID,
    join,
    () => dir,
    dir,
    { storageFull: "storage full", fileNotAdded: "file could not be added" },
    { warn: vi.fn(), error: vi.fn() },
  ) as {
    roomFor(n: number): unknown;
    reserveUpload(n: number): Promise<unknown>;
    release(n: unknown): void;
    saveFile(model: string, bytes: Uint8Array, name: string, held?: unknown): { file: string };
    scanned(bytes: Uint8Array): Promise<void>;
    savePicture(
      model: string,
      bytes: Uint8Array,
      alt: string,
      ours: boolean,
      held?: unknown,
    ): unknown;
    deleteFile(file: { file: string }, used: boolean): void;
  };
  return { dir, kit, bytes: new TextEncoder().encode("x".repeat(40)) };
}

test("duplicate successful uploads release unused capacity", () => {
  const { kit, bytes } = fixture();
  for (let i = 0; i < 4; i++) {
    const held = kit.roomFor(40);
    expect(held).toBeTruthy();
    kit.saveFile("record", bytes, "a.txt", held);
  }
  const next = kit.roomFor(60);
  expect(next).toBeTruthy();
  kit.release(next);
});

test("active reservations survive cache refresh and settle only once", () => {
  vi.useFakeTimers();
  const { kit, bytes } = fixture();
  const first = kit.roomFor(40);
  const second = kit.roomFor(40);
  expect(first).toBeTruthy();
  expect(second).toBeTruthy();
  vi.advanceTimersByTime(61000);
  expect(kit.roomFor(40)).toBeUndefined();
  kit.saveFile("record", bytes, "a.txt", first);
  kit.saveFile("record", bytes, "a.txt", second);
  kit.release(first);
  kit.release(first);
  const last = kit.roomFor(60);
  expect(last).toBeTruthy();
  expect(kit.roomFor(1)).toBeUndefined();
  kit.release(last);
});

test("different concurrent uploads, deletion, invalid files and understated lengths", () => {
  const { kit, bytes } = fixture();
  const first = kit.roomFor(40);
  const second = kit.roomFor(40);
  const stored = kit.saveFile("record", bytes, "a.txt", first);
  const other = new TextEncoder().encode("y".repeat(40));
  kit.saveFile("record", other, "b.txt", second);
  expect(kit.roomFor(21)).toBeUndefined();
  kit.deleteFile(stored, false);
  const held = kit.roomFor(60);
  expect(held).toBeTruthy();
  expect(() => kit.saveFile("record", new Uint8Array(70).fill(97), "c.txt", held)).toThrow(
    /storage full/,
  );
  kit.release(held);
  const invalid = kit.roomFor(60);
  expect(() => kit.saveFile("record", bytes, "file.exe", invalid)).toThrow();
  kit.release(invalid);
  const next = kit.roomFor(60);
  expect(next).toBeTruthy();
  kit.release(next);
});

test("actual stored size replaces the declared size while protecting concurrent holds", () => {
  const { kit } = fixture();
  const first = kit.roomFor(20);
  const other = kit.roomFor(40);
  const stored = kit.saveFile("record", new Uint8Array(60).fill(97), "a.txt", first);
  expect(kit.roomFor(1)).toBeUndefined();
  kit.release(other);
  kit.deleteFile(stored, false);
  const full = kit.roomFor(100);
  expect(full).toBeTruthy();
  kit.release(full);
});

test("scanner rejection and write failure release holds through caller finally", async () => {
  const { kit, bytes } = fixture(true);
  const first = kit.roomFor(80);
  try {
    expect(() => kit.saveFile("record", bytes, "a.txt", first)).toThrow(/disk full/);
  } finally {
    kit.release(first);
  }
  const second = kit.roomFor(100);
  expect(second).toBeTruthy();
  vi.stubEnv("SCAN_URL", "https://scanner.test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  try {
    await expect(kit.scanned(bytes)).rejects.toThrow();
  } finally {
    kit.release(second);
  }
  const third = kit.roomFor(100);
  expect(third).toBeTruthy();
  kit.release(third);
});

test("pictures settle by stored bytes and hash hits", () => {
  const { kit } = fixture();
  const bytes = new Uint8Array(40);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBPVP8X"), 8);
  for (let i = 0; i < 4; i++) {
    const held = kit.roomFor(50);
    expect(held).toBeTruthy();
    kit.savePicture("record", bytes, "", false, held);
  }
  const last = kit.roomFor(60);
  expect(last).toBeTruthy();
  kit.release(last);
});

test("partial writes never become a deduplication hit and existing holds remain usable", () => {
  const { dir, kit, bytes } = fixture("partial");
  const first = kit.roomFor(40),
    second = kit.roomFor(60);
  expect(() => kit.saveFile("record", bytes, "a.txt", first)).toThrow("disk full");
  expect(fs.readdirSync(join(dir, "uploads/record"))).toEqual([]);
  expect(fs.readdirSync(join(dir, "upload-staging"))).toEqual([]);
  const saved = kit.saveFile("record", bytes, "a.txt", second);
  expect(fs.readFileSync(join(dir, "uploads", saved.file))).toEqual(Buffer.from(bytes));
  const spare = kit.roomFor(60);
  expect(spare).toBeTruthy();
  kit.release(spare);
  // A pre-existing corrupt file is refused rather than silently treated as a hash hit.
  fs.writeFileSync(join(dir, "uploads", saved.file), "truncated");
  const held = kit.roomFor(1);
  expect(() => kit.saveFile("record", bytes, "a.txt", held)).toThrow();
});

test("a scanner error refuses admission without losing an existing hold", async () => {
  class FailedScanner extends EventEmitter {
    constructor() {
      super();
      queueMicrotask(() => {
        this.emit("error", new Error("scanner failed"));
        this.emit("exit", 1);
      });
    }
  }
  vi.useFakeTimers();
  const { kit, bytes } = fixture(false, FailedScanner);
  const held = kit.roomFor(60);
  expect(held).toBeTruthy();
  vi.advanceTimersByTime(61000);
  await expect(kit.reserveUpload(40)).rejects.toThrow("file could not be added");
  expect(() => kit.saveFile("record", bytes, "a.txt", held)).not.toThrow();
});

test("scanner deadline terminates the worker and releases the shared scanner queue", async () => {
  let terminated = 0;
  class StalledScanner extends EventEmitter {
    terminate() {
      terminated++;
      queueMicrotask(() => this.emit("exit", 1));
      return Promise.resolve(1);
    }
  }
  vi.useFakeTimers();
  const { kit } = fixture(false, StalledScanner);
  const refused = expect(kit.reserveUpload(1)).rejects.toThrow("file could not be added");
  await vi.advanceTimersByTimeAsync(30000);
  await refused;
  expect(terminated).toBe(1);
  const again = expect(kit.reserveUpload(1)).rejects.toThrow("file could not be added");
  await vi.advanceTimersByTimeAsync(30000);
  await again;
  expect(terminated).toBe(2);
});

test("continuous writes exhaust exactly three scan attempts, then admission counts on the last total", async () => {
  let attempts = 0;
  let kit: ReturnType<typeof fixture>["kit"];
  class ChangingScanner extends EventEmitter {
    constructor() {
      super();
      queueMicrotask(() => {
        attempts++;
        kit.saveFile("record", new Uint8Array(attempts).fill(120), "churn.txt");
        this.emit("message", 0);
        this.emit("exit", 0);
      });
    }
  }
  ({ kit } = fixture(false, ChangingScanner));
  // The last scan said 0 bytes (the churn files are not counted by this scanner): admitted on it.
  const held = await kit.reserveUpload(1);
  expect(held).toBeTruthy();
  expect(attempts).toBe(3);
  kit.release(held);
  // Not refused for a minute afterwards either: the estimate stands until the next refresh.
  const spare = await kit.reserveUpload(94);
  expect(spare).toBeTruthy();
  expect(attempts).toBe(3);
  kit.release(spare);
  // The churn's own bytes (1 + 2 + 3), written during the scans, stayed accounted: the estimate
  // is never below what was counted already, so 95 more do not fit in 100.
  expect(kit.roomFor(95)).toBeUndefined();
});

test("identical upload bytes remain isolated by model, including deletion", () => {
  const { dir, kit, bytes } = fixture();
  const first = kit.saveFile("alpha", bytes, "a.txt", kit.roomFor(bytes.length));
  const second = kit.saveFile("beta", bytes, "b.txt", kit.roomFor(bytes.length));
  expect(first.file).not.toBe(second.file);
  expect(fs.readFileSync(join(dir, "uploads", first.file))).toEqual(Buffer.from(bytes));
  expect(fs.readFileSync(join(dir, "uploads", second.file))).toEqual(Buffer.from(bytes));
  kit.deleteFile(first, false);
  expect(fs.existsSync(join(dir, "uploads", first.file))).toBe(false);
  expect(fs.readFileSync(join(dir, "uploads", second.file))).toEqual(Buffer.from(bytes));
});
