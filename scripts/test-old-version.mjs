// An old version as a copy (docs/design/old-version-preview.md §5), end to end on a real app:
// opens the version before the newest change, checks it is the app as it was (and its data then),
// closes it, and checks the project's data, worktrees and folders are as before.
//   node scripts/test-old-version.mjs <app made by smithable new, with at least two changes>
// Not part of check: it installs packages and starts a dev server.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "./dev-app.mjs";

const { openOldVersion, closeOldVersion, openVersion } = await import(
  join(repo, "packages/cli/dist/old-version.js")
);
const dir = process.argv[2];
if (!dir) throw new Error("Name an app folder with at least two changes.");
const data = () => {
  const hash = createHash("sha256");
  hash.update(readFileSync(join(dir, "data", "db", "app.db")));
  const snapshots = join(dir, "data", ".smithable", "snapshots");
  for (const f of existsSync(snapshots) ? readdirSync(snapshots).sort() : [])
    hash.update(readFileSync(join(snapshots, f)));
  return hash.digest("hex");
};
const worktrees = () => execFileSync("git", ["worktree", "list"], { cwd: dir }).toString();
const before = { data: data(), worktrees: worktrees() };
const started = Date.now();
const open = await openOldVersion(dir, "HEAD~1", { log: () => {} });
console.log(
  `opened ${open.commit.slice(0, 8)} with ${open.data === "then" ? "the data from then" : "samples"} in ${Math.round((Date.now() - started) / 1000)} s`,
);
let page;
for (let i = 0; i < 120 && !page; i++) {
  try {
    const answer = await fetch(`http://localhost:${open.port}/`, {
      signal: AbortSignal.timeout(30000),
    });
    if (answer.status < 500) page = answer.status;
  } catch {}
  if (!page) await new Promise((r) => setTimeout(r, 1000));
}
if (!page) throw new Error("the old version did not answer");
console.log(`the old version answers ${page}`);
closeOldVersion(dir);
await new Promise((r) => setTimeout(r, 3000));
if (openVersion(dir)) throw new Error("the record is still there");
if (existsSync(open.folder) || existsSync(open.home))
  throw new Error("the copy's folders are still there");
if (data() !== before.data) throw new Error("the project's data changed");
if (worktrees() !== before.worktrees) throw new Error("Git lists another worktree");
console.log("closed: the project's data, worktrees and folders are as before");
process.exit(0);
