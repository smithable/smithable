// Smithable app kit: the production server (`pnpm start`, and the container). It serves the
// built files and the app, and gives every response the security headers and a cache rule (the
// hashed build files kept a year, pages never); pages also get a Content Security Policy from
// the root route (src/kit/security.ts).
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

const TRUST_PROXY = process.env.TRUST_PROXY === "1";

/**
 * A limit per address of `burst` changes, then one a second, for at most `size` addresses: one
 * idle long enough to be full again is forgotten first, then the one seen longest ago, so many
 * addresses cannot make the list grow without end.
 */
function rateLimiter(burst, size) {
  const buckets = new Map();
  return (address, now = Date.now() / 1000) => {
    const bucket = buckets.get(address) ?? { tokens: burst, at: now };
    bucket.tokens = Math.min(burst, bucket.tokens + (now - bucket.at));
    bucket.at = now;
    // The latest seen last, so the oldest are first in line to go.
    buckets.delete(address);
    buckets.set(address, bucket);
    if (buckets.size > size) {
      // Never the address being counted.
      for (const [key, b] of buckets)
        if (key !== address && b.tokens + (now - b.at) >= burst) buckets.delete(key);
      for (const key of buckets.keys()) {
        if (buckets.size <= size) break;
        if (key !== address) buckets.delete(key);
      }
    }
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  };
}
/**
 * Changes (anything but GET and HEAD) per address: a burst of 60, then one a second. Enough
 * for anyone using the app, and a brake on a script filling a public form.
 */
const limited = rateLimiter(60, 10_000);

function allowed(request) {
  if (request.method === "GET" || request.method === "HEAD") return true;
  // Only behind a proxy that says who the visitor is (TRUST_PROXY=1, e.g. the hosted service)
  // is X-Forwarded-For believed, and then only its last hop, the one that proxy added; anyone
  // else could send a new address with every request.
  const forwarded =
    TRUST_PROXY && request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return limited(forwarded || request.ip || "");
}

/**
 * The most a request may carry, 1 MB (a picture's limit too), and 10 MB for a document
 * (src/kit/uploads.ts FILE_MAX_BYTES) sent to a record: by its page before saving (POST /files/…)
 * or through the API (PUT /api/v1/…, whose JSON bodies the API itself holds to 1 MB). Told by
 * Content-Length before anything is read. A body without a length (sent in chunks) is refused,
 * so nothing unbounded is ever read into memory.
 */
const MAX_BODY = 1_000_000;
const MAX_UPLOAD = 10_000_000;
function maxBody(request) {
  const path = new URL(request.url).pathname;
  return (request.method === "POST" && path.startsWith("/files/")) ||
    (request.method === "PUT" && path.startsWith("/api/v1/"))
    ? MAX_UPLOAD
    : MAX_BODY;
}
function tooLarge(request) {
  if (request.method === "GET" || request.method === "HEAD" || !request.body) return undefined;
  const length = request.headers.get("content-length");
  if (length === null) return 411;
  return Number(length) > maxBody(request) ? 413 : undefined;
}

/** Whether the visitor came over https: the request's own scheme, or a trusted proxy's word. */
function overHttps(request) {
  if (new URL(request.url).protocol === "https:") return true;
  return (
    TRUST_PROXY && request.headers.get("x-forwarded-proto")?.split(",").at(-1)?.trim() === "https"
  );
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
          refused === 413
            ? `The request is larger than ${maxBody(request) / 1_000_000} MB.`
            : "Say the request's length.",
          // The body was not read: the connection closes, so no unread bytes meet the next request.
          { status: refused, headers: { ...HEADERS, Connection: "close" } },
        );
      const response = await next();
      for (const [name, value] of Object.entries(HEADERS))
        if (!response.headers.has(name)) response.headers.set(name, value);
      // Reached over https (or, behind a trusted proxy, its visitor was): the browser keeps to
      // https for this host for a year, so no later visit can be turned back to http.
      if (overHttps(request) && !response.headers.has("Strict-Transport-Security"))
        response.headers.set("Strict-Transport-Security", "max-age=31536000");
      if (!response.headers.has("Cache-Control")) {
        // The build's files have their content's hash in the name, so a browser keeps them a
        // year; a page (often a signed-in person's own) is asked for again every time.
        if (response.ok && new URL(request.url).pathname.startsWith("/assets/"))
          response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
        else if (response.headers.get("Content-Type")?.startsWith("text/html"))
          response.headers.set("Cache-Control", "no-store");
      }

      // Serve user uploads and static images with a sandbox CSP to mitigate stored XSS via SVGs
      const path = new URL(request.url).pathname;
      if (response.ok && (path.startsWith("/images/") || path.startsWith("/uploads/"))) {
        response.headers.set(
          "Content-Security-Policy",
          "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        );
      }

      return response;
    },
    staticMiddleware({ dir: new URL("./dist/client", import.meta.url).pathname }),
  ],
});
