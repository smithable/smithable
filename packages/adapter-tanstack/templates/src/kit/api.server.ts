// Smithable app kit: the API's frame (docs/design/integrations.md §2). A call is a key's, or,
// where the app lets anyone read or add (public), a visitor's without one (api-only.md §3.4);
// limited per key (60 a minute; a call without a valid key by its address), with a body of at
// most 1 MB, answered in JSON and refused as a JSON problem in the app's own words. No cookies:
// it is for programs, not pages. The tools for assistants (mcp.server.ts) use the same pieces.
import { ZodError } from "zod";
import { keyViewer } from "#/generated/keys.server";
import { AccessDenied, Conflict, type Viewer } from "./access";
import { address, count, TooMany, writeAllowed } from "./limit";
import { BadInput, conflict, Gone, inUseFacts, NotFound } from "./refusal";
import { traceWho } from "./trace.server";

export { BadInput, Gone, NotFound };

const MAX_BODY = 1_000_000;

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
  if (error instanceof Gone) return { status: 410, title: error.message, more: error.more };
  if (error instanceof BadInput) return { status: 400, title: error.message };
  if (error instanceof Conflict) {
    // A record others point to: the facts in the body, with the record's title as `record`.
    const facts = inUseFacts(error);
    if (facts) {
      const { title: record, ...rest } = facts;
      return { status: 409, title: conflict(error.message), more: { ...rest, record } };
    }
    return { status: 409, title: conflict(error.message) };
  }
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

/** A visitor without a key, or the key given (null: a key was given but is not valid). */
export function callerOf(request: Request): { viewer: Viewer | null; keyless: boolean } {
  const keyless = !request.headers.get("authorization");
  return { viewer: keyOf(request), keyless };
}

/** Runs one call as the key in the Authorization header, with its body when it has one. */
export function apiCall(
  request: Request,
  run: (viewer: Viewer, body: unknown) => Promise<unknown>,
  status = 200,
): Promise<Response> {
  return call(request, (viewer, body) => run(viewer as Viewer, body), status, false);
}

/**
 * Runs a call anyone may make (what public lets visitors read or add): without a key as the
 * visitor, through the same data functions; with a key as the key. A key that is not valid is
 * refused, never taken for a visitor.
 */
export function openApiCall(
  request: Request,
  run: (viewer: Viewer | null, body: unknown) => Promise<unknown>,
  status = 200,
): Promise<Response> {
  return call(request, run, status, true);
}

/**
 * Runs a call whose body is a file (a record's picture or document), read by `run` itself with
 * bytesOf; what `run` answers may be a Response of its own (the file, for a GET).
 */
export function fileCall(
  request: Request,
  run: (viewer: Viewer | null) => Promise<unknown>,
  open = false,
): Promise<Response> {
  return call(request, (viewer) => run(viewer), 200, open, true);
}

/** A file sent as the body, at most `max` bytes. */
export async function bytesOf(request: Request, max: number): Promise<Uint8Array> {
  const tooLarge = `The file is larger than ${max / 1_000_000} MB.`;
  if (Number(request.headers.get("content-length") ?? 0) > max) throw new BadInput(tooLarge);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > max) throw new BadInput(tooLarge);
  return bytes;
}

async function call(
  request: Request,
  run: (viewer: Viewer | null, body: unknown) => Promise<unknown>,
  status: number,
  open: boolean,
  raw = false,
): Promise<Response> {
  try {
    const { viewer, keyless } = callerOf(request);
    // A write without a key is held to a visitor's limit (10 a minute per address), as a
    // contact form is, whether it may add or not.
    if (!viewer && request.method !== "GET") writeAllowed(null, request.headers);
    if (!viewer && !(open && keyless))
      return problem(401, "A valid key is needed: Authorization: Bearer <key>.");
    const body =
      !raw && request.method !== "GET" && request.method !== "DELETE"
        ? await bodyOf(request)
        : undefined;
    const result = await run(viewer, body);
    if (result instanceof Response) return result;
    return result === undefined
      ? new Response(null, { status: 204 })
      : Response.json(result, { status });
  } catch (error) {
    const refused = refusalOf(error);
    if (refused) return problem(refused.status, refused.title, refused.more);
    throw error;
  }
}
