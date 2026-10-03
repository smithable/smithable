// Your implementation of the "identified" action in smithable.yml. Smithable created this file once and
// never changes it; the input and output types are generated from the spec.
import type { IdentifiedInput, IdentifiedOutput } from "#/generated/actions/identified";
import type { Viewer } from "#/kit/access";
import { moveIncident } from "./status";

/** The cause is found; the incident moves to identified. */
export async function identified(
  { incident }: IdentifiedInput,
  _viewer: Viewer | null,
): Promise<IdentifiedOutput> {
  moveIncident(incident, "identified");
}
