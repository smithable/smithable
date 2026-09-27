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

serve({
  port: Number(process.env.PORT ?? 3000),
  gracefulShutdown: true,
  fetch: app.fetch,
  middleware: [
    async (_request, next) => {
      const response = await next();
      for (const [name, value] of Object.entries(HEADERS))
        if (!response.headers.has(name)) response.headers.set(name, value);
      return response;
    },
    staticMiddleware({ dir: new URL("./dist/client", import.meta.url).pathname }),
  ],
});
