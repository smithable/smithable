// Smithable app kit: a browser sends a record's picture or document here before saving the
// record (see src/kit/PictureInput.tsx and src/kit/FileInput.tsx). Whoever may add or change the
// model's records may send one; the file is checked and stored by src/kit/uploads.ts and the
// record keeps what this returns. A document's name comes in the X-File-Name header.
import { createFileRoute } from "@tanstack/react-router";
import { UPLOADS } from "#/generated/uploads";
import { allows } from "#/kit/access";
import { writeAllowed } from "#/kit/limit";
import { log } from "#/kit/log.server";
import { receiptFor } from "#/kit/receipts.server";
import {
  BadFile,
  BadPicture,
  FILE_MAX_BYTES,
  PICTURE_MAX_BYTES,
  saveFile,
  savePicture,
  scanned,
} from "#/kit/uploads";
import { w } from "#/kit/words";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/files/$model/$field")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const entry = UPLOADS[params.model]?.[params.field];
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
        try {
          writeAllowed(viewer, request.headers);
          const length = Number(request.headers.get("content-length") ?? 0);
          if (entry.kind === "file") {
            if (length > FILE_MAX_BYTES) throw new BadFile(w.fileTooLarge);
            const bytes = new Uint8Array(await request.arrayBuffer());
            await scanned(bytes);
            const name = decodeURIComponent(request.headers.get("x-file-name") ?? "");
            const stored = saveFile(params.model, bytes, name);
            // The receipt that lets this person put it on a record of this field.
            return Response.json({
              ...stored,
              receipt: receiptFor(viewer?.id ?? null, params.model, params.field, stored.file),
            });
          }
          if (length > PICTURE_MAX_BYTES) throw new BadPicture(w.pictureTooLarge);
          const bytes = new Uint8Array(await request.arrayBuffer());
          await scanned(bytes);
          const { file, width, height } = savePicture(params.model, bytes, "");
          return Response.json({
            file,
            width,
            height,
            receipt: receiptFor(viewer?.id ?? null, params.model, params.field, file),
          });
        } catch (error) {
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
        }
      },
    },
  },
});
