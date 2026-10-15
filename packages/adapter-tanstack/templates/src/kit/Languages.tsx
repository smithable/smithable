// Smithable app kit: an app in several languages (docs/design/languages.md §3): each public
// page tells search engines of its other versions, and a switch goes to the same page in
// another language; on a signed-in page it keeps the choice and shows the page again.
import { OFFERED } from "#/generated/languages";
import { isPublic, LANGUAGE_COOKIE } from "./language";
import { language, w } from "./words";

/** A path in a language: the app's own has no prefix. */
const inLanguage = (code: string, path: string) =>
  code === OFFERED.main ? path : `/${code}${path === "/" ? "" : path}`;

/** A language's name in itself: "Svenska", "English". */
const nameOf = (code: string) => {
  const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
};

/** The page's other versions, for search engines: each language and the default. */
export function Alternates({ path }: { path: string }) {
  if (!isPublic(path, OFFERED)) return null;
  return (
    <>
      {[OFFERED.main, ...OFFERED.others].map((code) => (
        <link key={code} rel="alternate" hrefLang={code} href={inLanguage(code, path)} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={path} />
    </>
  );
}

/** The other languages, each a link to this page in it. */
export function LanguageSwitch({ path }: { path: string }) {
  const now = language();
  const others = [OFFERED.main, ...OFFERED.others].filter((code) => code !== now);
  const open = isPublic(path, OFFERED);
  return (
    <nav aria-label={w.language} data-kit="languages" className="px-5 py-3 text-right text-sm">
      {others.map((code) => (
        <a
          key={code}
          lang={code}
          hrefLang={code}
          href={open ? inLanguage(code, path) : path}
          onClick={() => {
            // A signed-in page keeps its address: the choice is the cookie's.
            document.cookie = `${LANGUAGE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
          }}
          className="ml-4 underline-offset-4 hover:underline"
        >
          {nameOf(code)}
        </a>
      ))}
    </nav>
  );
}
