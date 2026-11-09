// The weekly run's last part (C 67, Fable 70): a starter made with `smithable new`, a random
// sequence of changes through the command line, then the app's own type check. A sequence the
// operation layer takes must leave an app that type-checks; a change it refuses is fine. The
// seed makes the sequences again: node scripts/random-typecheck.mjs --seed <n> [--runs <n>]
// [--starters crm,booking] [--steps 4]. Needs `pnpm build` first and the network for installs.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { validateSpec } from "../packages/core/dist/index.js";

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "1" },
    runs: { type: "string", default: "3" },
    steps: { type: "string", default: "4" },
    starters: { type: "string", default: "crm,booking,invoicing,status" },
  },
});
const cli = join(import.meta.dirname, "../packages/cli/dist/bin.js");
const seed = Number(values.seed);
const runs = Number(values.runs);
const steps = Number(values.steps);
const starters = values.starters.split(",");
if (![seed, runs, steps].every(Number.isInteger))
  throw new Error("--seed, --runs and --steps are whole numbers");

/** A small seeded generator (mulberry32), so a seed makes the same sequence again. */
function random(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NAMES = ["phone", "due", "code", "level", "tag", "note"];
const TYPES = ["string", "text", "int", "money", "date", "bool", "email", "low | high"];

function change(dir, next) {
  const pick = (list) => list[Math.floor(next() * list.length)];
  const ir = validateSpec({
    path: "smithable.yml",
    text: readFileSync(join(dir, "smithable.yml"), "utf8"),
  }).ir;
  const model = pick(ir?.models ?? []);
  const fields = (model?.fields ?? []).filter((f) => f.type.kind !== "relation");
  const field = pick(fields.length ? fields : [{ name: "name" }]);
  switch (pick(["addModel", "addField", "renameField", "removeField"])) {
    case "addModel":
      return ["addModel", `Thing${Math.floor(next() * 4)}`, `${pick(NAMES)}=${pick(TYPES)}`];
    case "addField":
      return ["addField", model?.name ?? "Missing", pick(NAMES), pick(TYPES)];
    case "renameField":
      return ["renameField", model?.name ?? "Missing", field.name, `${pick(NAMES)}Renamed`];
    default:
      return ["removeField", model?.name ?? "Missing", field.name];
  }
}

const run = (args, cwd) =>
  spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8", timeout: 600_000 });
const failures = [];
for (let i = 0; i < runs; i++) {
  const next = random(seed * 1000 + i);
  const starter = starters[Math.floor(next() * starters.length)];
  const root = mkdtempSync(join(tmpdir(), "smithable-random-typecheck-"));
  try {
    const made = run(
      [
        process.execPath,
        cli,
        "new",
        "app",
        "--starter",
        starter,
        "--admin",
        "owner@sample.example",
        "--yes",
      ],
      root,
    );
    if (made.status !== 0)
      throw new Error(`smithable new: ${(made.stdout + made.stderr).slice(-600)}`);
    const dir = join(root, "app");
    const done = [];
    for (let s = 0; s < steps; s++) {
      const op = change(dir, next);
      const r = run([process.execPath, cli, "op", ...op, "--yes"], dir);
      if (r.status === 0) done.push(op.join(" "));
    }
    const checked = run(["pnpm", "typecheck"], dir);
    const line = `run ${i} (${starter}): ${done.length ? done.join("; ") : "no change taken"}`;
    if (checked.status !== 0) {
      failures.push(`${line}\n${(checked.stdout + checked.stderr).slice(-2000)}`);
      console.log(`✗ ${line}`);
    } else console.log(`✓ ${line}`);
  } catch (error) {
    failures.push(`run ${i} (${starter}): ${error.message}`);
    console.log(`✗ run ${i} (${starter}): ${error.message.split("\n")[0]}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
if (failures.length) {
  console.log(
    `\nType check after random changes failed (seed ${seed}):\n\n${failures.join("\n\n")}`,
  );
  process.exit(1);
}
console.log(`\n${runs} random sequences type-checked (seed ${seed}).`);
