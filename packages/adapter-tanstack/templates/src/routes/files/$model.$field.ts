// Smithable app kit: a browser sends a record's picture or document here before saving the
// record (see src/kit/PictureInput.tsx and src/kit/FileInput.tsx). Whoever may add or change the
// model's records may send one; the file is checked and stored by src/kit/uploads.ts and the
// record keeps what this returns. A document's name comes in the X-File-Name header.
import { createFileRoute } from "@tanstack/react-router";
import { UPLOADS } from "#/generated/uploads";
import { allows } from "#/kit/access";
import { BodyLimit, bodySize, boundedBody } from "#/kit/bounded-body";
import { writeAllowed } from "#/kit/limit";
import { log } from "#/kit/log.server";
import { storeUpload } from "#/kit/receipts.server";
import {
  BadFile,
  BadPicture,
  FILE_MAX_BYTES,
  PICTURE_MAX_BYTES,
  release,
  reserveUpload,
  saveFile,
  savePicture,
  scanned,
  type UploadReservation,
} from "#/kit/uploads";
import { w } from "#/kit/words";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/files/$model/$field")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // Names from the address: only the app's own models and fields, never an object's own properties.
        const fields = Object.hasOwn(UPLOADS, params.model) ? UPLOADS[params.model] : undefined;
        const entry =
          fields && Object.hasOwn(fields, params.field) ? fields[params.field] : undefined;
        if (!entry) return new Response("Not found", { status: 404 });
        const viewer = await currentViewer();
        const { create, write } = entry.access;
        if (!(allows(create, viewer) || allows(write, viewer) || (viewer && write.owner)))
          return new Response(
            viewer ? "You are not allowed to do this." : "Please sign in first.",
            {
              status: viewer ? 403 : 401,
            },
          );
        // The room held for this upload, given back if it is refused or fails.
        let held: UploadReservation | undefined;
        try {
          writeAllowed(viewer, request.headers);
          const maximum = entry.kind === "file" ? FILE_MAX_BYTES : PICTURE_MAX_BYTES;
          const length = bodySize(request, maximum);
          // The app's storage is full (UPLOADS_MAX_BYTES): told before anything is read.
          held = await reserveUpload(length);
          if (!held) return new Response(w.storageFull, { status: 507 });
          if (entry.kind === "file") {
            const bytes = await boundedBody(request, maximum);
            await scanned(bytes);
            const name = decodeURIComponent(request.headers.get("x-file-name") ?? "");
            return Response.json(
              storeUpload(viewer?.id ?? null, params.model, params.field, entry.data.uses, () =>
                saveFile(params.model, bytes, name, held),
              ),
            );
          }
          const bytes = await boundedBody(request, maximum);
          await scanned(bytes);
          return Response.json(
            storeUpload(viewer?.id ?? null, params.model, params.field, entry.data.uses, () =>
              savePicture(params.model, bytes, "", false, held),
            ),
          );
        } catch (error) {
          if (error instanceof BodyLimit)
            return new Response(entry.kind === "file" ? w.fileTooLarge : w.pictureTooLarge, {
              status: 413,
            });
          if (error instanceof URIError) return new Response(w.fileNotAdded, { status: 400 });
          const known =
            error instanceof BadPicture ||
            error instanceof BadFile ||
            (error instanceof Error && error.message.startsWith("Too many "));
          if (!known) log.error("A picture could not be stored", { error });
          return new Response(
            known ? (error as Error).message : "The picture could not be stored.",
            {
              status: known ? 400 : 500,
            },
          );
        } finally {
          release(held);
        }
      },
    },
  },
});
