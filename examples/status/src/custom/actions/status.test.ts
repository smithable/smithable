// Tests for the incident steps (status.ts): custom logic needs its own tests.
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "#/db";
import { components, incidents, incidentUpdates } from "#/db/schema";
import { moveIncident } from "./status";

test("resolving sets the status, the time it ended, an update and the component working again", () => {
  const component = db.insert(components).values({ name: "API", status: "down" }).returning().get();
  const incident = db
    .insert(incidents)
    .values({
      title: "API errors",
      status: "investigating",
      componentId: component.id,
      detectedAt: new Date(),
    })
    .returning()
    .get();
  moveIncident(incident.id, "identified");
  expect(db.select().from(incidents).where(eq(incidents.id, incident.id)).get()?.status).toBe(
    "identified",
  );
  moveIncident(incident.id, "resolved");
  const done = db.select().from(incidents).where(eq(incidents.id, incident.id)).get();
  expect(done?.status).toBe("resolved");
  expect(done?.resolvedAt).toBeInstanceOf(Date);
  expect(db.select().from(components).where(eq(components.id, component.id)).get()?.status).toBe(
    "operational",
  );
  const said = db
    .select()
    .from(incidentUpdates)
    .where(eq(incidentUpdates.incidentId, incident.id))
    .all();
  expect(said.map((u) => u.status)).toEqual(["identified", "resolved"]);
  expect(() => moveIncident(incident.id, "monitoring")).toThrow("already resolved");
});
