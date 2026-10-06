// Smithable app kit: a record's picture or document, loaded through the model's data function,
// so it can be read exactly when the record can.
import { createFileRoute } from "@tanstack/react-router";
import { UPLOADS } from "#/generated/uploads";
import { uploadResponse } from "#/kit/uploads";
import { currentViewer } from "#/lib/viewer.server";

export const Route = createFileRoute("/files/$model/$id/$field")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const entry = UPLOADS[params.model]?.[params.field];
        const id = Number(params.id);
        if (!entry || !Number.isInteger(id)) return new Response("Not found", { status: 404 });
        const row = (await entry.data.get(await currentViewer(), id)) as Record<
          string,
          unknown
        > | null;
        const everyone = entry.access.read.public && !entry.access.read.where;
        return uploadResponse(request, entry.kind, row?.[entry.key], everyone);
      },
    },
  },
});
