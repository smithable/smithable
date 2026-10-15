// Smithable app kit: the app's words, in the language the page is in (docs/design/languages.md
// §4). `w.save` reads the words of the language now; `words(language)` gives a language's
// words outright. The generator writes this file with the app's languages; in the kit's own
// sources it is English alone, so the kit type-checks and its tests run.
import { w as en } from "./words/en";

export type Words = typeof en;

const BY: Record<string, Words> = { en };
const MAIN = "en";

/** Where the language now comes from: the app's own until a page or a person says another. */
let now: () => string = () => MAIN;

/** Sets where the language now comes from (the root route, a request on the server). */
export function languageFrom(source: () => string): void {
  now = source;
}

/** A language's words, the app's own for one it does not have. */
export function words(language = now()): Words {
  return BY[language] ?? (BY[MAIN] as Words);
}

/** The words of the language now: `w.save`, as everywhere in the kit and the app. */
export const w: Words = new Proxy({} as Words, {
  get: (_, key) => words()[key as keyof Words],
});
