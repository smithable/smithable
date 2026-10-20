// Smithable app kit: the app's start, where every request gets its trace id and access line
// (src/kit/trace.server.ts, docs/design/logging.md), and a server function answers only its
// own pages.
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { visitorAddress } from "#/kit/address.server";
import { traced } from "#/kit/trace.server";

const trace = createMiddleware().server(({ request, next }) =>
  traced(request, visitorAddress(request), async () => (await next()).response),
);

/**
 * Server functions are what the app's own pages call, with the visitor's session. A call from
 * another site, a sibling app on the same domain included, is refused (403): the browser says
 * where a request comes from (Sec-Fetch-Site), and an older one names the page's address, which
 * must be this app's. A picture or document sent before its record is saved (POST /files/…, a
 * server route) is checked the same way. The API and /mcp are not: they take a key, not a session.
 */
const ownPages = createCsrfMiddleware({
  filter: (ctx) =>
    ctx.handlerType === "serverFn" ||
    (ctx.request.method === "POST" && ctx.pathname.startsWith("/files/")),
  // Behind a proxy the request arrives as http, so the address is compared by host; and a request
  // known to have come over https (its own address, or a trusted proxy's word) takes an https page.
  origin: (origin, { request }) => {
    const page = URL.parse(origin);
    const https =
      new URL(request.url).protocol === "https:" ||
      (process.env.TRUST_PROXY === "1" &&
        request.headers.get("x-forwarded-proto")?.split(",").at(-1)?.trim() === "https");
    return page?.host === request.headers.get("host") && (!https || page.protocol === "https:");
  },
});

export const startInstance = createStart(() => ({ requestMiddleware: [trace, ownPages] }));
