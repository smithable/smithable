// Your implementation of the "monitoring" action in smithable.yml. Smithable created this file once and
// never changes it; the input and output types are generated from the spec.
import type { MonitoringInput, MonitoringOutput } from "#/generated/actions/monitoring";
import type { Viewer } from "#/kit/access";
import { moveIncident } from "./status";

/** A fix is out; the incident is watched before it is closed. */
export async function monitoring(
  { incident }: MonitoringInput,
  _viewer: Viewer | null,
): Promise<MonitoringOutput> {
  moveIncident(incident, "monitoring");
}
