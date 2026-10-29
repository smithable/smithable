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
  return `${HEADER}import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Rule } from "#/kit/access";
import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";
import { ${a.preview}, ${a.run} } from "./${kebab(action.name)}.server";

/** Who may run the "${action.name}" merge: its grant, with write on ${n.pluralLabel.toLowerCase()}. */
export const ${a.access}: Rule = ${literal(actionAccess(action, auth, ir.models))};

/** Which of the two stays: the person's choice, the oldest or the newest. */
export const ${a.keep} = ${JSON.stringify(action.merge?.keep)};

/** The two records: the one the person keeps (or the first picked) and the other. */
const pair = z.object({ keep: z.number().int(), other: z.number().int() });
/** And for each field asked, what the person picked. */
/** keep (the API's and Ask's word for the kept record's value) is kept. */
const choices = z.record(z.string(), z.enum(["kept", "keep", "other", "sum", "join"])).default({});

/** What merging the two would do, as the viewer may see it: the form's sentence. */
export const ${a.previewFn} = createServerFn({ method: "POST" })
  .validator(pair)
  .handler(async ({ data }) => ${a.preview}(await currentViewer(), data.keep, data.other));

export const ${action.name} = createServerFn({ method: "POST" })
  .validator(pair.extend({ choices }))
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    writeAllowed(viewer, getRequestHeaders());
    return ${a.run}(viewer, data.keep, data.other, data.choices);
  });
`;
}

/**
 * The merge on the server: the two records as the viewer may read them, which stays, what moves,
 * what is filled, all in one transaction; the other goes to the trash with a line that says what
 * moved, which its Restore reads.
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
  const merge = action.merge ?? { keep: "chosen", fields: {} };
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
  // The referring records, each reference on its own: those of the other record, the clash
  // rules, and the write each needs.
  const step = (r: Referrer, i: number) => {
    const rn = names(r.model, t);
    const tb = rn.table;
    const live = r.model.trash ? `, isNull(${tb}.deletedAt)` : "";
    const self = r.model.name === model.name;
    const ref = JSON.stringify(r.key);
    const lines = [
      `  // ${r.model.name}.${r.field.name}`,
      `  const rows${i} = tx.select({ id: ${tb}.id${signedIn ? `, owner: ${tb}.${ownerKey(r.model)}` : ""}${r.pairs
        .flat()
        .map((k) => `, ${k}: ${tb}.${k}`)
        .join(
          "",
        )} }).from(${tb}).where(eq(${tb}.${r.key}, other.id)).all()${self ? ".filter((row) => row.id !== other.id)" : ""};`,
    ];
    if (self)
      lines.push(
        `  // A reference between the two is cleared, never one to itself.`,
        `  for (const row of rows${i}.filter((row) => row.id === kept.id)) plan.cleared.push({ model: ${JSON.stringify(r.model.name)}, key: ${ref}, id: row.id });`,
        `  if (other.${r.key} === kept.id) plan.cleared.push({ model: ${JSON.stringify(r.model.name)}, key: ${ref}, id: other.id });`,
      );
    const moving = self ? `rows${i}.filter((row) => row.id !== kept.id)` : `rows${i}`;
    lines.push(
      `  for (const row of ${moving}) {`,
      `    if (!allows(${rn.access}.write, viewer${signedIn ? ", row.owner" : ""})) throw new Conflict(w.mergeMayNotChange(${rn.ui}.pluralLabel));`,
    );
    if (r.unique)
      lines.push(
        `    // A unique reference both have: one of them has to go first.`,
        `    if (tx.select({ id: ${tb}.id }).from(${tb}).where(and(eq(${tb}.${r.key}, kept.id)${live})).get()) throw new Conflict(w.mergeBothHave(${rn.ui}.label));`,
      );
    if (r.pairs.length)
      lines.push(
        `    // One the kept record already has, the same pair: it goes, not moves.`,
        `    if (${r.pairs.map((keys) => `tx.select({ id: ${tb}.id }).from(${tb}).where(and(eq(${tb}.${r.key}, kept.id), ${keys.map((k) => `row.${k} == null ? isNull(${tb}.${k}) : eq(${tb}.${k}, row.${k})`).join(", ")}${live})).get()`).join(" || ")}) {`,
        `      plan.trashed.push({ model: ${JSON.stringify(r.model.name)}, id: row.id });`,
        "      continue;",
        "    }",
      );
    lines.push(
      `    plan.moved.push({ model: ${JSON.stringify(r.model.name)}, key: ${ref}, id: row.id });`,
      "  }",
    );
    return lines.join("\n");
  };
  // Writing the plan: each model's table by name, as the plan lists them.
  const tables = [...new Map(referrers.map((r) => [r.model.name, r.model])).values()];
  const tableOf = `const TABLES = { ${tables.map((m) => `${JSON.stringify(m.name)}: ${names(m, t).table}`).join(", ")} } as const;`;
  const trashes = tables.filter((m) => m.trash).map((m) => JSON.stringify(m.name));
  // Their words are their models' own (words-once.md): read from each model's ui.
  const counted = `[${others.map((m) => `{ model: ${JSON.stringify(m.name)}, label: ${names(m, t).ui}.label, plural: ${names(m, t).ui}.pluralLabel }`).join(", ")}]`;
  const readers = others.map((m) => names(m, t));
  const usesKept = referrers.some((r) => r.model.name === model.name || r.unique || r.pairs.length);
  const live = referrers.some((r) => r.model.trash && (r.unique || r.pairs.length));
  const pairNull = referrers.some((r) => r.pairs.length);
  return `${HEADER}import { and, eq, inArray${live || pairNull ? ", isNull" : ""} } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { AccessDenied, allows, check, Conflict, ${signedIn ? "personOf, " : ""}type Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";
import { refusal } from "#/kit/log.server";
import { w } from "#/kit/words";
${[n, ...readers].map((x) => `import { ${x.access}, ${x.data} } from "${x.module}.server";`).join("\n")}
${[...new Set([model, ...tables])].map((m) => `import { ${names(m, t).ui} } from "${names(m, t).module}";`).join("\n")}
import { ${a.access}, ${a.keep} } from "./${kebab(action.name)}";

${tableOf}
/**
 * What becomes of each field (docs/design/intents.md §3): keep (the kept record's), other (the
 * other's), ask (the person picks where the two differ), add (the sum), append (both texts); an
 * empty side always takes the other's value.
 */
const RULES: Record<string, { rule: "keep" | "other" | "ask" | "add" | "append"; unique: boolean; kind: "number" | "text" | "other" }> = ${literal(rules)};
/** A reference the person decides, shown by its title: the row's field and the title's key. */
const REFS: Record<string, [string, string]> = ${literal(refs)};
/** The models whose records move, as the form names them. */
const COUNTED = ${counted};

/** The database or a transaction in it: what the plan reads with. */
type Tx = Pick<typeof db, "select">;
type Raw = typeof ${n.table}.$inferSelect;

/** No value: nothing, or an empty text (no and zero are values). */
const empty = (value: unknown) => value === null || value === undefined || value === "";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What the person may pick for a field asked: either record's value, the sum or both texts. */
export type Choice = "kept" | "other" | "sum" | "join";

/**
 * The fields the merge decides: all, but a unique one only when the other goes (while it stays,
 * its unique values are its own and the kept record keeps its own).
 */
function decided(goes: boolean): string[] {
  return Object.keys(RULES).filter((key) => goes || !RULES[key]?.unique);
}

/** The fields the person decides: asked by the spec, and different on the two (an empty one is not). */
function asked(kept: Raw, other: Raw, goes: boolean): string[] {
  return decided(goes).filter((key) => {
    const a = kept[key as keyof Raw];
    const b = other[key as keyof Raw];
    return RULES[key]?.rule === "ask" && !empty(a) && !empty(b) && !same(a, b);
  });
}

/** The kept record's new values: each field by its rule, or as the person chose; only what changes. */
function valuesOf(kept: Raw, other: Raw, chosen: Record<string, Choice>, goes: boolean): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const key of decided(goes)) {
    const { rule, kind } = RULES[key] as (typeof RULES)[string];
    const a = kept[key as keyof Raw];
    const b = other[key as keyof Raw];
    const pick: Choice = empty(a)
      ? "other"
      : empty(b)
        ? "kept"
        : rule === "ask"
          ? (chosen[key] ?? "kept")
          : rule === "other"
            ? "other"
            : rule === "add"
              ? "sum"
              : rule === "append"
                ? "join"
                : "kept";
    const value =
      pick === "other"
        ? b
        : pick === "sum" && kind === "number"
          ? Number(a) + Number(b)
          : pick === "join" && kind === "text"
            ? \`\${String(a)}\n\n\${String(b)}\`
            : a;
    if (!same(value, a)) values[key] = value;
  }
  return values;
}

/** The two, as the viewer may read them: which stays and which goes, with the rights each needs. */
async function pair(viewer: Viewer | null, first: number, second: number, strict = false) {
  check(${a.access}, viewer);
  if (first === second) throw new Conflict(w.mergeSame);
  const one = await ${n.data}.get(viewer, first);
  const two = await ${n.data}.get(viewer, second);
  if (!one || !two) throw new AccessDenied(viewer !== null);
  const firstStays = ${a.keep} === "chosen" ? true : ${a.keep} === "oldest" ? one.id < two.id : one.id > two.id;
  // Run (not previewed): with the oldest or the newest staying, the first named must be that one.
  if (strict && !firstStays) throw new Conflict(w.mergeKeepIs(String(two.${title} ?? two.id)));
  const [kept, other] = firstStays ? [one, two] : [two, one];
  // Write on the one that stays; the other goes to the trash only where the viewer may delete it,
  // else it stays, emptied of what moved.
  if (!allows(${n.access}.write, viewer${owner(model, "kept")})) throw new AccessDenied(true);
  return { kept, other, goes: allows(${n.access}.delete, viewer${owner(model, "other")}) };
}

/** What the merge does, worked out on the records as they are: refused here when it cannot be done. */
function planOf(${referrers.length ? "tx" : "_tx"}: Tx, ${referrers.length ? "viewer" : "_viewer"}: Viewer | null, ${usesKept ? "kept" : "_kept"}: Raw, ${referrers.length ? "other" : "_other"}: Raw) {
  const plan = {
    moved: [] as { model: keyof typeof TABLES; key: string; id: number }[],
    trashed: [] as { model: keyof typeof TABLES; id: number }[],
    cleared: [] as { model: keyof typeof TABLES; key: string; id: number }[],
  };
${referrers.map(step).join("\n")}
  return plan;
}

/** The two stored rows, by the ids the viewer may read. */
function rawOf(tx: Tx, keptId: number, otherId: number) {
  const row = (id: number) => tx.select().from(${n.table}).where(eq(${n.table}.id, id)).get() as Raw;
  return { kept: row(keptId), other: row(otherId) };
}

/**
 * What merging the two would do, as the viewer may see it: which stays, the values it takes from
 * the other, and how many records of each kind move; or why it cannot be done.
 */
export async function ${a.preview}(viewer: Viewer | null, first: number, second: number) {
  const { kept, other, goes } = await pair(viewer, first, second);
  const raw = rawOf(db, kept.id, other.id);
  try {
    const plan = planOf(db, viewer, raw.kept, raw.other);
    const ids = (model: string) => plan.moved.filter((m) => m.model === model).map((m) => m.id);
    // Only what the viewer may read is counted.
    const readable = {${readers.map((x, i) => `\n      ${JSON.stringify(others[i]?.name)}: (moving: number[]) => moving.length ? db.select({ id: ${x.table}.id }).from(${x.table}).where(and(inArray(${x.table}.id, moving), ${x.data}.readable(viewer))).all().length : 0,`).join("")}
    } as Record<string, (moving: number[]) => number>;
    return {
      kept: raw.kept,
      other: raw.other,
      keptTitle: String(kept.${title} ?? kept.id),
      otherTitle: String(other.${title} ?? other.id),
      // The fields the person decides, and those that take the other's value by the spec's rule.
      asked: asked(raw.kept, raw.other, goes).map((key) => ({ key, kind: RULES[key]?.kind ?? "other" })),
      refs: Object.fromEntries(
        Object.entries(REFS).map(([key, [field, titleKey]]) => {
          const title = (row: Record<string, unknown>) => String((row[field] as Record<string, unknown> | null)?.[titleKey] ?? "");
          return [key, [title(kept as Record<string, unknown>), title(other as Record<string, unknown>)]];
        }),
      ) as Record<string, [string, string]>,
      taken: Object.entries(valuesOf(raw.kept, raw.other, {}, goes))
        .filter(([key, value]) => !asked(raw.kept, raw.other, goes).includes(key) && same(value, raw.other[key as keyof Raw]))
        .map(([key]) => key),
      moves: COUNTED.map((c) => ({ ...c, count: readable[c.model]?.(ids(c.model)) ?? 0 })).filter((c) => c.count > 0),
      // Where the other goes: the trash, gone for good (no trash), or it stays (no right to delete).
      goes: (!goes ? "stays" : ${model.trash ? '"trash"' : '"gone"'}) as "trash" | "gone" | "stays",
      refused: null as string | null,
    };
  } catch (error) {
    if (!(error instanceof Conflict)) throw error;
    return { kept: raw.kept, other: raw.other, keptTitle: String(kept.${title} ?? kept.id), otherTitle: String(other.${title} ?? other.id), asked: [], refs: {}, taken: [], moves: [], goes: "stays" as "trash" | "gone" | "stays", refused: error.message };
  }
}

/**
 * Merges the two as the viewer: every reference to the other moves to the kept record, which keeps
 * the values its fields' rules and the person's choices give, and the other goes to the trash. Moved records are moved,
 * not changed: no rules of a change, no "changed" events, nothing told.
 */
export async function ${a.run}(viewer: Viewer | null, first: number, second: number, chosen: Record<string, Choice | "keep"> = {}) {
  const { kept, other, goes } = await pair(viewer, first, second, true);
  const when = new Date();
  try {
    db.transaction((tx) => {
      const raw = rawOf(tx, kept.id, other.id);
      const plan = planOf(tx, viewer, raw.kept, raw.other);
      for (const m of plan.moved) {
        const table = TABLES[m.model];
        tx.update(table).set({ [m.key]: raw.kept.id }).where(eq(table.id, m.id)).run();
      }
      for (const c of plan.cleared) {
        const table = TABLES[c.model];
        tx.update(table).set({ [c.key]: null }).where(eq(table.id, c.id)).run();
      }
      for (const d of plan.trashed) {
        const table = TABLES[d.model];
        if ((${literal(trashes.map((s) => JSON.parse(s)))} as string[]).includes(d.model))
          tx.update(table).set({ deletedAt: when${signedIn ? ", deletedBy: personOf(viewer)" : ""} } as never).where(eq(table.id, d.id)).run();
        else tx.delete(table).where(eq(table.id, d.id)).run();
      }
      // Each field the person decides must be decided: a program or Ask asks for the missing one.
      const picked = Object.fromEntries(Object.entries(chosen).map(([key, c]) => [key, c === "keep" ? "kept" : c])) as Record<string, Choice>;
      const missing = asked(raw.kept, raw.other, goes).find((key) => !(key in picked));
      if (missing !== undefined) throw new Conflict(w.mergeChoiceMissing(${n.ui}.fields.find((f) => f.name === missing || f.relation?.key === missing)?.label ?? missing));
      const values = valuesOf(raw.kept, raw.other, picked, goes);
      const changed = Object.keys(values);
      ${
        model.trash
          ? `// The other goes to the trash, its unique values released as a trashed record's are.
      if (goes) tx.update(${n.table}).set({ deletedAt: when${signedIn ? ", deletedBy: personOf(viewer)" : ""} }).where(eq(${n.table}.id, raw.other.id)).run();`
          : `// No trash for ${n.pluralLabel.toLowerCase()}: the other is deleted for good.
      if (goes) tx.delete(${n.table}).where(eq(${n.table}.id, raw.other.id)).run();`
      }
      // After the other has gone, so a unique value it gives the kept one is free (one it keeps
      // while it stays is refused as a taken value).
      if (changed.length) tx.update(${n.table}).set(values as Partial<Raw>).where(eq(${n.table}.id, raw.kept.id)).run();
      // What moved, so Restore can put it back: tied to this trashing, so a later delete and
      // restore of the record does not replay it.
      audit(tx, viewer, { action: goes ? "merged" : "merged, kept", model: ${JSON.stringify(model.name)}, record: raw.other.id, title: other.${title}, details: { into: raw.kept.id, by: ${JSON.stringify(action.name)}, trashedAt: goes ? when.getTime() : null, moved: plan.moved, trashed: plan.trashed, cleared: plan.cleared, before: Object.fromEntries(changed.map((key) => [key, raw.kept[key as keyof Raw]])), after: values } });
      audit(tx, viewer, { action: ${JSON.stringify(action.name)}, model: ${JSON.stringify(model.name)}, record: raw.kept.id, fields: changed, details: { merged: raw.other.id } });
    });
  } catch (error) {
    throw refusal(error);
  }
  return { kept: kept.id, other: other.id, stays: !goes };
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
