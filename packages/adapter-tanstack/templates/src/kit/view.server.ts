// Smithable app kit: a sent document's link (docs/design/record-documents.md §5). A mail whose
// text says {view} stores a copy of the record's document as the sender may read it, in the
// action's own transaction, and gives each recipient a link of their own to that copy: a random
// token, kept only as its hash. The page behind the link reads the copy alone, never the live
// record. A link ends after its days, when its record goes to the trash or is removed, or when
// someone withdraws it; an ended link stays ended. A mail whose text says {pay} gives each
// recipient a link of the same kind to pay for the record (payments.md §4.1), bound to the payments
// entry, the record and the amount, ended the same ways.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "#/db";
import { recordLinks, sentDocuments } from "#/db/schema";
import { Conflict, type Viewer } from "./access";
import { audit } from "./audit.server";

const DAY = 24 * 60 * 60_000;

/** What a document's reader gives: the parts, why it cannot be a document, or null (not readable). */
export type DocumentRead =
  | { refused: "read" | "settings" }
  | { refused: "missing"; label: string }
  | ({ refused?: undefined } & Record<string, unknown>)
  | null;

/** The database, or a transaction in it. */
type Writer = Pick<typeof db, "insert" | "update" | "delete" | "select">;

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

/** The address the app's own pages are at, for the link in a mail. */
function base(): string {
  return process.env.BETTER_AUTH_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
}

/**
 * The links of one send: the first recipient's link stores the copy, read now with the sender's
 * rights (a part they may not read refuses the whole change), and each recipient gets a token of
 * their own to it. A retry of the mail's delivery sends the same text, so the same link.
 */
export function viewLinks(
  tx: Pick<typeof db, "insert">,
  viewer: Viewer | null,
  send: { entry: string; model: string; record: number; days: number; read: () => DocumentRead },
): (email: string) => string {
  let copy: number | undefined;
  return (email) => {
    if (copy === undefined) {
      const found = send.read();
      if (!found) throw new Conflict("document-read");
      if (found.refused === "missing") throw new Conflict(`no-value:${found.label}`);
      if (found.refused) throw new Conflict(`document-${found.refused}`);
      const stored = tx
        .insert(sentDocuments)
        .values({
          entry: send.entry,
          model: send.model,
          recordId: send.record,
          sentBy: viewer?.id ?? null,
          content: JSON.stringify(found),
        })
        .returning({ id: sentDocuments.id })
        .all();
      copy = stored[0]?.id;
      if (copy === undefined) throw new Error("the sent copy was not stored");
    }
    const token = randomBytes(32).toString("base64url");
    const until = new Date(Date.now() + send.days * DAY);
    tx.insert(recordLinks)
      .values({ kind: "view", tokenHash: hashOf(token), documentId: copy, to: email, until })
      .run();
    audit(tx, viewer, {
      action: "link made",
      model: send.model,
      record: send.record,
      details: { entry: send.entry, to: email, until: until.toISOString() },
    });
    const at = base();
    return at ? `${at.replace(/\/$/, "")}/d/${token}` : `/d/${token}`;
  };
}

/** Days a pay link stays open (payments.md §4.1). */
const PAY_DAYS = 60;

/**
 * The pay links of one send (payments.md §4.1): each recipient a token of their own, bound to the
 * payments entry, the record and the amount it asks for now. A retry of the mail's delivery sends
 * the same text, so the same link.
 */
export function payLinks(
  tx: Pick<typeof db, "insert">,
  viewer: Viewer | null,
  send: { entry: string; payment: string; model: string; record: number; amount: number },
): (email: string) => string {
  return (email) => {
    const token = randomBytes(32).toString("base64url");
    const until = new Date(Date.now() + PAY_DAYS * DAY);
    tx.insert(recordLinks)
      .values({
        kind: "pay",
        tokenHash: hashOf(token),
        entry: send.payment,
        model: send.model,
        recordId: send.record,
        amount: Math.round(send.amount),
        to: email,
        until,
      })
      .run();
    audit(tx, viewer, {
      action: "pay link made",
      model: send.model,
      record: send.record,
      details: { entry: send.entry, to: email, until: until.toISOString() },
    });
    const at = base();
    return at ? `${at.replace(/\/$/, "")}/p/${token}` : `/p/${token}`;
  };
}

/**
 * What a pay token is bound to, or null: a wrong token, an ended link and a link of another kind
 * are alike. Whether the record still asks for that amount is the caller's to check.
 */
export function openPay(
  token: string,
): { entry: string; model: string; record: number; amount: number } | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = hashOf(token);
  const found = db
    .select({
      hash: recordLinks.tokenHash,
      entry: recordLinks.entry,
      model: recordLinks.model,
      record: recordLinks.recordId,
      amount: recordLinks.amount,
    })
    .from(recordLinks)
    .where(
      and(
        eq(recordLinks.tokenHash, hash),
        eq(recordLinks.kind, "pay"),
        isNull(recordLinks.endedAt),
        gt(recordLinks.until, new Date()),
      ),
    )
    .get();
  // Found by its hash; compared again in constant time, as a key is.
  const same = found !== undefined && timingSafeEqual(Buffer.from(found.hash), Buffer.from(hash));
  return same && found.entry && found.model && found.record !== null && found.amount !== null
    ? { entry: found.entry, model: found.model, record: found.record, amount: found.amount }
    : null;
}

/**
 * The copy a token opens, or null: a wrong token, an ended or withdrawn link, and a link of
 * another kind are alike. Reading changes nothing.
 */
export function openCopy(
  token: string,
): { model: string; record: number; sentAt: Date; content: unknown } | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const found = db
    .select({
      model: sentDocuments.model,
      record: sentDocuments.recordId,
      sentAt: sentDocuments.createdAt,
      content: sentDocuments.content,
    })
    .from(recordLinks)
    .innerJoin(sentDocuments, eq(sentDocuments.id, recordLinks.documentId))
    .where(
      and(
        eq(recordLinks.tokenHash, hashOf(token)),
        eq(recordLinks.kind, "view"),
        isNull(recordLinks.endedAt),
        gt(recordLinks.until, new Date()),
      ),
    )
    .get();
  return found ? { ...found, content: JSON.parse(found.content) as unknown } : null;
}

/** A record's sent copies and their links, newest first, for "Sent" on its page. */
export function sentOf(model: string, record: number, q: Pick<typeof db, "select"> = db) {
  const copies = q
    .select()
    .from(sentDocuments)
    .where(and(eq(sentDocuments.model, model), eq(sentDocuments.recordId, record)))
    .orderBy(desc(sentDocuments.id))
    .all();
  const links = copies.length
    ? q
        .select({
          documentId: recordLinks.documentId,
          to: recordLinks.to,
          until: recordLinks.until,
          endedAt: recordLinks.endedAt,
        })
        .from(recordLinks)
        .where(
          inArray(
            recordLinks.documentId,
            copies.map((c) => c.id),
          ),
        )
        .all()
    : [];
  const now = Date.now();
  return copies.map((c) => ({
    id: c.id,
    entry: c.entry,
    sentAt: c.createdAt,
    content: JSON.parse(c.content) as unknown,
    to: links
      .filter((l) => l.documentId === c.id)
      .map((l) => ({ to: l.to, open: !l.endedAt && l.until.getTime() > now })),
  }));
}

/**
 * Ends every open link to a record's copies and every pay link to it, for good: why is "withdrawn", "trashed" or "removed".
 * With madeBefore, only those made by then: a restore ends what its trash should have ended (a
 * record trashed before trashing ended its links).
 */
export function endLinks(
  tx: Writer,
  viewer: Viewer | null,
  model: string,
  record: number,
  why: "withdrawn" | "trashed" | "removed",
  madeBefore?: Date,
): number {
  const copies = tx
    .select({ id: sentDocuments.id })
    .from(sentDocuments)
    .where(and(eq(sentDocuments.model, model), eq(sentDocuments.recordId, record)))
    .all()
    .map((c) => c.id);
  const paying = and(
    eq(recordLinks.kind, "pay"),
    eq(recordLinks.model, model),
    eq(recordLinks.recordId, record),
  );
  const ended = tx
    .update(recordLinks)
    .set({ endedAt: new Date(), ended: why })
    .where(
      and(
        copies.length ? or(inArray(recordLinks.documentId, copies), paying) : paying,
        isNull(recordLinks.endedAt),
        madeBefore && lte(recordLinks.createdAt, madeBefore),
      ),
    )
    .returning({ id: recordLinks.id })
    .all().length;
  if (ended && why === "withdrawn")
    audit(tx, viewer, { action: "links withdrawn", model, record, details: { links: ended } });
  return ended;
}

/** Removes a record's sent copies (their links go with them) and its pay links, with the record itself. */
export function removeCopies(tx: Writer, model: string, record: number): void {
  tx.delete(sentDocuments)
    .where(and(eq(sentDocuments.model, model), eq(sentDocuments.recordId, record)))
    .run();
  tx.delete(recordLinks)
    .where(
      and(
        eq(recordLinks.kind, "pay"),
        eq(recordLinks.model, model),
        eq(recordLinks.recordId, record),
      ),
    )
    .run();
}
