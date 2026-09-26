import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { generateApp } from "@smithable/adapter-tanstack";
import { exec, type Io } from "./io.js";
import { loadSpec } from "./validate.js";
import { VERSION } from "./version.js";

const RECORD = ".smithable/files.json";

interface FileRecord {
  /** Smithable-owned files and the hash of what Smithable last wrote. */
  files: Record<string, string>;
}

export interface GenerateFlags {
  /** Install dependencies and run the app's own generators (migrations, route tree). */
  tools: boolean;
  /** Overwrite hand-edited Smithable-owned files. */
  force: boolean;
}

/** `smithable generate [dir]`: writes the app for the spec in `dir`. */
export function generate(dir: string, io: Io, flags: GenerateFlags): number {
  const { ir, content } = loadSpec(dir, io);
  if (!ir) return 1;
  const files = generateApp(ir, { smithableVersion: VERSION, ...(content ? { content } : {}) });
  const previous = readRecord(dir);

  // Never overwrite or delete a Smithable-owned file that was edited by hand.
  const edited = Object.entries(previous.files)
    .filter(([path, hash]) => existsSync(join(dir, path)) && hashFile(join(dir, path)) !== hash)
    .map(([path]) => path);
  if (edited.length > 0 && !flags.force) {
    io.err(
      `These files are owned by Smithable but were edited by hand:\n${edited.map((p) => `  ${p}\n`).join("")}` +
        "Move the changes into smithable.yml or src/custom/, or run with --force to overwrite them.\n",
    );
    return 1;
  }

  const next: FileRecord = { files: {} };
  let written = 0;
  for (const file of files) {
    const path = join(dir, file.path);
    if (file.zone === "scaffold") {
      if (existsSync(path)) continue;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content);
      written++;
      continue;
    }
    next.files[file.path] = hash(file.content);
    if (existsSync(path) && readFileSync(path, "utf8") === file.content) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
    written++;
  }
  // Delete only what the generator no longer produces; scaffold files are never removed.
  const produced = new Set(files.map((f) => f.path));
  const removed = Object.keys(previous.files).filter((path) => !produced.has(path));
  for (const path of removed) rmSync(join(dir, path), { force: true });
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, RECORD), `${JSON.stringify(next, null, 2)}\n`);
  io.out(`Generated ${files.length} files (${written} changed, ${removed.length} removed).\n`);

  if (!flags.tools) return 0;
  return runTools(dir, io);
}

/** Installs dependencies, then lets the app's own tools create migrations and the route tree. */
export function runTools(dir: string, io: Io): number {
  const steps: [string, string[]][] = [
    ["pnpm", ["install", "--silent"]],
    ["pnpm", ["exec", "drizzle-kit", "generate"]],
    ["pnpm", ["exec", "tsr", "generate"]],
  ];
  for (const [command, args] of steps) {
    const code = exec(command, args, dir);
    if (code !== 0) {
      io.err(`\`${command} ${args.join(" ")}\` failed.\n`);
      return code;
    }
  }
  return 0;
}

function readRecord(dir: string): FileRecord {
  try {
    return JSON.parse(readFileSync(join(dir, RECORD), "utf8")) as FileRecord;
  } catch {
    return { files: {} };
  }
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function hashFile(path: string): string {
  return hash(readFileSync(path, "utf8"));
}
