import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "./generate.js";
import { exec, type Io } from "./io.js";
import { STARTERS } from "./starters.gen.js";

/** `smithable new <dir>`: a new project from a starter spec, with sample data. */
export function create(dir: string, io: Io, starter: string): number {
  const spec = STARTERS[starter];
  if (spec === undefined) {
    io.err(`Unknown starter "${starter}". Available: ${Object.keys(STARTERS).join(", ")}.\n`);
    return 2;
  }
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    io.err(`${dir} already exists and is not empty.\n`);
    return 1;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "smithable.yml"), spec);
  const code = generate(dir, io, { tools: true, force: false });
  if (code !== 0) return code;
  if (exec("pnpm", ["db:seed"], dir) !== 0)
    io.err("Could not add sample data; the app works without it.\n");
  io.out(`\nCreated ${dir}. Start it with:\n\n  cd ${dir}\n  smithable run\n`);
  return 0;
}
