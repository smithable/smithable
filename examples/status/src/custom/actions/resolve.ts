// Your implementation of the "resolve" action in smithable.yml. Smithable created this file once and
// never changes it; the input and output types are generated from the spec.
import type { ResolveInput, ResolveOutput } from "#/generated/actions/resolve";
import type { Viewer } from "#/kit/access";
import { moveIncident } from "./status";

/** The incident is over. */
export async function resolve(
  { incident }: ResolveInput,
  _viewer: Viewer | null,
): Promise<ResolveOutput> {
  moveIncident(incident, "resolved");
}
