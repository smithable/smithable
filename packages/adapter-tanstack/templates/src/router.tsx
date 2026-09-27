import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

/**
 * A new nonce for every server-rendered page: the Content Security Policy allows its scripts.
 * Base64, as CSP nonces usually are (a hex nonce's digit runs can look like card numbers).
 */
const ssrOptions = createIsomorphicFn().server(() => ({
  nonce: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))),
}));

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    ssr: ssrOptions(),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
