// The browser walks' own lint guard (T1784), run by checkPorts, which each of them calls before
// it starts anything: a walk takes minutes, and a biome error in a changed file fails the gate or CI after it. It looks at this script's own
// checkout, however and from wherever the walk was started; CI has run lint already. The same
// check as gate.sh's lint_changed, which looks at the folder the gate was started in.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const biome = join(root, "node_modules/.bin/biome");

/** The files changed against origin/main and the new ones; none where git cannot say. */
function changed() {
  // Without GIT_*: a walk started from a hook would otherwise be asked about the hook's checkout.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
  );
  const options = { cwd: root, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  const git = (...args) =>
    execFileSync("git", args, { ...options, stdio: ["ignore", "pipe", "ignore"] });
  try {
    const base = git("merge-base", "HEAD", "origin/main").trim();
    return (
      [
        ...git("diff", "-z", "--name-only", "--diff-filter=d", base).split("\0"),
        ...git("ls-files", "-z", "--others", "--exclude-standard").split("\0"),
      ]
        .filter(Boolean)
        // A file's name is never read as one of biome's flags.
        .map((file) => `./${file}`)
    );
  } catch {
    return [];
  }
}

let checked = false;

/**
 * Exits 77 with biome's last lines when a changed file has an error. Once in a process: a later
 * call, in the middle of a walk, never ends it.
 */
export function lintGuard() {
  if (checked) return;
  checked = true;
  if (process.env.CI || !existsSync(join(root, "biome.json")) || !existsSync(biome)) return;
  const files = changed();
  if (!files.length) return;
  const options = ["--diagnostic-level=error", "--files-ignore-unknown=true"];
  const r = spawnSync(biome, ["check", ...options, "--no-errors-on-unmatched", ...files], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(`${r.stdout}${r.stderr}`.trimEnd().split("\n").slice(-30).join("\n"));
    console.error(
      "lint-guard: biome finds errors in the files changed here, so nothing was run: run pnpm fix, then pnpm lint.",
    );
    process.exit(77);
  }
}
