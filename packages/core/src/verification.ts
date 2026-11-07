import { modelAccess, pageAccess } from "./access.js";
import type { OperationResult, ProjectFiles } from "./apply.js";
import { type AuthIR, validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import type { Effect, OperationArgs } from "./operation.js";
import { validateSpec } from "./spec.js";

/**
 * What a change will do and what was verified (docs/design/change-verified.md): one object, read
 * before Apply (every check not run) and after it (each check as it ran). Core fills what it
 * knows from the files; the host adds the counts, the checks it runs, the revision and the place.
 */
export type CheckState = "passed" | "failed" | "not-run" | "inconclusive" | "not-configured";
export type CheckId =
  | "spec"
  | "generate"
  | "migrate"
  | "data"
  | "typecheck"
  | "tests"
  | "browser"
  | "outside";
export type CheckKind = "deterministic" | "unit" | "end-to-end";
export type Depth = "change" | "tests" | "browser";

export interface Check {
  id: CheckId;
  kind: CheckKind;
  state: CheckState;
  /** One plain sentence: "12 of 12 customers kept a phone". */
  says: string;
  /** Why it was not run, is inconclusive or failed: "blocked by typecheck". */
  reason?: string;
  /** When it ran (ISO time); a check that did not run has none. */
  at?: string;
  evidence?: { ran?: number; failed?: number; log?: string };
}

export interface Consequence {
  about: "records" | "access" | "custom-code" | "outside";
  /** "4 of 31 orders lose their discount code". */
  says: string;
  undo: "full" | "data-snapshot" | "none";
  /** What it is about, for a reader that acts on it (sampleusers): a model, a field of it. */
  model?: string;
  field?: string;
}

export interface Changed {
  models: string[];
  /** "Model.field". */
  fields: string[];
  pages: string[];
  actions: string[];
}

export interface Verification {
  /** The checkpoint's commit; "" before the change and on a failure. */
  revision: string;
  /** The revision the change was made against (the host's). */
  base: string;
  environment: { where: "local" | "studio" | "hosted"; engine: string };
  depth: Depth;
  changed: Changed;
  consequences: Consequence[];
  checks: Check[];
}

/** The checks in their order, each with its kind (§3.1). */
export const CHECKS: readonly { id: CheckId; kind: CheckKind }[] = [
  { id: "spec", kind: "deterministic" },
  { id: "generate", kind: "deterministic" },
  { id: "migrate", kind: "deterministic" },
  { id: "data", kind: "deterministic" },
  { id: "typecheck", kind: "deterministic" },
  { id: "tests", kind: "unit" },
  { id: "browser", kind: "end-to-end" },
  { id: "outside", kind: "deterministic" },
];

/** The checks a depth runs; each depth includes the one before (§3.3). */
export const DEPTH_CHECKS: Record<Depth, readonly CheckId[]> = {
  change: ["spec", "generate", "migrate", "data", "outside"],
  tests: ["spec", "generate", "migrate", "data", "outside", "typecheck", "tests"],
  browser: ["spec", "generate", "migrate", "data", "outside", "typecheck", "tests", "browser"],
};

export const DEPTHS: readonly Depth[] = ["change", "tests", "browser"];

const DEEPER: Partial<Record<CheckId, Depth>> = {
  typecheck: "tests",
  tests: "tests",
  browser: "browser",
};

const beyond = (id: CheckId, depth: Depth) =>
  `Not part of depth ${depth}: run smithable verify --depth ${DEEPER[id]}.`;

/** A deeper depth for a result: the checks it adds are not run yet, until they run. */
export function deepen(v: Verification, depth: Depth): Verification {
  if (DEPTHS.indexOf(depth) <= DEPTHS.indexOf(v.depth)) return v;
  for (const c of v.checks)
    if (c.state === "not-run" && c.reason === beyond(c.id, v.depth))
      c.reason = DEPTH_CHECKS[depth].includes(c.id) ? "Not run yet." : beyond(c.id, depth);
  v.depth = depth;
  return v;
}

/** A verification where nothing has run: what every result starts as. */
export function unverified(
  base: string,
  environment: Verification["environment"],
  depth: Depth,
): Verification {
  return {
    revision: "",
    base,
    environment,
    depth,
    changed: { models: [], fields: [], pages: [], actions: [] },
    consequences: [],
    checks: CHECKS.map(({ id, kind }) => ({
      id,
      kind,
      state: "not-run",
      says: "Not run.",
      reason: DEPTH_CHECKS[depth].includes(id)
        ? "The change has not been applied."
        : beyond(id, depth),
    })),
  };
}

/**
 * Sets a check's state. A check that fails makes every later check not run, with it as the
 * reason (§2.2); `at` is the time it ran, and a check that did not run keeps none.
 */
export function setCheck(
  v: Verification,
  id: CheckId,
  state: CheckState,
  says: string,
  more: { reason?: string; evidence?: Check["evidence"]; at?: string } = {},
): Verification {
  const index = v.checks.findIndex((c) => c.id === id);
  const old = v.checks[index] as Check;
  const ran = state === "passed" || state === "failed" || state === "inconclusive";
  v.checks[index] = {
    id,
    kind: old.kind,
    state,
    says,
    ...(more.reason ? { reason: more.reason } : {}),
    ...(ran ? { at: more.at ?? new Date().toISOString() } : {}),
    ...(more.evidence ? { evidence: more.evidence } : {}),
  };
  if (state === "failed")
    for (let i = index + 1; i < v.checks.length; i++) {
      const later = v.checks[i] as Check;
      // What the change touches outside the app is read from the files before Apply: kept.
      if (later.id === "outside" && (later.state !== "not-run" || later.says !== "Not run."))
        continue;
      v.checks[i] = {
        id: later.id,
        kind: later.kind,
        state: "not-run",
        says: "Not run.",
        reason: `blocked by ${id}`,
      };
    }
  return v;
}

export function checkOf(v: Verification, id: CheckId): Check {
  return v.checks.find((c) => c.id === id) as Check;
}

/**
 * The tests check from a run (§2.2): passed only when some ran and none failed. No tests in the
 * app is not configured; tests, none naming what changed, inconclusive; none that ran, too.
 */
export function testsCheck(run: {
  /** Test files the app has at all. */
  available: number;
  /** Test files that name what changed (all of them when nothing names a change). */
  named: number;
  ran?: number;
  failed?: number;
  /** Test files that could not run at all (an import that fails, a broken setup). */
  broken?: number;
  log?: string;
}): Pick<Check, "state" | "says" | "reason" | "evidence"> {
  if (run.available === 0)
    return { state: "not-configured", says: "The app has no tests.", reason: "no tests" };
  if (run.named === 0)
    return {
      state: "inconclusive",
      says: `None of the app's ${run.available} test files names what changed.`,
      reason: "no test names the change",
    };
  const evidence = {
    ...(run.ran !== undefined ? { ran: run.ran } : {}),
    ...(run.failed !== undefined ? { failed: run.failed } : {}),
    ...(run.log ? { log: run.log } : {}),
  };
  const count = (n: number | undefined) => n !== undefined && Number.isInteger(n) && n >= 0;
  if (!count(run.ran) || !count(run.failed) || (run.broken !== undefined && !count(run.broken)))
    return {
      state: "inconclusive",
      says: "The test run gave no results.",
      reason: "no results",
      evidence,
    };
  if ((run.broken ?? 0) > 0)
    return {
      state: "failed",
      says: `${run.broken} test ${run.broken === 1 ? "file" : "files"} could not run.`,
      reason: "tests failed",
      evidence,
    };
  if ((run.failed ?? 0) > 0)
    return {
      state: "failed",
      says: `${run.failed} of ${run.ran} tests failed.`,
      reason: "tests failed",
      evidence,
    };
  if (run.ran === 0)
    return { state: "inconclusive", says: "No test ran.", reason: "no test ran", evidence };
  return { state: "passed", says: `${run.ran} of ${run.ran} tests passed.`, evidence };
}

/**
 * The result before Apply (§4): what the change touches and its consequences, every check not
 * run. A refused change has the spec check failed, its diagnostics on the result being the
 * authority. `custom` names the custom files that use a concept ("field:Customer.phone"), which
 * the host knows from its index.
 */
export function verificationBefore(
  files: ProjectFiles,
  result: OperationResult,
  context: {
    base: string;
    environment: Verification["environment"];
    depth: Depth;
    custom?: (concept: string) => string[];
  },
): Verification {
  const v = unverified(context.base, context.environment, context.depth);
  if (!result.ok)
    return setCheck(v, "spec", "failed", result.message, {
      reason: result.diagnostics.length
        ? `${result.diagnostics.length} ${result.diagnostics.length === 1 ? "problem" : "problems"} in the diagnostics`
        : "refused",
    });
  const before = specOf(files);
  const after = specOf(result.files);
  if (!before || !after) return v;
  v.changed = changedBy(before.ir, after.ir, result.effects);
  v.consequences = [
    ...recordConsequences(before.ir, after.ir, result.effects),
    ...accessConsequences(before, after),
    ...customConsequences(v.changed, result.effects, context.custom),
    ...outsideConsequences(before.ir, after.ir),
  ];
  const outside = v.consequences.filter((c) => c.about === "outside");
  if (outside.length)
    setCheck(v, "outside", "not-run", outside.map((c) => c.says).join(" "), {
      reason: "Smithable does not send mail or call other services to check them.",
    });
  else setCheck(v, "outside", "not-configured", "Nothing outside the app is touched.");
  return v;
}

function specOf(files: ProjectFiles): { ir: SpecIR; auth?: AuthIR } | undefined {
  const ir = validateSpec(
    { path: "smithable.yml", text: files.spec },
    files.plugins ? { plugins: files.plugins } : {},
  ).ir;
  if (!ir) return undefined;
  const auth =
    files.auth === undefined
      ? undefined
      : validateAuth({ path: "smithable.auth.yml", text: files.auth }, ir).auth;
  return { ir, ...(auth ? { auth } : {}) };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Names added, removed or different between two lists, renames followed. */
function differing<T>(
  before: T[],
  after: T[],
  name: (item: T) => string,
  renamed: Map<string, string> = new Map(),
): string[] {
  const out = new Set<string>();
  for (const item of before) {
    const now = renamed.get(name(item)) ?? name(item);
    const match = after.find((a) => name(a) === now);
    if (!match) out.add(name(item));
    else if (now !== name(item) || !same({ ...item, name: now }, match)) out.add(now);
  }
  for (const item of after)
    if (![...before.map((b) => renamed.get(name(b)) ?? name(b))].includes(name(item)))
      out.add(name(item));
  return [...out].sort();
}

/** What a change touches (§3): models, fields ("Model.field"), pages and actions. */
export function changedBy(before: SpecIR, after: SpecIR, effects: Effect[] = []): Changed {
  const models = new Map(
    effects.flatMap((e) => (e.kind === "rename-model" ? [[e.from, e.to] as const] : [])),
  );
  const pages = new Map(
    effects.flatMap((e) => (e.kind === "rename-page" ? [[e.from, e.to] as const] : [])),
  );
  const fieldRenames = new Map(
    effects.flatMap((e) =>
      e.kind === "rename-field" ? [[`${e.model}.${e.from}`, `${e.model}.${e.to}`] as const] : [],
    ),
  );
  const fieldsOf = (ir: SpecIR, renamedModels: boolean) =>
    ir.models.flatMap((m) =>
      m.fields.map((f) => ({
        ...f,
        name: `${renamedModels ? (models.get(m.name) ?? m.name) : m.name}.${f.name}`,
      })),
    );
  return {
    models: differing(before.models, after.models, (m) => m.name, models),
    fields: differing(
      fieldsOf(before, true),
      fieldsOf(after, false),
      (f) => f.name,
      new Map(
        [...fieldRenames].map(([from, to]) => {
          const [model] = from.split(".") as [string];
          const now = models.get(model) ?? model;
          return [`${now}.${from.slice(model.length + 1)}`, `${now}.${to.slice(model.length + 1)}`];
        }),
      ),
    ),
    pages: differing(
      before.pages.map((p) => ({ ...p, name: p.id })),
      after.pages.map((p) => ({ ...p, name: p.id })),
      (p) => p.name,
      pages,
    ),
    actions: differing(before.actions, after.actions, (a) => a.name),
  };
}

/** What happens to existing records, from the effects (§4); the host adds the counts. */
function recordConsequences(before: SpecIR, after: SpecIR, effects: Effect[]): Consequence[] {
  const out: Consequence[] = [];
  for (const e of effects) {
    if (e.kind === "rename-model")
      out.push({
        about: "records",
        says: `${e.from} is renamed ${e.to}; its records are kept.`,
        undo: "full",
        model: e.to,
      });
    else if (e.kind === "rename-field" && e.storage !== "none")
      out.push({
        about: "records",
        says: `${e.model}.${e.from} is renamed ${e.to}; its values are kept.`,
        undo: "full",
        model: e.model,
        field: e.to,
      });
    else if (e.kind === "remove-field" && e.storage !== "none")
      out.push({
        about: "records",
        says: `${e.model}.${e.field} is removed with its values.`,
        undo: "data-snapshot",
        model: e.model,
        field: e.field,
      });
    else if (e.kind === "change-field") {
      const moved = Object.entries(e.renamed ?? {});
      out.push({
        about: "records",
        says: moved.length
          ? `${e.model}.${e.field}: ${moved.map(([from, to]) => (to ? `${from} becomes ${to}` : `${from} is emptied`)).join(", ")}.`
          : `${e.model}.${e.field} changes; values that do not fit are lost.`,
        undo: "data-snapshot",
        model: e.model,
        field: e.field,
      });
    } else if (e.kind === "import-records")
      out.push({
        about: "records",
        says: `Records are added to ${e.model}.`,
        undo: "data-snapshot",
        model: e.model,
      });
  }
  // A default filled into existing records: a new stored field with a default on a model that was there.
  for (const model of after.models) {
    const old = before.models.find((m) => m.name === model.name);
    if (!old) continue;
    for (const field of model.fields)
      if (
        field.default !== undefined &&
        !field.formula &&
        !old.fields.some((f) => f.name === field.name) &&
        !effects.some(
          (e) => e.kind === "rename-field" && e.model === model.name && e.to === field.name,
        )
      )
        out.push({
          about: "records",
          says: `Existing ${model.name} records get ${field.name} = ${JSON.stringify(field.default)}.`,
          undo: "full",
          model: model.name,
          field: field.name,
        });
  }
  return out;
}

/** Who gains or loses what (§4), from the access rules before and after. */
function accessConsequences(
  before: { ir: SpecIR; auth?: AuthIR },
  after: { ir: SpecIR; auth?: AuthIR },
): Consequence[] {
  if (!before.auth || !after.auth) return [];
  const out: Consequence[] = [];
  const who = (roles: string[]) => roles.join(", ");
  const compare = (
    what: string,
    was: { public: boolean; roles: string[] } | undefined,
    now: { public: boolean; roles: string[] } | undefined,
    model?: string,
  ) => {
    if (!was || !now) return;
    const gained = now.roles.filter((r) => !was.roles.includes(r));
    const lost = was.roles.filter((r) => !now.roles.includes(r));
    const says = [
      now.public && !was.public ? `Visitors can now ${what}.` : "",
      was.public && !now.public ? `Visitors can no longer ${what}.` : "",
      gained.length ? `${who(gained)} can now ${what}.` : "",
      lost.length ? `${who(lost)} can no longer ${what}.` : "",
    ].filter(Boolean);
    for (const s of says)
      out.push({ about: "access", says: s, undo: "full", ...(model ? { model } : {}) });
  };
  for (const model of after.ir.models) {
    const old = before.ir.models.find((m) => m.name === model.name);
    if (!old) continue;
    const was = modelAccess(old, before.auth);
    const now = modelAccess(model, after.auth);
    for (const op of Object.keys(now) as (keyof typeof now)[])
      compare(`${op} ${model.name} records`, was[op], now[op], model.name);
  }
  for (const page of after.ir.pages) {
    const old = before.ir.pages.find((p) => p.id === page.id);
    if (old)
      compare(
        `open the ${page.id} page`,
        pageAccess(old, before.auth),
        pageAccess(page, after.auth),
      );
  }
  return out;
}

/** The custom files that use what changes (§4), named by the host's index. */
function customConsequences(
  changed: Changed,
  effects: Effect[],
  custom: ((concept: string) => string[]) | undefined,
): Consequence[] {
  if (!custom) return [];
  // Looked up by the names before the change: custom code still uses the old ones.
  const old = (kind: "model" | "page", name: string) =>
    effects.find(
      (e) =>
        (e.kind === "rename-model" || e.kind === "rename-page") &&
        e.kind === `rename-${kind}` &&
        e.to === name,
    ) as { from: string } | undefined;
  const fieldOld = (name: string) => {
    const [model, field] = name.split(".") as [string, string];
    const e = effects.find(
      (x) => x.kind === "rename-field" && x.model === model && x.to === field,
    ) as { from: string } | undefined;
    return `${old("model", model)?.from ?? model}.${e?.from ?? field}`;
  };
  const concepts = [
    ...changed.models.map((m) => `model:${old("model", m)?.from ?? m}`),
    ...changed.fields.map((f) => `field:${fieldOld(f)}`),
    ...changed.pages.map((p) => `page:${old("page", p)?.from ?? p}`),
    ...changed.actions.map((a) => `action:${a}`),
  ];
  const files = [...new Set(concepts.flatMap(custom))].sort();
  return files.map((file) => ({
    about: "custom-code" as const,
    says: `${file} uses what changes and may need updating.`,
    undo: "full" as const,
  }));
}

/** Mail, calls and timers that change (§4): undo cannot take back what already went out. */
function outsideConsequences(before: SpecIR, after: SpecIR): Consequence[] {
  const lists = [
    ["Outgoing", before.outgoing, after.outgoing],
    ["Incoming", before.incoming, after.incoming],
    ["Timer", before.timers, after.timers],
  ] as const;
  return lists.flatMap(([label, was, now]) =>
    differing<{ name: string }>([...was], [...now], (x) => x.name).map((name) => ({
      about: "outside" as const,
      says: `${label} ${name} changes what the app sends, answers or runs on a clock.`,
      undo: "none" as const,
    })),
  );
}

/**
 * A plan tied to its base (§4.1): the revision it was made against and a hash of its operation
 * list. The host refuses an Apply whose base moved; a different hash means the plan was edited.
 */
export interface PlanBase {
  base: string;
  operations: string;
}

export function planBase(base: string, steps: { op: string; args: OperationArgs }[]): PlanBase {
  return { base, operations: operationsHash(steps) };
}

/** Why a plan no longer fits the project, or undefined when it does. */
export function planMoved(
  plan: PlanBase,
  now: { base: string; steps: { op: string; args: OperationArgs }[] },
): "base" | "operations" | undefined {
  if (plan.base !== now.base) return "base";
  if (plan.operations !== operationsHash(now.steps)) return "operations";
  return undefined;
}

/** A short, stable hash of an operation list: its canonical JSON, FNV-1a twice for 64 bits. */
export function operationsHash(steps: { op: string; args: OperationArgs }[]): string {
  const text = JSON.stringify(canonical(steps));
  const fnv = (seed: number) => {
    let h = seed;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return fnv(0x811c9dc5) + fnv(0x01000193);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  return value;
}
