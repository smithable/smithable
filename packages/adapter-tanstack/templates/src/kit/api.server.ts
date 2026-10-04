// Smithable app kit: the API's frame (docs/design/integrations.md §2). Every call is a key's,
// limited per key (60 a minute), with a body of at most 1 MB, answered in JSON and refused as a
// JSON problem in the app's own words. No cookies: it is for programs, not pages.
import { ZodError } from "zod";
import { keyViewer } from "#/generated/keys.server";
import { AccessDenied, Conflict, type Viewer } from "./access";
import { count, TooMany } from "./limit";
import { traceWho } from "./trace.server";

const MAX_BODY = 1_000_000;

/** A value or a body the API cannot take: a 400 with what is wrong. */
export class BadInput extends Error {}
/** A record that is not there, or not one the key may read: a 404. */
export class NotFound extends Error {}

export function problem(
  status: number,
  title: string,
  more: Record<string, unknown> = {},
): Response {
  return new Response(JSON.stringify({ status, title, ...more }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

/** What a refused change says, as the form says it ("taken:email" → that address is taken). */
function conflict(code: string): string {
  const taken = /^taken:(\w+)$/.exec(code)?.[1];
  if (taken) return `That ${taken} is already taken.`;
  if (code.startsWith("in-use"))
    return "It is still used by other records, so it cannot be deleted.";
  if (code === "full") return "No places left.";
  const booked = /^booked:(\d+)$/.exec(code)?.[1];
  if (booked) return `${booked} are already taken.`;
  return code;
}

/** Runs one call as the key in the Authorization header, with its body when it has one. */
export async function apiCall(
  request: Request,
  run: (viewer: Viewer, body: unknown) => Promise<unknown>,
  status = 200,
): Promise<Response> {
  const viewer = keyViewer(request.headers.get("authorization"));
  if (!viewer) return problem(401, "A valid key is needed: Authorization: Bearer <key>.");
  traceWho(viewer.id, viewer.role);
  try {
    count(`api:${viewer.id}`, { max: 60, seconds: 60 }, "requests");
    let body: unknown;
    if (request.method !== "GET" && request.method !== "DELETE") {
      const text = await request.text();
      if (text.length > MAX_BODY) return problem(413, "The body is larger than 1 MB.");
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        return problem(400, "The body is not JSON.");
      }
    }
    const result = await run(viewer, body);
    return result === undefined
      ? new Response(null, { status: 204 })
      : Response.json(result, { status });
  } catch (error) {
    if (error instanceof TooMany) return problem(429, error.message);
    if (error instanceof AccessDenied) return problem(403, error.message);
    if (error instanceof NotFound) return problem(404, error.message);
    if (error instanceof BadInput) return problem(400, error.message);
    if (error instanceof Conflict) return problem(409, conflict(error.message));
    if (error instanceof ZodError)
      return problem(422, "Some values are not valid.", {
        errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    // "This cannot be done now." (an action whose condition does not fit), and anything else
    // the app refuses with words of its own.
    if (error instanceof Error && /cannot be done now/.test(error.message))
      return problem(409, error.message);
    throw error;
  }
}
