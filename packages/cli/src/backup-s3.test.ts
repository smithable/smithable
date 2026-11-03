import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { tempDir } from "./test-dir.js";

const fake = vi.hoisted(() => ({
  objects: new Map<string, Buffer>(),
  writes: [] as string[],
  failAt: 0,
  run: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawnSync: fake.run }));
vi.mock("./build.js", () => ({ appName: () => "fixture" }));
vi.mock("./s3.js", () => ({
  S3: class {
    async put(_bucket: string, key: string, bytes: Buffer) {
      fake.writes.push(key);
      if (fake.failAt === fake.writes.length) throw new Error("interrupted save");
      fake.objects.set(key, bytes);
    }
    async get(_bucket: string, key: string) {
      return fake.objects.get(key);
    }
    async list(_bucket: string, prefix: string) {
      return [...fake.objects.keys()].filter((key) => key.startsWith(prefix));
    }
  },
}));

import { backup, restore } from "./backup.js";

test.each([false, true])("S3 completion marker is last; interrupted=%s", async (interrupted) => {
  const root = tempDir("backup-s3-");
  fake.objects.clear();
  fake.writes = [];
  fake.failAt = interrupted ? 2 : 0;
  fake.run.mockImplementation((_command: string, args: string[]) => {
    if (args[0] === "cp") {
      const dest = args.at(-1) ?? "";
      if (args[1]?.endsWith(".db.uploads")) {
        mkdirSync(dest);
        writeFileSync(join(dest, "blob"), "upload");
      } else writeFileSync(dest, "db");
    }
    return { status: 0, stderr: "", stdout: "finished" };
  });
  const io = { out: vi.fn(), err: vi.fn() };
  expect(await backup(root, io, { container: "fixture", to: "s3://test/prefix" })).toBe(
    interrupted ? 1 : 0,
  );
  expect(fake.writes[0]).toMatch(/manifest.json$/);
  if (!interrupted) expect(fake.writes.at(-1)).toMatch(/\/complete$/);
  expect([...fake.objects.keys()].some((k) => k.endsWith("/complete"))).toBe(!interrupted);
  expect(await restore(root, io, { from: "s3://test/prefix" })).toBe(interrupted ? 1 : 0);
  if (!interrupted)
    expect(readFileSync(join(root, "data", "uploads", "blob"), "utf8")).toBe("upload");
});
