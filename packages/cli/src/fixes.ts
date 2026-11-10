// Fixes that reach built apps (smithable-cloud docs/design/fixes-reach-apps.md §3, A 237): the
// fix files (fixes/<id>.yml in the engine's repository, embedded in fixes.gen.ts), and whether
// one affects a project, read from its spec files and package.json alone: never its records,
// logs or custom code. `smithable affected <id> --json` and `smithable fixes --json`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SCALAR_TYPES, YamlEditor } from "@smithable/core";
import { FIXES } from "./fixes.gen.js";
import type { Io } from "./io.js";
import { loadSpec } from "./validate.js";

export const SEVERITIES = ["urgent", "security", "fix"] as const;
export const MIGRATIONS = ["none", "additive", "destructive"] as const;

export interface Fix {
  id: string;
  /** One plain sentence. */
  title: string;
  severity: (typeof SEVERITIES)[number];
  /** What could have happened, in the notice's words, or "none". */
  exposure: string;
  /**
   * What the app's owner must do themselves, in one plain sentence (rotate a key, tell their
   * visitors); none when the rebuild is all (fixes-reach-apps.md §4: mailed with the impact).
   */
  ownerAction?: string;
  /** The engine commit that brought the bug, or "unknown". */
  introduced: string;
  /** Any one holding makes an app affected (OR). */
  affects: { kit?: string[]; features?: string[]; stack?: string[] };
  migration: (typeof MIGRATIONS)[number];
}

/**
 * The features a fix can name, each a predicate on the spec files (§3). One that needs two
 * things together is written here as one predicate, so a fix never needs AND.
 */
export const FEATURES: Record<string, string> = {
  any: "every app",
  "page:<kind>":
    "a page of that kind (crud, landing, sections, dashboard, settings, onboarding, users, calendar, …)",
  "field:<type>":
    "a field of that type (a scalar such as file, files, picture, money, phone; choice; reference; list)",
  "auth:<provider>": "sign-in with that provider (google, email, …)",
  "section:<name>":
    "a non-empty section: incoming, outgoing, timers, queries, actions, or a plugin's",
  "theme:<preset>": "the app's theme preset",
};

const KEYS = [
  "id",
  "title",
  "severity",
  "exposure",
  "owner_action",
  "introduced",
  "affects",
  "migration",
];

/** A fix file read and checked: the fix, or what is wrong with it. */
export function readFix(name: string, text: string): { fix: Fix } | { errors: string[] } {
  const errors: string[] = [];
  let raw: Record<string, unknown>;
  try {
    raw = (new YamlEditor(text).get([]) ?? {}) as Record<string, unknown>;
  } catch (error) {
    return { errors: [`${name}: not YAML (${(error as Error).message.split("\n")[0]})`] };
  }
  const text_ = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string).trim() : "");
  for (const key of Object.keys(raw))
    if (!KEYS.includes(key)) errors.push(`${name}: unknown key "${key}"`);
  for (const key of ["id", "title", "exposure", "introduced"])
    if (!text_(key)) errors.push(`${name}: "${key}" is missing`);
  if (text_("id") && `${text_("id")}.yml` !== name)
    errors.push(`${name}: its id is "${text_("id")}"; the file must be fixes/${text_("id")}.yml`);
  if (text_("id") && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text_("id")))
    errors.push(`${name}: an id is lowercase words joined by hyphens`);
  if (!SEVERITIES.includes(raw.severity as Fix["severity"]))
    errors.push(`${name}: "severity" is ${SEVERITIES.join(", ")}`);
  if (!MIGRATIONS.includes(raw.migration as Fix["migration"]))
    errors.push(`${name}: "migration" is ${MIGRATIONS.join(", ")}`);
  if ("owner_action" in raw && (typeof raw.owner_action !== "string" || !text_("owner_action")))
    errors.push(`${name}: "owner_action" is one plain sentence, or left out when there is none`);
  if (text_("owner_action").includes("\n"))
    errors.push(`${name}: "owner_action" is one sentence on one line`);
  if (text_("introduced") && !/^(?:unknown|[0-9a-f]{7,40})$/.test(text_("introduced")))
    errors.push(`${name}: "introduced" is an engine commit or "unknown"`);
  const affects = (raw.affects ?? {}) as Record<string, unknown>;
  const lists: Fix["affects"] = {};
  for (const [key, value] of Object.entries(affects)) {
    if (!["kit", "features", "stack"].includes(key)) {
      errors.push(`${name}: affects has kit, features and stack, not "${key}"`);
      continue;
    }
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v)) {
      errors.push(`${name}: affects.${key} is a list of texts`);
      continue;
    }
    lists[key as keyof Fix["affects"]] = value as string[];
  }
  for (const path of lists.kit ?? [])
    if (!/^src\/kit\/[\w./-]+$/.test(path) || path.includes(".."))
      errors.push(`${name}: a kit path is the app's, like src/kit/Upload.tsx: "${path}"`);
  for (const feature of lists.features ?? [])
    if (!knownFeature(feature)) errors.push(`${name}: unknown feature "${feature}"`);
  if (!Object.values(lists).some((l) => l && l.length > 0))
    errors.push(`${name}: affects names no kit file, feature or package`);
  if (errors.length) return { errors };
  return {
    fix: {
      id: text_("id"),
      title: text_("title"),
      severity: raw.severity as Fix["severity"],
      exposure: text_("exposure"),
      ...(text_("owner_action") ? { ownerAction: text_("owner_action") } : {}),
      introduced: text_("introduced"),
      affects: lists,
      migration: raw.migration as Fix["migration"],
    },
  };
}

const knownFeature = (feature: string) => {
  if (feature === "any") return true;
  const m = /^(page|field|auth|section|theme):([\w-]+)$/.exec(feature);
  if (!m) return false;
  return m[1] !== "field" || [...SCALAR_TYPES, "choice", "reference", "list"].includes(m[2] ?? "");
};

/** Every fix file embedded in this engine, read; a broken one throws (the build checks them). */
export function allFixes(): Fix[] {
  return Object.entries(FIXES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, text]) => {
      const read = readFix(name, text);
      if ("errors" in read) throw new Error(read.errors.join("\n"));
      return read.fix;
    });
}

export type Answer = { answer: "yes" | "no" | "unknown"; reason: string };

/** Whether a fix affects the project in `dir`, from its spec files and package.json alone. */
export function affects(dir: string, fix: Fix): Answer {
  const { kit = [], features = [], stack = [] } = fix.affects;
  const kitFile = kit.find((path) => existsSync(join(dir, path)));
  if (kitFile) return { answer: "yes", reason: `The app has ${kitFile}.` };
  // What could not be read leaves "unknown" only when nothing else says yes.
  let unread: string | undefined;
  if (features.length) {
    const quiet = { out: () => {}, err: () => {} };
    const spec = loadSpec(dir, quiet);
    if (!spec.ir || !spec.auth || (!spec.ux && features.some((f) => f.startsWith("theme:"))))
      unread = "The app's spec files could not be read.";
    else {
      const holding = features.find((f) => holds(f, spec));
      if (holding) return { answer: "yes", reason: `The app has ${FEATURE_WORDS(holding)}.` };
    }
  }
  if (stack.length) {
    let pkg:
      | { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
      | undefined;
    try {
      pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    } catch {
      unread ??= "The app's package.json could not be read.";
    }
    const found = stack.find((p) => pkg?.dependencies?.[p] ?? pkg?.devDependencies?.[p]);
    if (found) return { answer: "yes", reason: `The app uses ${found}.` };
  }
  if (unread) return { answer: "unknown", reason: unread };
  return {
    answer: "no",
    reason: `The app has none of what the fix is about (${[...kit, ...features, ...stack].join(", ")}).`,
  };
}

const FEATURE_WORDS = (feature: string) => {
  const [kind, value] = feature.split(":");
  return kind === "any"
    ? "what every app has"
    : kind === "page"
      ? `a ${value} page`
      : kind === "field"
        ? `a ${value} field`
        : kind === "auth"
          ? `sign-in with ${value}`
          : kind === "section"
            ? `the ${value} section`
            : `the ${value} theme`;
};

function holds(feature: string, spec: ReturnType<typeof loadSpec>): boolean {
  const { ir, auth, ux } = spec;
  if (!ir || !auth) return false;
  if (feature === "any") return true;
  const [kind, value = ""] = feature.split(":");
  if (kind === "page") return ir.pages.some((p) => p.pattern.kind === value);
  if (kind === "field")
    return ir.models.some((m) =>
      m.fields.some((f) =>
        f.type.kind === "scalar"
          ? f.type.name === value
          : f.type.kind === "choice"
            ? value === "choice"
            : f.type.kind === "relation" && value === (f.type.many ? "list" : "reference"),
      ),
    );
  if (kind === "auth")
    return auth.signIn !== "none" && auth.signIn.providers.some((p) => p === value);
  if (kind === "section") {
    const sections: Record<string, unknown[]> = {
      incoming: ir.incoming,
      outgoing: ir.outgoing,
      timers: ir.timers,
      queries: ir.queries,
      actions: ir.actions,
    };
    const list = sections[value];
    if (list) return list.length > 0;
    const plugin = ir.extensions?.[value];
    return Array.isArray(plugin)
      ? plugin.length > 0
      : plugin !== null && typeof plugin === "object"
        ? Object.keys(plugin).length > 0
        : plugin !== undefined;
  }
  if (kind === "theme") return ux?.theme.preset === value;
  return false;
}

/** `smithable affected <id> [--json]`: yes, no or unknown, with a one-line reason. */
export function affectedCommand(
  dir: string,
  io: Io,
  id: string | undefined,
  json: boolean,
): number {
  const fix = id ? allFixes().find((f) => f.id === id) : undefined;
  if (!fix) {
    io.err(
      id
        ? `No fix "${id}" in this engine: smithable fixes lists them.\n`
        : "Name a fix: smithable affected <id>.\n",
    );
    return 2;
  }
  const result = affects(dir, fix);
  io.out(
    json
      ? `${JSON.stringify({ fix: fix.id, ...result })}\n`
      : `${result.answer}: ${result.reason}\n`,
  );
  return 0;
}

/** `smithable fixes [--json]`: the fix files this engine carries (fixes.json in the image). */
export function fixesCommand(io: Io, json: boolean): number {
  const fixes = allFixes();
  if (json) io.out(`${JSON.stringify({ fixes }, null, 2)}\n`);
  else for (const f of fixes) io.out(`${f.id} (${f.severity}): ${f.title}\n`);
  return 0;
}

/**
 * What a database change does to the build before it (§5, the `additive` check): `none`; or
 * `additive` when every statement only adds (a table, a plain index, a column that may be
 * empty or has a default), so the previous build still runs on the migrated schema; otherwise
 * `destructive`, which is never applied automatically. Anything not known to be safe counts as
 * destructive (a unique index, a table rebuilt, a column dropped or renamed).
 */
export function migrationKind(sql: string[]): Fix["migration"] {
  // Comments out first, then every statement on its own, wherever its semicolon is.
  const statements = sql
    .flatMap((text) => text.replace(/--.*$/gm, "").split(";"))
    .map((s) => s.trim())
    .filter(Boolean);
  if (statements.length === 0) return "none";
  const adds = (s: string) =>
    /^CREATE TABLE\b/i.test(s) ||
    /^CREATE INDEX\b/i.test(s) ||
    (/^ALTER TABLE\s+\S+\s+ADD\s+(?:COLUMN\s+)?\S+/i.test(s) &&
      // One clause only: "ADD a text, DROP b" is not an addition.
      !s.replace(/\([^()]*\)/g, "").includes(",") &&
      (!/\bNOT NULL\b/i.test(s) || /\bDEFAULT\b/i.test(s)) &&
      !/\b(?:UNIQUE|PRIMARY KEY|REFERENCES|CHECK|CONSTRAINT)\b/i.test(s));
  return statements.every(adds) ? "additive" : "destructive";
}

/** A schema as drizzle-kit keeps it after each migration (drizzle/meta/NNNN_snapshot.json). */
export interface SchemaSnapshot {
  tables: Record<
    string,
    {
      name: string;
      columns: Record<string, { name: string; type: string; notNull?: boolean; default?: unknown }>;
      indexes?: Record<string, { name: string; columns: string[]; isUnique?: boolean }>;
      foreignKeys?: Record<string, { name: string; columnsFrom: string[]; tableTo: string }>;
    }
  >;
}

/**
 * What a destructive migration loses or may refuse, one plain line each (fixes-reach-apps §5
 * "Data"): the tables and columns that go, a column whose type changes, a column that becomes
 * required, a new rule (unique, a reference) old records may break. Words only, never a value.
 * None (undefined) when the comparison finds nothing to say, so the service keeps the update
 * held rather than read it as losing nothing; with more than 40 lines it holds it too.
 */
export function migrationConsequences(
  before: SchemaSnapshot,
  after: SchemaSnapshot,
): { about: "records"; says: string }[] | undefined {
  const lines: string[] = [];
  const then = new Map(Object.values(before.tables).map((t) => [t.name, t]));
  const now = new Map(Object.values(after.tables).map((t) => [t.name, t]));
  for (const table of then.values())
    if (!now.has(table.name))
      lines.push(`The table ${table.name} is removed, with all its records.`);
  for (const later of now.values()) {
    const table = then.get(later.name);
    if (!table) continue;
    for (const column of Object.values(table.columns)) {
      const next = later.columns[column.name];
      if (!next) {
        lines.push(`The column ${column.name} of ${table.name} is removed, with its values.`);
        continue;
      }
      if (next.type !== column.type)
        lines.push(
          `The column ${column.name} of ${table.name} changes from ${column.type} to ${next.type}: values that do not convert are lost.`,
        );
      if (next.notNull && !column.notNull)
        lines.push(
          `The column ${column.name} of ${table.name} becomes required: records without a value stop the update.`,
        );
    }
    for (const next of Object.values(later.columns))
      if (!table.columns[next.name] && next.notNull && next.default === undefined)
        lines.push(
          `A required column ${next.name} is added to ${table.name} with no value to give its records: they stop the update.`,
        );
    const uniques = (t: typeof table) =>
      new Set(
        Object.values(t.indexes ?? {})
          .filter((i) => i.isUnique)
          .map((i) => i.columns.join(", ")),
      );
    const was = uniques(table);
    for (const columns of uniques(later))
      if (!was.has(columns))
        lines.push(
          `${table.name}'s ${columns} must now be unique: records that share a value stop the update.`,
        );
    const refs = (t: typeof table) =>
      new Set(
        Object.values(t.foreignKeys ?? {}).map((f) => `${f.columnsFrom.join(", ")} → ${f.tableTo}`),
      );
    const had = refs(table);
    for (const ref of refs(later))
      if (!had.has(ref))
        lines.push(
          `${table.name}'s ${ref.replace(" → ", " now refers to ")}: records that refer to nothing there stop the update.`,
        );
  }
  if (!lines.length) return undefined;
  return lines.map((says) => ({ about: "records" as const, says: says.slice(0, 500) }));
}
