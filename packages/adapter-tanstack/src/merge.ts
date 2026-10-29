// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7): a merge,
// two records of a model made one (docs/design/intents.md §3).
import {
  type AuthIR,
  actionAccess,
  type FieldIR,
  kebab,
  type ModelIR,
  type SpecIR,
  type StandardActionIR,
  titleField,
  USER_MODEL,
} from "@smithable/core";
import { actionNames } from "./actions.js";
import { hasSignIn } from "./auth.js";
import {
  dataKey,
  HEADER,
  literal,
  modelNamed,
  names,
  ownerKey,
  SCHEMA_IMPORT,
  sequenceEntries,
  shownTitleKey,
  type Texts,
} from "./shared.js";

/** A reference to the merged model from any model (itself too): what moves to the kept record. */
interface Referrer {
  model: ModelIR;
  field: FieldIR;
  key: string;
  /** Unique on its own (`unique` on the field, or a model's unique list of it alone): one to one. */
  unique: boolean;
  /** For each unique pair it is in, the pair's other stored keys (customer and tag). */
  pairs: string[][];
}

/** Every single reference to `model`, in every model: lists store nothing, so these are all. */
export function referrersOf(ir: SpecIR, model: string): Referrer[] {
  return ir.models.flatMap((m) =>
    m.fields
      .filter((f) => f.type.kind === "relation" && !f.type.many && f.type.model === model)
      .map((field) => ({
        model: m,
        field,
        key: dataKey(field),
        unique:
          Boolean(field.unique) ||
          (m.unique ?? []).some((u) => u.fields.length === 1 && u.fields[0] === field.name),
        pairs: (m.unique ?? [])
          .filter((u) => u.fields.length > 1 && u.fields.includes(field.name))
          .map((u) =>
            u.fields
              .filter((name) => name !== field.name)
              .map((name) => dataKey(m.fields.find((f) => f.name === name) as FieldIR)),
          ),
      })),
  );
}

/**
 * The fields a merge decides between the two records: stored values a person gives, not computed,
 * counting up, the owner or a reference to the model itself.
 */
export function mergedFields(model: ModelIR): FieldIR[] {
  return model.fields.filter(
    (f) =>
      !f.formula &&
      !f.sequence &&
      !f.byApp &&
      f.name !== model.ownedBy &&
      !(f.type.kind === "relation" && (f.type.many || f.type.model === model.name)),
  );
}

/** The merge actions of a model: its records' Restore puts back what a merge moved. */
export const mergesOf = (ir: SpecIR, model: string): StandardActionIR[] =>
  ir.actions.filter(
    (a): a is StandardActionIR => !a.custom && a.merge !== undefined && a.on === model,
  );

/** The merge's module: who may run it, what it would do (the form's sentence), and the run. */
export function mergeActionModule(
  action: StandardActionIR,
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
): string {
  const a = actionNames(action);
  const n = names(modelNamed(ir, action.on), t);
  const into = action.merge?.into ?? "chosen";
  return `${HEADER}import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Rule } from "#/kit/access";
import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";
import { ${a.preview}, ${a.run} } from "./${kebab(action.name)}.server";

/** Who may run the "${action.name}" ${into === "new" ? "combine" : "merge"}: its grant, with ${into === "new" ? "the right to add" : "write on"} ${n.pluralLabel.toLowerCase()}. */
export const ${a.access}: Rule = ${literal(actionAccess(action, auth, ir.models))};

/** Where the records go: into the one the person picks (chosen), or into a new one (new). */
export const ${a.keep} = ${JSON.stringify(into)};

/** The records picked, in their order: the one that stays (or whose values come first) first. */
const ids = z.array(z.number().int()).min(2).max(50);
/** And for each field asked, what the person picked: a record's value by its id, the sum or the texts joined. */
const choices = z
  .record(z.string(), z.union([z.enum(["keep", "kept", "other", "sum", "join"]), z.number().int()]))
  .default({});

/** What merging them would do, as the viewer may see it: the form's sentence. */
export const ${a.previewFn} = createServerFn({ method: "POST" })
  .validator(z.object({ ids }))
  .handler(async ({ data }) => ${a.preview}(await currentViewer(), data.ids));

export const ${action.name} = createServerFn({ method: "POST" })
  .validator(z.object({ ids, choices${into === "new" ? ", remove: z.boolean().default(false)" : ""} }))
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    writeAllowed(viewer, getRequestHeaders());
    return ${a.run}(viewer, data.ids, data.choices${into === "new" ? ", data.remove" : ""});
  });
`;
}

/**
 * The merge on the server: the records picked, as the viewer may read them, in their order.
 * Into the chosen one: every reference to the others moves to it and it takes the values its
 * fields' rules and the person's choices give, in one transaction, and the others go to the trash
 * with a line each that says what moved, which their Restore reads. Into a new one (a combine): a
 * new record from the same rules, the picked staying as they are unless the person removes them.
 */
export function mergeActionServer(
  action: StandardActionIR,
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
): string {
  const a = actionNames(action);
  const model = modelNamed(ir, action.on);
  const n = names(model, t);
  const merge = action.merge ?? { into: "chosen", fields: {} as Record<string, string> };
  const into = merge.into;
  const signedIn = hasSignIn(auth);
  const owner = (m: ModelIR, row: string) => (signedIn ? `, ${row}.${ownerKey(m)}` : "");
  const referrers = referrersOf(ir, model.name);
  // Each field's rule, by its stored key; what the spec does not name, the person decides.
  const rules = Object.fromEntries(
    mergedFields(model).map((f) => [
      dataKey(f),
      {
        rule: merge.fields?.[f.name] ?? "ask",
        unique: Boolean(f.unique) || (model.unique ?? []).some((u) => u.fields.includes(f.name)),
        kind:
          f.type.kind === "scalar" && ["int", "decimal", "money"].includes(f.type.name)
            ? "number"
            : f.type.kind === "scalar" && ["string", "text", "markdown"].includes(f.type.name)
              ? "text"
              : "other",
      },
    ]),
  );
  const title = titleField(model);
  // A reference's value shown by its title: the field as the record page's row has it, and the key.
  const refs = Object.fromEntries(
    mergedFields(model)
      .filter((f) => f.type.kind === "relation")
      .map((f) => [
        dataKey(f),
        [
          f.name,
          f.type.kind === "relation" && f.type.model === USER_MODEL
            ? "name"
            : shownTitleKey(ir, (f.type as { model: string }).model),
        ],
      ]),
  );
  const others = [...new Map(referrers.map((r) => [r.model.name, r.model])).values()].filter(
    (m) => m.name !== model.name,
  );
  // The referring records, each reference on its own: those of the others, the clash rules, and
  // the rights each needs. A record in the trash moves with the rest but takes part in no clash.
  const step = (r: Referrer, i: number) => {
    const rn = names(r.model, t);
    const tb = rn.table;
    const self = r.model.name === model.name;
    const ref = JSON.stringify(r.key);
    const m = JSON.stringify(r.model.name);
    const gone = r.model.trash ? "row.deletedAt != null" : "false";
    const select = `{ id: ${tb}.id, ref: ${tb}.${r.key}${signedIn ? `, owner: ${tb}.${ownerKey(r.model)}` : ""}${r.model.trash ? `, deletedAt: ${tb}.deletedAt` : ""}${r.pairs
      .flat()
      .map((k) => `, ${k}: ${tb}.${k}`)
      .join("")} }`;
    const lines = [
      `  // ${r.model.name}.${r.field.name}`,
      `  const rows${i} = tx.select(${select}).from(${tb}).where(inArray(${tb}.${r.key}, [kept.id, ...others.map((o) => o.id)])).all();`,
    ];
    if (r.unique)
      lines.push(
        `  // A unique reference more than one of them holds: all but one have to let it go first.`,
        `  if (new Set(rows${i}.filter((row) => !(${gone})).map((row) => row.ref)).size > 1) throw new Conflict(w.mergeBothHave(${rn.ui}.label));`,
      );
    if (r.pairs.length)
      lines.push(
        `  // The pairs the kept record has: one of the others' that is the same goes, not moves.`,
        `  const pairs${i} = new Set(rows${i}.filter((row) => row.ref === kept.id && !(${gone})).map((row) => JSON.stringify([${r.pairs
          .flat()
          .map((k) => `row.${k}`)
          .join(", ")}])));`,
      );
    lines.push(`  for (const row of rows${i}.filter((row) => row.ref !== kept.id)) {`);
    if (self)
      lines.push(
        `    // A reference between the picked records is cleared, never one to itself; one on a record`,
        `    // that stays is a change to it, which needs write on it.`,
        `    if (row.id === kept.id || others.some((o) => o.id === row.id)) {`,
        `      if (row.id !== kept.id && !goes.has(row.id) && !allows(${rn.access}.write, viewer${signedIn ? ", row.owner" : ""})) throw new Conflict(w.mergeMayNotChange(${rn.ui}.pluralLabel));`,
        `      plan.cleared.push({ model: ${m}, key: ${ref}, id: row.id, from: row.ref as number });`,
        "      continue;",
        "    }",
      );
    lines.push(
      `    if (!allows(${rn.access}.write, viewer${signedIn ? ", row.owner" : ""})) throw new Conflict(w.mergeMayNotChange(${rn.ui}.pluralLabel));`,
    );
    if (r.pairs.length)
      lines.push(
        `    const pair = JSON.stringify([${r.pairs
          .flat()
          .map((k) => `row.${k}`)
          .join(", ")}]);`,
        `    if (!(${gone}) && pairs${i}.has(pair)) {`,
        `      // It goes to the trash with its record: one who may delete it.`,
        `      if (!allows(${rn.access}.delete, viewer${signedIn ? ", row.owner" : ""})) throw new Conflict(w.mergeMayNotChange(${rn.ui}.pluralLabel));`,
        `      plan.trashed.push({ model: ${m}, id: row.id, from: row.ref as number });`,
        "      continue;",
        "    }",
        `    if (!(${gone})) pairs${i}.add(pair);`,
      );
    lines.push(
      `    plan.moved.push({ model: ${m}, key: ${ref}, id: row.id, from: row.ref as number });`,
      "  }",
    );
    return lines.join("\n");
  };
  // Writing the plan: each model's table by name, as the plan lists them.
  const tables = [...new Map(referrers.map((r) => [r.model.name, r.model])).values()];
  const tableOf = `const TABLES = { ${tables.map((m) => `${JSON.stringify(m.name)}: ${names(m, t).table}`).join(", ")} } as const;`;
  const trashes = tables.filter((m) => m.trash).map((m) => m.name);
  // Their words are their models' own (words-once.md): read from each model's ui.
  const counted = `[${others.map((m) => `{ model: ${JSON.stringify(m.name)}, label: ${names(m, t).ui}.label, plural: ${names(m, t).ui}.pluralLabel }`).join(", ")}]`;
  const readers = others.map((m) => names(m, t));
  const numbered = sequenceEntries(model, auth, n.table, "personOf(viewer)")
    .map((e) => `, ${e}`)
    .join("");
  const combine = into === "new";
  const plain = !combine && referrers.length > 0;
  return `${HEADER}import { ${combine ? "" : "and, "}eq, inArray${numbered ? ", max" : ""} } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { AccessDenied, allows, check, Conflict, ${signedIn ? "personOf, " : ""}type Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";
import { refusal } from "#/kit/log.server";
${numbered ? 'import { nextInSequence } from "#/kit/sequence.server";\n' : ""}import { w } from "#/kit/words";
${[n, ...(combine ? [] : readers)].map((x) => `import { ${x.access}, ${x.data} } from "${x.module}.server";`).join("\n")}
${[...new Set([model, ...(combine ? [] : tables)])].map((m) => `import { ${names(m, t).ui} } from "${names(m, t).module}";`).join("\n")}
import { ${a.access} } from "./${kebab(action.name)}";

${combine ? "" : tables.length ? `${tableOf}\n` : "const TABLES = {} as const;\n"}/**
 * What becomes of each field (docs/design/intents.md §3): keep (the kept record's, the first
 * other's that is not empty when it is), other (the first other's that is not empty), ask (the
 * person picks where the records differ), add (the sum), append (the texts, a blank line between).
 */
const RULES: Record<string, { rule: "keep" | "other" | "ask" | "add" | "append"; unique: boolean; kind: "number" | "text" | "other" }> = ${literal(rules)};
/** A field's name as Ask and the sample users say it, by its stored key where they differ (accountManager). */
const KEYS: Record<string, string> = ${literal(
    Object.fromEntries(
      mergedFields(model)
        .filter((f) => f.name !== dataKey(f))
        .map((f) => [f.name, dataKey(f)]),
    ),
  )};
/** A reference the person decides, shown by its title: the row's field and the title's key. */
const REFS: Record<string, [string, string]> = ${literal(refs)};
${combine ? "" : `/** The models whose records move, as the form names them. */\nconst COUNTED = ${counted};\n`}
/** The database or a transaction in it: what the plan reads with. */
type Tx = Pick<typeof db, "select">;
type Raw = typeof ${n.table}.$inferSelect;

/** No value: nothing, or an empty text (no and zero are values). */
const empty = (value: unknown) => value === null || value === undefined || value === "";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What the person picked for a field asked: a record's value by its id, the sum or the texts joined. */
export type Choice = number | "sum" | "join";

/** The distinct values a field has among the records, in their order, empty ones left out. */
function valuesAmong(records: Raw[], key: string): unknown[] {
  const out: unknown[] = [];
  for (const r of records) {
    const v = r[key as keyof Raw];
    if (!empty(v) && !out.some((o) => same(o, v))) out.push(v);
  }
  return out;
}

/**
 * The fields the merge decides: all, but a unique one only when its value is free to take (the
 * others all go, or a combine removes them); while it stays with a record, it is that record's.
 */
function decided(free: boolean): string[] {
  return Object.keys(RULES).filter((key) => free || !RULES[key]?.unique);
}

/** The fields the person decides: asked by the spec, and different among the records (an empty one is not). */
function asked(records: Raw[], free: boolean): string[] {
  return decided(free).filter((key) => RULES[key]?.rule === "ask" && valuesAmong(records, key).length > 1);
}

/** The values the first record (the kept one) ends with: each field by its rule, or as the person chose. */
function valuesOf(records: Raw[], chosen: Record<string, Choice>, free: boolean): Record<string, unknown> {
  const [first, ...rest] = records as [Raw, ...Raw[]];
  const values: Record<string, unknown> = {};
  for (const key of decided(free)) {
    const { rule, kind } = RULES[key] as (typeof RULES)[string];
    const found = valuesAmong(records, key);
    const own = first[key as keyof Raw];
    const restFirst = valuesAmong(rest, key)[0];
    const sum = () => found.reduce<number>((total, v) => total + Number(v), 0);
    const joined = () => found.map(String).join("\\n\\n");
    let value: unknown;
    if (found.length <= 1) value = found[0] ?? own;
    else if (rule === "keep") value = empty(own) ? restFirst : own;
    else if (rule === "other") value = restFirst ?? own;
    else if (rule === "add" && kind === "number") value = sum();
    else if (rule === "append" && kind === "text") value = joined();
    else {
      const pick = chosen[key];
      value =
        pick === "sum" && kind === "number"
          ? sum()
          : pick === "join" && kind === "text"
            ? joined()
            : (records.find((r) => r.id === pick) ?? first)[key as keyof Raw];
    }
    values[key] = value;
  }
  return values;
}

/** The choices as given: by stored key (a field's name works too), keep as the first record, other as the next. */
function choicesOf(records: Raw[], given: Record<string, number | string>): Record<string, Choice> {
  const out: Record<string, Choice> = {};
  for (const [key, c] of Object.entries(given)) {
    const choice: Choice | undefined =
      c === "keep" || c === "kept" ? records[0]?.id : c === "other" ? records[1]?.id : c === "sum" || c === "join" ? c : typeof c === "number" && records.some((r) => r.id === c) ? c : undefined;
    if (choice !== undefined) out[KEYS[key] ?? key] = choice;
  }
  return out;
}

/** The records picked, as the viewer may read them, in their order; each once, at least two. */
async function picked(viewer: Viewer | null, ids: number[]) {
  check(${a.access}, viewer);
  const unique = [...new Set(ids)];
  if (unique.length < 2) throw new Conflict(w.mergeSame);
  const rows = [];
  for (const id of unique) {
    const row = await ${n.data}.get(viewer, id);
    if (!row) throw new AccessDenied(viewer !== null);
    rows.push(row);
  }
  return rows;
}

/** The stored rows of the records picked, in their order. */
function rawOf(tx: Tx, ids: number[]): Raw[] {
  return ids.map((id) => tx.select().from(${n.table}).where(eq(${n.table}.id, id)).get() as Raw);
}

/** The words of a reference's value for each record: its title. */
function refsOf(rows: Record<string, unknown>[]): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(REFS).map(([key, [field, titleKey]]) => [
      key,
      rows.map((row) => String((row[field] as Record<string, unknown> | null)?.[titleKey] ?? "")),
    ]),
  );
}
${
  combine
    ? combineCode(action, model, n, referrers, numbered, title, signedIn, owner, t)
    : chosenCode(
        action,
        model,
        n,
        referrers,
        step,
        readers,
        others,
        trashes,
        title,
        signedIn,
        owner,
        plain,
      )
}`;
}

/** Into the chosen record: who may, the plan, the preview and the run. */
function chosenCode(
  action: StandardActionIR,
  model: ModelIR,
  n: ReturnType<typeof names>,
  referrers: Referrer[],
  step: (r: Referrer, i: number) => string,
  readers: ReturnType<typeof names>[],
  others: ModelIR[],
  trashes: string[],
  title: string,
  signedIn: boolean,
  owner: (m: ModelIR, row: string) => string,
  plain: boolean,
): string {
  const a = actionNames(action);
  return `
/** Which stay and which go: write on the kept one; each other goes to the trash where the viewer may delete it. */
function rights(viewer: Viewer | null, rows: { id: number${signedIn ? `; ${ownerKey(model)}: string | null` : ""} }[]) {
  const [kept, ...others] = rows as [(typeof rows)[number], ...typeof rows];
  if (!allows(${n.access}.write, viewer${owner(model, "kept")})) throw new AccessDenied(true);
  // A record the viewer may not delete stays, emptied of what moved.
  return new Set(others.filter((other) => allows(${n.access}.delete, viewer${owner(model, "other")})).map((o) => o.id));
}

/** What the merge does, worked out on the records as they are: refused here when it cannot be done. */
function planOf(${plain ? "tx" : "_tx"}: Tx, ${plain ? "viewer" : "_viewer"}: Viewer | null, ${plain ? "kept" : "_kept"}: Raw, ${plain ? "others" : "_others"}: Raw[], ${plain && referrers.some((r) => r.model.name === model.name) ? "goes" : "_goes"}: Set<number>) {
  const plan = {
    moved: [] as { model: keyof typeof TABLES; key: string; id: number; from: number }[],
    trashed: [] as { model: keyof typeof TABLES; id: number; from: number }[],
    cleared: [] as { model: keyof typeof TABLES; key: string; id: number; from: number }[],
  };
${referrers.map(step).join("\n")}
  return plan;
}

/**
 * What merging them would do, as the viewer may see it: which stays, the values it takes, how
 * many records of each kind move, and where each other goes; or why it cannot be done.
 */
export async function ${a.preview}(viewer: Viewer | null, ids: number[]) {
  const rows = await picked(viewer, ids);
  const goes = rights(viewer, rows);
  const raw = rawOf(db, rows.map((r) => r.id));
  const [kept, ...others] = raw as [Raw, ...Raw[]];
  const free = others.every((o) => goes.has(o.id));
  const titles = rows.map((r) => String(r.${title} ?? r.id));
  const fate = (others.every((o) => goes.has(o.id)) ? ${model.trash ? '"trash"' : '"gone"'} : others.some((o) => goes.has(o.id)) ? "some" : "stays") as "trash" | "gone" | "stays" | "some";
  try {
    const plan = planOf(db, viewer, kept, others, goes);
    const moving = (model: string) => plan.moved.filter((m) => m.model === model).map((m) => m.id);
    // Only what the viewer may read is counted.
    const readable = {${readers.map((x, i) => `\n      ${JSON.stringify(others[i]?.name)}: (ids: number[]) => ids.length ? db.select({ id: ${x.table}.id }).from(${x.table}).where(and(inArray(${x.table}.id, ids), ${x.data}.readable(viewer))).all().length : 0,`).join("")}
    } as Record<string, (ids: number[]) => number>;
    const values = valuesOf(raw, {}, free);
    return {
      records: raw,
      titles,
      asked: asked(raw, free).map((key) => ({ key, kind: RULES[key]?.kind ?? "other" })),
      refs: refsOf(rows as Record<string, unknown>[]),
      // The fields that take another record's value by the spec's rule.
      taken: Object.keys(values).filter((key) => !asked(raw, free).includes(key) && !same(values[key], kept[key as keyof Raw])),
      moves: COUNTED.map((c) => ({ ...c, count: readable[c.model]?.(moving(c.model)) ?? 0 })).filter((c) => c.count > 0),
      goes: fate,
      emptied: [] as string[],
      removable: false,
      refused: null as string | null,
    };
  } catch (error) {
    if (!(error instanceof Conflict)) throw error;
    return { records: raw, titles, asked: [], refs: {}, taken: [], moves: [], goes: fate, emptied: [] as string[], removable: false, refused: error.message };
  }
}

/**
 * Merges the records into the first as the viewer: every reference to the others moves to it,
 * which takes the values its fields' rules and the person's choices give, and the others go to the
 * trash. Moved records are moved, not changed: no rules of a change, no "changed" events, nothing told.
 */
export async function ${a.run}(viewer: Viewer | null, ids: number[], given: Record<string, number | string> = {}) {
  const rows = await picked(viewer, ids);
  const goes = rights(viewer, rows);
  const when = new Date();
  try {
    db.transaction((tx) => {
      const raw = rawOf(tx, rows.map((r) => r.id));
      const [kept, ...others] = raw as [Raw, ...Raw[]];
      const free = others.every((o) => goes.has(o.id));
      const plan = planOf(tx, viewer, kept, others, goes);
      for (const m of plan.moved) {
        const table = TABLES[m.model];
        tx.update(table).set({ [m.key]: kept.id }).where(eq(table.id, m.id)).run();
      }
      for (const c of plan.cleared) {
        const table = TABLES[c.model];
        tx.update(table).set({ [c.key]: null }).where(eq(table.id, c.id)).run();
      }
      for (const d of plan.trashed) {
        const table = TABLES[d.model];
        if ((${literal(trashes)} as string[]).includes(d.model))
          tx.update(table).set({ deletedAt: when${signedIn ? ", deletedBy: personOf(viewer)" : ""} } as never).where(eq(table.id, d.id)).run();
        else tx.delete(table).where(eq(table.id, d.id)).run();
      }
      // Each field the person decides must be decided: a program or Ask asks for the missing one.
      const chosen = choicesOf(raw, given);
      const missing = asked(raw, free).find((key) => chosen[key] === undefined);
      if (missing !== undefined) throw new Conflict(w.mergeChoiceMissing(${n.ui}.fields.find((f) => f.name === missing || f.relation?.key === missing)?.label ?? missing));
      const all = valuesOf(raw, chosen, free);
      const values = Object.fromEntries(Object.entries(all).filter(([key, value]) => !same(value, kept[key as keyof Raw])));
      const changed = Object.keys(values);
      for (const other of others) {
        ${
          model.trash
            ? `// It goes to the trash, its unique values released as a trashed record's are.
        if (goes.has(other.id)) tx.update(${n.table}).set({ deletedAt: when${signedIn ? ", deletedBy: personOf(viewer)" : ""} }).where(eq(${n.table}.id, other.id)).run();`
            : `// No trash for ${n.pluralLabel.toLowerCase()}: it is deleted for good.
        if (goes.has(other.id)) tx.delete(${n.table}).where(eq(${n.table}.id, other.id)).run();`
        }
        // What moved from it, so its Restore can put it back: tied to this trashing.
        const mine = <T extends { from: number }>(list: T[]) => list.filter((x) => x.from === other.id || ("id" in x && (x as { id: number }).id === other.id));
        audit(tx, viewer, { action: goes.has(other.id) ? "merged" : "merged, kept", model: ${JSON.stringify(model.name)}, record: other.id, title: other.${title}, details: { into: kept.id, by: ${JSON.stringify(action.name)}, trashedAt: goes.has(other.id) ? when.getTime() : null, moved: mine(plan.moved), trashed: mine(plan.trashed), cleared: mine(plan.cleared), before: Object.fromEntries(changed.map((key) => [key, kept[key as keyof Raw]])), after: values } });
      }
      // After the others have gone, so a unique value one gives the kept record is free.
      if (changed.length) tx.update(${n.table}).set(values as Partial<Raw>).where(eq(${n.table}.id, kept.id)).run();
      audit(tx, viewer, { action: ${JSON.stringify(action.name)}, model: ${JSON.stringify(model.name)}, record: kept.id, fields: changed, details: { merged: others.map((o) => o.id) } });
    });
  } catch (error) {
    throw refusal(error);
  }
  return { kept: rows[0]?.id as number, others: rows.slice(1).map((r) => r.id), stays: rows.slice(1).map((r) => r.id).filter((id) => !goes.has(id)) };
}
`;
}

/** Into a new record (a combine): who may, the preview and the run. */
function combineCode(
  action: StandardActionIR,
  model: ModelIR,
  n: ReturnType<typeof names>,
  referrers: Referrer[],
  numbered: string,
  title: string,
  signedIn: boolean,
  owner: (m: ModelIR, row: string) => string,
  t: Texts,
): string {
  const a = actionNames(action);
  const refers = referrers.map((r) => {
    const tb = names(r.model, t).table;
    return `tx.select({ id: ${tb}.id }).from(${tb}).where(inArray(${tb}.${r.key}, ids)).get()`;
  });
  return `
/**
 * Whether the picked could be removed for the new one: the same apart from what is summed or
 * joined, nothing refers to them, and the viewer may delete each.
 */
function removable(${refers.length ? "tx" : "_tx"}: Tx, viewer: Viewer | null, records: Raw[]): boolean {
${refers.length ? "  const ids = records.map((r) => r.id);\n" : ""}  const sameApart = Object.keys(RULES).every((key) => RULES[key]?.rule === "add" || RULES[key]?.rule === "append" || new Set(records.map((r) => JSON.stringify(r[key as keyof Raw] ?? null))).size === 1);
  const referred = ${refers.length ? refers.join(" || ") : "false"};
  return sameApart && !referred && records.every((record) => allows(${n.access}.delete, viewer${owner(model, "record")}));
}

/** What combining them would do, as the viewer may see it: the new record's values, what is left empty, and whether they may go. */
export async function ${a.preview}(viewer: Viewer | null, ids: number[]) {
  const rows = await picked(viewer, ids);
  const raw = rawOf(db, rows.map((r) => r.id));
  const titles = rows.map((r) => String(r.${title} ?? r.id));
  const values = valuesOf(raw, {}, false);
  return {
    records: raw,
    titles,
    asked: asked(raw, false).map((key) => ({ key, kind: RULES[key]?.kind ?? "other" })),
    refs: refsOf(rows as Record<string, unknown>[]),
    taken: Object.keys(values).filter((key) => !asked(raw, false).includes(key) && !same(values[key], raw[0]?.[key as keyof Raw])),
    moves: [] as { model: string; label: string; plural: string; count: number }[],
    goes: "stays" as "trash" | "gone" | "stays" | "some",
    // A unique value stays with the record that has it: the new one's is left empty.
    emptied: Object.keys(RULES).filter((key) => RULES[key]?.unique && valuesAmong(raw, key).length > 0),
    removable: removable(db, viewer, raw),
    refused: null as string | null,
  };
}

/**
 * Combines the records into a new one as the viewer: its values by the fields' rules and the
 * person's choices, the first picked where the kept one would be; sequences and the app's fields
 * new, a unique value left empty unless the picked are removed (to the trash), which frees it.
 * Returns the new record's id.
 */
export async function ${a.run}(viewer: Viewer | null, ids: number[], given: Record<string, number | string> = {}, remove = false): Promise<number> {
  const rows = await picked(viewer, ids);
  const when = new Date();
  let made: Raw;
  try {
    made = db.transaction((tx) => {
      const raw = rawOf(tx, rows.map((r) => r.id));
      if (remove && !removable(tx, viewer, raw)) throw new Conflict(w.combineNotRemovable);
      const chosen = choicesOf(raw, given);
      const missing = asked(raw, remove).find((key) => chosen[key] === undefined);
      if (missing !== undefined) throw new Conflict(w.mergeChoiceMissing(${n.ui}.fields.find((f) => f.name === missing || f.relation?.key === missing)?.label ?? missing));
      if (remove)
        for (const record of raw) {
          ${
            model.trash
              ? `tx.update(${n.table}).set({ deletedAt: when${signedIn ? ", deletedBy: personOf(viewer)" : ""} }).where(eq(${n.table}.id, record.id)).run();`
              : `tx.delete(${n.table}).where(eq(${n.table}.id, record.id)).run();`
          }
          audit(tx, viewer, { action: ${model.trash ? '"trashed"' : '"deleted"'}, model: ${JSON.stringify(model.name)}, record: record.id, title: record.${title}, details: { by: ${JSON.stringify(action.name)} } });
        }
      // Made as any new record is (A 153): its rules, its numbers counting up; theirs who ran it.
      const values = ${n.data}.checkCreate(tx, viewer, valuesOf(raw, chosen, remove) as never);
      const created = tx.insert(${n.table}).values({ ...values${signedIn ? `, ${ownerKey(model)}: personOf(viewer)` : ""}${numbered} } as never).returning().get() as Raw;
      audit(tx, viewer, { action: ${JSON.stringify(action.name)}, model: ${JSON.stringify(model.name)}, record: created.id, details: { from: raw.map((r) => r.id), removed: remove } });
      return created;
    });
  } catch (error) {
    throw refusal(error);
  }
  return made.id;
}
`;
}

/**
 * What a merged record's Restore does besides taking it out of the trash (intents.md §3, Undo):
 * what is still as the merge left it goes back, what was changed since stays and is counted.
 * Empty for a model no merge is on.
 */
export function unmergeCode(ir: SpecIR, model: ModelIR, auth: AuthIR, t: Texts): string {
  if (!model.trash || !mergesOf(ir, model.name).length) return "";
  const n = names(model, t);
  const signedIn = hasSignIn(auth);
  const tables = [
    ...new Map(referrersOf(ir, model.name).map((r) => [r.model.name, r.model])).values(),
  ];
  return `
/** The tables a merge of ${n.pluralLabel.toLowerCase()} moves records in, by model. */
const MERGED_TABLES = { ${tables.map((m) => `${JSON.stringify(m.name)}: ${names(m, t).table}`).join(", ")} } as const;

/** Who may change a record of each, read when asked (the modules import one another). */
const mergedWrite = (model: keyof typeof MERGED_TABLES): ModelAccess["write"] =>
  ({ ${tables.map((m) => `${JSON.stringify(m.name)}: ${names(m, t).access}.write`).join(", ")} })[model];
/** The owner's column of each, to check the rule on a record. */
const MERGED_OWNERS: Record<keyof typeof MERGED_TABLES, string | null> = { ${tables.map((m) => `${JSON.stringify(m.name)}: ${signedIn ? JSON.stringify(ownerKey(m)) : "null"}`).join(", ")} };

/**
 * Puts back what merging this ${n.label.toLowerCase()} away moved, as far as it is still as the merge left it;
 * returns how many things were changed since and stay as they are.
 */
function unmerge(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], viewer: Viewer | null, id: number, deletedAt: Date | null): number {
  const line = tx.select({ details: schema.auditLog.details }).from(schema.auditLog).where(and(eq(schema.auditLog.model, ${JSON.stringify(model.name)}), eq(schema.auditLog.recordId, id), eq(schema.auditLog.action, "merged"))).orderBy(desc(schema.auditLog.id)).get();
  const merged = line?.details as { into: number; moved: { model: keyof typeof MERGED_TABLES; key: string; id: number }[]; trashed: { model: keyof typeof MERGED_TABLES; id: number }[]; cleared: { model: keyof typeof MERGED_TABLES; key: string; id: number }[]; before: Record<string, unknown>; after: Record<string, unknown>; trashedAt: number | null } | undefined;
  // Only the merge that put it in the trash this time.
  if (!merged || merged.trashedAt !== deletedAt?.getTime()) return 0;
  let stayed = 0;
  // A record the viewer may not change stays where the merge put it, and is counted.
  const mayChange = (model: keyof typeof MERGED_TABLES, rowId: number) => {
    const owner = MERGED_OWNERS[model];
    const table = MERGED_TABLES[model] as unknown as typeof ${n.table};
    const row = owner ? (tx.select().from(table).where(eq(table.id, rowId)).get() as Record<string, unknown> | undefined) : undefined;
    return allows(mergedWrite(model), viewer, owner ? ((row?.[owner] as string | null | undefined) ?? null) : undefined);
  };
  for (const m of merged.moved) {
    if (!mayChange(m.model, m.id)) {
      stayed++;
      continue;
    }
    const table = MERGED_TABLES[m.model] as unknown as typeof ${n.table};
    const column = table[m.key as keyof typeof table] as never;
    stayed += 1 - tx.update(table).set({ [m.key]: id } as never).where(and(eq(table.id, m.id), eq(column, merged.into))).run().changes;
  }
  for (const c of merged.cleared) {
    if (!mayChange(c.model, c.id)) {
      stayed++;
      continue;
    }
    const table = MERGED_TABLES[c.model] as unknown as typeof ${n.table};
    const column = table[c.key as keyof typeof table] as never;
    stayed += 1 - tx.update(table).set({ [c.key]: c.id === id ? merged.into : id } as never).where(and(eq(table.id, c.id), isNull(column))).run().changes;
  }
  for (const d of merged.trashed) {
    // Those of a model without a trash were deleted for good.
    if (!(${literal(tables.filter((m) => m.trash).map((m) => m.name))} as string[]).includes(d.model)) continue;
    if (!mayChange(d.model, d.id)) {
      stayed++;
      continue;
    }
    const table = MERGED_TABLES[d.model] as unknown as typeof ${n.table};
    tx.update(table).set({ deletedAt: null, deletedBy: null } as never).where(eq(table.id, d.id)).run();
  }
  // A value the merge gave the kept one, still as it left it, goes back to what it was.
  const kept = tx.select().from(${n.table}).where(eq(${n.table}.id, merged.into)).get();
  // Only by one who may change the kept record.
  if (kept && !allows(${n.access}.write, viewer${signedIn ? `, kept.${ownerKey(model)}` : ""})) stayed += Object.keys(merged.after ?? {}).length;
  else if (kept) {
    // Dates were written as text in the line: compared as the line has them.
    const now = JSON.parse(JSON.stringify(kept)) as Record<string, unknown>;
    // Forgotten in the log since: the values are not there to put back.
    const keys = Object.keys(merged.after ?? {});
    const untouched = keys.filter((key) => JSON.stringify(now[key]) === JSON.stringify(merged.after[key]));
    stayed += keys.length - untouched.length;
    if (untouched.length) tx.update(${n.table}).set(Object.fromEntries(untouched.map((key) => [key, revived(kept[key as keyof typeof kept], merged.before[key])]))).where(eq(${n.table}.id, merged.into)).run();
  }
  return stayed;
}

/** The records the trashed ones were merged into, by title (the trash list's "merged into"). */
function mergedIntoTitles(viewer: Viewer | null, rows: { id: number; deletedAt?: Date | null }[]): Map<number, string> {
  const titles = new Map<number, string>();
  if (!rows.length) return titles;
  const lines = db.select({ recordId: schema.auditLog.recordId, details: schema.auditLog.details }).from(schema.auditLog).where(and(eq(schema.auditLog.model, ${JSON.stringify(model.name)}), eq(schema.auditLog.action, "merged"), inArray(schema.auditLog.recordId, rows.map((r) => r.id)))).orderBy(schema.auditLog.id).all();
  for (const row of rows) {
    // The merge that put it in the trash this time.
    const line = lines.filter((l) => l.recordId === row.id && (l.details as { trashedAt?: number } | null)?.trashedAt === row.deletedAt?.getTime()).pop();
    const into = (line?.details as { into?: number } | undefined)?.into;
    // Named only to one who may read it.
    const kept = into === undefined ? undefined : db.select().from(${n.table}).where(and(eq(${n.table}.id, into), ${n.data}.readable(viewer))).get();
    if (kept) titles.set(row.id, String(kept.${titleField(model)} ?? kept.id));
  }
  return titles;
}

/** A value from the line as its column takes it: a date and time back from its text. */
function revived(like: unknown, value: unknown): unknown {
  return like instanceof Date && typeof value === "string" ? new Date(value) : value;
}
`;
}

/** What the merged record's Restore imports: the other models' rules, to check a move back. */
export function unmergeImports(ir: SpecIR, model: ModelIR, t: Texts): string {
  return [...new Map(referrersOf(ir, model.name).map((r) => [r.model.name, r.model])).values()]
    .filter((m) => m.name !== model.name)
    .map((m) => `import { ${names(m, t).access} } from "./${kebab(m.name)}.server";\n`)
    .join("");
}

/** The user model is never merged; kept here so the check reads where the code is. */
export const MERGEABLE = (model: string) => model !== USER_MODEL;
