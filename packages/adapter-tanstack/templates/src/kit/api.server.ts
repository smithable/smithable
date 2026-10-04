// Smithable app kit: the API's frame (docs/design/integrations.md §2). Every call is a key's,
// limited per key (60 a minute; a call without a valid key by its address), with a body of at
// most 1 MB, answered in JSON and refused as a JSON problem in the app's own words. No cookies:
// it is for programs, not pages. The tools for assistants (mcp.server.ts) use the same pieces.
import { ZodError } from "zod";
import { keyViewer } from "#/generated/keys.server";
import { AccessDenied, Conflict, type Viewer } from "./access";
import { address, count, TooMany } from "./limit";
import { traceWho } from "./trace.server";

const MAX_BODY = 1_000_000;

/** A value or a body the API cannot take: a 400 with what is wrong. */
export class BadInput extends Error {}
/** A record that is not there, or not one the key may read: a 404. */
export class NotFound extends Error {}
/** A body over the limit: a 413, refused by its declared size before it is read. */
class TooLarge extends Error {}

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

/**
 * The key a call is made with, counted: 60 calls a minute per key, and a call without a valid
 * key by its address, so guessing keys is slow too. Null when there is no valid key.
 */
export function keyOf(request: Request): Viewer | null {
  const viewer = keyViewer(request.headers.get("authorization"));
  count(
    viewer ? `api:${viewer.id}` : `api-nokey:${address(request.headers)}`,
    { max: 60, seconds: 60 },
    "requests",
  );
  if (viewer) traceWho(viewer.id, viewer.role);
  return viewer;
}

/** A call's JSON body: refused by its declared size before it is read, at most 1 MB. */
export async function bodyOf(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) throw new TooLarge();
  const text = await request.text();
  if (text.length > MAX_BODY) throw new TooLarge();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new BadInput("The body is not JSON.");
  }
}

/** A refusal as a status and the app's words; undefined for an error that is not one. */
export function refusalOf(
  error: unknown,
): { status: number; title: string; more?: Record<string, unknown> } | undefined {
  if (error instanceof TooMany) return { status: 429, title: error.message };
  if (error instanceof TooLarge) return { status: 413, title: "The body is larger than 1 MB." };
  if (error instanceof AccessDenied) return { status: 403, title: error.message };
  if (error instanceof NotFound) return { status: 404, title: error.message };
  if (error instanceof BadInput) return { status: 400, title: error.message };
  if (error instanceof Conflict) return { status: 409, title: conflict(error.message) };
  if (error instanceof ZodError)
    return {
      status: 422,
      title: "Some values are not valid.",
      more: { errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
    };
  // "This cannot be done now." (an action whose condition does not fit).
  if (error instanceof Error && /cannot be done now/.test(error.message))
    return { status: 409, title: error.message };
  return undefined;
}

/** Runs one call as the key in the Authorization header, with its body when it has one. */
export async function apiCall(
  request: Request,
  run: (viewer: Viewer, body: unknown) => Promise<unknown>,
  status = 200,
): Promise<Response> {
  try {
    const viewer = keyOf(request);
    if (!viewer) return problem(401, "A valid key is needed: Authorization: Bearer <key>.");
    const body =
      request.method !== "GET" && request.method !== "DELETE" ? await bodyOf(request) : undefined;
    const result = await run(viewer, body);
    return result === undefined
      ? new Response(null, { status: 204 })
      : Response.json(result, { status });
  } catch (error) {
    const refused = refusalOf(error);
    if (refused) return problem(refused.status, refused.title, refused.more);
    throw error;
  }
}
