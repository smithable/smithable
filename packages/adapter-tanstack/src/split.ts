// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7): a split, one
// record of a model made two (docs/design/intents.md §4).
import {
  type AuthIR,
  actionAccess,
  type FieldIR,
  kebab,
  type ModelIR,
  type SpecIR,
  type StandardActionIR,
  titleField,
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

/** The list a split moves records of: its field, the records' model, and their reference back. */
export function splitList(ir: SpecIR, action: StandardActionIR) {
  const model = modelNamed(ir, action.on);
  const list = model.fields.find((f) => f.name === action.split?.move) as FieldIR & {
    type: { kind: "relation"; model: string };
  };
  const child = modelNamed(ir, list.type.model);
  const back = child.fields.find(
    (f) => f.type.kind === "relation" && !f.type.many && f.type.model === model.name,
  ) as FieldIR;
  return {
    model,
    list,
    child,
    back,
    backKey: dataKey(back),
    titleKey: shownTitleKey(ir, child.name),
  };
}

/** The split's module: who may run it, the run (it returns the new record's id), and its undo. */
export function splitActionModule(
  action: StandardActionIR,
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
): string {
  const a = actionNames(action);
  const model = modelNamed(ir, action.on);
  const n = names(model, t);
  return `${HEADER}import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Rule } from "#/kit/access";
import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";
import { ${a.run}${model.trash ? `, ${a.undo}` : ""} } from "./${kebab(action.name)}.server";

/** Who may run the "${action.name}" split: its grant, with the right to add ${n.pluralLabel.toLowerCase()}. */
export const ${a.access}: Rule = ${literal(actionAccess(action, auth, ir.models))};

/** The viewer about to change things, counted against how often one may write (see src/kit/limit.ts). */
async function writer() {
  const viewer = await currentViewer();
  writeAllowed(viewer, getRequestHeaders());
  return viewer;
}

/** Splits the ${n.label.toLowerCase()}: the picked records go to a new one, whose id it returns. */
export const ${action.name} = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int(), picked: z.array(z.number().int()).min(1).max(1000) }))
  .handler(async ({ data }) => ${a.run}(await writer(), data.id, data.picked));
${
  model.trash
    ? `
/** Undoes a split: what is still on the new ${n.label.toLowerCase()} moves back, and it goes to the trash. */
export const ${a.undoFn} = createServerFn({ method: "POST" })
  .validator(z.number().int())
  .handler(async ({ data }) => ${a.undo}(await writer(), data));
`
    : ""
}`;
}

/**
 * The split on the server: the record as the viewer may read it, the picked records of the list
 * (each one theirs to change), and in one transaction a new record with the copied fields, made as
 * any new record is, with the picked records moved to it. Its undo reads the split's line.
 */
export function splitActionServer(
  action: StandardActionIR,
  ir: SpecIR,
  auth: AuthIR,
  t: Texts,
): string {
  const a = actionNames(action);
  const { model, child, backKey } = splitList(ir, action);
  const n = names(model, t);
  const cn = names(child, t);
  const signedIn = hasSignIn(auth);
  const copied = (action.split?.copy ?? []).map((name) =>
    dataKey(model.fields.find((f) => f.name === name) as FieldIR),
  );
  const numbered = sequenceEntries(model, auth, n.table, "personOf(viewer)")
    .map((e) => `, ${e}`)
    .join("");
  const childLive = child.trash ? `, isNull(${cn.table}.deletedAt)` : "";
  const title = titleField(model);
  // Undo is the trash's (intents.md §4): a model without one has none.
  const undo = `/**
 * Undoes a split (intents.md §4): the moved ${cn.pluralLabel.toLowerCase()} still on the new ${n.label.toLowerCase()}
 * go back to the one it came from, then the new one goes to the trash; a number it took stays
 * taken. Returns the original's id and how many stayed (moved on since).
 */
export async function ${a.undo}(viewer: Viewer | null, id: number) {
  check(${a.access}, viewer);
  const row = await ${n.data}.get(viewer, id);
  if (!row) throw new AccessDenied(viewer !== null);
  // The new record goes: the viewer must be one who may delete it.
  if (!allows(${n.access}.delete, viewer${signedIn ? `, row.${ownerKey(model)}` : ""})) throw new AccessDenied(true);
  const line = db
    .select({ details: schema.auditLog.details })
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.model, ${JSON.stringify(model.name)}), eq(schema.auditLog.recordId, id), eq(schema.auditLog.action, "split")))
    .get();
  const split = line?.details as { from: number; moved: number[] } | undefined;
  if (!split) throw new Conflict(w.splitNotSplit);
  // The one it came from must still be there to take them back.
  if (!(await ${n.data}.get(viewer, split.from))) throw new Conflict(w.splitOriginalGone);
  // What is still on the new record and the viewer may change goes back; the rest stays, counted.
  const back = childrenOf(viewer, id)
    .filter((c) => split.moved.includes(c.id) && allows(${cn.access}.write, viewer${signedIn ? ", c.owner" : ""}))
    .map((c) => c.id);
  try {
    db.transaction((tx) => {
      if (back.length) tx.update(${cn.table}).set({ ${backKey}: split.from }).where(and(inArray(${cn.table}.id, back), eq(${cn.table}.${backKey}, id))).run();
      tx.update(${n.table}).set({ deletedAt: new Date()${signedIn ? ", deletedBy: personOf(viewer)" : ""} }).where(eq(${n.table}.id, id)).run();
      audit(tx, viewer, { action: "split undone", model: ${JSON.stringify(model.name)}, record: id, title: row.${title}, details: { into: split.from, back } });
    });
  } catch (error) {
    throw refusal(error);
  }
  return { original: split.from, stayed: split.moved.length - back.length };
}
`;
  return `${HEADER}import { and, eq, inArray${child.trash ? ", isNull" : ""}${numbered ? ", max" : ""} } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { AccessDenied, allows, check, Conflict, personOf, type Viewer } from "#/kit/access";
import { audit } from "#/kit/audit.server";
import { refusal } from "#/kit/log.server";
${numbered ? 'import { nextInSequence } from "#/kit/sequence.server";\n' : ""}import { w } from "#/kit/words";
import { afterChange } from "#/generated/hooks";
import { ${n.schema} } from "${n.module}.schema";
import { ${n.access}, ${n.data} } from "${n.module}.server";
${cn.data === n.data ? `import { ${n.ui} } from "${n.module}";\n` : `import { ${cn.access}, ${cn.data} } from "${cn.module}.server";\nimport { ${cn.ui} } from "${cn.module}";\n`}import { ${a.access} } from "./${kebab(action.name)}";

/** The ${child.name === model.name ? "records" : cn.pluralLabel.toLowerCase()} of a ${n.label.toLowerCase()} the viewer may see: those on it now, with whose each is. */
function childrenOf(viewer: Viewer | null, id: number) {
  return db
    .select({ id: ${cn.table}.id${signedIn ? `, owner: ${cn.table}.${ownerKey(child)}` : ""} })
    .from(${cn.table})
    .where(and(eq(${cn.table}.${backKey}, id)${childLive}, ${cn.data}.readable(viewer)))
    .all();
}

/**
 * Splits the ${n.label.toLowerCase()} as the viewer: the picked ${cn.pluralLabel.toLowerCase()} go to a new
 * ${n.label.toLowerCase()} with its copied fields; at least one is picked and at least one stays.
 * Returns the new record's id, whose page the person lands on.
 */
export async function ${a.run}(viewer: Viewer | null, id: number, picked: number[]): Promise<number> {
  check(${a.access}, viewer);
  const row = await ${n.data}.get(viewer, id);
  if (!row) throw new AccessDenied(viewer !== null);
  const on = childrenOf(viewer, id);
  const chosen = [...new Set(picked)];
  if (!chosen.length) throw new Conflict(w.splitPickOne(${cn.ui}.label));
  if (chosen.some((c) => !on.some((o) => o.id === c))) throw new AccessDenied(true);
  if (chosen.length >= on.length) throw new Conflict(w.splitLeaveOne(${cn.ui}.label));
  // Each record that moves is the viewer's to change.
  for (const c of on.filter((o) => chosen.includes(o.id)))
    if (!allows(${cn.access}.write, viewer${signedIn ? ", c.owner" : ""})) throw new Conflict(w.splitMayNotChange(${cn.ui}.pluralLabel));
  let created: typeof ${n.table}.$inferSelect;
  try {
    // The copied fields as the viewer sees them, as a new record takes them (its defaults fill the rest).
    const shown = row as unknown as Record<string, unknown>;
    const values = ${n.schema}.parse({ ${copied.map((k) => `${k}: shown.${k}`).join(", ")} });
    created = db.transaction((tx) => {
      // Made as any new record is (A 153): its rules, its numbers counting up.
      const made = tx.insert(${n.table}).values({ ...${n.data}.checkCreate(tx, viewer, values), ${ownerKey(model)}: personOf(viewer)${numbered} }).returning().get();
      // Only those still on it: one moved meanwhile stays where it went.
      tx.update(${cn.table}).set({ ${backKey}: made.id }).where(and(inArray(${cn.table}.id, chosen), eq(${cn.table}.${backKey}, id))).run();
      // What moved, so the split can be undone (by ids, never values).
      audit(tx, viewer, { action: "split", model: ${JSON.stringify(model.name)}, record: made.id, details: { from: id, by: ${JSON.stringify(action.name)}, moved: chosen } });
      return made;
    });
  } catch (error) {
    throw refusal(error);
  }
  await afterChange("afterCreate", ${JSON.stringify(model.name)}, created, viewer);
  return created.id;
}

${model.trash ? undo : ""}`;
}
