import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { columnOf, plural } from "@smithable/adapter-tanstack";
import {
  type Check,
  type CheckId,
  type Consequence,
  checkOf,
  DEPTH_CHECKS,
  DEPTHS,
  type Depth,
  deepen,
  type Effect,
  type SpecIR,
  setCheck,
  storageOf,
  testsCheck,
  unverified,
  type Verification,
} from "@smithable/core";
import { findTests } from "@smithable/index";
import { countValues, databasePath } from "./database.js";
import { git, ownRepository, uncommittedRefusal } from "./git.js";
import { exec, type Io, tool } from "./io.js";
import { projectRevision } from "./project-revision.js";
import { projectIndex } from "./rules.js";
import { loadSpec } from "./validate.js";
import { VERSION } from "./version.js";

/** Where results are kept: one file per revision and place (change-verified.md §3.2). */
const KEPT = "data/.smithable/verified";
const quiet: Io = { out: () => {}, err: () => {} };

export type Where = Verification["environment"]["where"];

export function environment(where?: Where): Verification["environment"] {
  return {
    // A hosted workspace is told its level; there every change is a hosted one.
    where: process.env.SMITHABLE_HOSTED_LEVEL ? "hosted" : (where ?? "local"),
    engine: VERSION,
  };
}

export function keptPath(dir: string, revision: string, where: Where): string {
  return join(dir, KEPT, `${revision}-${where}.json`);
}

/** Keeps a result for its revision; one without a revision (a failure before the commit) is not kept. */
export function keep(dir: string, v: Verification): void {
  if (!v.revision) return;
  mkdirSync(join(dir, KEPT), { recursive: true });
  writeFileSync(keptPath(dir, v.revision, v.environment.where), `${JSON.stringify(v, null, 2)}\n`);
}

export function readKept(dir: string, revision: string, where: Where): Verification | undefined {
  try {
    const v = JSON.parse(readFileSync(keptPath(dir, revision, where), "utf8")) as Verification;
    return v.revision === revision && v.environment?.where === where ? v : undefined;
  } catch {
    return undefined;
  }
}

/** The custom files that use a concept ("field:Customer.phone"), from the project's index. */
export function customUsers(dir: string): ((concept: string) => string[]) | undefined {
  if (!existsSync(join(dir, "src", "custom"))) return undefined;
  const { ir, auth } = loadSpec(dir, quiet);
  if (!ir || !auth) return undefined;
  const index = projectIndex(dir, ir, auth);
  return (concept) =>
    (index.concepts.find((c) => c.concept === concept)?.files ?? [])
      .filter((f) => f.role === "uses" || f.role === "implements")
      .map((f) => f.path);
}

/** Row and value counts: "Model" is its records, "Model.field" those with a value. */
export type Counts = Record<string, number | null>;

/** The counts of the given models' stored columns; undefined when there is no database. */
export function countModels(dir: string, ir: SpecIR, models: string[]): Counts | undefined {
  if (!existsSync(databasePath(dir))) return undefined;
  const counts: Counts = {};
  for (const model of ir.models.filter((m) => models.includes(m.name))) {
    const { table } = columnOf(model.name, "id");
    counts[model.name] = countValues(dir, table, "id")?.total ?? null;
    for (const field of model.fields) {
      const storage = storageOf(field);
      if (storage === "none") continue;
      const { column } = columnOf(model.name, field.name, storage === "reference");
      counts[`${model.name}.${field.name}`] = countValues(dir, table, column)?.filled ?? null;
    }
  }
  return counts;
}

/** A record consequence's count (§4): how many records hold the values it is about. */
export function countConsequences(dir: string, ir: SpecIR, consequences: Consequence[]): void {
  for (const c of consequences) {
    if (c.about !== "records" || c.undo === "full" || !c.model || !c.field) continue;
    const field = ir.models.find((m) => m.name === c.model)?.fields.find((f) => f.name === c.field);
    if (!field || storageOf(field) === "none") continue;
    const { table, column } = columnOf(c.model, c.field, storageOf(field) === "reference");
    const n = countValues(dir, table, column);
    if (n)
      c.says = `${c.says} ${n.filled} of ${n.total} ${plural(c.model).toLowerCase()} have a value.`;
  }
}

/**
 * The data check (§3.1): the values per touched column, counted before and after, equal apart
 * from what the change set out to remove: a column the spec no longer has is not compared, and
 * `mayLose` are those a confirmed change may empty (a type conversion, a choice value emptied,
 * the trash).
 */
export function dataCheck(
  before: Counts | undefined,
  after: Counts | undefined,
  effects: Effect[],
  mayLose: Set<string>,
): Pick<Check, "state" | "says" | "reason"> {
  if (!before)
    return { state: "passed", says: "There was no development database: no records to keep." };
  if (Object.keys(before).length === 0)
    return { state: "passed", says: "No stored values were touched." };
  if (!after)
    return { state: "inconclusive", says: "The database could not be read after the change." };
  // A key before the change as it is named after it: a renamed model, a renamed field.
  const now = (key: string) => {
    const [model, field] = key.split(".") as [string, string | undefined];
    let to = model;
    let name = field;
    for (const e of effects) {
      if (e.kind === "rename-model" && e.from === model) to = e.to;
      if (e.kind === "rename-field" && e.from === field && (e.model === model || e.model === to))
        name = e.to;
    }
    return name === undefined ? to : `${to}.${name}`;
  };
  const keys = Object.keys(before).filter((key) => now(key) in after);
  const lost: string[] = [];
  const confirmed: string[] = [];
  for (const key of keys) {
    const was = before[key];
    const is = after[now(key)];
    if (was === null || was === undefined || is === null || is === undefined)
      return {
        state: "inconclusive",
        says: `${key} could not be counted before and after the change.`,
        reason: "not counted",
      };
    if (is >= was) continue;
    (mayLose.has(key) ? confirmed : lost).push(`${key} ${was} → ${is}`);
  }
  const models = keys.filter((k) => !k.includes("."));
  const records = models.reduce((n, k) => n + (before[k] ?? 0), 0);
  if (lost.length)
    return {
      state: "failed",
      says: `Values were lost: ${lost.join(", ")}.`,
      reason: "counts dropped",
    };
  if (records === 0) return { state: "passed", says: "No records to keep." };
  const noun = models.length === 1 ? plural(models[0] as string).toLowerCase() : "records";
  return {
    state: "passed",
    says: `${records} ${noun} kept their values${confirmed.length ? `, apart from what the change was confirmed to remove (${confirmed.join(", ")})` : ""}.`,
  };
}

/** The app's test files (the generated vitest config's include: src/**\/*.test.ts). */
function testFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (folder: string) => {
    if (!existsSync(folder)) return;
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".test.ts")) out.push(relative(dir, path));
    }
  };
  walk(join(dir, "src"));
  return out.sort();
}

/**
 * The tests depth on the committed revision (§3.3): the app's type check, then the tests that
 * name what changed (all of them when nothing names a change, as `smithable verify` on edits).
 */
export function runDeeper(dir: string, v: Verification, typecheck = true): void {
  if (typecheck) typecheckCheck(dir, v);
  if (checkOf(v, "typecheck").state === "failed") return;
  const all = testFiles(dir);
  const concepts = [
    ...v.changed.models.map((m) => `model:${m}`),
    ...v.changed.fields.map((f) => `field:${f}`),
    ...v.changed.pages.map((p) => `page:${p}`),
    ...v.changed.actions.map((a) => `action:${a}`),
  ];
  let named = all;
  if (concepts.length && all.length) {
    const { ir, auth } = loadSpec(dir, quiet);
    const index = ir && auth ? projectIndex(dir, ir, auth) : undefined;
    named = index
      ? [...new Set(concepts.flatMap((c) => findTests(index, c).map((t) => t.file)))].sort()
      : [];
  }
  let run: { ran?: number; failed?: number; log?: string } = {};
  if (all.length && named.length) {
    const log = join(KEPT, `tests-${v.revision || "working"}.json`);
    mkdirSync(join(dir, KEPT), { recursive: true });
    const [command, args] = tool(dir, "vitest", [
      "run",
      "--reporter",
      "json",
      "--outputFile.json",
      log,
      ...(named === all ? [] : named),
    ]);
    spawnSync(command, args, { cwd: dir, stdio: "ignore", shell: process.platform === "win32" });
    try {
      const json = JSON.parse(readFileSync(join(dir, log), "utf8")) as {
        numPassedTests: number;
        numFailedTests: number;
      };
      run = {
        ran: json.numPassedTests + json.numFailedTests,
        failed: json.numFailedTests,
        log,
      };
    } catch {}
  }
  const result = testsCheck({ available: all.length, named: named.length, ...run });
  setCheck(v, "tests", result.state, result.says, {
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.evidence ? { evidence: result.evidence } : {}),
  });
}

/** The app's own type check (`pnpm typecheck`), its output on stderr. */
export function typecheckCheck(dir: string, v: Verification): boolean {
  const code = exec("pnpm", ["typecheck"], dir);
  setCheck(
    v,
    "typecheck",
    code === 0 ? "passed" : "failed",
    code === 0 ? "The app's type check passed." : `The app's type check failed (exit ${code}).`,
    code === 0 ? {} : { reason: "type errors" },
  );
  return code === 0;
}

/** The browser check is sampleusers' (§5.4): until its report is handed over, not run. */
export function browserNotRun(v: Verification): void {
  if (checkOf(v, "browser").state !== "not-run") return;
  setCheck(v, "browser", "not-run", "Not run.", {
    reason:
      "Browser checks come with sampleusers (change-verified.md §7, step 4): hand its report over with smithable verify --record <report>.",
  });
}

const LABEL: Record<CheckId, string> = {
  spec: "Spec",
  generate: "Generate",
  migrate: "Migration",
  data: "Data",
  typecheck: "Type check",
  tests: "Tests",
  browser: "Browser flow",
  outside: "Outside the app",
};

/** After a change: a line per check that did not pass, the ones beyond its depth in one. */
export function notPassedLines(v: Verification): string {
  const lines: string[] = [];
  const beyond: string[] = [];
  for (const c of v.checks) {
    if (c.state === "passed" || c.state === "not-configured") continue;
    if (c.state === "not-run" && !DEPTH_CHECKS[v.depth].includes(c.id)) {
      beyond.push(LABEL[c.id].toLowerCase());
      continue;
    }
    lines.push(
      `${LABEL[c.id]} ${c.state.replace("-", " ")}: ${c.says}${c.reason ? ` (${c.reason})` : ""}\n`,
    );
  }
  if (beyond.length) {
    const next = DEPTHS[DEPTHS.indexOf(v.depth) + 1] ?? "browser";
    lines.push(`Not checked: ${beyond.join(", ")}. Run smithable verify --depth ${next}.\n`);
  }
  return lines.join("");
}

/** Every check, for `smithable verify`. */
function allLines(v: Verification): string {
  return `${v.revision.slice(0, 12)} (${v.environment.where}), depth ${v.depth}:\n${v.checks
    .map(
      (c) =>
        `  ${LABEL[c.id]}: ${c.state.replace("-", " ")}${c.state === "not-run" ? "" : `. ${c.says}`}${c.reason && c.state !== "passed" ? ` (${c.reason})` : ""}\n`,
    )
    .join("")}${v.consequences.map((c) => `  ${c.says}\n`).join("")}`;
}

/**
 * A sampleusers report as the browser check (§5.4): refused for another revision; passed is
 * passed, failed failed, blocked not run with the blocking step as reason, anything else
 * inconclusive.
 */
export function browserFromReport(
  v: Verification,
  report: {
    revision?: string;
    target?: { revision?: string };
    status?: string;
    summary?: string;
    steps?: { status?: string; name?: string; reason?: string }[];
  },
  log: string,
): string | undefined {
  const revision = report.revision ?? report.target?.revision;
  if (!revision) return "The report names no revision, so it cannot be tied to this one.";
  if (revision !== v.revision)
    return `The report is for revision ${revision.slice(0, 12)}, not ${v.revision.slice(0, 12)}.`;
  const steps = report.steps ?? [];
  const failed = steps.filter((s) => s.status === "failed").length;
  const blocking = steps.find((s) => s.status === "blocked" || s.status === "failed");
  const state =
    report.status === "passed"
      ? "passed"
      : report.status === "failed"
        ? "failed"
        : report.status === "blocked"
          ? "not-run"
          : "inconclusive";
  setCheck(v, "browser", state, report.summary ?? `The sampleusers run ${report.status}.`, {
    ...(state === "passed"
      ? {}
      : {
          reason:
            state === "not-run"
              ? `blocked${blocking ? ` at ${blocking.name}${blocking.reason ? `: ${blocking.reason}` : ""}` : ""}`
              : String(report.status ?? "no status"),
        }),
    ...(state === "not-run" ? {} : { evidence: { ran: steps.length, failed, log } }),
  });
  return undefined;
}

/**
 * `smithable verify [--depth change|tests|browser] [--json] [--record <report>]`: the current
 * revision's result, deepened to the depth asked (§3.2, §3.3). With uncommitted edits it
 * verifies nothing and says why.
 */
export function verify(
  dir: string,
  io: Io,
  flags: { depth?: string; json?: boolean; record?: string; where?: Where },
): number {
  const depth = (flags.depth ?? "change") as Depth;
  if (!DEPTHS.includes(depth)) {
    io.err("--depth is change, tests or browser.\n");
    return 2;
  }
  const env = environment(flags.where);
  const print = (v: Verification, code: number) => {
    if (flags.json) io.out(`${JSON.stringify(v, null, 2)}\n`);
    else io.out(allLines(v));
    return code;
  };
  const refused = !ownRepository(dir)
    ? "This project has no history yet: make a change with smithable op first.\n"
    : uncommittedRefusal(dir, "since a result belongs to one committed revision");
  if (refused) {
    io.err(refused);
    if (!flags.json) return 1;
    const v = unverified("", env, depth);
    for (const c of v.checks) c.reason = "uncommitted edits: nothing was verified";
    return print(v, 1);
  }
  const revision = git(dir, ["rev-parse", "HEAD"]).out.trim();
  const kept = readKept(dir, revision, env.where);
  const v = kept ?? { ...unverified(projectRevision(dir), env, depth), revision };
  if (!kept) {
    const { ir, auth } = loadSpec(dir, quiet);
    setCheck(
      v,
      "spec",
      ir && auth ? "passed" : "failed",
      ir && auth ? "The spec has no errors." : "The spec has errors: smithable validate.",
    );
    for (const id of ["generate", "migrate", "data", "outside"] as const)
      if (checkOf(v, id).state === "not-run")
        setCheck(v, id, "not-run", "Not run.", {
          reason: "It runs with a change (smithable op); this revision has no result from one.",
        });
  }
  deepen(v, depth);
  if (flags.record) {
    let report: Parameters<typeof browserFromReport>[1];
    try {
      report = JSON.parse(readFileSync(flags.record, "utf8"));
    } catch (error) {
      io.err(`Could not read the report ${flags.record}: ${(error as Error).message}\n`);
      return 1;
    }
    const refusal = browserFromReport(v, report, flags.record);
    if (refusal) {
      io.err(`${refusal}\n`);
      return 1;
    }
  } else if (depth !== "change" && checkOf(v, "spec").state !== "failed") {
    runDeeper(dir, v);
    if (depth === "browser") browserNotRun(v);
  }
  keep(dir, v);
  return print(v, v.checks.some((c) => c.state === "failed") ? 1 : 0);
}
