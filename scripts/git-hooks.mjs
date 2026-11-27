// The root package's `prepare` (run by pnpm install): turns on .githooks, the pre-push guard, in this
// clone. Only on the maintainers' machine, which is told by the folder ~/repos/.session-scripts: an
// outside contributor's clone, CI (CI is set) and an installed package (not a Git checkout of its
// own) are left as they are. Generated apps have their own package.json and never run this.
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const quietly = (...args) => {
  try {
    return git(...args);
  } catch {
    return "";
  }
};

if (process.env.CI || !existsSync(join(homedir(), "repos", ".session-scripts"))) process.exit(0);
const top = quietly("rev-parse", "--show-toplevel");
if (!top || realpathSync(top) !== realpathSync(process.cwd())) process.exit(0);
const current = quietly("config", "--get", "core.hooksPath");
if (current === ".githooks") process.exit(0);
if (current) {
  console.log(
    `git-hooks: core.hooksPath is ${current}; the push guard (.githooks) is not turned on.`,
  );
  process.exit(0);
}
git("config", "core.hooksPath", ".githooks");
console.log("git-hooks: the push guard (.githooks/pre-push) is on in this clone.");
