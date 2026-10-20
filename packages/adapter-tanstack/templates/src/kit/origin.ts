// Smithable app kit: the site's own address for a request, for links that leave the page
// (a sitemap, a picture in a shared link): behind a proxy that says where the visitor came
// (TRUST_PROXY=1, as for the visitor's address), its forwarded host and scheme; else the
// request's own, so nobody can put another site's address in the links by sending the headers.
export function originOf(request: Request): string {
  const url = new URL(request.url);
  // The proxy's own value: the last of a list it added to.
  const last = (name: string) => request.headers.get(name)?.split(",").at(-1)?.trim();
  const forwardedHost = process.env.TRUST_PROXY === "1" ? last("x-forwarded-host") : undefined;
  if (forwardedHost) {
    const said = last("x-forwarded-proto")?.toLowerCase();
    const proto = said === "http" || said === "https" ? said : url.protocol.replace(":", "");
    return `${proto}://${forwardedHost}`;
  }
  return url.origin;
}
