# An app in several languages (design)

Status: 2026-10-13, Fable, on Johan's brief: "I want it to be able to show everything in
Swedish", with the language in the path for search engines. `language.md` (2026-10-06, built)
made an app in one language: its `language` key chooses the kit's words, and the maker's texts
are as written. This note is that design's step 5: the same app in two or more languages, each
reader choosing theirs. A build for A after the support portal; merging this note is the
go-ahead for the keys.

## 1. What people get

- **A visitor** opens `/` and reads the app in its own language (English, say). `/sv/` is the
  same page in Swedish: the landing page's sections, the articles' frame, the menu, the contact
  form, the kit's words (Send, Search, Sold out). A switch in the header, "Svenska", goes to the
  same page in the other language. Search engines see both, each telling of the other, and
  nobody is redirected by their browser's language: the address says which.
- **A signed-in person** chooses a language once (the switch, or the language of the page they
  signed in from) and keeps it: every page, every dialog, the mails the app sends them. The
  address does not change for them: `/requests` is `/requests`, in their language.
- **The maker** writes the app's texts once, in the app's language, as today, then adds a
  language: `smithable op addLanguage sv` makes `smithable.content.sv.yml` with every text a person
  reads, to be filled in: the content file's own texts (page titles, landing sections, the
  assistant's greeting) and the ones the app derives from names (each model's label and
  plural, each field's label, choice values, action and menu labels), since "Credit limit"
  has no line in the content file and still wants to be "Kreditgräns". Studio's Languages view shows the two side by side, each empty line
  marked, and a model fills a first draft of them when one is configured (a hundred short texts;
  cents). What is left empty shows in the app's language and `smithable validate` says so.
- **Records are data** and stay as written: a dish named "Fish soup" is "Fish soup" on `/sv/`.
  A maker who wants a record's text in two languages gives the model two fields (`name`,
  `nameSv`); which one a page shows is a later key (§7).

## 2. The spec

```yaml
# smithable.content.yml
smithableContent: 0.1
language: en                 # the app's language, as today
languages: [sv, fi]          # NEW: the other languages it is offered in, each with its own file
pages:
  home:
    title: Harbour Kiosk
    landing:
      hero: { title: Fresh fish, every day, text: … }
```

```yaml
# smithable.content.sv.yml  (NEW: one per language in `languages`, the same keys)
smithableContent: 0.1
pages:
  home:
    title: Hamnkiosken
    landing:
      hero: { title: Färsk fisk, varje dag, text: … }
models:
  Dish: { label: Rätt, pluralLabel: Rätter }
```

- `languages` lists the other languages, each one the kit has words in (`en`, `sv` today;
  refused otherwise, with the list). The app's own `language` is not in it. `addLanguage <lang>`
  adds one and writes its file; `removeLanguage <lang>` takes both away (asked first).
- A language file may hold any key the content file may hold (the content reader checks the
  names against the spec, as it does for the content file), whether or not the content file
  has a line for it, since most texts are derived from names and have none; it holds no
  `language`, `languages` or `assistant.for`. The full list of texts a person reads is derived
  from the spec, one function for `addLanguage`, for the reader's fallback and for the
  warning: a text on that list the language file leaves empty or lacks is a warning
  (`text-untranslated`, with the count), and the app shows the app's language there.
- `setText` takes `--language sv` to write into a language file; `setLanguage` stays the app's
  own. Renaming a page, a model or a field follows into every language file.
- Why the content file: a translation is visible text and nothing else (rule 1). Why a file per
  language and not a second column per key: a translator gets one file, the app's language
  stays readable, and a language can be added or removed as a whole.
- The summary sentence: "The app is in English, and in Swedish and Finnish for those who
  choose them."

## 3. Where the language comes from

1. **Public pages: the path.** The app's language has no prefix (`/`, `/menu`, `/blog/x`); each
   other language has its code first (`/sv/`, `/sv/menu`, `/sv/blog/x`). `/sv/` is a real page,
   not a redirect: search engines index it, with `<link rel="alternate" hreflang="sv">` on each
   version naming the others and `x-default` naming the app's language, `<html lang>` right,
   and the sitemap listing every version. The browser's language never redirects (a crawler and
   a Swede in London both get what the address says); a later, optional line under the header
   may offer "Den här sidan finns på svenska".
2. **Signed-in pages: the person's choice.** No prefix: those pages are not indexed, and the
   links the app sends (a record's link in a mail, the API's) stay one address. The choice is
   kept with the person (a `language` on the kit's `users` table, beside their name; it is the
   kit's table, not a model of the maker's, so the roadmap's rule "language is data, never
   database fields of the app" holds) and, before sign-in, in a cookie the public switch sets.
   Signing in from `/sv/` keeps Swedish.
3. **Mails:** the sign-in code goes in the language of the page it was asked from; every later
   mail in the person's kept language; a mail to an address that is no user (a visitor's order
   confirmation) in the language of the page the record was made on, kept on the outbox entry.
4. **The assistant** answers in the language of the question, as today, with the person's
   language as the hint.
5. **Dates and numbers** in sentences the app writes follow the language, as today
   (`Intl` with the language; the browser's for what the browser renders).

## 4. New in the app, and where it comes from

| Part | New or reused |
|---|---|
| The kit's words by language at run time | new, mechanical: `generate` copies every listed language's file into `src/kit/words/` and `words.ts` becomes `words(language)`; the kit reads it from a context the root route sets (the path's prefix, else the person's choice, else the app's language). About 220 `w.x` uses in the kit become `w().x` or a hook; the ~400 strings the generator writes into the app's own files already take their words from the file, so they get a language argument |
| The maker's texts by language | new in the adapter, by the text (gettext's model, decided 2026-10-15): the generated code keeps its literals, and when the app has `languages` each text site is wrapped, `tx("Customers")`, through one helper in the generator (`textCode`), so a one-language app is byte-identical to today. `content.<lang>.gen.ts` is a map from the main text to the language's, built from `textsToTranslate` (path → main text) and the language file (path → translation); empty translations are left out, so `tx` falls back to the literal; a composed string wraps its label and the kit composes ("New customer"). The limit: the same main text has the same translation everywhere. When two paths share a text and the file gives them different words, the generator takes the path that sorts first and `validateContent` warns `text-shared`, naming both; a path-keyed `tx("Book", "models.Book.label")` at colliding sites only is a later line, when a tester hits it |
| The `/sv/` routes | new in the adapter: a route tree parameter `$lang` on the public routes only, validated against `languages`, 404 otherwise; the same page components |
| hreflang, `<html lang>`, the sitemap's versions | small additions to `rootRoute` and `sitemapRoute` |
| The switch | new, kit: in the public header and the signed-in menu (the person's own page); sets the cookie or the user's language |
| `users.language` | a migration the kit owns (like `name`); `smithable upgrade` adds it |
| Validation, operations, Studio's Languages view, the model's first draft of a file | core and Studio; the draft is `propose`'s machinery on one prompt ("translate these texts into Swedish, keep the keys") |
| First builds | a description in two languages ("på svenska och engelska") makes `addLanguage sv` the draft's second operation after `setLanguage`; the reader without a model asks |

## 5. ARCHITECTURE §2.4

1. **Common:** every public site in a country with two languages (Finland, Belgium, Switzerland,
   Canada) and every EU business with customers over a border.
2. **Deterministic:** files, keys, a path prefix, a fallback; no model, except the optional
   first draft of a translation, which is text the maker reviews.
3. **Less AI and ambiguity:** without it a model builds a second copy of every page or a
   translation table in custom code, and the kit's words stay English.
4. **Technology-neutral:** a language code, a file per language, a path prefix.
5. **Better than free text and custom code:** the words, the maker's texts, the routes, the
   mails and the search engine's view must agree on one language per page; only the engine can
   keep them so.

## 6. Steps (A, after the support portal; one pull request each)

1. The kit's words at run time: `words(language)` and the context, with the app's one language
   only (no visible change; the gate's byte-identity check is the proof).
2. `languages` and the language files in core: parsing, validation, `addLanguage`,
   `removeLanguage`, `setText --language`, renames following, the summary, the schema, the
   spec reference.
3. (Done, 2026-10-15.) The public routes with the prefix, hreflang, `<html lang>`, the sitemap, the switch, the
   cookie; a test-apps flow on the booking starter with a Swedish file: `/sv/` reads Swedish,
   `/` English, both in the sitemap, the alternates right.
4. (Done, 2026-10-15.) The person's language: `users.language`, the signed-in switch, the mails.
5. (Done, 2026-10-15.) Studio's Languages view and the model's first draft.
6. (Done, 2026-10-15, with a model.) First builds: a description that names two languages together ("på svenska och engelska") gets the other added last (addLanguage, its file to fill in or to draft with `smithable translate`). The reader without a model asking it is still to come.

Steps 1–3 are what a public site needs and are the bulk; 4–6 follow. Size: a week of A's pull
requests, none large.

## 7. Out of scope, for now

- **A record's text in several languages** (`name` and `nameSv` shown by language): a later
  key on a field, `translated: true`, that makes the form take one value per language and
  the page show the reader's; when a tester has a menu in two languages.
- **Studio and the Builder in Swedish:** the maker's tool stays English (language.md §5).
- **A language the kit has no words in:** one more file, reviewed by a reader of it, when
  someone asks (Finnish is the obvious next for Åland's neighbours).
- **Right-to-left languages:** nothing in the kit is written for them yet.

## 8. Smithable's own site and docs

smithable.ai and docs.smithable.ai are not generated apps: the landing is the service's own
page and the docs are built from Markdown. A Swedish smithable.ai is a content job on those
(a `/sv/` tree with the same hreflang rule), separate from this design, and worth doing only
when the public pages have settled. Building smithable.ai's public pages with Smithable itself
is the website starter's purpose (the backlog's "next starter": the company website built on
the hosted service); when that starter carries what the landing has today (the hero deck, the
starters' pages, metadata per path, the sitemap), the marketing pages can move to it and this
design is what gives them Swedish.
