# An app in another language

Design, 2026-10-06 (Fable). Johan: "making the app itself in a different language should work". The roadmap's principle (2026-10-03): language is data, never code and never database fields. Status: to build (steps in §6; the engine part is Fable's, the first language Swedish).

## 1. What is English in a Swedish app today

A maker who writes Swedish names and texts gets them back as written: labels, titles, choice values, the content file's words, the landing page's sections. Dates and numbers follow the reader's browser. What stays English is what the generated app brings by itself:

- the kit's words: about 220 strings in `src/kit/` (Save, Cancel, Delete, Search, New, Back, Newest first, Yes, No, the sign-in page, invitations, the users and keys pages, empty states, confirmations, the assistant's frame);
- about 400 strings the generator writes into the app's own files (validation messages, refusals, the API's problem titles, the sign-in and invitation mails, the robots and licences texts, `alt` texts);
- words derived from names: `plural()` adds an English s (`Kund` → `Kunds`) unless the content file gives `pluralLabel`; a phrase built around a name ("New customer", "No customers yet", "Add a customer") puts the name into an English sentence.

The Builder and Studio stay English: they are the maker's tool, and the maker reads the spec's summary in the language the spec is written in anyway.

## 2. The language is a fact about the visible text

`smithable.content.yml` gets one top-level key:

```yaml
smithableContent: 0.1
language: sv              # BCP 47; the default is en
```

It lives in the content file because it is about what people read, not what the app does: the spec, the IR, the columns and the routes do not change with it (rule 1 of the repository). It is one key, not a construct, so the five questions do not apply; the spec reference's content section documents it. A language the kit does not have is refused by validation with the ones it has.

Formatting follows the language for what the app writes (a date in a mail, a number in a sentence), and the reader's browser for what the browser renders (`Intl` with `undefined`), as today. The time zone and the currency are the app's, as today.

## 3. Words as files, one per language

- `templates/src/kit/words/en.ts` holds every word the kit and the generated files use, keyed, with the phrases that take a name as functions: `words.newRecord(label)`, `words.noneYet(pluralLabel)`. Nothing in the kit or in a generated file holds an English string any more; they say `w.save`.
- `words/sv.ts` is Swedish, the same keys, type-checked against `en.ts` so a missing key is a build error.
- The generator copies the app's language as `src/kit/words.ts` (and only that one), so an app carries one language and `w.save` is a plain import. A different language is a different file: byte-identical generation holds.
- A word with grammar in it (a plural, "a" or "an", "no … yet") is a function of the label, and each language's file writes the sentence its own way: Swedish has no article to choose and puts the count before the noun.
- The derived plural: `plural()` stays English, and a first build, or a maker, writes `pluralLabel` for a model whose name is not English; validation warns when the language is not `en` and a model has no `pluralLabel` ("Kund: the plural would be Kunds; give it a pluralLabel"), which is also what the Builder's rename form asks for.
- Mails: the kit's mail texts are words too; the subject and the body of the sign-in code and the invitation come from the file.
- The assistant: its frame from the file; its answers in the language of the question, as now, with the app's language told to the model as a hint.
- The API's problem titles are words too, so a Swedish app refuses in Swedish; the field names and the codes stay as they are.

## 4. How a language gets into the kit

A language is a file in the repository, reviewed by a reader of it, never generated at build time: the first time a model writes `sv.ts` from `en.ts` (one call, about 600 strings, under a euro), then a person corrects it and it is kept. The booking starter in Swedish is the check that it is complete: a test renders its pages and mails and fails on any English word from `en.ts` found in them.

A first build from a Swedish description sets `language: sv` before the model answers (the same short-word count that tells an English description apart, `packages/ai/src/language.ts`, now knows Swedish; `setLanguage sv` is the draft's first operation, applied by Smithable, and the prompt lists it as applied) and the model writes the labels, texts and `pluralLabel`s in Swedish; the reader without a model (`read-description.ts`) leaves it `en` and the maker sets it in Builder's Look tab or the content file. The plural warning sits on the model's entry in the content file when it has one, else on the `language` key.

## 5. What this is not

- Not translation of the maker's own texts between languages: an app has one language. `smithable.content.<locale>.yml` for several languages at once (ARCHITECTURE §12's note) is a later step on the same files, with the language chosen per reader.
- Not localisation of Studio or the Builder.
- Not language-aware name derivation: `humanize` and `kebab` stay as they are, and the content file carries what differs.

## 6. Steps

1. **Words out of the code** (engine, no visible change; the gate's byte-identity check is the proof): every string in the kit and the generator into `words/en.ts`, with the phrases as functions; `generate` copies it as `words.ts`. One pull request, large but mechanical.
2. **`language` in the content file** (core): the key, its check against the kit's languages, the `pluralLabel` warning, the spec reference and the schema, `setLanguage` as an operation (a form in the Look tab is A's).
3. **Swedish**: `sv.ts`, the booking starter's Swedish copy as a test app (`examples/booking-sv`? no: a test-apps variant that sets the language and the labels from a small file, so the starter itself stays English), the no-English check.
4. **First builds**: a Swedish description makes `setLanguage sv` the draft's first operation; the reader leaves `en`. Done 2026-10-06.
5. Later, each its own change: a second language when someone asks; several languages per app: [languages.md](languages.md) (2026-10-13).
