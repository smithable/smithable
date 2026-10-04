// Smithable app kit: Better Auth's endpoints (sign-in callbacks, sessions, sign-out), each told
// the visitor's address for its limits.
import { createFileRoute } from "@tanstack/react-router";
import { withAddress } from "#/kit/address.server";
import { auth } from "#/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(withAddress(request)),
      POST: ({ request }) => auth.handler(withAddress(request)),
    },
  },
});
