import { spawnSync } from "node:child_process";

export function git(dir: string, args: string[]): { ok: boolean; out: string } {
  const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  return { ok: result.status === 0, out: `${result.stdout}${result.stderr}`.trim() };
}

/** Makes `dir` a Git repository with a first commit, if it is not one yet. */
export function ensureRepository(dir: string): void {
  if (git(dir, ["rev-parse", "--is-inside-work-tree"]).ok) return;
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "smithable: start of history"]);
}

/** Uncommitted changes, as `git status --short` lines. */
export function uncommitted(dir: string): string[] {
  return git(dir, ["status", "--porcelain"]).out.split("\n").filter(Boolean);
}

/** Puts every file back as in the last commit: undoes a failed operation's writes. */
export function discardChanges(dir: string): void {
  git(dir, ["checkout", "--", "."]);
  git(dir, ["clean", "-fdq"]);
}
