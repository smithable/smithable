import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("embed --check names a generated file that no longer matches, and writes nothing", (t) => {
  const repo = mkdtempSync(join(tmpdir(), "embed-check-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  for (const dir of [
    "scripts",
    "fixes",
    "examples",
    "packages/adapter-tanstack/templates",
    "packages/adapter-tanstack/src",
    "packages/cli/src",
    "packages/core/src",
  ])
    mkdirSync(join(repo, dir), { recursive: true });
  copyFileSync(new URL("embed.mjs", import.meta.url), join(repo, "scripts/embed.mjs"));
  writeFileSync(join(repo, "packages/core/src/csv.ts"), "");
  const embed = (...args) =>
    spawnSync("node", [join(repo, "scripts/embed.mjs"), ...args], { encoding: "utf8" });

  assert.equal(embed().status, 0);
  assert.equal(embed("--check").status, 0);
  const fixes = join(repo, "packages/cli/src/fixes.gen.ts");
  const before = readFileSync(fixes, "utf8");
  writeFileSync(join(repo, "fixes/one.yml"), "title: one\n");
  const checked = embed("--check");
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /packages\/cli\/src\/fixes\.gen\.ts\. Run "pnpm build"/);
  assert.doesNotMatch(checked.stderr, /templates|starters/);
  assert.equal(readFileSync(fixes, "utf8"), before);
});
