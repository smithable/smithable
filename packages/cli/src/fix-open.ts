// A held fix opened on its branch (fixes-reach-apps §5) runs the held version's code, and its
// migrations, on the project's one dev database. So opening it keeps a snapshot of that database,
// and leaving the branch puts it back: the held version's migrations never stay on today's dev
// data (T240, Fable M433; the full copy, with edits brought back, is an open design question).
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { restoreDatabase, snapshotDatabase } from "./database.js";
import { git } from "./git.js";

const record = (dir: string) => join(dir, "data", ".smithable", "fix-open.json");

/** Before the fix's branch is checked out: the dev database as it is, and which branch it is for. */
export function rememberBeforeFix(dir: string, branch: string): void {
  if (existsSync(record(dir))) return; // Already kept, from the first time this fix was opened.
  const snapshot = `fix-open-${branch.replace(/[^\w-]/g, "-")}`;
  if (!snapshotDatabase(dir, snapshot)) return;
  writeFileSync(record(dir), JSON.stringify({ branch, snapshot }));
}

/**
 * Once the project is on another branch than the fix's, the database kept before it goes back.
 * Returns whether it did.
 */
export function backFromFix(dir: string): boolean {
  if (!existsSync(record(dir))) return false;
  const kept = JSON.parse(readFileSync(record(dir), "utf8")) as {
    branch: string;
    snapshot: string;
  };
  const now = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
  if (now === kept.branch) return false;
  const restored = restoreDatabase(dir, kept.snapshot);
  rmSync(record(dir), { force: true });
  return restored;
}
