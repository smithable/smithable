import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
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
import { ensureRepository, git, uncommittedRefusal } from "./git.js";
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

/**
 * Keeps a result for its revision; one without a revision (a failure before the commit) is not
 * kept. `out`: another folder to write it to (a project mounted read-only, the hosted runner).
 */
export function keep(dir: string, v: Verification, out?: string): void {
  if (!v.revision) return;
  const file = out
    ? join(out, `${v.revision}-${v.environment.where}.json`)
    : keptPath(dir, v.revision, v.environment.where);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(v, null, 2)}\n`);
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

/**
 * A record consequence's count (§4), from the database before the change: how many records hold
 * the values of a field it is about, else how many records its model has.
 */
export function countConsequences(
  dir: string,
  ir: SpecIR,
  effects: Effect[],
  consequences: Consequence[],
): void {
  for (const c of consequences) {
    if (c.about !== "records" || !c.model) continue;
    // A consequence names the model and field as they are after the change.
    const name =
      effects.flatMap((e) => (e.kind === "rename-model" && e.to === c.model ? [e.from] : []))[0] ??
      c.model;
    const model = ir.models.find((m) => m.name === name);
    if (!model) continue;
    const fieldName =
      effects.flatMap((e) =>
        e.kind === "rename-field" && e.model === c.model && e.to === c.field ? [e.from] : [],
      )[0] ?? c.field;
    const field = model.fields.find((f) => f.name === fieldName);
    const stored = field && storageOf(field) !== "none" ? field : undefined;
    const { table, column } = columnOf(
      model.name,
      stored?.name ?? "id",
      stored ? storageOf(stored) === "reference" : false,
    );
    const n = countValues(dir, table, column);
    if (!n) continue;
    const noun = plural(c.model).toLowerCase();
    c.says = stored
      ? `${c.says} ${n.filled} of ${n.total} ${noun} have a value.`
      : `${c.says} ${n.total} ${n.total === 1 ? c.model.toLowerCase() : noun} so far.`;
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
  // A key the spec no longer has after the change went with it: said, not compared.
  const keys = Object.keys(before).filter((key) => now(key) in after);
  const modelOf = (key: string) => key.split(".")[0] as string;
  // A removed model is named once, not with each of its fields.
  const removed = Object.keys(before)
    .filter((key) => !(now(key) in after) && (!key.includes(".") || now(modelOf(key)) in after))
    .map((key) => `${key} (${before[key] ?? "?"})`);
  const may = (key: string) =>
    [key, now(key), modelOf(key), modelOf(now(key))].some((k) => mayLose.has(k));
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
    (may(key) ? confirmed : lost).push(`${key} ${was} → ${is}`);
  }
  const models = keys.filter((k) => !k.includes("."));
  const records = models.reduce((n, k) => n + (before[k] ?? 0), 0);
  if (lost.length)
    return {
      state: "failed",
      says: `Values were lost: ${lost.join(", ")}.`,
      reason: "counts dropped",
    };
  const gone = removed.length ? ` Removed with the spec's change: ${removed.join(", ")}.` : "";
  if (records === 0) return { state: "passed", says: gone ? gone.trim() : "No records to keep." };
  const noun = models.length === 1 ? plural(models[0] as string).toLowerCase() : "records";
  return {
    state: "passed",
    says: `${records} ${noun} kept their values${confirmed.length ? `, apart from what the change was confirmed to remove (${confirmed.join(", ")})` : ""}.${gone}`,
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
export function runDeeper(dir: string, v: Verification, typecheck = true, out?: string): void {
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
    if (!index) {
      setCheck(v, "tests", "inconclusive", "The project's index could not be read.", {
        reason: "no index",
      });
      return;
    }
    named = [...new Set(concepts.flatMap((c) => findTests(index, c).map((t) => t.file)))].sort();
  }
  let run: { ran?: number; failed?: number; broken?: number; log?: string } = {};
  if (all.length && named.length) {
    // Beside the kept results, not among them: one file per revision and place there.
    const folder = out ?? join(dir, "data/.smithable/test-runs");
    const file = join(folder, `${v.revision || "working"}-${v.environment.where}.json`);
    const log = out ? file : relative(dir, file);
    mkdirSync(folder, { recursive: true });
    // A report left by an earlier run is never read as this one's.
    rmSync(file, { force: true });
    const [command, args] = tool(dir, "vitest", [
      "run",
      "--reporter",
      "json",
      "--outputFile.json",
      file,
      ...(named === all ? [] : named),
    ]);
    const spawned = spawnSync(command, args, {
      cwd: dir,
      stdio: "ignore",
      timeout: 15 * 60_000,
      shell: process.platform === "win32",
    });
    try {
      if (spawned.error) throw spawned.error;
      const json = JSON.parse(readFileSync(file, "utf8")) as {
        numPassedTests?: number;
        numFailedTests?: number;
        numFailedTestSuites?: number;
      };
      run = {
        ran: (json.numPassedTests ?? Number.NaN) + (json.numFailedTests ?? Number.NaN),
        failed: json.numFailedTests ?? Number.NaN,
        // A file counts as failed when a test in it failed: broken only when none did.
        broken: json.numFailedTests ? 0 : (json.numFailedTestSuites ?? 0),
        log,
      };
      // Vitest exits non-zero on any failure: a report that says none is not trusted alone.
      if (spawned.status !== 0 && !run.failed && !run.broken) run = { log };
    } catch {}
  }
  const result = testsCheck({ available: all.length, named: named.length, ...run });
  // Nothing the change touched names a model, field, page or action: every test ran.
  if (result.state === "passed" && !concepts.length)
    result.says = `${result.says} Nothing the change touched is named by a test, so all of them ran.`;
  setCheck(v, "tests", result.state, result.says, {
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.evidence ? { evidence: result.evidence } : {}),
  });
}

/** The app's own type check (`pnpm typecheck`), its output on stderr. */
export function typecheckCheck(dir: string, v: Verification): boolean {
  let scripts: Record<string, string> = {};
  try {
    scripts = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).scripts ?? {};
  } catch {}
  if (!scripts.typecheck) {
    setCheck(v, "typecheck", "not-configured", "The app has no typecheck script.", {
      reason: "no typecheck script",
    });
    return true;
  }
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
  const browser = checkOf(v, "browser");
  if (browser.state !== "not-run" || browser.reason?.startsWith("blocked by")) return;
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
    if (c.state === "passed" || (c.state === "not-configured" && c.id === "outside")) continue;
    if (c.state === "not-run" && !DEPTH_CHECKS[v.depth].includes(c.id)) {
      beyond.push(LABEL[c.id].toLowerCase());
      continue;
    }
    lines.push(
      `${LABEL[c.id]} ${c.state.replace("-", " ")}: ${c.says}${c.reason ? ` (${c.reason})` : ""}\n`,
    );
  }
  // After a failure the deeper depths are not the next step.
  if (beyond.length && !v.checks.some((c) => c.state === "failed")) {
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
    environment?: { where?: string };
    target?: { revision?: string; where?: string };
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
  const where = report.environment?.where ?? report.target?.where;
  if (where && where !== v.environment.where)
    return `The report is for the ${where} environment, not ${v.environment.where}.`;
  const steps = report.steps ?? [];
  const failed = steps.filter((s) => s.status === "failed").length;
  const blocking = steps.find((s) => s.status === "blocked" || s.status === "failed");
  // Passed only with steps that ran and none that failed (§2.1).
  const state =
    report.status === "passed"
      ? steps.length && !failed
        ? "passed"
        : "inconclusive"
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
  flags: {
    depth?: string;
    json?: boolean;
    record?: string;
    where?: Where;
    /** Where the result and the test run's report are written; the project's data/ when unsaid. */
    out?: string;
    /** Given the result printed (MCP's structured content). */
    onResult?: (v: Verification) => void;
  },
): number {
  const depth = (flags.depth ?? "change") as Depth;
  if (!DEPTHS.includes(depth)) {
    io.err("--depth is change, tests or browser.\n");
    return 2;
  }
  const env = environment(flags.where);
  const print = (v: Verification, code: number) => {
    flags.onResult?.(v);
    if (flags.json) io.out(`${JSON.stringify(v, null, 2)}\n`);
    else io.out(allLines(v));
    return code;
  };
  // A fresh app starts its history here, as with an operation: its result is that commit's.
  ensureRepository(dir);
  const refused = uncommittedRefusal(dir, "since a result belongs to one committed revision");
  if (refused) {
    io.err(refused);
    const v = unverified("", env, depth);
    for (const c of v.checks) c.reason = "uncommitted edits: nothing was verified";
    if (flags.json) return print(v, 1);
    flags.onResult?.(v);
    return 1;
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
      if (checkOf(v, id).state === "not-run" && !checkOf(v, id).reason?.startsWith("blocked by"))
        setCheck(v, id, "not-run", "Not run.", {
          reason: "It runs with a change (smithable op); this revision has no result from one.",
        });
  }
  // A browser report is recorded at depth browser, over the checks of the depths before it.
  deepen(v, flags.record ? "browser" : depth);
  if (flags.record) {
    // The lower checks of a kept result for this revision are reused when they passed (or had
    // nothing to run); otherwise they run first.
    if (
      !(["typecheck", "tests"] as const).every((id) =>
        ["passed", "not-configured"].includes(checkOf(v, id).state),
      )
    )
      runDeeper(dir, v, true, flags.out);
    const failed = v.checks.find((c) => c.id !== "browser" && c.state === "failed");
    if (failed) {
      io.err(
        `The browser report is not recorded: the ${LABEL[failed.id].toLowerCase()} check failed.\n`,
      );
      keep(dir, v, flags.out);
      return print(v, 1);
    }
    let report: Parameters<typeof browserFromReport>[1];
    try {
      report = JSON.parse(readFileSync(flags.record, "utf8"));
    } catch (error) {
      io.err(`Could not read the report ${flags.record}: ${(error as Error).message}\n`);
      keep(dir, v, flags.out);
      return print(v, 1);
    }
    const refusal = browserFromReport(v, report, flags.record);
    if (refusal) {
      io.err(`${refusal}\n`);
      keep(dir, v, flags.out);
      return print(v, 1);
    }
  } else if (depth !== "change" && checkOf(v, "spec").state !== "failed") {
    runDeeper(dir, v, true, flags.out);
    if (depth === "browser") browserNotRun(v);
  }
  keep(dir, v, flags.out);
  return print(v, v.checks.some((c) => c.state === "failed") ? 1 : 0);
}
