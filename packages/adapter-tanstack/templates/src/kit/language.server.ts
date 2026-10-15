// Smithable app kit: the language of the request being answered (docs/design/languages.md §3),
// so a page rendered on the server, and a mail it sends, are in the page's language.
import { AsyncLocalStorage } from "node:async_hooks";
import { languageOf, type Offered } from "./language";
import { languageFrom } from "./words";

const store = new AsyncLocalStorage<string>();

/** Answers a request in its page's language. */
export function inLanguage<T>(
  request: Request,
  offered: Offered,
  run: () => Promise<T>,
): Promise<T> {
  const url = new URL(request.url);
  languageFrom(() => store.getStore() ?? offered.main);
  return store.run(languageOf(url.pathname, request.headers.get("cookie") ?? "", offered), run);
}
