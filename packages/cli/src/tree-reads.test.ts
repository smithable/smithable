// What this process writes back into the tree or sends to a model from it is read as the
// project's own file where a project user is set (secrets.ts treeText, treeBytes).
import { symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { projectLook } from "./project-look.js";
import { forgetProjectUserForTests, treeBytes, treeText } from "./secrets.js";
import { tempDir } from "./test-dir.js";

const linux = process.platform === "linux";
let dir: string;
let secret: string;
beforeEach(() => {
  dir = tempDir("tree-reads-");
  secret = join(tempDir("tree-reads-mine-"), "secret");
  writeFileSync(secret, "this process's own");
  process.env.SMITHABLE_PROJECT_UID = String(process.getuid?.());
  process.env.SMITHABLE_PROJECT_GID = String(process.getgid?.());
  forgetProjectUserForTests();
});
afterEach(() => {
  delete process.env.SMITHABLE_PROJECT_UID;
  delete process.env.SMITHABLE_PROJECT_GID;
  forgetProjectUserForTests();
});

test.runIf(linux)(
  "the project's own file is read, a link is refused, a missing one is ENOENT",
  () => {
    writeFileSync(join(dir, "own.yml"), "a: 1\n");
    symlinkSync(secret, join(dir, "planted.yml"));
    expect(treeText(join(dir, "own.yml"))).toBe("a: 1\n");
    expect(treeBytes(join(dir, "own.yml")).toString()).toBe("a: 1\n");
    expect(() => treeText(join(dir, "planted.yml"))).toThrow();
    expect(() => treeBytes(join(dir, "planted.yml"))).toThrow();
    expect(() => treeText(join(dir, "gone.yml"))).toThrow(
      expect.objectContaining({ code: "ENOENT" }),
    );
  },
);

test("without a project user a missing file is ENOENT as before", () => {
  delete process.env.SMITHABLE_PROJECT_UID;
  delete process.env.SMITHABLE_PROJECT_GID;
  forgetProjectUserForTests();
  expect(() => treeBytes(join(dir, "gone"))).toThrow(expect.objectContaining({ code: "ENOENT" }));
});

test.runIf(linux)("the look sent to a model never reads the ux file through a link", () => {
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\napp:\n  name: Shop\n");
  symlinkSync(secret, join(dir, "smithable.ux.yml"));
  let look: unknown;
  try {
    look = projectLook(dir);
  } catch {}
  expect(JSON.stringify(look ?? null)).not.toContain("this process's own");
});
