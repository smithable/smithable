// Smithable app kit: a browser sends a record's picture here before saving the record (see
// src/kit/PictureInput.tsx). Whoever may add or change the model's records may send one; the
// file is checked and stored by src/kit/uploads.ts and the record keeps what this returns.
import { createFileRoute } from "@tanstack/react-router";
import { PICTURES } from "#/generated/pictures";
import { allows } from "#/kit/access";
import { writeAllowed } from "#/kit/limit";
import { log } from "#/kit/log.server";
import { BadPicture, PICTURE_MAX_BYTES, savePicture } from "#/kit/uploads";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/files/$model/$field")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const entry = PICTURES[params.model]?.[params.field];
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
          if (length > PICTURE_MAX_BYTES)
            throw new BadPicture("The picture is too large (at most 1 MB).");
          const bytes = new Uint8Array(await request.arrayBuffer());
          const { file, width, height } = savePicture(params.model, bytes, "");
          return Response.json({ file, width, height });
        } catch (error) {
          const known =
            error instanceof BadPicture ||
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
