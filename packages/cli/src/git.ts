import { spawnSync } from "node:child_process";

/**
 * Who a commit is by when Git has no name or address configured (a newly installed Git): a
 * change must not fail for that, so those commits are Smithable's own. The address can never
 * be a real one.
 */
const FALLBACK = { "user.name": "Smithable", "user.email": "studio@smithable.invalid" };
function identity(dir: string): string[] {
  return Object.entries(FALLBACK).flatMap(([key, value]) =>
    spawnSync("git", ["config", key], { cwd: dir }).status === 0 ? [] : ["-c", `${key}=${value}`],
  );
}

/**
 * The number the next change takes (ask-flows.md §8): one more than the highest
 * `Smithable-Change` trailer in the history, which undo never rewinds, so none is reused.
 */
export function nextChangeNumber(dir: string): number {
  const log = git(dir, ["log", "--format=%(trailers:key=Smithable-Change,valueonly)"]);
  return log.out.split("\n").reduce((n, line) => Math.max(n, Number(line.trim()) || 0), 0) + 1;
}

/**
 * Whether a commit message is one of the person's changes, the ones Changes shows and numbers:
 * a change or an undo, not the start of the history or the project's setting up.
 */
export function isChangeMessage(message: string): boolean {
  const subject = message.split("\n")[0] ?? "";
  return (
    (subject.startsWith("smithable: ") || subject.startsWith('Revert "smithable: ')) &&
    subject !== "smithable: start of history" &&
    !/^Smithable-Setup: /m.test(message)
  );
}

/** The message with its change number as a trailer, in its trailer paragraph when it has one. */
function numbered(dir: string, message: string): string {
  const line = `Smithable-Change: ${nextChangeNumber(dir)}`;
  const text = message.replace(/\n+$/, "");
  const last = text.split("\n\n").at(-1) ?? "";
  return text.includes("\n\n") && /^[A-Z][\w-]+: /.test(last)
    ? `${text}\n${line}\n`
    : `${text}\n\n${line}\n`;
}

export function git(dir: string, args: string[]): { ok: boolean; out: string } {
  const who = ["commit", "revert", "tag"].includes(args[0] ?? "") ? identity(dir) : [];
  // Every change commit gets its number here, the one place they all pass through; the
  // project's mutation lock, held by every change, keeps two from taking the same one.
  const m = args[0] === "commit" ? args.indexOf("-m") + 1 : 0;
  if (m > 0 && isChangeMessage(args[m] ?? ""))
    args = [...args.slice(0, m), numbered(dir, args[m] ?? ""), ...args.slice(m + 1)];
  const safeConfig = ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false"];
  const result = spawnSync("git", [...safeConfig, ...who, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
  });
  return { ok: result.status === 0, out: `${result.stdout}${result.stderr}`.trim() };
}

/**
 * Whether `dir` is a Git repository of its own. A repository that starts in a folder above it
 * (an app made inside a clone of something else) is not the app's: its changes and undo would
 * be that repository's commits, and that repository's other edits would stand in their way.
 */
export function ownRepository(dir: string): boolean {
  const prefix = git(dir, ["rev-parse", "--show-prefix"]);
  return prefix.ok && prefix.out === "";
}

/** Makes `dir` a Git repository of its own with a first commit, if it is not one yet. */
export function ensureRepository(dir: string): void {
  if (ownRepository(dir)) return;
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "smithable: start of history"]);
}

/** Uncommitted changes, as `git status --short` lines. */
export function uncommitted(dir: string): string[] {
  return git(dir, ["status", "--porcelain"]).out.split("\n").filter(Boolean);
}

/**
 * The refusal when there are uncommitted changes (listing them), or undefined: a change made
 * on top of someone's edits could not be undone on its own.
 */
export function uncommittedRefusal(dir: string, why = ""): string | undefined {
  const dirty = uncommitted(dir);
  if (dirty.length === 0) return undefined;
  return `Commit or discard these changes first${why ? `, ${why}` : ""}:\n${dirty.map((l) => `  ${l}\n`).join("")}`;
}

/** Returns a commit message's trailer value (`Smithable-Op: …`), if it has one. */
export function trailer(body: string, key: string): string | undefined {
  return new RegExp(`^${key}: (.+)$`, "m").exec(body)?.[1];
}

/** Puts every file back as in the last commit: undoes a failed operation's writes. */
export function discardChanges(dir: string): void {
  git(dir, ["checkout", "--", "."]);
  git(dir, ["clean", "-fdq"]);
}
