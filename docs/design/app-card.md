# The app card: one page that says what an app is (design)

Status: proposed 2026-11-07, Fable, from an outside review of 2026-10-11 the owner found
excellent (backlog Fable 25); build after Johan reads it: core and CLI first (§7). Second
reviewers' points taken the same day (the definition apart from project facts, the version hash,
facts per language, the walk over the schema, custom code as declarations only).

## 1. Today

A client asks "what does this app do with my data", an auditor "who can change what", a buyer
"what is generated and what was written by hand". The answers exist in pieces, mostly for the
maker: Studio's "What it does" (`summarize`, packages/index/src/summary.ts, English);
`smithable validate --explain` (`explainSpec`, the defaults the engine chose); `explainAccess`
(packages/core/src/explain-access.ts, one "why may X do Y" at a time, from `modelAccess`,
`pageAccess` and `actionAccess`); the assistant's one-line-per-model summary (assistant.md); the
privacy page (legal-page.md, `legalFacts`), for visitors, in the app's language; and the
sensitive-data warnings (`sensitiveKind`). None is one page a person outside the project can
read, keep and compare.

## 2. What people get

One page, the **app card**, written from the app's definition by the same functions the app is
generated from. Its sentences come from fixed rules: no model writes or rewords them, and nobody
edits the card. The labels and quoted texts in it are the project's, whoever wrote them.

- `smithable card` prints it (Markdown, HTML, or its facts as JSON), to send to a client or an
  auditor.
- Studio shows it in a Card view beside "What it does", with Download (Markdown, HTML).
- The app itself serves it to its administrators at `/app-card`, in each of the app's languages.

The **definition** (parts 1 to 8 below, from the spec files) is the same everywhere. The CLI and
Studio add **project facts** that only the project's folder knows (marked "From the project" in
§3); the served card never has them.

## 3. The card's content

Eight parts, in this order. Every sentence is a kit word filled with facts; every label is the
content file's (or a language file's). An empty part is left out, never padded.

1. **The app.** Its name and `app.description`, quoted as the maker's words. Its languages. The
   version: a short hash of the files it is written from (`smithable.yml`, the auth, ux, content
   and context files and the language files, in that order, with LF line endings) and the
   Smithable version that wrote it. From the project: the commit and its date ("with changes not
   yet committed" when those files differ from it; nothing when there is no Git), and the latest
   verification line (§5). One fixed line: "Written from the app's definition by Smithable. Not
   edited by hand."
2. **What it does.** One line per kind of record: its label, what it holds (the fields' labels
   with their kinds: text, date, amount, a choice of …, a reference to …, pictures, documents),
   what is required and unique. Then the pages by kind, the actions (what each does, on which
   records, when), the timers. Free-text `rules` are quoted, marked as the maker's words, as
   written (the language files do not hold them). The facts are `summarize`'s, moved to core (§4).
3. **What it stores about people.** The account: how people sign in (a mail code, Google), who
   may (invited only, allowed domains). Each kind of record with an email, phone or user field, as
   `legalFacts` finds them, and who may read it. Uploads. The kit's fixed records: the access log,
   the activity log and their retention (ARCHITECTURE §6.3). Then each field `sensitiveKind`
   flags, as a fact about its name: "The field Patient › Diagnosis has a name that looks like
   health data." No advice follows it.
4. **Who may see or change what.** A table: the roles (and visitors) down, the kinds of record
   across, each cell four verbs (read, add, change, delete), each verb allowed, denied, or allowed
   with its own condition in words: "own only" for read, change and delete, a `where` or `when`
   by `conditionText`. A role is one row; a person has one role. Then the pages each role may
   open, the actions each may run, and the kinds of record whose waiting files each approves
   (`review`). From `modelAccess`, `pageAccess` and `actionAccess`, the functions
   `explainAccess` and the generated checks use, so the table cannot differ from what those
   checks enforce. API keys: what `api` offers, and that a key does what its role may.
   Assistants at `/mcp`, and whether they may delete. When the app has custom code, one line:
   "Custom code runs with the access of the person who starts it; what it does is described in
   part 6 by its declarations only."
5. **What it talks to outside the app.** Mail: sign-in codes, each `outgoing` mail entry (when,
   to whom, which fields go, from `show`). Calls out: each entry, its event and which fields go.
   Calls in: each entry and the record it makes. The API. Analytics: the provider, with or
   without cookies. The app's own AI: whether Ask is on (`assistant` block), for which roles,
   reading or also changing; that the model, if any, is the one whoever runs the app sets, and
   that the card cannot say where that model runs. The models that help build the app: the
   context file's `ai.policy` in words ("only models on this machine", "only EU-hosted models",
   "the best model configured"). When the app has custom code or project plugins, one line: they
   may call services this card cannot see. A future spec section that talks outside (payments)
   adds its line here; the walk test (§5) makes sure it does.
6. **What is generated and what is custom.** One sentence on the stack (the context file's
   `adapter` and `database`, the one file allowed to name technologies). Generated and kit code,
   rewritten on each change. Then each custom part the spec declares: custom actions, with their
   contract in words when `touches` has one ("may read invoices and payments, write payments"; or
   "may reach anything the person running it may") and how many `examples` test them; custom
   pages and sections; custom queries; the hooks file; project plugins. The CLI and Studio add
   project facts: each custom file's path and size, the hook points it fills (export names, from
   the project index), generated files edited by hand (drift, ARCHITECTURE §6.5), the number of
   migrations, and how many changes a model proposed and a person confirmed (the `Smithable-AI`
   commit trailer). A `touches` contract is said as what it is: a fence the type check holds the
   code to, not a proof of what the code does.
7. **What the person running it is responsible for.** Facts of what the app does not do itself,
   each present only when the spec makes it true: the mail server's settings when the app sends
   mail; each incoming entry's secret; the assistant's model settings; the API keys, made and
   revoked by an administrator; the operator's details on the privacy page, or that the app has
   no privacy page while it stores personal details; backups of the database and uploads; the
   correctness of custom code, which Smithable type-checks and tests but does not write rules for.
8. **What this card is not.** One fixed sentence (§6).

## 4. Where it lives

- **Core: the facts.** `appCard(ir, auth, ux, content, context, language)` returns `CardFacts`:
  plain data with a `version` of its shape, no sentences, labels resolved for that language (a
  text a language file leaves empty falls back to the app's language, as in the app). Pure, so it
  runs in the browser too (rule 8). `summarize`'s facts move into core where the card needs them;
  the summary keeps its English sentences on top. Project facts are a second, optional argument
  the host fills.
- **One renderer, the kit's.** `src/kit/card.ts` turns facts and words into blocks (headings,
  lines, the table); it imports only `words/<language>.ts` and `formats.ts`. The adapter's build
  compiles those files for its own use, so `renderCard(facts)` gives the CLI and Studio the very
  sentences the app shows. Quoted texts are escaped for Markdown and HTML. A test renders each
  starter's card both ways and compares.
- **The CLI.** `smithable card [--format md|html|json] [--language <code>] [--out <file>]`;
  Markdown to standard output by default. HTML is one self-contained file, printable. JSON is the
  `CardFacts`, so two versions can be compared by a program.
- **Studio.** A Card view beside "What it does", in the app's language with a switch to the
  others, and Download (Markdown, HTML).
- **The generated app.** `src/generated/card.ts` holds one facts literal per language (as the
  privacy page's facts are), the kit's `AppCard` renders them, at `/app-card`, for the `admin`
  role only (it always exists), linked from the users page. Validation refuses a spec page at
  that route. The app depends on no Smithable package (rule 4): the facts are
  data and the renderer is a kit file. An app without sign-in has no served card. Why only
  administrators: the card shows every role, rule and field; for visitors the privacy page is
  the public face (open question 1).

No spec key is added. The card is derived, so ARCHITECTURE §2.4's questions do not arise. The one
candidate, an `about` text the owner writes in the content file, is refused. The card quotes the
maker's words only where the spec already holds them for a job of their own (`app.description`
for the summary and the privacy page, `rules` for the models, `hosting` on the privacy page).
A text whose only job is to make claims on the card would invite the claims §6 keeps out
("secure", "compliant"), and `app.description` and the privacy page's `operator` and `more`
already say what the app is for and who runs it (open question 2).

## 5. How it stays true

- **Regenerated, never stored by hand.** The served card is generated on every change like any
  page, so each revision's commit holds the card of that revision, and generation stays
  byte-identical (rule 6): it reads only the spec files, never Git or the clock.
- **The CLI and Studio make it on demand.** Smithable writes no card file into the project.
  A card sent with `--out` names its commit and date, so an old copy says it is old.
- **Two tests.** One walks the spec's JSON Schema (as what-it-does.md's walk does) and fails on a
  key the card neither shows nor lists in its allow-list of keys left out on purpose (the look,
  presentation-only texts), so a new section must take a side. The other renders each starter
  and a fixture with conditional access, custom parts and every integration: each model, field,
  role, page, action, timer and entry appears, and every cell agrees with `explainAccess`.
- **Custom code is described by what declares it**, never by reading its content: the spec's
  custom parts, their `touches` contracts and `examples`, and the project index's file paths and
  export names. No model reads custom code for the card.
- **The latest verification line** (change-verified.md §3.2), in part 1: the CLI and Studio card
  shows the kept result for the current revision, each check with its state ("Tests: not run"), or "No
  check is kept for this version". The served card does not: a result is per environment and
  would break byte-identical generation.

## 6. What it never says

- No security guarantee and no legal statement: never "secure", "compliant", "GDPR-ready" or a
  certification. The fixed last sentence: "This card describes how the app is defined. It is not
  a security review or legal advice."
- No advice: a sensitive-data finding is a fact about a field's name, worded as such.
- Nothing it cannot know: where the app is hosted (the operator's `hosting` text is quoted as
  theirs, marked so), whether settings are filled in, what custom code does beyond its contract.
- No record values and no counts of records: the card is about the definition, not the data.
- A sentence of its own that a model wrote or reworded.

## 7. Build order

1. **Core and CLI (Fable).** `CardFacts` and `appCard`; the facts `summarize` and `legalFacts`
   share, moved into core; the kit's `card.ts` and the `card*` words in `en.ts` and `sv.ts`;
   `renderCard` in the adapter; `smithable card` with its three formats; the starters' walk test;
   a paragraph on the card in ARCHITECTURE §6.3 (the kit) and §11 (the command).
2. **The generated page (A).** `src/generated/card.ts`, the kit's `AppCard`, the `/app-card`
   route for administrators, the users page's link; `kit-words.mjs` covers it.
3. **Studio (A).** The Card view, the language switch, Download.
4. **The docs page (C).** `docs/site/app-card.md`: what the card is for, a starter's card as the
   example, what it never says.

## 8. Open questions

1. Who reads the served card: administrators only (recommended), every signed-in person, or
   visitors too through a page kind like `legal: card` (which would need ARCHITECTURE §2.4's
   five questions)?
2. The owner's own `about` text on the card: refused here (§4). Agreed?
3. On the hosted service, should the card add what the service knows (where the data is stored,
   the backups' schedule)? Recommended: yes, later, as an appendix the service writes outside
   `CardFacts`, marked as the service's, so the definition stays pure.
