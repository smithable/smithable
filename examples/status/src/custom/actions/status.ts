// The incident steps the three actions share (identified.ts, monitoring.ts, resolve.ts): a new
// status, a line in the incident's updates saying so, and on resolving the time it ended and its
// component working again. Yours to change: Smithable created this file and never touches it.
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { components, incidents, incidentUpdates } from "#/db/schema";

type Step = "identified" | "monitoring" | "resolved";

const SAID: Record<Step, string> = {
  identified: "The cause is found and a fix is being worked on.",
  monitoring: "A fix is out. We are watching before we close this.",
  resolved: "This incident is resolved.",
};

export function moveIncident(id: number, status: Step): void {
  const incident = db.select().from(incidents).where(eq(incidents.id, id)).get();
  if (!incident) throw new Error("There is no such incident.");
  if (incident.status === "resolved") throw new Error("This incident is already resolved.");
  const now = new Date();
  // All of it or none: the status, its update and the component change together.
  db.transaction((tx) => {
    tx.update(incidents)
      .set({ status, ...(status === "resolved" ? { resolvedAt: now } : {}) })
      .where(eq(incidents.id, id))
      .run();
    tx.insert(incidentUpdates)
      .values({ incidentId: id, at: now, status, message: SAID[status] })
      .run();
    if (status === "resolved" && incident.componentId !== null)
      tx.update(components)
        .set({ status: "operational" })
        .where(eq(components.id, incident.componentId))
        .run();
  });
}
