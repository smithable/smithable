import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { columnOf } from "@smithable/adapter-tanstack";
import {
  type AuthIR,
  type Effect,
  GRANT_KEYS,
  type ModelIR,
  type SpecIR,
  storageOf,
  typeKey,
  validateAuth,
  validateSpec,
  YamlEditor,
  type YamlValue,
} from "@smithable/core";
import { BUSY_MS, countValue, countValues, databasePath } from "./database.js";
import { git, isChangeMessage, ownRepository, trailer, uncommittedRefusal } from "./git.js";
import type { Io } from "./io.js";
import { managedAt, managedDiff, managedOnDisk, SPEC_FILES, validateManaged } from "./managed.js";
import { type FilesPlan, runFilesChange } from "./op.js";
import { loadPlugins } from "./plugins.js";

/**
 * Apply this version (docs/design/apply-old-version.md): an earlier version's definition made
 * the app's again, as a new change through the pipeline. A version is a change on the main line,
 * the undone ones included.
 */

/** A change on the main line, newest first. */
export interface Version {
  sha: string;
  /** Without "smithable: ". */
  subject: string;
  /** When it was made, in seconds. */
  time: number;
  number?: number;
  /** Undone by a later change. */
  undone: boolean;
}

/** Every change on the main line (first parents), newest first, the undone ones included. */
export function versions(dir: string): Version[] {
  if (!ownRepository(dir)) return [];
  const log = git(dir, ["log", "--first-parent", "--format=%H%x1f%ct%x1f%B%x1e"])
    .out.split("\x1e")
    .filter((e) => e.trim());
  const reverted = new Set<string>();
  const list: Version[] = [];
  for (const entry of log) {
    const [sha = "", time = "0", message = ""] = entry.trim().split("\x1f");
    for (const match of message.matchAll(/This reverts commit ([0-9a-f]{40})/g))
      reverted.add(match[1] ?? "");
    if (!isChangeMessage(message)) continue;
    const subject = (message.split("\n")[0] ?? "").replace(/^smithable: /, "");
    const number = Number(trailer(message, "Smithable-Change"));
    list.push({
      sha,
      subject,
      time: Number(time),
      ...(number ? { number } : {}),
      undone: reverted.has(sha),
    });
  }
  return list;
}

/** A version by its id (a commit, at least seven characters) or its change number (12, #12). */
export function findVersion(dir: string, change: string): Version | undefined {
  const all = versions(dir);
  const number = /^#?(\d{1,6})$/.exec(change)?.[1];
  if (number) return all.find((v) => v.number === Number(number));
  if (/^[0-9a-f]{7,40}$/.test(change)) return all.find((v) => v.sha.startsWith(change));
  return undefined;
}

/** "12 November, 14:02": when a version was made, in the machine's time zone. */
export function versionDate(time: number): string {
  const at = new Date(time * 1000);
  const month = at.toLocaleString("en-GB", { month: "long" });
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getDate()} ${month}, ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The auth keys that say who gets in: today's are kept, whatever the version had (§3). */
const KEPT = ["admins", "signIn", "api"] as const;

/** The version's auth file with today's values for the kept keys (a key today lacks removed). */
export function keepAccessKeys(version: string, today: string): string {
  const editor = new YamlEditor(version);
  const now = new YamlEditor(today);
  for (const key of KEPT) {
    if (now.has([key])) {
      const value = now.get([key]) as YamlValue;
      if (editor.has([key])) editor.set([key], value);
      else editor.add([], key, value);
    } else if (editor.has([key])) editor.remove([key]);
  }
  return editor.text;
}

/** What applying a version would do, or why it is refused. */
export interface RestorePlan {
  version: Version;
  /** The managed files that change: each new text, null for one that goes. */
  files: Record<string, string | null>;
  /** The access block (§3): every way the version's roles and rules widen today's, in words. */
  access: string[];
  /** The models and stored fields that come back and that go, in words. */
  comesBack: string[];
  goes: string[];
  /** What the records lose: values with no place in the version (§4.5). */
  lost: { key: string; says: string }[];
  /** The roles the version lacks that people hold now (§4.6). */
  rolesGone: { role: string; people: number }[];
  effects: Effect[];
  /** The renames taken back, for the record. */
  renamed: { model?: string; from: string; to: string }[];
}

/**
 * The plan of applying a version, every check of §4 that needs no answer made: the history, a
 * clean folder, the main line, the version stored, its files valid together. A refusal is a
 * sentence. The checks that ask (a loss, a role people hold) are in the plan, for the caller.
 */
export function restorePlan(dir: string, change: string): RestorePlan | string {
  if (!ownRepository(dir)) return "There is no version to apply: this project has no history yet.";
  const refused = uncommittedRefusal(dir, "so applying a version can be undone on its own");
  if (refused) return refused.trimEnd();
  const branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]).out;
  if (branch.startsWith("fix/"))
    return `The project stands on the fix ${branch.slice(4)}: finish or drop the fix, then apply the version.`;
  const version = findVersion(dir, change);
  if (!version) return `No version ${change} in this app's history.`;
  const then = managedAt(dir, version.sha);
  const thenAuth = then?.[SPEC_FILES.auth];
  if (!then?.[SPEC_FILES.spec] || thenAuth === undefined)
    return "This version is no longer stored.";
  const now = managedOnDisk(dir);
  const auth = now[SPEC_FILES.auth];
  // Today's sign-in, admins and API are what the version gets (§2): without them, nothing to keep.
  if (!auth?.trim())
    return `The app has no ${SPEC_FILES.auth} to keep its sign-in settings from: put it back, then apply the version.`;
  const wanted: Record<string, string> = {
    ...then,
    [SPEC_FILES.auth]: keepAccessKeys(thenAuth, auth),
  };
  const files = managedDiff(now, wanted);
  const problems = validateManaged(dir, files);
  if (problems.length)
    return `This version does not fit the app as it is today:\n${problems.map((p) => `  ${p}`).join("\n")}`;

  const plugins = loadPlugins(dir);
  const spec = (text: string | undefined) =>
    text
      ? (validateSpec({ path: SPEC_FILES.spec, text }, { plugins }).ir as SpecIR | undefined)
      : undefined;
  const today = spec(now[SPEC_FILES.spec]);
  const target = spec(wanted[SPEC_FILES.spec]);
  if (!today || !target) return "This version does not fit the app as it is today.";
  const renames = recordedRenames(dir, version.sha, today, target);
  if (renames.unresolved) return UNFOLLOWED;
  const shape = shapeChange(dir, today, target, renames);
  const authOf = (text: string | undefined, ir: SpecIR) =>
    text ? validateAuth({ path: SPEC_FILES.auth, text }, ir).auth : undefined;
  const holders = roleHolders(dir);
  // What cannot be counted is never taken as nothing to lose.
  if (shape.unread || !holders) return UNREAD;
  const access = accessBlock(authOf(auth, today), authOf(wanted[SPEC_FILES.auth], target), holders);
  const roles = new Set(authOf(wanted[SPEC_FILES.auth], target)?.roles.map((r) => r.name) ?? []);
  const rolesGone = [...holders]
    .filter(([role, people]) => people > 0 && !roles.has(role))
    .map(([role, people]) => ({ role, people }));
  return {
    version,
    files,
    access,
    comesBack: shape.comesBack,
    goes: shape.goes,
    lost: shape.lost,
    rolesGone,
    effects: shape.effects,
    renamed: [
      ...renames.models.map((m) => ({ from: m.now, to: m.was })),
      ...renames.fields.map((f) => ({ model: f.model, from: f.now, to: f.was })),
    ],
  };
}

const UNFOLLOWED =
  "The changes since this version could not be followed (an undo of an undo too many levels deep, or a change Git cannot find or read), so what was renamed since is not known: nothing was changed.";

const UNREAD =
  "The app's records could not be read to see what this version would delete or who holds which role: try again when nothing else is using the database.";

/** The refusal of a plan's loss or roles, said as Studio says it; undefined when none. */
export function lossRefusal(plan: RestorePlan): string | undefined {
  const lines = [
    ...(plan.lost.length
      ? [`This version has no place for: ${plan.lost.map((l) => l.says).join(", ")}.`]
      : []),
    ...plan.rolesGone.map(
      (r) =>
        `The role ${r.role} is not in this version; ${r.people} ${r.people === 1 ? "person has" : "people have"} it.`,
    ),
  ];
  return lines.length ? lines.join("\n") : undefined;
}

/** What `--check` and the confirmation say: the access block first, then the shape, then the records. */
export function planText(plan: RestorePlan): string {
  const lines = [
    `Applying the version from ${versionDate(plan.version.time)} (after "${plan.version.subject}"):`,
  ];
  if (plan.access.length) lines.push("Access:", ...plan.access.map((a) => `  ${a}`));
  if (plan.comesBack.length) lines.push("Comes back:", ...plan.comesBack.map((a) => `  ${a}`));
  if (plan.goes.length) lines.push("Goes:", ...plan.goes.map((a) => `  ${a}`));
  const refusal = lossRefusal(plan);
  lines.push(refusal ?? "Your records stay as they are.");
  return `${lines.join("\n")}\n`;
}

/**
 * `smithable apply-version <change>`: applies a version. `check` says what it would do and changes
 * nothing; a loss, a role people hold or access that widens asks first, and `yes` is the answer. The plan is made
 * again under the project's lock, so every check sees the project as the change finds it.
 */
export async function restore(
  dir: string,
  io: Io,
  change: string,
  flags: {
    check?: boolean;
    yes?: boolean;
    expectedRevision?: string;
    trailer?: string;
    mcp?: boolean;
  } = {},
): Promise<number> {
  if (flags.check) {
    const plan = restorePlan(dir, change);
    if (typeof plan === "string") {
      io.err(`${plan}\n`);
      return 1;
    }
    if (!Object.keys(plan.files).length) {
      io.out("This version is the app as it is now: applying it changes nothing.\n");
      return 0;
    }
    io.out(planText(plan));
    return 0;
  }
  return runFilesChange(
    dir,
    io,
    {
      op: "restoreVersion",
      build: (root) => {
        const plan = restorePlan(root, change);
        if (typeof plan === "string") return plan;
        const refusal = lossRefusal(plan);
        // A loss, a role people hold, or access that widens: asked first (§3, §4.5, §4.6).
        if ((refusal || plan.access.length) && !flags.yes)
          return [
            ...(plan.access.length
              ? [`This version lets more in:\n${plan.access.map((a) => `  ${a}`).join("\n")}`]
              : []),
            ...(refusal ? [refusal] : []),
            `${plan.rolesGone.length ? "With the answer yes, those people are left without that role. " : ""}Run again with ${flags.mcp ? "confirm: true" : "--yes"} to apply it${plan.lost.length ? "; those values are deleted" : ""}.`,
          ].join("\n");
        if (!Object.keys(plan.files).length)
          return "This version is the app as it is now: applying it changes nothing.";
        if (plan.access.length) io.out(`Access:\n${plan.access.map((a) => `  ${a}\n`).join("")}`);
        // Said with the answer given beforehand too, so what goes is never deleted unseen.
        if (refusal) io.out(`${refusal}\n`);
        const lost = plan.lost.map((l) => l.key);
        const result: FilesPlan = {
          files: plan.files,
          subject: `smithable: Applied the version from ${versionDate(plan.version.time)} (after "${plan.version.subject}")`,
          body: `Applies the version of commit ${plan.version.sha}.`,
          description: `Applied the version from ${versionDate(plan.version.time)}`,
          recorded: {
            op: "restoreVersion",
            args: {
              version: plan.version.sha,
              ...(lost.length ? { lost } : {}),
              ...(plan.renamed.length ? { renamed: plan.renamed } : {}),
            },
          },
          effects: plan.effects,
          lost,
        };
        return result;
      },
    },
    {
      yes: flags.yes === true,
      ...(flags.expectedRevision ? { expectedRevision: flags.expectedRevision } : {}),
      ...(flags.trailer ? { trailer: flags.trailer } : {}),
      ...(flags.mcp ? { mcp: true } : {}),
    },
  );
}

/** A model or field as it is now and as the version names it. */
interface Renames {
  models: { now: string; was: string }[];
  fields: { model: string; now: string; was: string; reference: boolean }[];
  /** The history since the version could not be followed: what was renamed is not known. */
  unresolved?: boolean;
}

/**
 * The renames between a version and now, read from the recorded operations (each commit's
 * Smithable-Op) on the main line, a change undone since left out (one from before the version
 * undone since played backwards, a revert of a revert forwards again), and kept only where the two
 * shapes bear them out: a rename is never guessed from the shapes alone (§4.5).
 */
function recordedRenames(dir: string, version: string, today: SpecIR, then: SpecIR): Renames {
  const range = git(dir, [
    "log",
    "--first-parent",
    "--reverse",
    "--format=%H%x1f%B%x1e",
    `${version}..HEAD`,
  ]);
  const entries = range.out
    .split("\x1e")
    .filter((e) => e.trim())
    .map((e) => {
      const [sha = "", message = ""] = e.trim().split("\x1f");
      return { sha, message };
    });
  // Each of the version's models and fields, by the name it has after each rename in turn
  // (undefined once it has gone).
  const models = new Map<string, string | undefined>(then.models.map((m) => [m.name, m.name]));
  const fields = new Map<string, string | undefined>(
    then.models.flatMap((m) => m.fields.map((f) => [`${m.name}\x1f${f.name}`, f.name] as const)),
  );
  const rename = (op: string | undefined, args: Record<string, unknown>, back = false) => {
    // A removal ends an identity at once, so a newer one on the name in the same commit is another.
    if (back && op === "addModel" && typeof args.model === "string") {
      for (const [name, current] of models) if (current === args.model) models.set(name, undefined);
    }
    if (
      ((back && op === "addField") || (!back && op === "removeField")) &&
      typeof args.model === "string" &&
      typeof args.field === "string"
    ) {
      const owner = [...models].find(([, current]) => current === args.model)?.[0];
      for (const [key, current] of fields)
        if (owner && key.startsWith(`${owner}\x1f`) && current === args.field)
          fields.set(key, undefined);
    }
    if (op === "renameModel" && typeof args.from === "string" && typeof args.to === "string") {
      for (const [name, current] of models) if (current === args.from) models.set(name, args.to);
    }
    if (
      op === "renameField" &&
      typeof args.model === "string" &&
      typeof args.from === "string" &&
      typeof args.to === "string"
    ) {
      const owner = [...models].find(([, current]) => current === args.model)?.[0];
      for (const [key, current] of fields)
        if (owner && key.startsWith(`${owner}\x1f`) && current === args.from)
          fields.set(key, args.to);
    }
  };
  // A commit's recorded steps, in order: a batch's operations, an applied version's renames.
  const steps = (
    message: string,
  ): { op?: string; args: Record<string, unknown>; back?: boolean }[] => {
    let recorded: { op?: string; args?: Record<string, unknown> } = {};
    try {
      recorded = JSON.parse(trailer(message, "Smithable-Op") ?? "{}");
    } catch {}
    const args = recorded.args ?? {};
    if (recorded.op === "batch" && Array.isArray(args.operations))
      return (args.operations as { op?: string; args?: Record<string, unknown> }[]).map((s) => ({
        op: s.op,
        args: s.args ?? {},
      }));
    if (recorded.op === "restoreVersion" && Array.isArray(args.renamed))
      return (args.renamed as { model?: string; from: string; to: string }[]).map((r) => ({
        op: r.model ? "renameField" : "renameModel",
        args: r,
      }));
    return [{ op: recorded.op, args }];
  };
  const revertOf = (message: string) => /This reverts commit ([0-9a-f]{40})/.exec(message)?.[1];
  // What a commit did, a revert being what it reverted done backwards; undefined when the chain
  // of reverts cannot be followed to its end (too deep, or a commit Git cannot find).
  type Step = ReturnType<typeof steps>[number];
  const effect = (message: string, depth = 0): Step[] | undefined => {
    const target = revertOf(message);
    if (!target) return steps(message);
    const reverted = depth < 8 ? git(dir, ["log", "-1", "--format=%B", target]) : undefined;
    if (!reverted?.ok) return undefined;
    return effect(reverted.out, depth + 1)
      ?.reverse()
      .map((step) => ({
        ...step,
        back: !step.back,
        args: { ...step.args, from: step.args.to, to: step.args.from },
      }));
  };
  // The models and their fields as a commit left its spec; undefined when it cannot be read or
  // is not a map of models each with a map of fields.
  const shapeAt = (sha: string): Map<string, Set<string>> | undefined => {
    const shown = git(dir, ["show", `${sha}:./${SPEC_FILES.spec}`]);
    if (!shown.ok) return undefined;
    const isMap = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null && !Array.isArray(v);
    try {
      const all = new YamlEditor(shown.out).get(["models"]) ?? {};
      if (!isMap(all)) return undefined;
      const shape = new Map<string, Set<string>>();
      for (const [name, m] of Object.entries(all)) {
        const fields = isMap(m) ? (m.fields ?? {}) : undefined;
        if (!isMap(fields)) return undefined;
        shape.set(name, new Set(Object.keys(fields)));
      }
      return shape;
    } catch {
      return undefined;
    }
  };
  // Every commit in turn, a revert as its change backwards. A model or field that is not in a
  // commit's spec under the name followed has gone, and one on that name later is another: its
  // identity ends there and no rename brings today's back as the version's.
  if (!range.ok) return { models: [], fields: [], unresolved: true };
  for (const { sha, message } of entries) {
    const done = effect(message);
    const shape = shapeAt(sha);
    if (!done || !shape) return { models: [], fields: [], unresolved: true };
    for (const step of done) rename(step.op, step.args, step.back);
    for (const [name, current] of models)
      if (current !== undefined && !shape.has(current)) models.set(name, undefined);
    for (const [key, current] of fields) {
      const owner = models.get(key.split("\x1f")[0] ?? "");
      if (current !== undefined && (owner === undefined || !shape.get(owner)?.has(current)))
        fields.set(key, undefined);
    }
  }
  const model = (ir: SpecIR, name: string) => ir.models.find((m) => m.name === name);
  const result: Renames = { models: [], fields: [] };
  // A newer model on the old name goes (shapeChange counts what it holds); the rename stands.
  for (const [name, current] of models)
    if (current !== undefined && current !== name && model(today, current))
      result.models.push({ now: current, was: name });
  const nowName = (name: string) => result.models.find((m) => m.was === name)?.now ?? name;
  for (const [key, current] of fields) {
    const [owner = "", name = ""] = key.split("\x1f");
    if (current === undefined || current === name) continue;
    const was = model(then, owner)?.fields.find((f) => f.name === name);
    const is = model(today, nowName(owner))?.fields.find((f) => f.name === current);
    if (!was || !is || storageOf(was) === "none" || storageOf(was) !== storageOf(is)) continue;
    result.fields.push({
      model: owner,
      now: current,
      was: name,
      reference: storageOf(was) === "reference",
    });
  }
  return result;
}

/**
 * The difference between today's shape and the version's, as effects and in words (§4.5): what
 * comes back, what goes, and what the records lose (a stored field or model with values gone, a
 * field of another type, a choice value in use that is gone).
 */
function shapeChange(dir: string, today: SpecIR, then: SpecIR, renames: Renames) {
  const effects: Effect[] = [];
  const comesBack: string[] = [];
  const goes: string[] = [];
  const lost: { key: string; says: string }[] = [];
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  // A count the database did not give, while there is one, is unknown, never none.
  const database = existsSync(databasePath(dir));
  let unread = false;
  const read = <T>(value: T | undefined): T | undefined => {
    if (value === undefined && database) unread = true;
    return value;
  };
  // Today's model as the version names it, and back.
  const thenModel = (name: string) =>
    renames.models.find((m) => m.now === name)?.was ??
    (renames.models.some((m) => m.was === name) ? undefined : name);
  const nowModel = (name: string) => renames.models.find((m) => m.was === name)?.now ?? name;
  for (const m of renames.models) effects.push({ kind: "rename-model", from: m.now, to: m.was });
  for (const f of renames.fields)
    effects.push({
      kind: "rename-field",
      model: f.model,
      from: f.now,
      to: f.was,
      storage: f.reference ? "reference" : "value",
    });
  const stored = (model: ModelIR) => model.fields.filter((f) => storageOf(f) !== "none");
  for (const model of today.models) {
    const name = thenModel(model.name);
    const old = name ? then.models.find((m) => m.name === name) : undefined;
    if (!old) {
      const rows =
        read(countValues(dir, columnOf(model.name, "id", false).table, "id"))?.total ?? 0;
      goes.push(model.name);
      if (rows)
        lost.push({ key: model.name, says: `${model.name} (${count(rows, "record", "records")})` });
      continue;
    }
    for (const field of stored(model)) {
      const renamed = renames.fields.find((f) => f.model === old.name && f.now === field.name);
      const taken = renames.fields.some((f) => f.model === old.name && f.was === field.name);
      const match = renamed
        ? old.fields.find((f) => f.name === renamed.was)
        : taken
          ? undefined
          : old.fields.find((f) => f.name === field.name);
      const reference = storageOf(field) === "reference";
      const { table, column } = columnOf(model.name, field.name, reference);
      const filled = () => read(countValues(dir, table, column))?.filled ?? 0;
      const where = `${model.name} · ${field.name}`;
      if (!match || storageOf(match) === "none") {
        goes.push(where);
        const n = filled();
        if (n)
          lost.push({
            key: `${model.name}.${field.name}`,
            says: `${where} (${count(n, "value", "values")})`,
          });
        continue;
      }
      const nowType = typeKey(field.type);
      const thenType = typeKey(match.type).replace(/^(\w+)/, (t) => nowModel(t));
      if (nowType !== thenType) {
        const n = filled();
        if (n)
          lost.push({
            key: `${model.name}.${field.name}`,
            says: `${where} (${count(n, "value", "values")} of another type)`,
          });
        continue;
      }
      if (field.type.kind === "choice" && match.type.kind === "choice") {
        const kept = match.type.values;
        const gone = field.type.values.filter((v) => !kept.includes(v));
        const cleared: Record<string, string> = {};
        for (const value of gone) {
          const n = read(countValue(dir, table, column, value)) ?? 0;
          if (!n) continue;
          cleared[value] = "";
          lost.push({
            key: `${model.name}.${field.name}`,
            says: `${where} = ${value} (${count(n, "record", "records")})`,
          });
        }
        if (Object.keys(cleared).length)
          effects.push({
            kind: "change-field",
            model: old.name,
            field: match.name,
            choices: kept,
            renamed: cleared,
          });
      }
    }
  }
  for (const model of then.models) {
    const current = today.models.find((m) => m.name === nowModel(model.name));
    if (!current) {
      comesBack.push(model.name);
      continue;
    }
    for (const field of stored(model)) {
      const renamed = renames.fields.find((f) => f.model === model.name && f.was === field.name);
      if (renamed) continue;
      if (!current.fields.some((f) => f.name === field.name))
        comesBack.push(`${model.name} · ${field.name}`);
    }
  }
  return { effects, comesBack, goes, lost, unread };
}

/** How many people hold each role in the development database (none when there is none). */
export function roleHolders(dir: string): Map<string, number> | undefined {
  const holders = new Map<string, number>();
  // No database, or an app without sign-in: nobody holds a role.
  if (!existsSync(databasePath(dir))) return holders;
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(databasePath(dir), { readOnly: true, timeout: BUSY_MS });
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user'").get())
      return holders;
    const rows = db.prepare('SELECT role, count(*) AS n FROM "user" GROUP BY role').all() as {
      role: string | null;
      n: number;
    }[];
    for (const row of rows) if (row.role) holders.set(row.role, Number(row.n));
    return holders;
  } catch {
    // Locked or unreadable: unknown, which the plan refuses (never "nobody").
    return undefined;
  } finally {
    db?.close();
  }
}

/**
 * The access block (§3): every way the version's roles and rules let more in than today's, in
 * plain words, with the people it concerns counted from today's records. Empty when no rule or
 * role widens.
 */
export function accessBlock(
  today: AuthIR | undefined,
  then: AuthIR | undefined,
  holders: Map<string, number>,
): string[] {
  if (!today || !then) return [];
  const lines: string[] = [];
  const people = (n: number) =>
    n ? `${n} ${n === 1 ? "person has" : "people have"} it` : "nobody has it now";
  const added = (was: string[], is: string[]) => is.filter((x) => !was.includes(x));
  for (const model of added(today.public.read, then.public.read))
    lines.push(`Anyone can read ${model} again.`);
  for (const model of added(today.public.create, then.public.create))
    lines.push(`Anyone can add ${model} records again.`);
  for (const page of added(today.public.pages, then.public.pages))
    lines.push(`Anyone can open the page ${page} again.`);
  if (today.defaultAccess === "private" && then.defaultAccess === "shared")
    lines.push("Everyone who signs in can read each other's records again.");
  if (then.defaultRole !== today.defaultRole)
    lines.push(`People who sign up get the role ${then.defaultRole} again.`);
  for (const role of then.roles) {
    const now = today.roles.find((r) => r.name === role.name);
    if (!now) {
      lines.push(`The role ${role.name} comes back; ${people(holders.get(role.name) ?? 0)}.`);
      continue;
    }
    if (role.grants === "all") {
      if (now.grants !== "all") lines.push(`The role ${role.name} may do everything again.`);
      continue;
    }
    if (now.grants === "all") continue;
    for (const key of GRANT_KEYS) {
      const was = now.grants[key];
      const is = role.grants[key];
      if (!is || was === "all") continue;
      const more = is === "all" ? ["everything"] : added(was ?? [], is);
      if (more.length) lines.push(`The role ${role.name} may ${key} ${more.join(", ")} again.`);
    }
  }
  return lines;
}
