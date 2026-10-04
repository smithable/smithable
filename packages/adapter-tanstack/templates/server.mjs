// Smithable app kit: the production server (`pnpm start`, and the container). It serves the
// built files and the app, and gives every response the security headers; pages also get a
// Content Security Policy from the root route (src/kit/security.ts).
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import app from "./dist/server/server.js";

const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

/**
 * Changes (anything but GET and HEAD) per address: a burst of 60, then one a second. Enough
 * for anyone using the app, and a brake on a script filling a public form.
 */
const BURST = 60;
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const buckets = new Map();
function allowed(request) {
  if (request.method === "GET" || request.method === "HEAD") return true;
  // Only behind a proxy that says who the visitor is (TRUST_PROXY=1, e.g. the hosted service)
  // is X-Forwarded-For believed, and then only its last hop, the one that proxy added; anyone
  // else could send a new address with every request.
  const forwarded =
    TRUST_PROXY && request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const address = forwarded || request.ip || "";
  const now = Date.now() / 1000;
  const bucket = buckets.get(address) ?? { tokens: BURST, at: now };
  bucket.tokens = Math.min(BURST, bucket.tokens + (now - bucket.at));
  bucket.at = now;
  buckets.set(address, bucket);
  if (buckets.size > 10_000)
    for (const [key, b] of buckets) if (b.tokens >= BURST) buckets.delete(key);
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/**
 * The most a request may carry, 1 MB (a picture's limit too): told by Content-Length before
 * anything is read. A body without a length (sent in chunks) is refused, so nothing unbounded is
 * ever read into memory.
 */
const MAX_BODY = 1_000_000;
function tooLarge(request) {
  if (request.method === "GET" || request.method === "HEAD" || !request.body) return undefined;
  const length = request.headers.get("content-length");
  if (length === null) return 411;
  return Number(length) > MAX_BODY ? 413 : undefined;
}

serve({
  port: Number(process.env.PORT ?? 3000),
  gracefulShutdown: true,
  fetch: app.fetch,
  middleware: [
    async (request, next) => {
      if (!allowed(request))
        return new Response("Too many requests; try again in a moment.", {
          status: 429,
          headers: { "Retry-After": "5", ...HEADERS },
        });
      const refused = tooLarge(request);
      if (refused)
        return new Response(
          refused === 413 ? "The request is larger than 1 MB." : "Say the request's length.",
          { status: refused, headers: HEADERS },
        );
      const response = await next();
      for (const [name, value] of Object.entries(HEADERS))
        if (!response.headers.has(name)) response.headers.set(name, value);
      return response;
    },
    staticMiddleware({ dir: new URL("./dist/client", import.meta.url).pathname }),
  ],
});
