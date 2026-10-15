// Smithable app kit: which language a page is in (docs/design/languages.md §3). A public page's
// language is in its address (/sv/menu; the app's own has no prefix), a signed-in page's is the
// person's choice, kept in a cookie the switch sets. Nothing is guessed from the browser.

/** The cookie the language switch sets. */
export const LANGUAGE_COOKIE = "lang";

/** The app's languages and its public pages' addresses, as the generator writes them. */
export interface Offered {
  main: string;
  others: readonly string[];
  /** The public pages’ addresses, without a prefix: "/" or a route like "/menu" and below. */
  public: readonly string[];
}

/** The language a path names by its first segment, and the path without it. */
export function fromPath(pathname: string, offered: Offered): { language?: string; path: string } {
  const [, first = "", ...rest] = pathname.split("/");
  return offered.others.includes(first)
    ? { language: first, path: `/${rest.join("/")}` }
    : { path: pathname };
}

/** Whether a page is public: its address is one of the public pages’, or under one. */
export function isPublic(path: string, offered: Offered): boolean {
  return offered.public.some((p) =>
    p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`),
  );
}

/** The language a Cookie header (or document.cookie) chose, if it is one the app has. */
export function cookieLanguage(cookies: string, offered: Offered): string | undefined {
  const value = new RegExp(`(?:^|;\\s*)${LANGUAGE_COOKIE}=([^;]*)`).exec(cookies)?.[1];
  return value && offered.others.includes(value) ? value : undefined;
}

/** A page's language: a public page's by its address, another's by the cookie, else the app's own. */
export function languageOf(pathname: string, cookies: string, offered: Offered): string {
  const { language, path } = fromPath(pathname, offered);
  if (language) return language;
  if (isPublic(path, offered)) return offered.main;
  return cookieLanguage(cookies, offered) ?? offered.main;
}
