// Smithable app kit: who a request comes from, the same for every limit in the app.
import { getRequestIP } from "@tanstack/react-start/server";

/**
 * The visitor's address: behind a proxy that says who the visitor is (TRUST_PROXY=1, e.g. the
 * hosted service) the last hop of X-Forwarded-For, the one that proxy added; otherwise the
 * connection's own, since anyone could send a new X-Forwarded-For with every request. As in
 * server.mjs.
 */
export function visitorAddress(request: Request): string | undefined {
  return (
    (process.env.TRUST_PROXY === "1"
      ? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
      : undefined) || getRequestIP()
  );
}

/** The header Better Auth's own limits read the address from; set here, never by the visitor. */
export const ADDRESS_HEADER = "x-smithable-address";

/** The request with the visitor's address in ADDRESS_HEADER, whatever the visitor sent there. */
export function withAddress(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.set(ADDRESS_HEADER, visitorAddress(request) ?? "");
  return new Request(request, { headers });
}
