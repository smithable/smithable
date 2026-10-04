// Smithable app kit: the app's start, where every request gets its trace id and access line
// (src/kit/trace.server.ts, docs/design/logging.md), and a server function answers only its
// own pages.
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { traced } from "#/kit/trace.server";

const trace = createMiddleware().server(({ request, next }) =>
  traced(
    request,
    // Behind a proxy that says who the visitor is (TRUST_PROXY=1), the hop it added; as in server.mjs.
    (process.env.TRUST_PROXY === "1"
      ? request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
      : undefined) || getRequestIP(),
    async () => (await next()).response,
  ),
);

/**
 * Server functions are what the app's own pages call, with the visitor's session. A call from
 * another site, a sibling app on the same domain included, is refused (403): the browser says
 * where a request comes from (Sec-Fetch-Site), and an older one names the page's address, which
 * must be this app's. The API and /mcp are not server functions: they take a key, not a session.
 */
const ownPages = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  // Behind a proxy the request arrives as http, so the address is compared by host.
  origin: (origin, { request }) => URL.parse(origin)?.host === request.headers.get("host"),
});

export const startInstance = createStart(() => ({ requestMiddleware: [trace, ownPages] }));
