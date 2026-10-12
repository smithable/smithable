// Smithable app kit: a stored picture or document goes onto a record only with the receipt its
// upload gave (docs/design/attachments.md §6). A file's name in storage is never enough to put it
// on a record: only the person who uploaded it, for that field, within a day.
import { randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { db } from "#/db";
import { uploads } from "#/db/schema";
import type { Viewer } from "./access";
import { BadInput } from "./refusal";
import { deleteFile } from "./uploads";
import { w } from "./words";

const DAY = 24 * 60 * 60 * 1000;

/** Records a file just stored for a model's field by `uploader` (nothing for a visitor): the receipt the record's form sends back with it. */
export function receiptFor(
  uploader: string | null,
  model: string,
  field: string,
  file: string,
): string {
  const receipt = randomBytes(16).toString("hex");
  db.insert(uploads).values({ file, model, field, uploader, receipt }).run();
  return receipt;
}

type Sent = { file: string; receipt?: string };

/**
 * A picture or document field's value as sent, for saving: each file the record had already
 * stays; each new one needs the receipt its upload gave this viewer for this field within a day.
 * The receipts are not kept in the record.
 */
export function acceptFiles<V>(
  viewer: Viewer | null,
  model: string,
  field: string,
  value: V,
  before?: unknown,
): V {
  if (value === null || value === undefined) return value;
  const had = new Set(
    (Array.isArray(before) ? before : before ? [before] : []).map((f) => (f as Sent | null)?.file),
  );
  const accepted = (sent: Sent) => {
    const { receipt, ...kept } = sent;
    if (had.has(kept.file)) return kept;
    const upload =
      typeof receipt === "string"
        ? db
            .select({ uploader: uploads.uploader })
            .from(uploads)
            .where(
              and(
                eq(uploads.receipt, receipt),
                eq(uploads.file, kept.file),
                eq(uploads.model, model),
                eq(uploads.field, field),
                gt(uploads.at, new Date(Date.now() - DAY)),
              ),
            )
            .get()
        : undefined;
    if (!upload || upload.uploader !== (viewer?.id ?? null)) throw new BadInput(w.fileNotUploaded);
    return kept;
  };
  return (
    Array.isArray(value)
      ? value.map((v) => accepted(v as Sent))
      : accepted(value as unknown as Sent)
  ) as V;
}

/**
 * Files uploaded and never saved on a record (a form left, a picture chosen again): a day after
 * their upload the receipt goes, and the file too when no record of its model has it.
 */
export async function sweepUploads(now = Date.now()): Promise<number> {
  const { UPLOADS } = await import("#/generated/uploads");
  const old = db
    .select()
    .from(uploads)
    .where(lte(uploads.at, new Date(now - DAY)))
    .all();
  let gone = 0;
  for (const upload of old) {
    const recent = db
      .select({ id: uploads.id })
      .from(uploads)
      .where(and(eq(uploads.file, upload.file), gt(uploads.at, new Date(now - DAY))))
      .get();
    const used = Object.values(UPLOADS[upload.model] ?? {}).some((f) => f.data.uses(upload.file));
    if (!recent && !used) {
      deleteFile({ file: upload.file, name: "", type: "", size: 0 }, false);
      gone++;
    }
    db.delete(uploads).where(eq(uploads.id, upload.id)).run();
  }
  return gone;
}

// Every hour, in the server.
if (import.meta.env.SSR)
  setInterval(() => void sweepUploads().catch(() => {}), 60 * 60 * 1000).unref?.();
