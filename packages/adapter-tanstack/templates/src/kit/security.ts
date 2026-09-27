// Smithable app kit: the Content Security Policy of the production app's pages. The other
// security headers come from server.mjs, on every response. In development there are none,
// so the app can be previewed inside another page (an iframe) and the dev server works.

/**
 * A page's Content Security Policy: only the app's own scripts and those carrying this page's
 * nonce run. Inline style attributes are allowed (a chart's bars are sized with them); inline
 * style elements need the nonce.
 */
export function pageHeaders(nonce: string | undefined): Record<string, string> {
  if (!import.meta.env.PROD || !nonce) return {};
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'nonce-${nonce}'`,
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
}
