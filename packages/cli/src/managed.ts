import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type Diagnostic, formatDiagnostic } from "@smithable/core";
import type { Io } from "./io.js";
import { childEnv } from "./secrets.js";
import { loadSpec } from "./validate.js";

/**
 * The managed files (docs/design/apply-old-version.md §3): what a change from files (an undo of
 * an earlier change, a version applied) reads, writes and takes away. The five spec files, the
 * project's themes, its language files and its samples (sample records and sample users).
 */
export const SPEC_FILES = {
  spec: "smithable.yml",
  auth: "smithable.auth.yml",
  content: "smithable.content.yml",
  ux: "smithable.ux.yml",
  context: "smithable.context.yml",
} as const;

const SPEC_PATHS = new Set<string>(Object.values(SPEC_FILES));

/** Whether a project path (forward slashes, from the project's root) is a managed file. */
export function isManaged(path: string): boolean {
  return (
    SPEC_PATHS.has(path) ||
    /^smithable\.content\.[A-Za-z-]+\.yml$/.test(path) ||
    /^(themes|samples)\/[^/]+\.ya?ml$/.test(path)
  );
}

/** A managed file's text at a commit, or null when the commit has none (or cannot be read). */
export function showAt(dir: string, rev: string, path: string): string | null {
  const r = spawnSync("git", ["show", `${rev}:${path}`], {
    env: childEnv(),
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return r.status === 0 ? r.stdout : null;
}

/** Every managed file a commit has, with its text; undefined when the commit cannot be read. */
export function managedAt(dir: string, rev: string): Record<string, string> | undefined {
  const r = spawnSync("git", ["ls-tree", "-r", "--name-only", rev], {
    env: childEnv(),
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (r.status !== 0) return undefined;
  const files: Record<string, string> = {};
  for (const path of r.stdout.split("\n").filter(isManaged)) {
    const text = showAt(dir, rev, path);
    if (text === null) return undefined;
    files[path] = text;
  }
  return files;
}

/** Every managed file the project's folder has now, with its text. */
export function managedOnDisk(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const add = (path: string) => {
    const at = join(dir, path);
    if (existsSync(at) && statSync(at).isFile()) files[path] = readFileSync(at, "utf8");
  };
  for (const path of readdirSync(dir)) if (isManaged(path)) add(path);
  for (const folder of ["themes", "samples"]) {
    const at = join(dir, folder);
    if (!existsSync(at) || !statSync(at).isDirectory()) continue;
    for (const name of readdirSync(at))
      if (isManaged(`${folder}/${name}`)) add(`${folder}/${name}`);
  }
  return files;
}

/** The managed files that differ between two sets: each changed or added path's text, null for a removed one. */
export function managedDiff(
  from: Record<string, string>,
  to: Record<string, string>,
): Record<string, string | null> {
  const changes: Record<string, string | null> = {};
  for (const [path, text] of Object.entries(to)) if (from[path] !== text) changes[path] = text;
  for (const path of Object.keys(from)) if (!(path in to)) changes[path] = null;
  return changes;
}

/**
 * The errors the project would have with these managed files over the ones on disk, each as a
 * line: every file checked by today's validators against the others (the UX against the plan's
 * themes, the content against its language files, the samples against its models and roles),
 * with the project's own plugins. The files are laid out in a scratch folder and read as a
 * project is; nothing in the project is touched.
 */
export function validateManaged(dir: string, files: Record<string, string | null>): string[] {
  const scratch = mkdtempSync(join(tmpdir(), "smithable-plan-"));
  try {
    const all = { ...managedOnDisk(dir), ...files };
    for (const [path, text] of Object.entries(all)) {
      if (text === null) continue;
      mkdirSync(dirname(join(scratch, path)), { recursive: true });
      writeFileSync(join(scratch, path), text);
    }
    const plugins = join(dir, "smithable", "plugins");
    if (existsSync(plugins))
      cpSync(plugins, join(scratch, "smithable", "plugins"), { recursive: true });
    const found: Diagnostic[] = [];
    const said: string[] = [];
    const io: Io = { out: () => {}, err: (text) => said.push(text) };
    const loaded = loadSpec(scratch, io, [], found);
    // The scratch folder's path is never said, with either separator.
    const local = (text: string) =>
      text.split(`${scratch}/`).join("").split(`${scratch}\\`).join("");
    const errors = found
      .filter((d) => d.severity === "error")
      .map((d) => local(formatDiagnostic(d)));
    // A refusal said without a finding (a missing auth file, a plugin that does not load).
    if (!errors.length && !loaded.ir)
      errors.push(local(said.join("").trim()) || "The files could not be read.");
    return errors;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
