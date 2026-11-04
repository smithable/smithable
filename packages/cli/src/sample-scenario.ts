import { createHash, randomUUID } from "node:crypto";
import { lstatSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { maintenanceInfo } from "./maintenance.js";
import { projectRevision } from "./release-review.js";
import type { LogEntry } from "./sample-run.js";
export type ScenarioContext = {
  specRevision: string;
  appRevision: string;
  seed: number;
  snapshot: { id: string; digest: string };
  clock: string;
  actors: { id: string; role: string }[];
  versions: { engine: string; stackProfile: string; dependencies: Record<string, string> };
};
export type ScenarioStep = {
  action: LogEntry;
  expectedOutcome: "done" | "refused";
  checks: Record<string, unknown>;
};
export type SampleScenario = {
  version: 1;
  id: string;
  context: ScenarioContext;
  steps: ScenarioStep[];
};
const MAX_BYTES = 2 * 1024 * 1024;
function jsonData(value: unknown, depth = 0, budget = { left: 50000 }): boolean {
  if (--budget.left < 0 || depth > 16) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 65536;
  if (Array.isArray(value))
    return value.length <= 5000 && value.every((v) => jsonData(v, depth + 1, budget));
  if (
    value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    const entries = Object.entries(value);
    return (
      entries.length <= 1000 &&
      entries.every(([key, v]) => key.length <= 500 && jsonData(v, depth + 1, budget))
    );
  }
  return false;
}
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, v]) => [key, ordered(v)]),
    );
  return value;
}
export function canonical(value: unknown): string {
  assert(jsonData(value), "finite bounded JSON data required");
  return JSON.stringify(ordered(value));
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid sample scenario: ${message}`);
}
const iso = (value: unknown) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const digest = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
/** Versioned data only; scenarios cannot contain executable checks or reset commands. */
export function validateScenario(value: unknown): SampleScenario {
  assert(jsonData(value), "finite bounded JSON data required");
  const text = JSON.stringify(value);
  assert(text && Buffer.byteLength(text) <= MAX_BYTES, "size exceeds 2 MB");
  assert(
    object(value) && value.version === 1 && typeof value.id === "string",
    "unsupported version or id",
  );
  const c = value.context;
  assert(
    object(c) && digest(c.specRevision) && digest(c.appRevision) && Number.isSafeInteger(c.seed),
    "revisions or seed",
  );
  assert(
    object(c.snapshot) &&
      typeof c.snapshot.id === "string" &&
      c.snapshot.id.length > 0 &&
      digest(c.snapshot.digest),
    "reset snapshot identity",
  );
  assert(
    iso(c.clock) && Array.isArray(c.actors) && c.actors.length > 0 && c.actors.length <= 100,
    "clock or actors",
  );
  assert(
    c.actors.every(
      (a) =>
        object(a) &&
        typeof a.id === "string" &&
        a.id.length > 0 &&
        typeof a.role === "string" &&
        a.role.length > 0,
    ),
    "actor identity",
  );
  assert(new Set(c.actors.map((a) => a.id)).size === c.actors.length, "duplicate actors");
  assert(
    object(c.versions) &&
      typeof c.versions.engine === "string" &&
      typeof c.versions.stackProfile === "string" &&
      object(c.versions.dependencies) &&
      Object.values(c.versions.dependencies).every((v) => typeof v === "string"),
    "version inventory",
  );
  assert(
    Array.isArray(value.steps) && value.steps.length > 0 && value.steps.length <= 300,
    "steps",
  );
  for (const [index, step] of value.steps.entries()) {
    assert(
      object(step) &&
        ["done", "refused"].includes(String(step.expectedOutcome)) &&
        object(step.checks) &&
        Object.keys(step.checks).length > 0,
      "independent outcomes are required",
    );
    const a = step.action;
    assert(
      object(a) &&
        a.turn === index &&
        typeof a.id === "string" &&
        typeof a.move === "string" &&
        Array.isArray(a.listed) &&
        a.listed.every((v) => typeof v === "string"),
      "complete ordered action log",
    );
    assert(
      (a.listed as string[]).includes(a.move as string),
      "action was not in its recorded move list",
    );
    assert(
      Number.isSafeInteger(a.seed) &&
        a.seed === Number(c.seed) + index &&
        iso(a.clock) &&
        typeof a.actorRole === "string",
      "action seed, clock or role",
    );
    assert(
      c.actors.some((actor) => actor.id === a.id && actor.role === a.actorRole),
      "actor is incompatible",
    );
    if (["change", "delete", "merge", "split"].includes(String(a.kind)))
      assert(a.target !== undefined, "record action target is required");
    if (a.target !== undefined)
      assert(
        object(a.target) &&
          Object.keys(a.target).length === 1 &&
          Object.entries(a.target).every(([key, v]) =>
            key === "record"
              ? Number.isSafeInteger(v) && Number(v) > 0
              : key === "records" &&
                Array.isArray(v) &&
                v.length > 0 &&
                v.length <= 1000 &&
                v.every((id) => Number.isSafeInteger(id) && id > 0),
          ),
        "target ids",
      );
    if (a.values !== undefined) assert(object(a.values), "action values");
  }
  assert(
    (value.steps[0] as { action: { clock: string } }).action.clock === c.clock,
    "initial clock",
  );
  // Detach the caller's objects; later edits cannot change a queued plan.
  return JSON.parse(text) as SampleScenario;
}
export function captureScenario(
  context: ScenarioContext,
  entries: LogEntry[],
  expectations: Omit<ScenarioStep, "action">[],
): SampleScenario {
  assert(entries.length === expectations.length, "one independently stated expectation per action");
  return validateScenario({
    version: 1,
    id: randomUUID(),
    context,
    steps: entries.map((action, index) => ({ ...expectations[index], action })),
  });
}
export function compatibleScenario(scenario: SampleScenario, current: ScenarioContext): void {
  const actors = (c: ScenarioContext) => [...c.actors].sort((a, b) => a.id.localeCompare(b.id));
  if (
    canonical({ ...scenario.context, actors: actors(scenario.context) }) !==
    canonical({ ...current, actors: actors(current) })
  )
    throw new Error(
      "Sample scenario is incompatible with the current revision, actors, versions, clock or reset snapshot.",
    );
}
export function writeScenario(path: string, scenario: SampleScenario): void {
  const checked = validateScenario(scenario),
    staging = `${path}.${randomUUID()}`;
  writeFileSync(staging, `${JSON.stringify(checked, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(staging, path);
}
export function readScenario(path: string): SampleScenario {
  const stat = lstatSync(path);
  assert(stat.isFile() && stat.size <= MAX_BYTES, "not a bounded regular file");
  return validateScenario(JSON.parse(readFileSync(path, "utf8")));
}

/** Read source/version identity afresh for each replay compatibility check. */
export function projectScenarioContext(
  dir: string,
  run: Pick<ScenarioContext, "seed" | "snapshot" | "clock" | "actors">,
): ScenarioContext {
  const appRevision = projectRevision(dir);
  if (!appRevision)
    throw new Error(
      "The project source revision is unknown; scenario compatibility cannot be verified.",
    );
  const specFiles = [
    "smithable.yml",
    "smithable.auth.yml",
    "smithable.ux.yml",
    "smithable.content.yml",
    "smithable.context.yml",
  ].map((path) => {
    try {
      return [path, readFileSync(join(dir, path), "utf8")];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return [path, null];
    }
  });
  const maintenance = maintenanceInfo(dir);
  const dependencies = {
    ...(maintenance.dependencies as Record<string, string>),
    "runner:node": process.versions.node,
  };
  return {
    ...run,
    specRevision: createHash("sha256").update(JSON.stringify(specFiles)).digest("hex"),
    appRevision,
    versions: {
      engine: maintenance.generatedEngine ?? "unknown",
      stackProfile: maintenance.generatedProfile ?? "unknown",
      dependencies,
    },
  };
}
