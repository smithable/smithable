// Smithable app kit: the language of the request being answered (docs/design/languages.md §3),
// so a page rendered on the server, and a mail it sends, are in the page's language.
import { AsyncLocalStorage } from "node:async_hooks";
import {
  cookieLanguage,
  fromPath,
  isPublic,
  LANGUAGE_COOKIE,
  languageOf,
  type Offered,
} from "./language";
import { languageFrom } from "./words";

const store = new AsyncLocalStorage<string>();

/**
 * Answers a request in its page's language. A signed-in page with no choice in its cookie (a
 * new browser) takes the person's own, `personal`, and the cookie is set to it, so the page
 * the browser takes over is in the same language.
 */
export async function inLanguage(
  request: Request,
  offered: Offered,
  run: () => Promise<Response>,
  personal?: () => Promise<string | null | undefined>,
): Promise<Response> {
  languageFrom(() => store.getStore() ?? offered.main);
  const { pathname } = new URL(request.url);
  const cookies = request.headers.get("cookie") ?? "";
  const { language, path } = fromPath(pathname, offered);
  const own =
    !language && !isPublic(path, offered) && !cookieLanguage(cookies, offered) && personal
      ? await personal().catch(() => undefined)
      : undefined;
  if (!own || !offered.others.includes(own))
    return store.run(languageOf(pathname, cookies, offered), run);
  const response = await store.run(own, run);
  try {
    response.headers.append(
      "Set-Cookie",
      `${LANGUAGE_COOKIE}=${own}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  } catch {
    // A response whose headers are fixed (a redirect made elsewhere) keeps them.
  }
  return response;
}

/** Does `make` in a language: a mail to a person, in theirs. */
export function speaking<T>(language: string, make: () => T): T {
  return store.run(language, make);
}
