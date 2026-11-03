import { randomUUID } from "node:crypto";
import { git, ownRepository, trailer, uncommittedRefusal } from "./git.js";
import type { Io } from "./io.js";
import { runOperation } from "./op.js";
import { projectRevision } from "./project-revision.js";

/**
 * `smithable redo`: makes again the most recent change that was undone, as long as no other
 * change came after the undo. It runs the operation again from its own record (the commit's
 * Smithable-Op), so the files, the migration and the database snapshot are made as the first
 * time; the new commit names the undo it takes back (Smithable-Redo), so several undos are
 * redone in turn.
 */
export async function redo(dir: string, io: Io): Promise<number> {
  if (!ownRepository(dir)) {
    io.err("There is nothing to redo: this project has no history yet.\n");
    return 1;
  }
  const refused = uncommittedRefusal(dir);
  if (refused) {
    io.err(refused);
    return 1;
  }
  const target = redoTarget(dir);
  if (!target) {
    io.err(
      "There is nothing to redo: Redo makes again a change you undid, until you make another.\n",
    );
    return 1;
  }
  const record = trailer(
    git(dir, ["show", "-s", "--format=%b", target.change]).out,
    "Smithable-Op",
  );
  let recorded: { op?: string; args?: Record<string, unknown> } = {};
  try {
    recorded = JSON.parse(record ?? "{}");
  } catch {}
  // A whole edited spec keeps no arguments to run again.
  if (!recorded.op || recorded.op === "editSpec") {
    io.err("This change cannot be redone: make it again.\n");
    return 1;
  }
  // A theme Apply's precondition and request id are the host's, not the record's: this redo is
  // a request of its own, against the source as it is now. A record from before 2026-11-03 still
  // has them among its arguments; they are left out.
  const { expectedRevision: _revision, requestId: _request, ...args } = recorded.args ?? {};
  return runOperation(
    dir,
    io,
    recorded.op,
    recorded.op === "applyTheme" ? args : (recorded.args ?? {}),
    {
      yes: true,
      expectedRevision: projectRevision(dir),
      ...(recorded.op === "applyTheme" ? { requestId: randomUUID() } : {}),
      trailer: `Smithable-Redo: ${target.undo}`,
    },
  );
}

/**
 * What Redo would make again: from the newest commit back, a redo takes back the undo it names,
 * an undo not taken back is the one, and any other change ends what can be redone.
 */
export function redoTarget(dir: string): { undo: string; change: string } | undefined {
  if (!ownRepository(dir)) return undefined;
  const log = git(dir, ["log", "--format=%H%x1f%s%x1f%b%x1e"])
    .out.split("\x1e")
    .filter((e) => e.trim());
  const redone = new Set<string>();
  for (const entry of log) {
    const [sha = "", subject = "", body = ""] = entry.trim().split("\x1f");
    const redid = trailer(body, "Smithable-Redo");
    if (redid) {
      redone.add(redid);
      continue;
    }
    const reverted = /This reverts commit ([0-9a-f]{40})/.exec(body)?.[1];
    if (!subject.startsWith('Revert "smithable: ') || !reverted) return undefined;
    if (!redone.has(sha)) return { undo: sha, change: reverted };
  }
  return undefined;
}
