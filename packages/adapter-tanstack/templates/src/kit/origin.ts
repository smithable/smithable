// Smithable app kit: the site's own address for a request, for links that leave the page
// (a sitemap, a picture in a shared link): the app's address (BETTER_AUTH_URL) when it is set,
// since a common proxy passes a visitor's own X-Forwarded-Host on; else, behind a proxy that says
// where the visitor came (TRUST_PROXY=1, as for the visitor's address), its forwarded host and
// scheme; else the request's own.
export function originOf(request: Request): string {
  const own = process.env.BETTER_AUTH_URL;
  if (own)
    try {
      return new URL(own).origin;
    } catch {}
  return requestOrigin(request);
}

// A host name of labels (none empty) or a bracketed address, and a port.
const HOST =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*|\[[0-9a-fA-F:]+\])(?::(\d{1,5}))?$/;

/**
 * The origin the request was made to: the proxy's forwarded host when the app trusts it and it is
 * a host, else the request's own; what originOf answers when the app's address is not set.
 */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  // The proxy's own value: the last of a list it added to.
  const last = (name: string) => request.headers.get(name)?.split(",").at(-1)?.trim();
  const forwardedHost = process.env.TRUST_PROXY === "1" ? last("x-forwarded-host") : undefined;
  const host = forwardedHost ? HOST.exec(forwardedHost) : null;
  const port = host?.[1] === undefined ? 1 : Number(host[1]);
  if (forwardedHost && host && port >= 1 && port <= 65535) {
    const said = last("x-forwarded-proto")?.toLowerCase();
    const proto = said === "http" || said === "https" ? said : url.protocol.replace(":", "");
    try {
      // As a browser writes an origin: lower case, without the scheme's own port.
      return new URL(`${proto}://${forwardedHost}`).origin;
    } catch {}
  }
  return url.origin;
}
