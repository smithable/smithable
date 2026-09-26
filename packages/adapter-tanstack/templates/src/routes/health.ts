// Smithable app kit: the health endpoint of the deployment contract.
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { db } from "#/db";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: () => {
        db.run(sql`select 1`);
        return Response.json({ status: "ok" });
      },
    },
  },
});
