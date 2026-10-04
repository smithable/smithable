// Smithable app kit: the audit log (docs/design/logging.md §3.3): who changed what, written in
// the same transaction as the change, so there is no change without its line and no line for a
// change that did not happen. Nothing in the app edits or deletes these lines; only the daily
// job removes them after their time.
import { auditLog } from "#/db/schema";
import type { Viewer } from "./access";
import { traceDetails } from "./trace.server";

/** The database, or a transaction in it: what a line is written with. */
type Writer = {
  insert(table: typeof auditLog): { values(row: typeof auditLog.$inferInsert): { run(): unknown } };
};

export interface AuditLine {
  /** What was done: created, changed, deleted, copied, or an action's name. */
  action: string;
  model?: string;
  record?: number;
  /** The record's title at that moment, so a deleted record can still be named. */
  title?: unknown;
  /** For a change, the fields that changed (their names, not their values). */
  fields?: string[];
  /** Anything more the line needs to say, e.g. the record a copy came from. */
  details?: Record<string, unknown>;
}

/**
 * Writes one line for the viewer the change was made as: a visitor in a request, or "the app"
 * for its own work outside one (a daily job). The client's details come from the request.
 */
export function audit(tx: Writer, viewer: Viewer | null, line: AuditLine): void {
  const trace = traceDetails();
  tx.insert(auditLog)
    .values({
      trace: trace?.traceId,
      who: viewer?.id ?? (trace ? "visitor" : "the app"),
      role: viewer?.role,
      address: trace?.address,
      browser: trace?.browser,
      action: line.action,
      model: line.model,
      recordId: line.record,
      title: line.title == null ? undefined : String(line.title),
      fields: line.fields?.length ? line.fields : undefined,
      details: line.details,
    })
    .run();
}

/** Of the keys a change set, those whose value is not what it was: dates and lists by value. */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
): string[] {
  const same = (a: unknown, b: unknown) =>
    a instanceof Date && b instanceof Date
      ? a.getTime() === b.getTime()
      : JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return keys.filter((key) => key !== "updatedAt" && !same(before[key], after[key]));
}
