// Smithable app kit: an import's server side (A 238). Every row is read as the form would store
// it and goes through the model's own create, so the write checks and the viewer's access apply
// to each; the rows that cannot go in are named by line and column, the rest go in. The import
// is one line in the activity log (who, the file's name, how many; the new records' ids for the
// undo, never their values), and for 24 hours its importer can take it back: into the trash where
// the model has one, otherwise only the records nobody has changed since, the rest named.
import { and, eq, sql } from "drizzle-orm";
import { db } from "#/db";
import { auditLog } from "#/db/schema";
import { AccessDenied, allows, Conflict, type Rule, type Viewer } from "./access";
import { audit } from "./audit.server";
import { convertCell, type ImportRefusal, type Lookup, planImport } from "./import";
import { log } from "./log.server";
import type { ModelUi } from "./model";
import { BadInput } from "./refusal";
import { w } from "./words";

const DAY = 24 * 60 * 60 * 1000;
/** Ids in one statement: under SQLite's limit on a statement's values. */
const PART = 500;

export interface ImportAnswer {
  columns: { column: string; field: string }[];
  ignored: string[];
  refusals: ImportRefusal[];
  /** The rows that go in (a dry run) or went in. */
  count: number;
  /** The activity line to undo it by, when records went in. */
  undo?: number;
}

/** What a refused write says, for its row. */
function refusalText(error: unknown, ui: ModelUi, column: (field: string) => string | undefined) {
  if (error instanceof Conflict && error.message.startsWith("taken:")) {
    const key = error.message.slice("taken:".length);
    const field = ui.fields.find(
      (f) => f.name === key || f.name.toLowerCase() === key.replace(/_/g, ""),
    );
    return {
      column: field ? column(field.name) : undefined,
      message: w.alreadyHas(ui.label, field?.label ?? key),
    };
  }
  if (error instanceof BadInput || error instanceof AccessDenied) return { message: error.message };
  return { message: w.importRowFailed };
}

/** Imports a file's rows (the header first) as `ui`'s records, or with `dryRun` says what would. */
export async function importRows(o: {
  viewer: Viewer | null;
  ui: ModelUi;
  access: Rule;
  /** Who may delete: the undo is offered only to an importer who may. */
  remove: Rule;
  schema: {
    safeParse(
      values: unknown,
    ):
      | { success: true; data: unknown }
      | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
  };
  create: (viewer: Viewer | null, values: never) => Promise<{ id: number }>;
  lookup: (viewer: Viewer | null) => Promise<Lookup>;
  file: string;
  rows: string[][];
  dryRun: boolean;
  timeZone?: string;
}): Promise<ImportAnswer> {
  if (!allows(o.access, o.viewer)) throw new AccessDenied(Boolean(o.viewer));
  const [header = [], ...lines] = o.rows;
  const plan = planImport(o.ui, header, lines.length);
  const answer: ImportAnswer = {
    columns: plan.columns.map((c) => ({ column: c.column, field: c.field.label })),
    ignored: plan.ignored,
    refusals: [...plan.refusals],
    count: 0,
  };
  if (plan.refusals.length) return answer;
  const lookup = await o.lookup(o.viewer);
  const column = (field: string) => plan.columns.find((c) => c.field.name === field)?.column;
  const ids: number[] = [];
  for (const [i, cells] of lines.entries()) {
    const line = i + 2;
    const values: Record<string, unknown> = {};
    const problems: ImportRefusal[] = [];
    for (const { column: name, field, at } of plan.columns) {
      const converted = convertCell(field, cells[at] ?? "", lookup, o.timeZone);
      if ("problem" in converted) problems.push({ line, column: name, message: converted.problem });
      // An empty cell leaves the field to its default.
      else if (converted.value !== null || field.default === undefined)
        values[field.name] = converted.value;
    }
    if (!problems.length) {
      const parsed = o.schema.safeParse(values);
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          problems.push({
            line,
            column: column(String(issue.path[0] ?? "")),
            message: issue.message,
          });
      else if (!o.dryRun)
        try {
          ids.push((await o.create(o.viewer, parsed.data as never)).id);
        } catch (error) {
          problems.push({ line, ...refusalText(error, o.ui, column) });
        }
    }
    if (problems.length) answer.refusals.push(...problems);
    else answer.count++;
  }
  if (ids.length) {
    const id = audit(db, o.viewer, {
      action: "imported",
      model: o.ui.model,
      details: { file: o.file.slice(0, 200), records: ids.length, ids },
    });
    if (id !== undefined && allows(o.remove, o.viewer)) answer.undo = id;
  }
  return answer;
}

/** The importer takes an import back within a day: what was undone, and what was kept and why. */
export async function undoImport(o: {
  viewer: Viewer | null;
  ui: ModelUi;
  /** The activity line of the import. */
  id: number;
  trash: boolean;
  /** The import's records still there (not in the trash): when made and last changed, the title. */
  rows: (ids: number[]) => { id: number; createdAt: Date; updatedAt: Date; title: string }[];
  removeMany: (viewer: Viewer | null, ids: number[]) => Promise<unknown>;
}): Promise<{ undone: number; changed: number; kept: string[] }> {
  const line = db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.id, o.id), eq(auditLog.action, "imported")))
    .get();
  // Someone else's import, or none: the same answer, so nothing is learned of others' imports.
  if (!o.viewer) throw new AccessDenied(false);
  if (!line || line.who !== o.viewer.id || line.model !== o.ui.model)
    throw new BadInput(w.importUndoGone);
  if (Date.now() - line.at.getTime() > DAY) throw new BadInput(w.importUndoLate);
  // Once: what was restored after an undo is not taken again by a second one.
  const before = db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "import undone"),
        sql`json_extract(${auditLog.details}, '$.import') = ${o.id}`,
      ),
    )
    .get();
  if (before) throw new BadInput(w.importUndoneAlready);
  const details = (line.details ?? {}) as { ids?: number[]; file?: string };
  // In parts, within SQLite's limit on a statement's values.
  const parts = (ids: number[]) =>
    Array.from({ length: Math.ceil(ids.length / PART) }, (_, i) =>
      ids.slice(i * PART, (i + 1) * PART),
    );
  const rows = parts(Array.isArray(details.ids) ? details.ids : []).flatMap((ids) => o.rows(ids));
  // Changed since it was imported: a second after it was made, or later.
  const changed = rows.filter((r) => r.updatedAt.getTime() - r.createdAt.getTime() > 1000);
  const gone = o.trash ? rows : rows.filter((r) => !changed.includes(r));
  let undone = 0;
  for (const ids of parts(gone.map((r) => r.id))) {
    const result = (await o.removeMany(o.viewer, ids)) as { deleted?: number } | undefined;
    undone += typeof result?.deleted === "number" ? result.deleted : ids.length;
  }
  const kept = o.trash ? [] : changed.map((r) => r.title);
  audit(db, o.viewer, {
    action: "import undone",
    model: o.ui.model,
    details: { import: o.id, file: details.file, undone, kept: kept.length },
  });
  return { undone, changed: changed.length, kept };
}

/**
 * A JSON list for the API (POST /api/v1/<records> with a list): each item as one record is given,
 * ids for references; every item checked, each one's id or refusal, and the import's line to
 * undo it by (DELETE /api/v1/<records>/imports/<id>).
 */
export async function importItems(
  viewer: Viewer | null,
  model: string,
  items: unknown[],
  create: (item: unknown) => Promise<{ id: number }>,
): Promise<{ results: ({ id: number } | { error: string })[]; undo?: number }> {
  if (items.length > 1000) throw new BadInput(w.importListTooLong(1000));
  if (!items.length) throw new BadInput(w.importListEmpty);
  const results: ({ id: number } | { error: string })[] = [];
  const ids: number[] = [];
  for (const item of items)
    try {
      const { id } = await create(item);
      ids.push(id);
      results.push({ id });
    } catch (error) {
      const issues = (error as { issues?: { path: PropertyKey[]; message: string }[] }).issues;
      if (issues)
        results.push({ error: issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      else if (
        error instanceof BadInput ||
        error instanceof AccessDenied ||
        error instanceof Conflict
      )
        results.push({ error: error.message });
      // Anything else is the app's own failure: said as such, and the import goes on, so what
      // went in is still on one line to undo.
      else {
        log.error("An imported record could not be added", { error });
        results.push({ error: w.importRowFailed });
      }
    }
  const undo = ids.length
    ? audit(db, viewer, {
        action: "imported",
        model,
        details: { file: "API", records: ids.length, ids },
      })
    : undefined;
  return { results, ...(undo !== undefined ? { undo } : {}) };
}
