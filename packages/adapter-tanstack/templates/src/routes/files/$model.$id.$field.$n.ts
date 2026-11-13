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
        // Names from the address: only the app's own models and fields, never an object's own properties.
        const fields = Object.hasOwn(UPLOADS, params.model) ? UPLOADS[params.model] : undefined;
        const entry =
          fields && Object.hasOwn(fields, params.field) ? fields[params.field] : undefined;
        const id = Number(params.id);
        const n = Number(params.n);
        if (!entry || !Number.isInteger(id) || !Number.isInteger(n) || n < 0)
          return new Response("Not found", { status: 404 });
        const row = (await entry.data.get(await currentViewer(), id)) as Record<
          string,
          unknown
        > | null;
        const list = row?.[entry.key];
        return uploadResponse(
          request,
          entry.kind,
          Array.isArray(list) ? list[n] : undefined,
        );
      },
    },
  },
});
