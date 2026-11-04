import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function upgradeFlow(dir, { cli, run, step, smithable }) {
  const git = (...args) =>
    run("git", ["-c", "user.name=Test", "-c", "user.email=t@example.com", ...args], dir);
  const lockPath = join(dir, "smithable.lock");
  const current = JSON.parse(readFileSync(lockPath, "utf8")).stackProfile;
  step("an app from an older stack profile: generate refuses and points to upgrade", () => {
    // As if made by an earlier Smithable: another profile, and an older clsx.
    writeFileSync(lockPath, readFileSync(lockPath, "utf8").replace(current, "2026-08"));
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    pkg.dependencies.clsx = "2.1.0";
    writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
    run("pnpm", ["install", "--silent"], dir);
    // Smithable's record says it wrote these files so, as the older Smithable would have.
    const recordPath = join(dir, ".smithable/files.json");
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    for (const entry of record.files)
      if (["package.json", "smithable.lock"].includes(entry.path))
        entry.sha256 = createHash("sha256")
          .update(readFileSync(join(dir, entry.path)))
          .digest("hex");
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    git("add", "-A");
    git("commit", "-qm", "An app from stack profile 2026-08");
    const result = spawnSync("node", [cli, "generate", dir], { encoding: "utf8" });
    if (result.status === 0 || !result.stderr.includes("smithable upgrade"))
      throw new Error(result.stderr);
  });
  step(
    "upgrade: custom code that no longer fits is reported, not fixed, and nothing changes",
    () => {
      writeFileSync(
        join(dir, "src/custom/legacy.ts"),
        'import { formatMoney } from "#/kit/format";\n\nexport const total = (cents: number) => formatMoney(cents);\n',
      );
      git("add", "-A");
      git("commit", "-qm", "Custom code using the old kit");
      const result = smithable(dir, "upgrade");
      if (
        result.code === 0 ||
        !result.out.includes("src/custom/legacy.ts") ||
        !result.out.includes("formatMoney")
      )
        throw new Error(result.out);
      if (run("git", ["status", "--porcelain"], dir).trim())
        throw new Error("the failed upgrade left changes");
      if (!readFileSync(lockPath, "utf8").includes("2026-08"))
        throw new Error("the profile changed anyway");
    },
  );
  step(
    "upgrade: with the custom code updated, the app moves to the new profile and its tests pass",
    () => {
      rmSync(join(dir, "src/custom/legacy.ts"));
      git("add", "-A");
      git("commit", "-qm", "Custom code updated for the new kit");
      const result = smithable(dir, "upgrade");
      if (result.code !== 0 || !result.out.includes(`to ${current}`)) throw new Error(result.out);
      if (!readFileSync(lockPath, "utf8").includes(current))
        throw new Error("the lock was not updated");
      if (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies.clsx === "2.1.0")
        throw new Error("clsx was not upgraded");
      if (
        !run("git", ["log", "-1", "--format=%s"], dir).includes(
          `Upgrade to stack profile ${current}`,
        )
      )
        throw new Error("no upgrade commit");
    },
  );
}
