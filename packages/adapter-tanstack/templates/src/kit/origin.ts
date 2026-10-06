// Smithable app kit: the site's own address for a request, for links that leave the page
// (a sitemap, a picture in a shared link): the proxy's forwarded host and scheme when there is
// one, else the request's own.
export function originOf(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const url = new URL(request.url);
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
    return `${proto}://${forwardedHost}`;
  }
  return url.origin;
}
