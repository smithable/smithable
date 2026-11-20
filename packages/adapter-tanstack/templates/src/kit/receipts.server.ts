// Smithable app kit: a stored picture or document goes onto a record only with the receipt its
// upload gave (docs/design/attachments.md §6). A file's name in storage is never enough to put it
// on a record: only the person who uploaded it, for that field, within a day.
import { randomBytes } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq, gt, lte } from "drizzle-orm";
import { db } from "#/db";
import { uploads } from "#/db/schema";
import type { Viewer } from "./access";
import { log } from "./log.server";
import { BadInput } from "./refusal";
import {
  BadPicture,
  deleteFile,
  hasUpload,
  PICTURE_WIDTHS,
  readPicture,
  type SmallerPicture,
  saveSmaller,
  type UploadReservation,
  uploadsDir,
  webpSize,
} from "./uploads";
import { w } from "./words";

const DAY = 24 * 60 * 60 * 1000;

/** Records a file just stored for a model's field by `uploader` (nothing for a visitor): the receipt the record's form sends back with it. */
export function receiptFor(
  uploader: string | null,
  model: string,
  field: string,
  file: string,
): string {
  return db.transaction(() => recordReceipt(uploader, model, field, file), {
    behavior: "immediate",
  });
}

function recordReceipt(
  uploader: string | null,
  model: string,
  field: string,
  file: string,
): string {
  const receipt = randomBytes(16).toString("hex");
  if (!hasUpload(file)) throw new BadInput(w.fileNotUploaded);
  db.insert(uploads).values({ file, model, field, uploader, receipt }).run();
  return receipt;
}

/** Store bytes and register the claim while holding the same writer slot as cleanup. */
export function storeUpload<T extends { file: string }>(
  uploader: string | null,
  model: string,
  field: string,
  uses: (file: string) => boolean,
  store: () => T,
): T & { receipt: string } {
  return db.transaction(
    () => {
      const stored = store();
      try {
        return { ...stored, receipt: recordReceipt(uploader, model, field, stored.file) };
      } catch (error) {
        deleteFile(
          { file: stored.file, name: "", type: "", size: 0 },
          uses(stored.file) || keepsUpload(stored.file),
        );
        throw error;
      }
    },
    { behavior: "immediate" },
  );
}

/**
 * Stores a smaller copy of a picture this uploader sent for the field within a day, the one its
 * receipt names, under the same receipt: the record takes the copy only with that picture
 * (acceptFiles). Refused when the receipt is not theirs or the picture has its copies already.
 */
export function storeSmaller(
  uploader: string | null,
  model: string,
  field: string,
  receipt: string,
  uses: (file: string) => boolean,
  bytes: Uint8Array,
  held?: UploadReservation,
): SmallerPicture {
  return db.transaction(
    () => {
      const claims = db
        .select({ file: uploads.file, uploader: uploads.uploader, at: uploads.at })
        .from(uploads)
        .where(
          and(eq(uploads.receipt, receipt), eq(uploads.model, model), eq(uploads.field, field)),
        )
        .orderBy(asc(uploads.id))
        .all();
      // The first claim is the picture's own, still within its day; the rest are its copies.
      const main = claims[0];
      const picture =
        main && main.uploader === uploader && main.at > new Date(Date.now() - DAY)
          ? readPicture({ file: main.file, alt: "", width: 0, height: 0 })
          : undefined;
      const size = picture && webpSize(picture);
      if (!main || !picture || !size || claims.length > PICTURE_WIDTHS.length)
        throw new BadPicture(w.fileNotUploaded);
      const copy = saveSmaller(model, bytes, { ...size, bytes: picture.length }, held);
      try {
        db.insert(uploads).values({ file: copy.file, model, field, uploader, receipt }).run();
      } catch (error) {
        deleteFile(
          { file: copy.file, name: "", type: "", size: 0 },
          uses(copy.file) || keepsUpload(copy.file),
        );
        throw error;
      }
      return copy;
    },
    { behavior: "immediate" },
  );
}

/** An upload a person may still attach must survive another record's cleanup. */
export function keepsUpload(file: string): boolean {
  return !!db
    .select({ id: uploads.id })
    .from(uploads)
    .where(
      and(
        eq(uploads.file, file),
        eq(uploads.attached, false),
        gt(uploads.at, new Date(Date.now() - DAY)),
      ),
    )
    .get();
}

/** Cleanup follows a committed mutation. A busy database defers only cleanup; it must not
 * turn the already committed action into an apparent failure. Recheck references on retry. */
export function cleanUploads(clean: () => void, attempt = 0): void {
  try {
    db.transaction(clean, { behavior: "immediate" });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (typeof code === "string" && /^SQLITE_(BUSY|LOCKED)/.test(code) && attempt < 5)
      setTimeout(() => cleanUploads(clean, attempt + 1), 1000 * 2 ** attempt).unref?.();
    else log.error("Upload cleanup incomplete; inspect receipt and file state", { error });
  }
}

type Sent = { file: string; receipt?: string; smaller?: SmallerPicture[] };

/** Release only this failed request's receipts. Other pending uploads and committed records
 * retain deduplicated bytes; the writer slot fences both checks and deletion. */
export function discardUploads(files: Sent[], uses: (file: string) => boolean): void {
  const discarded = files.map(({ file, receipt }) => ({ file, receipt }));
  cleanUploads(() => {
    for (const sent of discarded)
      if (sent.receipt)
        db.delete(uploads)
          .where(and(eq(uploads.receipt, sent.receipt), eq(uploads.file, sent.file)))
          .run();
    for (const sent of discarded)
      deleteFile(
        { file: sent.file, name: "", type: "", size: 0 },
        uses(sent.file) || keepsUpload(sent.file),
      );
  });
}

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
  copies = true,
): V {
  if (value === null || value === undefined) return value;
  const earlier = (Array.isArray(before) ? before : before ? [before] : []) as (Sent | null)[];
  const had = new Set(earlier.map((f) => f?.file));
  // A picture the record had keeps the copies it had, as they were stored.
  const hadSmaller = new Map(earlier.map((f) => [f?.file, f?.smaller ?? []]));
  const attached = new Set<string>();
  const accepted = (sent: Sent) => {
    const { receipt, ...kept } = sent;
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
    const own = upload && upload.uploader === (viewer?.id ?? null);
    if (!had.has(kept.file) && (!own || !hasUpload(kept.file)))
      throw new BadInput(w.fileNotUploaded);
    if (own && typeof receipt === "string") attached.add(receipt);
    const { smaller: listed, ...rest } = kept;
    // A field whose pictures are reviewed shows only what the reviewer saw: no copies.
    if (!listed || !copies) return rest;
    // Each smaller copy: one the picture had, or one sent under this picture's receipt, with its
    // size read from its file. Any other is left out, and the picture is shown at its own size.
    const smaller: SmallerPicture[] = [];
    for (const s of listed) {
      if (s.file === kept.file || smaller.some((x) => x.file === s.file)) continue;
      const stored = hadSmaller.get(kept.file)?.find((x) => x.file === s.file);
      const claimed =
        !stored &&
        own &&
        hasUpload(s.file) &&
        !!db
          .select({ id: uploads.id })
          .from(uploads)
          .where(
            and(
              eq(uploads.receipt, receipt as string),
              eq(uploads.file, s.file),
              eq(uploads.model, model),
              eq(uploads.field, field),
            ),
          )
          .get();
      const bytes = claimed
        ? readPicture({ file: s.file, alt: "", width: 0, height: 0 })
        : undefined;
      const size = bytes && webpSize(bytes);
      if (stored) smaller.push(stored);
      else if (size && (PICTURE_WIDTHS as readonly number[]).includes(size.width))
        smaller.push({ file: s.file, ...size });
    }
    return smaller.length ? { ...rest, smaller } : rest;
  };
  const result = (
    Array.isArray(value)
      ? value.map((v) => accepted(v as Sent))
      : accepted(value as unknown as Sent)
  ) as V;
  // The record transaction marks only its own claims as attached. Permission remains reusable
  // for a day while the bytes exist, but an attached claim no longer retains orphan bytes.
  // A failed record write rolls this back; other pending uploads keep their own holds.
  for (const receipt of attached)
    db.update(uploads).set({ attached: true }).where(eq(uploads.receipt, receipt)).run();
  return result;
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
    // Fence the check and unlink with a writer hold, including during backup capture.
    // A failed lock acquisition must leave both the receipt and the file intact.
    db.transaction(
      () => {
        const recent = db
          .select({ id: uploads.id })
          .from(uploads)
          .where(
            and(
              eq(uploads.file, upload.file),
              eq(uploads.attached, false),
              gt(uploads.at, new Date(now - DAY)),
            ),
          )
          .get();
        const used = Object.values(UPLOADS[upload.model] ?? {}).some((f) =>
          f.data.uses(upload.file),
        );
        if (!recent && !used) {
          deleteFile({ file: upload.file, name: "", type: "", size: 0 }, false);
          gone++;
        }
        db.delete(uploads).where(eq(uploads.id, upload.id)).run();
      },
      { behavior: "immediate" },
    );
  }
  // Files no receipt names: a store whose receipt never committed (the process gone between the
  // write and the row), or a receipt swept before. After the same grace, one that no record of
  // its model has goes too, under the same writer hold.
  for (const model of Object.keys(UPLOADS)) {
    let names: string[];
    try {
      names = readdirSync(join(uploadsDir(), model));
    } catch {
      continue;
    }
    for (const name of names) {
      const file = `${model}/${name}`;
      let written: number;
      try {
        written = statSync(join(uploadsDir(), file)).mtimeMs;
      } catch {
        continue;
      }
      if (written > now - DAY) continue;
      db.transaction(
        () => {
          const named = db
            .select({ id: uploads.id })
            .from(uploads)
            .where(eq(uploads.file, file))
            .get();
          const used = Object.values(UPLOADS[model] ?? {}).some((f) => f.data.uses(file));
          if (!named && !used) {
            deleteFile({ file, name: "", type: "", size: 0 }, false);
            gone++;
          }
        },
        { behavior: "immediate" },
      );
    }
  }
  return gone;
}

// Every hour, in the server.
if (import.meta.env.SSR)
  setInterval(() => void sweepUploads().catch(() => {}), 60 * 60 * 1000).unref?.();
