// Smithable app kit: a record's picture, loaded through the model's data function, so it can
// be seen exactly when the record can. Cached by browsers for a day when anyone may read the
// model (the address changes with the content), privately otherwise.
import { createFileRoute } from "@tanstack/react-router";
import { PICTURES } from "#/generated/pictures";
import { type Picture, pictureTag, readPicture } from "#/kit/uploads";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/files/$model/$id/$field")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const entry = PICTURES[params.model]?.[params.field];
        const id = Number(params.id);
        if (!entry || !Number.isInteger(id)) return new Response("Not found", { status: 404 });
        const row = (await entry.data.get(await currentViewer(), id)) as Record<
          string,
          unknown
        > | null;
        const picture = row?.[entry.key] as Picture | null | undefined;
        const bytes = picture && readPicture(picture);
        if (!picture || !bytes) return new Response("Not found", { status: 404 });
        const tag = pictureTag(picture);
        const everyone = entry.access.read.public && !entry.access.read.where;
        const headers = {
          "Content-Type": "image/webp",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": everyone ? "public, max-age=86400" : "private, max-age=3600",
          ETag: tag,
        };
        if (request.headers.get("if-none-match") === tag)
          return new Response(null, { status: 304, headers });
        return new Response(new Uint8Array(bytes), { headers });
      },
    },
  },
});
