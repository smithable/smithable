// A push that changes a browser walk needs a passing local run of that walk with the same file
// (.githooks/pre-push). A walk that passes calls walkRecord, a single run and the gate's alike, which
// notes each of its files by content (git's blob), under the clone's common git dir beside the
// gate's marks, so every worktree shares them. `node scripts/walk-record.mjs check <base> <head>` is
// the hook's question.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

/** Each walk by its entry, and how to run it. Its files are the entry and what it imports. */
export const WALKS = {
  "scripts/test-apps.mjs": "pnpm test:apps:one <an example that runs the changed step>",
  "scripts/test-studio.mjs": "pnpm test:studio",
  "scripts/test-apps-parallel.mjs": "node scripts/test-apps-parallel.mjs <an example>",
  "scripts/test-studio-look.mjs": "node scripts/test-studio-look.mjs",
};
/** What the walks stand on and holds no step: a change here asks for no run. */
const SUPPORT = [
  "dev-app",
  "fake-model",
  "patience",
  "ports",
  "studio-test-processes",
  "walk-record",
].map((name) => `scripts/${name}.mjs`);
const WAY_OUT = "Walk-not-run";

/** A walk's files, from `read(path)`: the source, or undefined for a file that is not there. */
export function walkFiles(entry, read) {
  const files = new Set();
  const add = (path) => {
    if (files.has(path) || SUPPORT.includes(path)) return;
    const source = read(path);
    if (source === undefined) return;
    files.add(path);
    for (const [, name] of source.matchAll(
      /(?:\bfrom\s+|\bimport\s*\(?\s*)"(\.{1,2}\/[^"]+\.mjs)"/g,
    ))
      add(posix.join(posix.dirname(path), name));
  };
  add(entry);
  return [...files];
}

const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
const records = (cwd) =>
  join(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"), "verified", "walk");

/**
 * Call when a walk starts: it takes its files' contents as they are then. The function returned is
 * for a run that passed, with what it ran (the example apps' names).
 */
export function walkRecord(entry, repo = fileURLToPath(new URL("..", import.meta.url))) {
  let blobs = [];
  let dir;
  try {
    const files = walkFiles(entry, (path) =>
      existsSync(join(repo, path)) ? readFileSync(join(repo, path), "utf8") : undefined,
    );
    // Asked first: Git hashes a file outside a repository too, and the note would then fail.
    dir = records(repo);
    blobs = files.map((file) => git(repo, "hash-object", file));
  } catch {
    // Not a clone of Git: there is no push to guard.
  }
  return (ran) => {
    if (!blobs.length) return;
    mkdirSync(dir, { recursive: true });
    for (const blob of blobs)
      appendFileSync(join(dir, blob), `${ran}\t${new Date().toISOString()}\n`);
  };
}

/**
 * Each walk file the commits from `base` to `head` add or change: whether a run passed with it
 * (`ran`), or a commit with the trailer has the same content (`reason`), or neither. It sees a
 * walk's own files only: a change to the product that breaks an unchanged step is CI's to find.
 */
export function checkWalks(base, head, cwd = process.cwd()) {
  // -z: a name with letters beyond ASCII comes as it is, not quoted.
  const names = ["diff", "--name-only", "-z", "--no-renames", "--diff-filter=d", base, head];
  const changed = git(cwd, ...names)
    .split("\0")
    .filter(Boolean);
  const read = (path) => {
    try {
      return git(cwd, "show", `${head}:${path}`);
    } catch {
      return undefined;
    }
  };
  const excused = git(
    cwd,
    "log",
    `--format=%H%x09%(trailers:key=${WAY_OUT},valueonly,separator=%x20)`,
    `${base}..${head}`,
  )
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([, reason]) => reason?.trim());
  const blobAt = (commit, path) => {
    try {
      return git(cwd, "rev-parse", `${commit}:${path}`);
    } catch {
      return undefined;
    }
  };
  const found = [];
  for (const [entry, run] of Object.entries(WALKS)) {
    for (const file of walkFiles(entry, read)) {
      // A file two walks share is satisfied by either: records go by content.
      if (!changed.includes(file) || found.some((f) => f.file === file)) continue;
      const blob = blobAt(head, file);
      const record = join(records(cwd), blob);
      const ran = existsSync(record)
        ? [
            ...new Set(
              readFileSync(record, "utf8")
                .split("\n")
                .filter(Boolean)
                .map((line) => line.split("\t")[0]),
            ),
          ].join(", ")
        : undefined;
      const reason = ran ? undefined : excused.find(([c]) => blobAt(c, file) === blob)?.[1];
      found.push({ file, run, ran, reason });
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, base, head] = process.argv.slice(2);
  if (command !== "check" || !base || !head) {
    console.error("usage: node scripts/walk-record.mjs check <base> <head>");
    process.exit(2);
  }
  const found = checkWalks(base, head);
  for (const { file, ran, reason } of found) {
    if (ran) console.error(`pre-push: ${file}: this content passed a run (${ran}).`);
    else if (reason) console.error(`pre-push: ${file}: not run, ${WAY_OUT}: ${reason}`);
  }
  const missing = found.filter((f) => !f.ran && !f.reason);
  if (!missing.length) process.exit(0);
  for (const { file } of missing)
    console.error(
      `pre-push: not pushed: ${file} has changes with no passing run of it as committed.`,
    );
  for (const run of new Set(missing.map((f) => f.run))) console.error(`Run: ${run}`);
  console.error(
    `If it cannot run here, a commit trailer "${WAY_OUT}: <reason>" lets the push through.`,
  );
  process.exit(1);
}
