import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { maintenanceInfo, templateKitRevision } from "../packages/cli/dist/maintenance.js";
import { upgradeFlow } from "./upgrade-flow.mjs";

test("existing staged upgrade refuses incompatible custom code then records the checked upgrade", {
  timeout: 240000,
}, () => {
  const repo = resolve(import.meta.dirname, ".."),
    root = mkdtempSync(join(tmpdir(), "staged-upgrade-")),
    dir = join(root, "app"),
    cli = join(repo, "packages/cli/dist/bin.js");
  const run = (command, args, cwd = repo) =>
    execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
  try {
    run(process.execPath, [cli, "new", dir, "--starter", "crm"]);
    run(process.execPath, [cli, "op", "setApp", "--name", "Staged upgrade fixture", "--dir", dir]);
    run("pnpm", ["build"], dir);
    upgradeFlow(dir, {
      cli,
      run,
      step: (name, fn) => {
        fn();
        console.log(`PASS ${name}`);
      },
      smithable: (dir, ...args) => {
        const result = spawnSync(process.execPath, [cli, ...args, "--dir", dir], {
          cwd: repo,
          encoding: "utf8",
          timeout: 120000,
          maxBuffer: 16 * 1024 * 1024,
        });
        return {
          code: result.status,
          out: `${result.stdout}${result.stderr}`,
          stdout: result.stdout,
        };
      },
    });
    const info = maintenanceInfo(dir);
    assert.ok(info.upgrade?.commit);
    assert.equal(info.upgrade.to, info.currentProfile);
    assert.equal(info.generatedKit, templateKitRevision);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
