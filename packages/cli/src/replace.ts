// A workspace that waits with Studio running gets its app when someone claims it
// (docs/design/fast-start.md): the project's files are replaced by another app's, and only the
// preview starts again. Every app of a stack profile has the same packages, so what is installed
// stays. Studio allows it once, and only when it was started as replaceable.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { generate } from "./generate.js";
import type { Io } from "./io.js";
import { administered, create, named, withoutSampleDomains } from "./new.js";

export interface Replacement {
  /** A finished project on this machine's disk, as `smithable new` made it (no node_modules needed). */
  from?: string;
  /** Or a description: the app is made as `smithable new --describe` makes it. */
  describe?: string;
  starter?: string;
  answers?: string;
  /** The app's name as the person typed it, and their address as its administrator. */
  name?: string;
  admin?: string;
}

const SPEC_FILES = [
  "smithable.yml",
  "smithable.auth.yml",
  "smithable.content.yml",
  "smithable.ux.yml",
];

/**
 * Where the making of an app is, for whoever watches it (docs/design/while-it-is-made.md):
 * the model is drafting it, it is being built from the draft (whose files are told then), it
 * is coming in under the preview.
 */
export type MakingStage = "drafting" | "building" | "arriving";
/** Before the making: the description is read by a model, or the person is asked. */
export type AskingStage = "reading" | "asking";
export type Progress = (stage: MakingStage, draft?: Record<string, string>) => void;

/** What decides the install: the same in both means the packages installed here fit. */
function installed(dir: string): string {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const workspace = join(dir, "pnpm-workspace.yaml");
  return JSON.stringify([
    pkg.dependencies,
    pkg.devDependencies,
    pkg.packageManager,
    existsSync(workspace) ? readFileSync(workspace, "utf8") : "",
  ]);
}

/** Studio's own settings for the preview, which belong to the workspace, not to the app. */
const PREVIEW_CONFIG = join("data", ".smithable", "preview.vite.config.mjs");
const stays = (path: string) =>
  path === PREVIEW_CONFIG || ["node_modules", ".git"].includes(path.split(sep)[0] ?? "");

/** Every file under `root`, as paths from it; what `stays` is left out. Refuses symlinks. */
function filesOf(root: string, under = ""): string[] {
  return readdirSync(join(root, under), { withFileTypes: true }).flatMap((entry) => {
    const path = join(under, entry.name);
    if (stays(path)) return [];
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${path}`);
    const resolved = resolve(root, path);
    // Explicitly verify we stay within the source directory even without symlinks
    if (!resolved.startsWith(`${resolve(root)}${sep}`))
      throw new Error(`Path escaped root: ${path}`);
    return entry.isDirectory() ? filesOf(root, path) : [path];
  });
}

/** The route tree the dev server's router reads: it names every route file, so it comes in last. */
const ROUTE_TREE = join("src", "routeTree.gen.ts");

/**
 * The order the new app's files come in: the route tree after every other file. The folder's
 * own order put it first (routeTree.gen.ts before routes/), and a page the preview rendered in
 * between failed on the tree's import of a route file that was not there yet ("Failed to
 * resolve import ./routes/items/index from src/routeTree.gen.ts", a hosted workspace claimed
 * with another app, 2026-10-23); rendered on the server, that page had no client to reload it.
 */
export function arrival(paths: Iterable<string>): string[] {
  const all = [...paths];
  return [...all.filter((p) => p !== ROUTE_TREE), ...all.filter((p) => p === ROUTE_TREE)];
}

/**
 * Makes `dir` hold the files `from` holds. What is gone goes first (a database's journal must
 * not meet another database), then each file that differs comes in whole, under a new name
 * that takes the old one's place: a process that has the old file open keeps reading the old
 * one, never half of the new.
 */
/** Writes `from` over `dir`: only what differs, each file by a rename over it; what `from` lacks goes. */
export function sync(from: string, dir: string): void {
  const wanted = new Set(filesOf(from));
  const before = filesOf(dir);
  // The new app's files are written first and the old app's own files removed after: the
  // preview's dev server serves whichever route tree is on disk, and a page rendered while the
  // files move must find every module that tree names. With the removals first, the old tree
  // named a model's module that was already gone ("Failed to load url
  // /src/generated/item.ts", a replaceable Studio in main's check, 2026-10-11). Written first,
  // the old tree's modules stay until the new tree and its modules are there; and the new tree
  // comes after the files it names (arrival).
  for (const path of arrival(wanted)) {
    const source = readFileSync(join(from, path));
    const target = join(dir, path);
    if (existsSync(target) && statSync(target).isFile() && readFileSync(target).equals(source))
      continue;
    // A file of the old app where the new one has a folder: it is not wanted, so it goes now.
    for (let up = dirname(target); up.startsWith(dir) && up !== dir; up = dirname(up))
      if (existsSync(up) && statSync(up).isFile()) rmSync(up, { force: true });
    mkdirSync(dirname(target), { recursive: true });
    // A file is replaced by a rename over it, never removed first: the preview's dev server
    // keeps a list of the public files it serves, and an unlink followed by an add of the same
    // path can leave it dropped (the two events are handled out of order), so a picture the
    // replacement rewrote answered 404 until a restart (a demo's mark, 2026-10-11). A rename
    // over a file is one change to the watcher, and atomic. Only a folder in the way goes first.
    if (existsSync(target) && !statSync(target).isFile())
      rmSync(target, { recursive: true, force: true });
    writeFileSync(`${target}.incoming`, source, { mode: statSync(join(from, path)).mode });
    renameSync(`${target}.incoming`, target);
  }
  for (const path of before) {
    const target = join(dir, path);
    // Still a file: one the writes turned into a folder is the new app's now.
    if (!wanted.has(path) && existsSync(target) && statSync(target).isFile())
      rmSync(target, { force: true });
  }
  // Folders that are left empty go too (a page's folder under src/routes would still be a route).
  const prune = (under: string): boolean => {
    const entries = readdirSync(join(dir, under), { withFileTypes: true });
    let empty = true;
    for (const entry of entries) {
      const path = join(under, entry.name);
      if (stays(path) || !entry.isDirectory() || !prune(path)) empty = false;
    }
    if (empty && under) rmSync(join(dir, under), { recursive: true, force: true });
    return empty;
  };
  prune("");
}

/**
 * Has a running preview open the database again: its file was replaced, and the server side
 * still holds the old one. The module that opens it is marked as changed, so the dev server
 * loads the app's server side anew. The connection it had stays open on the file that is gone
 * until the preview's process ends: one, for a replacement.
 */
export function reopenDatabase(dir: string): void {
  const module = join(dir, "src", "db", "index.ts");
  if (existsSync(module)) utimesSync(module, new Date(), new Date());
}

/**
 * Replaces the project in `dir`. Returns 0 when the new app is in place; otherwise it says why
 * on `io.err`, and the project is as it was unless it says the starter was used instead.
 */
export async function replaceProject(
  dir: string,
  io: Io,
  to: Replacement,
  progress: Progress = () => {},
): Promise<number> {
  if (to.from) {
    const from = resolve(to.from);
    if (!existsSync(join(from, "smithable.yml")) || !existsSync(join(from, "package.json"))) {
      io.err(`${to.from} is not a finished Smithable project.\n`);
      return 1;
    }
    if (`${from}${sep}`.startsWith(`${resolve(dir)}${sep}`)) {
      io.err("The project that comes in cannot be inside the one it replaces.\n");
      return 1;
    }
    if (installed(from) !== installed(dir)) {
      io.err(
        "The app that comes in needs other packages than the ones installed here (another stack profile, or packages of its own), so it cannot take this project's place.\n",
      );
      return 1;
    }
    progress("arriving");
    // Only what differs is written, and nothing that is the same is touched: the preview's dev
    // server keeps running and keeps what it has compiled of the files every app shares (the
    // kit), as after any change. Measured locally, the new app answers in 1 to 3 s this way,
    // against 3 to 4 s with the server started again; on a hosted workspace, where a start is
    // 15 s, the difference is the point (docs/design/fast-start.md).
    sync(from, dir);
    rmSync(join(dir, ".git"), { recursive: true, force: true });
    // The person's name for the app and their own way in, as `smithable new` writes them; the
    // files that follow from the spec are generated again (no tool runs: the tables are the same).
    if (to.name?.trim() || to.admin?.trim()) {
      let files: Record<string, string> = Object.fromEntries(
        SPEC_FILES.filter((f) => existsSync(join(dir, f))).map((f) => [
          f,
          readFileSync(join(dir, f), "utf8"),
        ]),
      );
      if (to.name?.trim()) files = named(files, to.name.trim());
      if (to.admin?.trim()) files = withoutSampleDomains(administered(files, to.admin.trim()), io);
      for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
      const code = await generate(dir, io, { tools: false, force: false });
      if (code !== 0) return code;
    }
    reopenDatabase(dir);
    return 0;
  }
  if (!to.describe?.trim()) {
    io.err('Say what comes in: "from" (a finished project) or "describe".\n');
    return 2;
  }
  // From a description: made beside the project, on the packages that are installed there (a
  // link to them), then brought in like a finished one, under the running preview. So the
  // preview is not started again for it either, and a description the model could not make an
  // app from never leaves the project empty: the starter is made instead, and the reason said.
  const options = { name: to.name, admin: to.admin, yes: true, installed: true };
  const beside = `${resolve(dir)}.incoming`;
  const fresh = () => {
    rmSync(beside, { recursive: true, force: true });
    mkdirSync(beside, { recursive: true });
    symlinkSync(join(resolve(dir), "node_modules"), join(beside, "node_modules"));
    const lock = join(dir, "pnpm-lock.yaml");
    if (existsSync(lock)) copyFileSync(lock, join(beside, "pnpm-lock.yaml"));
  };
  let said = "";
  const kept: Io = {
    out: io.out,
    err: (text) => {
      said += text;
    },
  };
  try {
    fresh();
    progress("drafting");
    let made = await create(beside, kept, to.starter, {
      ...options,
      describe: to.describe,
      answers: to.answers,
      onDraft: (files) => progress("building", files),
    });
    if (made !== 0) {
      io.err(said);
      fresh();
      progress("building");
      const starter = to.starter ?? "crm";
      made = await create(beside, io, starter, options);
      if (made !== 0) return made;
      const why = /allowance/i.test(said)
        ? "the AI allowance is used up"
        : said.includes("No model is available")
          ? "no AI model is available"
          : "the AI model did not produce a working app from it";
      io.err(`Could not make the app from the description (${why}); starting from ${starter}.\n`);
      mkdirSync(join(beside, "data", ".smithable"), { recursive: true });
      writeFileSync(
        join(beside, "data", ".smithable", "notice.txt"),
        `The description could not be used this time: ${why}. This is the ${starter} starter; describe changes to it below.\n`,
      );
    }
    progress("arriving");
    sync(beside, dir);
    rmSync(join(dir, ".git"), { recursive: true, force: true });
    reopenDatabase(dir);
    return 0;
  } finally {
    rmSync(beside, { recursive: true, force: true });
  }
}
