// Smithable app kit: the Content Security Policy of the production app's pages. The other
// security headers come from server.mjs, on every response. In development there are none,
// so the app can be previewed inside another page (an iframe) and the dev server works.

/**
 * A page's Content Security Policy: only the app's own scripts and those carrying this page's
 * nonce run. Inline style attributes are allowed (a chart's bars are sized with them); inline
 * style elements need the nonce.
 */
export function pageHeaders(
  nonce: string | undefined,
  /** A counter of visits' addresses (the app's analytics setting), added to the policy. */
  allow: { script?: string[]; connect?: string[]; img?: string[] } = {},
): Record<string, string> {
  if (!import.meta.env.PROD || !nonce) return {};
  const more = (list?: string[]) => (list?.length ? ` ${list.join(" ")}` : "");
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'${more(allow.script)}`,
      `style-src 'self' 'nonce-${nonce}'`,
      "style-src-attr 'unsafe-inline'",
      `img-src 'self' data:${more(allow.img)}`,
      "font-src 'self'",
      `connect-src 'self'${more(allow.connect)}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
}
