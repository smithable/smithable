// Smithable app kit: the app's start, where every request gets its trace id and access line
// (src/kit/trace.server.ts, docs/design/logging.md).
import { createMiddleware, createStart } from "@tanstack/react-start";
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

export const startInstance = createStart(() => ({ requestMiddleware: [trace] }));
