// Smithable app kit: one id for one request, and a line for every request (docs/design/
// logging.md §2 and §3.1). The id is in the W3C traceparent format that OpenTelemetry uses: a
// caller's or the front door's is continued, otherwise one is made. Code never passes it on by
// hand: the logs ask this module.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

interface Trace {
  traceId: string;
  spanId: string;
  /** Who the request is for, once known: a user's id or a key's name. */
  who?: string;
  role?: string;
}

const store = new AsyncLocalStorage<Trace>();
const TRACEPARENT = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/;
const hex = (bytes: number) => randomBytes(bytes).toString("hex");

/** The current request's trace id; undefined outside a request. */
export function traceId(): string | undefined {
  return store.getStore()?.traceId;
}

/** Who the current request is for, as far as known: the app log names them. */
export function traceWhoNow(): string | undefined {
  return store.getStore()?.who;
}

/** Says who the request is for (the viewer, a key), for the access line. */
export function traceWho(who: string, role?: string): void {
  const trace = store.getStore();
  if (trace) Object.assign(trace, { who, role });
}

/** The address and path as the access line keeps them: a query's names, never its values. */
export function loggedPath(url: URL): string {
  const names = [...new Set(url.searchParams.keys())];
  return names.length ? `${url.pathname}?${names.join("&")}` : url.pathname;
}

/**
 * Runs one request inside its trace, answers with its traceparent and writes its access line:
 * the time, the id, what was asked, the answer, who asked and from where. No cookies, keys,
 * bodies or query values.
 */
export async function traced(
  request: Request,
  address: string | undefined,
  run: () => Promise<Response>,
): Promise<Response> {
  const traceId = TRACEPARENT.exec(request.headers.get("traceparent") ?? "")?.[1] ?? hex(16);
  const trace: Trace = { traceId, spanId: hex(8) };
  const started = performance.now();
  let response = await store.run(trace, run);
  const traceparent = `00-${traceId}-${trace.spanId}-01`;
  try {
    response.headers.set("traceparent", traceparent);
  } catch {
    // A response whose headers are fixed (a redirect made by Response.redirect): copied.
    response = new Response(response.body, response);
    response.headers.set("traceparent", traceparent);
  }
  const line = {
    time: new Date().toISOString(),
    log: "access",
    trace: traceId,
    method: request.method,
    path: loggedPath(new URL(request.url)),
    status: response.status,
    ms: Math.round(performance.now() - started),
    who: trace.who ?? "visitor",
    ...(trace.role ? { role: trace.role } : {}),
    address,
    browser: request.headers.get("user-agent") ?? undefined,
    size: Number(response.headers.get("content-length")) || undefined,
  };
  process.stdout.write(`${JSON.stringify(line)}\n`);
  return response;
}
