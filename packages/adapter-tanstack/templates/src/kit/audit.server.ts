// Smithable app kit: the audit log (docs/design/logging.md §3.3): who changed what, written in
// the same transaction as the change, so there is no change without its line and no line for a
// change that did not happen. Nothing in the app edits or deletes these lines; only pruning
// blanks the client's details and removes lines after their time.
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "#/db";
import { auditLog } from "#/db/schema";
import { AccessDenied, type Viewer } from "./access";
import { log } from "./log.server";
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
  /** Only on the line that deletes a record: its title by then, so it can still be named. */
  title?: unknown;
  /** For a change, the fields that changed (their names, not their values). */
  fields?: string[];
  /**
   * Anything more the line needs to say, e.g. the record a copy came from. For what touches
   * security, the values: who was made what, and what they were (never a secret).
   */
  details?: Record<string, unknown>;
}

/**
 * Writes one line for the viewer the change was made as: a visitor in a request, or "the app"
 * for its own work outside one (a daily job). The client's details come from the request.
 */
export function audit(
  tx: Writer,
  viewer: Pick<Viewer, "id" | "role"> | null,
  line: AuditLine,
): void {
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
      // A change asked for through Ask says so (assistant.md §7).
      details: trace?.through ? { ...line.details, through: trace.through } : line.details,
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

const DAY = 24 * 60 * 60 * 1000;

/** A deleted record (its model and id) or a removed user (their id), to forget in the log. */
export type Forgotten = { model: string; record: number } | { user: string };

/**
 * "Forget in the log" (docs/design/logging.md §3.3), for administrators: blanks every stored
 * name, title, address and browser in the lines about a deleted record or a removed user, and
 * keeps what was done and when. The only change to existing lines, and it can only blank; it is
 * logged itself, by the id and never the name.
 */
export function forgetInLog(viewer: Viewer | null, target: Forgotten): number {
  if (viewer?.role !== "admin") throw new AccessDenied(viewer !== null);
  return db.transaction((tx) => {
    const blank = { title: null, address: null, browser: null };
    // A person is named by their id on what they did and on the line that removed them, and by
    // their address on invitations and refused sign-ins: both go.
    const address =
      "user" in target
        ? // A removed user's row is gone; the line that removed them has their address.
          tx
            .select({ email: sql<string | null>`json_extract(${auditLog.details}, '$.email')` })
            .from(auditLog)
            .where(
              sql`json_extract(${auditLog.details}, '$.user') = ${target.user} and json_extract(${auditLog.details}, '$.email') is not null`,
            )
            .get()?.email
        : undefined;
    const withoutEmail = { ...blank, details: sql`json_remove(${auditLog.details}, '$.email')` };
    const changed =
      "user" in target
        ? tx.update(auditLog).set(blank).where(eq(auditLog.who, target.user)).run().changes +
          tx
            .update(auditLog)
            .set(withoutEmail)
            .where(
              address
                ? sql`json_extract(${auditLog.details}, '$.user') = ${target.user} or json_extract(${auditLog.details}, '$.email') = ${address}`
                : sql`json_extract(${auditLog.details}, '$.user') = ${target.user}`,
            )
            .run().changes
        : tx
            .update(auditLog)
            .set(blank)
            .where(and(eq(auditLog.model, target.model), eq(auditLog.recordId, target.record)))
            .run().changes +
          // A merge's line keeps the kept record's values from before and after it (intents.md
          // §3): they go when either of the two is forgotten.
          tx
            .update(auditLog)
            .set({ details: sql`json_remove(${auditLog.details}, '$.before', '$.after')` })
            .where(
              and(
                eq(auditLog.model, target.model),
                sql`${auditLog.action} in ('merged', 'merged, kept')`,
                sql`(${auditLog.recordId} = ${target.record} or json_extract(${auditLog.details}, '$.into') = ${target.record})`,
              ),
            )
            .run().changes;
    audit(tx, viewer, {
      action: "forgotten in the log",
      details:
        "user" in target ? { user: target.user } : { model: target.model, record: target.record },
    });
    return changed;
  });
}

/**
 * How long the log keeps things (docs/design/logging.md §3.3), as settings in the environment:
 * the client's address and browser 90 days (AUDIT_CLIENT_DAYS), a line 12 months (AUDIT_DAYS).
 */
export function auditKeeping(env: Record<string, string | undefined> = process.env) {
  const days = (value: string | undefined, fallback: number) =>
    Number(value) > 0 ? Number(value) : fallback;
  return { client: days(env.AUDIT_CLIENT_DAYS, 90), lines: days(env.AUDIT_DAYS, 365) };
}

/**
 * Blanks what names someone on lines older than their time (the client's address and browser,
 * and a deleted record's title: it then reads "a deleted customer (#42)"), and removes lines
 * older than theirs.
 */
export function pruneAudit(
  now = Date.now(),
  keep = auditKeeping(),
): { blanked: number; removed: number } {
  return db.transaction((tx) => ({
    blanked: tx
      .update(auditLog)
      .set({ address: null, browser: null, title: null })
      .where(lt(auditLog.at, new Date(now - keep.client * DAY)))
      .run().changes,
    removed: tx
      .delete(auditLog)
      .where(lt(auditLog.at, new Date(now - keep.lines * DAY)))
      .run().changes,
  }));
}

// In production: a minute after the server starts and then once a day, so an app that restarts
// often still prunes. The timers never keep the process alive by themselves.
if (import.meta.env.SSR && import.meta.env.PROD) {
  const prune = () => {
    try {
      pruneAudit();
    } catch (error) {
      log.error("The audit log could not be pruned", { error });
    }
  };
  setTimeout(prune, 60_000).unref();
  setInterval(prune, DAY).unref();
}
