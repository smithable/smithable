// Smithable app kit: a link to an address that may be the app's own. A page of the app opens
// through the router (no new document, so nothing flashes white); anything else (another site,
// mailto:, tel:, a file) is an ordinary link.
import { Link } from "@tanstack/react-router";

export function AppLink({
  href,
  ...props
}: { href?: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  if (!href?.startsWith("/") || href.startsWith("//")) return <a href={href} {...props} />;
  const url = new URL(href, "http://app.invalid");
  return (
    <Link
      to={url.pathname as never}
      search={Object.fromEntries(url.searchParams) as never}
      hash={url.hash.slice(1) || undefined}
      {...props}
    />
  );
}
