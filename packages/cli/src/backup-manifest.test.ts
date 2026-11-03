import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { tempDir } from "./test-dir.js";

const fake = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: fake.run }));
vi.mock("./build.js", () => ({ appName: () => "fixture" }));

import { backup, restore, verifyBackup } from "./backup.js";

for (const damage of [
  "none",
  "missing-upload",
  "truncated-db",
  "manifest-hash",
  "unsafe-path",
  "incomplete",
  "missing-manifest",
  "stripped-metadata",
] as const) {
  test(`versioned backup/restore: ${damage}`, async () => {
    const root = tempDir("manifest-");
    fake.run.mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "cp") {
        const path = args.at(-1) ?? "";
        if (args[1]?.endsWith(".db.uploads")) {
          mkdirSync(path);
          writeFileSync(join(path, "blob"), "upload bytes");
        } else writeFileSync(path, "database references blob");
      }
      return { status: 0, stderr: "", stdout: "finished" };
    });
    const io = { out: vi.fn(), err: vi.fn() };
    const store = join(root, "store");
    expect(await backup(root, io, { to: store, container: "fixture" })).toBe(0);
    const folder = join(store, "fixture", readdirSync(join(store, "fixture"))[0] ?? "");
    expect(verifyBackup(folder)).toBe(true);
    if (damage === "missing-upload") rmSync(join(folder, "uploads", "blob"));
    if (damage === "truncated-db") writeFileSync(join(folder, "app.db"), "short");
    if (damage === "manifest-hash") writeFileSync(join(folder, "manifest.json"), "{}");
    if (damage === "incomplete") rmSync(join(folder, "complete"));
    if (damage === "missing-manifest" || damage === "stripped-metadata")
      rmSync(join(folder, "manifest.json"));
    if (damage === "stripped-metadata") rmSync(join(folder, "complete"));
    if (damage === "unsafe-path") {
      const doc = JSON.parse(readFileSync(join(folder, "manifest.json"), "utf8"));
      doc.entries[0].path = "../outside";
      const text = JSON.stringify(doc);
      writeFileSync(join(folder, "manifest.json"), text);
      writeFileSync(join(folder, "complete"), createHash("sha256").update(text).digest("hex"));
    }
    const project = join(root, "restored");
    mkdirSync(join(project, "data", "db"), { recursive: true });
    writeFileSync(join(project, "data", "db", "app.db"), "original");
    const result = await restore(project, io, { from: store });
    expect(result).toBe(damage === "none" ? 0 : 1);
    expect(readFileSync(join(project, "data", "db", "app.db"), "utf8")).toBe(
      damage === "none" ? "database references blob" : "original",
    );
    if (damage === "none")
      expect(readFileSync(join(project, "data", "uploads", "blob"), "utf8")).toBe("upload bytes");
  });
}
