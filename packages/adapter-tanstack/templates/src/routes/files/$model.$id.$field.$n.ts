// Smithable app kit: one of a record's several pictures or documents (the n-th, from 0; a
// picture's first is the cover), loaded through the model's data function like a single one,
// so it can be read exactly when the record can.
import { createFileRoute } from "@tanstack/react-router";
import { UPLOADS } from "#/generated/uploads";
import { uploadResponse } from "#/kit/uploads";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/files/$model/$id/$field/$n")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const entry = UPLOADS[params.model]?.[params.field];
        const id = Number(params.id);
        const n = Number(params.n);
        if (!entry || !Number.isInteger(id) || !Number.isInteger(n) || n < 0)
          return new Response("Not found", { status: 404 });
        const row = (await entry.data.get(await currentViewer(), id)) as Record<
          string,
          unknown
        > | null;
        const list = row?.[entry.key];
        const everyone = entry.access.read.public && !entry.access.read.where;
        return uploadResponse(
          request,
          entry.kind,
          Array.isArray(list) ? list[n] : undefined,
          everyone,
        );
      },
    },
  },
});
