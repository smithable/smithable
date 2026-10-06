import { restoreDatabase } from "./database.js";
import { git, ownRepository, trailer, uncommittedRefusal } from "./git.js";
import { exec, type Io } from "./io.js";

/**
 * `smithable undo`: reverts the most recent operation that is not undone yet. The revert is
 * a new commit, so an undo can itself be undone with Git. The dev database goes back to
 * its snapshot from before the operation.
 */
export function undo(dir: string, io: Io): number {
  if (!ownRepository(dir)) {
    io.err("There is nothing to undo: this project has no history yet.\n");
    return 1;
  }
  const refused = uncommittedRefusal(dir);
  if (refused) {
    io.err(refused);
    return 1;
  }
  const log = git(dir, ["log", "--format=%H%x1f%s%x1f%b%x1e"])
    .out.split("\x1e")
    .filter((e) => e.trim());
  const reverted = new Set<string>();
  let target: { sha: string; subject: string; snapshot?: string } | undefined;
  for (const entry of log) {
    const [sha = "", subject = "", body = ""] = entry.trim().split("\x1f");
    for (const match of body.matchAll(/This reverts commit ([0-9a-f]{40})/g))
      reverted.add(match[1] ?? "");
    if (!subject.startsWith("smithable: ") || subject === "smithable: start of history") continue;
    // A change that set the project up for its owner (op --setup) is not the owner's to undo.
    if (reverted.has(sha) || trailer(body, "Smithable-Setup")) continue;
    const snapshot = trailer(body, "Smithable-Snapshot");
    target = { sha, subject, ...(snapshot && snapshot !== "none" ? { snapshot } : {}) };
    break;
  }
  if (!target) {
    io.err("There is no operation to undo.\n");
    return 1;
  }
  const revert = git(dir, ["revert", "--no-edit", target.sha]);
  if (!revert.ok) {
    git(dir, ["revert", "--abort"]);
    io.err(
      `Could not undo "${target.subject.slice(11)}": later changes touch the same files.\n${revert.out}\n`,
    );
    return 1;
  }
  // A change that swapped packages (e.g. a theme's font) removed some from node_modules: the
  // restored package.json needs them back.
  const touched = git(dir, ["show", "--name-only", "--format=", target.sha]).out.split("\n");
  if (touched.some((f) => f === "package.json" || f === "pnpm-lock.yaml")) {
    if (exec("pnpm", ["install", "--silent"], dir) !== 0)
      io.err("Reinstalling the packages failed: run pnpm install.\n");
  }
  const restored = target.snapshot ? restoreDatabase(dir, target.snapshot) : false;
  io.out(
    `Undid: ${target.subject.slice(11)}.${restored ? " The dev database is back as it was before." : ""}\n` +
      (restored ? "Restart the dev server if it is running.\n" : ""),
  );
  return 0;
}
