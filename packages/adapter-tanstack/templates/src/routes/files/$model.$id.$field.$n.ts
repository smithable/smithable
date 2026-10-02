// Smithable app kit: one of a record's several pictures (the n-th, from 0; the first is the
// cover), loaded through the model's data function like a single picture, so it can be seen
// exactly when the record can.
import { createFileRoute } from "@tanstack/react-router";
import { PICTURES } from "#/generated/pictures";
import { type Picture, pictureTag, readPicture } from "#/kit/uploads";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/files/$model/$id/$field/$n")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const entry = PICTURES[params.model]?.[params.field];
        const id = Number(params.id);
        const n = Number(params.n);
        if (!entry || !Number.isInteger(id) || !Number.isInteger(n) || n < 0)
          return new Response("Not found", { status: 404 });
        const row = (await entry.data.get(await currentViewer(), id)) as Record<
          string,
          unknown
        > | null;
        const list = row?.[entry.key];
        const picture = Array.isArray(list) ? (list[n] as Picture | undefined) : undefined;
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
