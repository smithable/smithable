import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Diagnostic,
  formatDiagnostic,
  type SpecIR,
  validateAuth,
  validateContent,
  validateContext,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { restoreDatabase } from "./database.js";
import { git, ownRepository, trailer, uncommittedRefusal } from "./git.js";
import { exec, type Io } from "./io.js";
import { type FilesPlan, lostFields, runFilesChange } from "./op.js";
import { loadPlugins } from "./plugins.js";
import { projectThemes } from "./validate.js";

/** A change in the history that can still be undone, newest first. */
interface Change {
  sha: string;
  /** Without "smithable: ". */
  subject: string;
  snapshot?: string;
}

/** The changes that are a person's own and not undone, newest first. */
export function undoableChanges(dir: string): Change[] {
  const log = git(dir, ["log", "--format=%H%x1f%s%x1f%b%x1e"])
    .out.split("\x1e")
    .filter((e) => e.trim());
  const reverted = new Set<string>();
  const changes: Change[] = [];
  for (const entry of log) {
    const [sha = "", subject = "", body = ""] = entry.trim().split("\x1f");
    for (const match of body.matchAll(/This reverts commit ([0-9a-f]{40})/g))
      reverted.add(match[1] ?? "");
    if (!subject.startsWith("smithable: ") || subject === "smithable: start of history") continue;
    // A change that set the project up for its owner (op --setup) is not the owner's to undo.
    if (reverted.has(sha) || trailer(body, "Smithable-Setup")) continue;
    const snapshot = trailer(body, "Smithable-Snapshot");
    changes.push({
      sha,
      subject: subject.slice(11),
      ...(snapshot && snapshot !== "none" ? { snapshot } : {}),
    });
  }
  return changes;
}

const EDITABLE: { key: keyof FilesPlan["files"]; path: string }[] = [
  { key: "spec", path: "smithable.yml" },
  { key: "auth", path: "smithable.auth.yml" },
  { key: "content", path: "smithable.content.yml" },
  { key: "ux", path: "smithable.ux.yml" },
  { key: "context", path: "smithable.context.yml" },
];

/**
 * Undoes one change by its id, not only the newest (docs/design/studio-v3.md §3). The newest is
 * undone as `undo` does, its commit reverted and the database snapshot put back. An earlier one
 * is reversed as a new change: its spec files are merged back three ways (revertedFiles), only
 * they, and go through the ordinary pipeline (validated, regenerated, migrated forward,
 * committed) once two checks pass: the merge applies (a later change did not edit the same
 * part), and the spec after it is valid, which is
 * the dependency check: the validator's words name what a later change still needs ("page orders:
 * model Order does not exist"). A column that goes with it is a data loss and asks first, like
 * any change. `check` only says whether it is safe, and changes nothing.
 */
export async function undoChange(
  dir: string,
  io: Io,
  change: string,
  flags: { check?: boolean; yes?: boolean } = {},
): Promise<number> {
  if (!ownRepository(dir)) {
    io.err("There is nothing to undo: this project has no history yet.\n");
    return 1;
  }
  const refused = uncommittedRefusal(dir);
  if (refused) {
    io.err(refused);
    return 1;
  }
  const changes = undoableChanges(dir);
  const target = /^[0-9a-f]{7,40}$/.test(change)
    ? changes.find((c) => c.sha.startsWith(change))
    : undefined;
  if (!target) {
    io.err(`No change ${change} to undo: it is not in the history, or it is undone already.\n`);
    return 1;
  }
  if (target.sha === changes[0]?.sha) {
    if (flags.check) {
      io.out(`Safe to undo "${target.subject}": it is the newest change.\n`);
      return 0;
    }
    return undo(dir, io);
  }
  // The files as they would be with the change taken out: each spec file three-way merged, what
  // the change left as the base, what it started from as the other side, the file now as ours.
  // Only the spec files: the change's generated files and migration stay, the pipeline makes new
  // ones, and a revert of the whole commit would clash on them with every later change.
  const reverted = revertedFiles(dir, target.sha);
  if ("conflict" in reverted) {
    io.err(
      `Cannot undo "${target.subject}": a later change edited the same part (${reverted.conflict}). Undo that one first.\n`,
    );
    return 1;
  }
  const files = reverted.files;
  if (files.spec === null || files.spec === undefined) {
    io.err(`Cannot undo "${target.subject}": it made the app itself.\n`);
    return 1;
  }
  // The dependency check: the spec without the change, valid or not.
  const problems = check(dir, files);
  if (problems.length) {
    io.err(
      `Cannot undo "${target.subject}": later changes depend on it.\n${problems.map((p) => `  ${p}`).join("\n")}\n`,
    );
    return 1;
  }
  const lost = lostFieldsOf(dir, files.spec);
  if (flags.check) {
    io.out(
      `Safe to undo "${target.subject}".${lost.length ? ` It deletes the ${lost.join(", ")} ${lost.length === 1 ? "column" : "columns"} and the values in ${lost.length === 1 ? "it" : "them"}, so it asks first.` : ""}\n`,
    );
    return 0;
  }
  return runFilesChange(
    dir,
    io,
    {
      files,
      subject: `Revert "smithable: ${target.subject}"`,
      body: `This reverts commit ${target.sha}.`,
      description: `Undid: ${target.subject}`,
      recorded: { op: "undo", args: { change: target.sha } },
    },
    { yes: flags.yes === true },
  );
}

/**
 * The spec files with one change taken out, or the file a later change edited in the same place.
 * For each file: as the change left it (the base), as it was before the change (the other side)
 * and as it is now (ours), merged three ways by git; a file the change added goes only when
 * nothing edited it since, one the change removed comes back only when nothing re-added it.
 */
export function revertedFiles(
  dir: string,
  sha: string,
): { files: FilesPlan["files"] } | { conflict: string } {
  const files: FilesPlan["files"] = {};
  const show = (rev: string, path: string) => {
    const r = spawnSync("git", ["show", `${rev}:${path}`], { cwd: dir, encoding: "utf8" });
    return r.status === 0 ? r.stdout : null;
  };
  for (const { key, path } of EDITABLE) {
    const base = show(sha, path);
    const other = show(`${sha}^`, path);
    if (base === other) continue;
    const at = join(dir, path);
    const ours = existsSync(at) ? readFileSync(at, "utf8") : null;
    if (ours === base) {
      files[key] = other;
      continue;
    }
    if (base === null || other === null || ours === null) return { conflict: path };
    const scratch = mkdtempSync(join(tmpdir(), "smithable-undo-"));
    try {
      const names = ["ours", "base", "other"].map((n) => join(scratch, n));
      writeFileSync(names[0] as string, ours);
      writeFileSync(names[1] as string, base);
      writeFileSync(names[2] as string, other);
      const merged = spawnSync("git", ["merge-file", "-p", ...names], {
        cwd: dir,
        encoding: "utf8",
      });
      if (merged.status !== 0) return { conflict: path };
      files[key] = merged.stdout;
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  return { files };
}

/** The errors the spec files would have with the change taken out, each as a line. */
function check(dir: string, files: FilesPlan["files"]): string[] {
  const plugins = loadPlugins(dir);
  const errors = (ds: Diagnostic[]) =>
    ds.filter((d) => d.severity === "error").map((d) => formatDiagnostic(d));
  const spec = validateSpec({ path: "smithable.yml", text: files.spec ?? "" }, { plugins });
  const problems = errors(spec.diagnostics);
  const ir = spec.ir as SpecIR | undefined;
  if (!ir) return problems;
  if (files.auth)
    problems.push(
      ...errors(validateAuth({ path: "smithable.auth.yml", text: files.auth }, ir).diagnostics),
    );
  if (files.content)
    problems.push(
      ...errors(
        validateContent({ path: "smithable.content.yml", text: files.content }, ir).diagnostics,
      ),
    );
  if (files.ux)
    problems.push(
      ...errors(
        validateUx({ path: "smithable.ux.yml", text: files.ux }, ir, projectThemes(dir))
          .diagnostics,
      ),
    );
  if (files.context)
    problems.push(
      ...errors(validateContext({ path: "smithable.context.yml", text: files.context })),
    );
  return problems;
}

/** The stored fields the project has now that the text has not. */
function lostFieldsOf(dir: string, text: string): string[] {
  const plugins = loadPlugins(dir);
  const now = validateSpec(
    { path: "smithable.yml", text: readFileSync(join(dir, "smithable.yml"), "utf8") },
    { plugins },
  ).ir;
  const then = validateSpec({ path: "smithable.yml", text }, { plugins }).ir;
  return now && then ? lostFields(now, then) : [];
}

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
