# The first build, second version: questions first, a better starting point, no silent fallback (design and plan)

Status: 2026-09-30, proposed by Fable after Johan's "a site to show my dogs" came out as the plain CRM. What happened (from the workspace's log): the demo guest's allowance could not cover one draft, so no model was called, `smithable new --describe` fell back to the CRM starter, and Studio said nothing. The two bugs are with Opus already (the allowance and the silent fallback). This is the rest: what the first build should do so that a short description becomes the right app.

## 1. What people get

1. **Questions before the app**, when the description leaves them open: at most three, short, with suggested answers, such as "Who will use it: only you, your team, or anyone on the internet?", "Should visitors see the dogs without signing in?", "What should each dog's page show?". A description that is already clear gets no questions. The answers are added to the description and the draft follows.
2. **A starting point that fits.** The starter is chosen by the model in the same call as the questions, from short descriptions of every starter, not by counting shared words (which sent a bakery's inventory to the booking starter). A fourth starter, **records**, is the neutral one: a landing page and one model with a name, a picture, a text and a few fields, for the many apps that are "things and what we know about them" (dogs, tools, recipes, jobs, players).
3. **Never a silent fallback.** When no draft could be made, the person is told why, in plain words, before or in Studio, and gets the starter with the description kept for the change box ("Describe a change" already has it).
4. **The app's name and words follow the description**: the model already rewrites `app.name`, the description and the landing texts; the records starter's texts are written to be replaced, so nothing "Acme" survives.

## 2. How it works

### 2.1 One cheap call first: `clarify`

`packages/ai/src/draft.ts` gets `clarifyProject({ description, starters, providers })`: the description plus one paragraph per starter (its `app.description` and model names) go to the cheapest allowed model with a strict JSON answer:

```json
{ "starter": "records", "questions": [{ "question": "Who will use it?", "options": ["Only me", "My team", "Anyone on the internet"] }] }
```

`questions` has at most three entries, and is empty when the description says enough. Rules in the prompt: ask only what changes the app's shape (who uses it, what is public, what the main records are and what they hold), never about looks. The answer is validated; a bad answer means no questions and the word-overlap starter, as today, so nothing gets worse.

### 2.2 The draft, with the answers

`draftProject` takes `description` plus `answers: { question, answer }[]`, folded into the description as "Answers: …". Everything else in the drafting stays (the strongest model, errors back with diagnostics, the two repairs, optional files dropped, the person's confirmation).

### 2.3 Where the questions are asked

- **Command line:** `smithable new <dir> --describe "…"` prints the questions and reads the answers (a number picks a suggested answer; free text is fine; Enter skips one); `--yes` skips all questions and drafts with the description alone, as now, so scripts and the benchmark still run unattended. `--answers "a; b; c"` answers them without a prompt.
- **Hosted (smithable-cloud):** the projects page and the demo page keep one form, but "Create" first asks the service's `clarify` (through the gateway, charged like any call) and shows the questions on a second step of the same page, with the description shown above them; "Create" there makes the workspace with description and answers (`DESCRIBE` and `ANSWERS` to the workspace start script, which passes `--answers`). The warm pool is untouched: a described app never came from it.
- **Studio's first prompt** (Builder, an empty project) is the same two steps once Builder can create projects; not in this version.

### 2.4 The records starter

`examples/records/`: `Item` (name, a `picture` field once #13 lands, until then a `url` field for a picture link, a `markdown`/text `about`, `tags` as a choice, `addedOn` date), a landing page with hero and a records section of items, an `items` crud page, `defaultAccess: shared`, admins only for create, public read of items. Its texts are generic on purpose ("Our items", "What we keep track of"). Like every example it runs through `test:apps`, and `smithable new --starter records` works without a model.

### 2.5 The fallback, told

`smithable new --describe` already prints the reason. The workspace start script writes it to `data/.smithable/notice.txt` in the project (`data/` is never committed, so it never reaches a checkpoint), and Studio shows it once as a notice at the top of Builder ("The description could not be used: the demo's AI allowance is used up. This is the CRM starter; describe the changes you want below.") and deletes the file after showing it. The service logs the same line, so it can be seen without reading a container's log.

### 2.6 Cost and the demo

A clarify call is a few hundred tokens with the small model; the draft is as today.

### 2.7 To evaluate: the draft as operations rather than files

ARCHITECTURE §9 says the first draft is "expressed as a batch of operations"; the code has the model write whole files. Drafting through operations (what an AI agent does over MCP) cannot produce invalid syntax: every operation is validated as it is applied, and an error goes back naming that one operation. Judgment can still go wrong (the wrong models), but the grammar cannot, and my test without a starter (4 of 11 valid files, every failure a grammar slip) suggests that is most of what goes wrong. Step 3 below evaluates both on the ten descriptions with the same model: whole files as today, and a batch of operations answered against the constrained schema over every operation; the one that makes more valid and better apps stays.

### 2.8 A website as the starting point

`smithable new <dir> --from <url> [--content sample|full] [--with-pictures]` uses the existing first-build path with structured facts extracted from a website.

- **Reading.** A named user agent reads at most twelve pages, through depth two, within sixty seconds and eight MiB of aggregate response bodies. A page is at most two MiB. Only the starting host and its `www.` twin are eligible; HTTP may upgrade to HTTPS, but a downgrade, another port or another subdomain is refused. Every connection uses a checked public address. Every page, image and content redirect is checked against robots rules, including wildcards and terminal `$`; the longest applicable agent or wildcard rule wins and Allow wins a tie. A robots 4xx permits reading; 5xx, timeout or an unresolved robots redirect refuses it. Reading robots itself is a bounded protocol bootstrap with the same network guards.
- **Facts and structure.** The versioned bundle retains page addresses, fetch metadata and extraction evidence. The reader extracts business identity, services, products, contacts, opening hours, location, prices, navigation, calls to action and detected functions. Observed facts and inferred hints remain distinct. Conflicting business identities require clarification. Pages that require JavaScript can still yield too little; no browser is started to execute the site.
- **Personal details.** The default `sample` mode deterministically replaces detected people, street addresses, phone numbers and email addresses before model input. Business identity is retained only as the app name; shared context such as town, sector and opening days stays. A versioned table supplies labelled sample values. Persisted identities keep their ordinals; a newly detected collision selects another labelled stand-in for the affected identity. Original URLs, the detected set and its keyed mapping remain private comparison/transport material; model projections use opaque source references. Detection is structural and incomplete, not a guarantee of anonymization. Known detections are replaced throughout facts, metadata and generation/repair requests and checked again in generated text. Sample contact actions remain inert, including links built by contact components. A structured person-only source is insufficient for the sample business flow. When an unstructured title or site name consists only of a person-shaped name, it is insufficient too; it does not receive the business-name exception. A name with an explicit business word can retain that exception, including recognized Swedish trade words. Person-shaped titles contain two to four capitalized words. Telephone detection excludes numbers shorter than seven digits and recognized prices, dates and opening hours.
- **Full content.** On a local clone, `--content full` explicitly asks to bring in the source wording and personal values unchanged. It includes bounded source prose and disables personal replacement and the ten-word copy check. It grants no extra page, byte or image permission. When factual metadata is sparse, full mode can use substantive source text under the existing 25-word reading threshold. Hosted full-content generation is not enabled in this reader step; it still needs the later owner-instruction form and host integration. A generation parameter cannot authorize it. Explicit local programmatic inputs are the local owner's instruction, like the local CLI flag.
- **Generation.** In sample mode the draft receives bounded factual fields and structure, with unknown facts left unknown. Evidence and source prose are separate comparison material. Every value is untrusted data, never an instruction. The existing clarification, drafting, validation and generation machinery creates the app. Website builds start without invented sample records or active consequential integrations.
- **Wording.** In sample mode, before compilation, visible content and sample-data strings are compared against the complete visible source corpus after case, Unicode, whitespace and punctuation normalization. A match of ten consecutive words requests one fresh replacement from facts and its semantic location. A second match receives short neutral wording and a diagnostic. The source sentence is never supplied to the repair model.
- **Images.** At most sixty images retain textual context: source, file name, alt/title, caption, surrounding headings and paragraphs, parent, page, attribute dimensions and role. Optional `--interpret-site-images` uses the configured text provider to interpret unresolved metadata; it never sends image bytes. `--with-pictures` asks for permission before importing up to twenty JPEG, PNG or WebP originals, each at most one MiB and still within the aggregate reading budget. No new image-generation provider is added. Existing library imagery and placeholders fill appropriate illustrative roles; logos are handled separately.
- **Provenance and review.** Originals and library assets use separate paths under `public/images/`. `smithable.assets.json` records hashes, source, strategy, permission reference, licence and role. In sample mode an imported original’s source is an opaque handle; the raw address stays in private input. Full mode retains its source address. Existing placeholder manifests remain readable. Illustrations are labelled; factual photography and illustrations that could imply business features require review before public release. `review-assets` reports the exact assets and presentation digest; `review-assets --approve <digest>` records a local review. Changed bytes or presentation invalidate that approval. Hosted services own their approval records independently of project files.
- **Hosted input.** A host may fetch the bounded pages and call `read-page --bundle --facts` in a networkless reader. It installs validated private source input through `website-input --generation <id> --sha256 <digest>` on stdin. Generation requests carry the digest reference, not a filesystem path or source prose. The input is consumed before project build tools run and is not added to the project or its Git history. Content mode is checked against an installation receipt bound to the project, generation and input digest. Legacy inputs default to sample mode and receive the local replacement pass. `smithable.website.json` records only mode and sample metadata, never the private mapping or original values. Hosted authorization, retention and public-release decisions belong to the host.

Authenticated pages, executing source-site JavaScript, importing business records and generating new images are outside this path.

### 2.9 Before any model: a starter's own description, and small edits of it

Johan, 2026-10-05, after the first numbers on reading descriptions without a model. A visitor's first app should usually cost nothing.

- **Each starter has a description** that says what it is in plain words: the kind of app, what it keeps, who signs in, what anyone sees. The start page shows it in the box (a starter's button fills the box instead of building at once), so people see which words make which app.
- **Built unchanged, it is the starter:** no model, at once.
- **A small edit is read as a difference** between the two readings and made by operations: a known kind of record added (a model with a name and notes, and its page; the summary says to say what else it holds), a page taken out, closed to visitors, by invitation only.
- **Everything else is a new description** and goes to the model as before, with the reason kept: another subject (the starter's texts, samples and pictures would not fit a pilates studio), a word the reader cannot place (SMS reminders), something opened to visitors (a choice), another language, another kind of app.

Reading a whole free description without a model was measured first and is not good enough to build from: on 40 descriptions it had not seen, the reader settled 62 % of the decisions right, asked about 37 % and got 2 % wrong, and only a third of the descriptions needed no question (`scripts/bench-read.mjs`, `docs/benchmarks/read-blind.json`). Its use is here, on text that starts from our own words, and for saying what a description leaves open.

### 2.10 Two models for one draft: the cheap one first, the strong one when the checks say so; and the brief

Johan, 2026-10-16: the newest small model as the default and the newest strong one behind it, with the bench to confirm it (the comparison table in `docs/benchmarks/m12-model-comparison.md`); and two suggestions from a second opinion the same day, a cascade of models and a structured brief between the questions and the draft. What follows is how they fit what exists, as (a) the bench, (b) the cascade and (c) the brief.

**The bench (a).** The cheap model alone on the first set and the wide set, against the comparison table, as soon as the account has the models; its row is what (b) and (c) are measured against.

**Today.** `draftProjectByOperations` takes the providers the policy allows and tries the strongest first; a weaker one is tried only when the strong one fails outright. Each provider is one model, and the frontier setting names one. A draft gets four rounds of repair with the same model; what an essential operation still refuses after the last round fails the draft, an action or a formula field is dropped and named, and a valid draft's flaws for visitors go back once each.

**The cascade (b).** The order turns round: the cheap model drafts and repairs, and the strong one is called only when a check says the draft is not good enough. The checks are facts about the draft, never the model's own report of its confidence (a model's confidence is one more thing it can get wrong, and costs a question to ask):

1. **The draft failed**: nothing applied, an essential operation still refused after the last round, or the answer broken twice. Today this is the told fallback (§2.5); with a strong model behind, it goes there instead.
2. **Something was dropped**: an action, a capacity or a formula field named as left out after the last round. The cheap model saw what the description asked for and could not write it. Some of these no model can write (a formula the spec has no function for), so a drop buys the strong model one round, not four, and the bench counts the escalations that still end in a drop: if most do, this check goes.
3. **The draft does not cover the description.** The reader without a model (§2.9, `readDescription`) already lists the kinds of record a description names (`things`, as it names them) and what they hold (`fields`); a thing that no model of the draft matches by its name, singular or plural, is uncovered, and so is a named holding that no field carries. A check by rule, free, beside `visitorFlaws`. The reader's uncertain items (`maybe`: "SMS reminders") do not count: they were never a thing to build. Words can differ ("clients" drafted as `Customer`), so the match also reads the draft's own words (the models' and pages' labels and the landing texts, which usually keep the description's word), and an uncovered thing goes back to the cheap model first, as one more correction round ("The description names clients; the draft has no record for them: add one, or the field or record that holds them"); only a thing still uncovered after that escalates.

The strong model does not start over. It gets the description, the starter's shape and the cheap model's attempt as a correction round gets it: "Applied so far (do not repeat them)", what was refused or dropped with the reasons, and the uncovered things by name ("The description names invoices and payments; the draft has no record for them"), with the instruction to answer only with the operations that add or correct, a `removeModel` or `removeField` of a wrong one among them, never the app again. It gets the same rounds of repair (one after a drop, above); after it, today's ending (the fallback told, the drops named). What was right in the cheap draft stays. The cost: the cheap draft plus a strong round whose input is the strong draft's (the fixed instructions and the starter are most of it) and a few thousand tokens of applied operations, so an escalated build costs a little more than a strong draft and a build that stays costs the cheap one; the bench's "escalated" count says what the mix comes to. The uncovered-things check is worth showing on its own too, as a line on the draft the person confirms, whichever model made it.

Settings: `SMITHABLE_FRONTIER_MODEL` stays the model that drafts; `SMITHABLE_FRONTIER_MODEL_STRONG` names the one behind it, on the same provider (Bedrock or Claude Code). Unset, nothing changes: one model, as today. The policy covers both (an `eu.` profile each under `eu-only`); the hosted service sets the pair (its gateway, B 52). Rule 3 of CLAUDE.md is unchanged, only applied within the frontier tier as well: the cheapest capable model first, and a check, not a guess, decides when it was not capable.

Measured before it is the default: the bench with both set adds an "escalated" count to its report (by check, and how many still ended in a drop); the scorecard of the pair against the strong model alone and the cheap one alone on the 34 descriptions decides.

**The brief (c).** The suggestion: between the questions and the draft, a structured brief (the starter, the kind of business, the kinds of record, who signs in, the features), expanded by rule into the starter plus operations, then one small-model pass for the rest. Most of it exists in pieces: `clarify` picks the starter and asks what changes the shape; the reader settles the kind, the audience, what visitors see and the things named; §2.9's small edits are the expansion by rule (a thing becomes a model with a name and notes and its page; the audience becomes `setSignUp` and `setPublic`). The brief is those pieces written down as one thing the person can read:

```json
{ "starter": "records", "about": "a dog kennel", "records": [{ "name": "dogs", "holds": ["breed", "age", "picture"] }, { "name": "litters" }], "signIn": "team", "visitors": "read", "features": ["reminders by e-mail"] }
```

Its real worth is not the draft's quality but that **a person confirms it before anything is built**: the wizard in Studio (ask-in-studio.md) shows it as its last question, "I'll make an app for a dog kennel: dogs (breed, age, picture) and litters; you and the people you invite sign in; visitors see the dogs. Right?", with the records and holdings as chips to edit; the command line prints it under the questions and `--yes` accepts it. The draft then has the records named before the model writes, which is where today's drafts miss most (the table's row "drafts made only of the starter's models": a hair salon kept the yoga starter's classes). The model's pass after the expansion gets the brief and the whole description, not the brief alone: the records and the people are settled, and the actions, formulas and capacities come from the description as they do today.

Whether the brief also makes better drafts is a measurement, not an assumption: `scripts/bench-m12.mjs --brief` runs the 34 descriptions through the brief (filled by the reader where it can, else by the small model in the `clarify` call) and the expansion, then one pass for the fields, against the direct draft with the same model, on the scorecard (valid, models kept and added, actions, own words, flaws, cost, time). The expectation to test: fewer records missed and fewer own words and actions; if the actions are what is lost, the brief stays the confirmation step and the draft stays as it is.

Order: (a) first; then (b), since it is what the models change needs; (c) after the bench, as an experiment under the benchmark rule.

## 3. What is built

Built: `clarify` (the questions, `--answers`, `--yes`, the hosted two-step form), the records starter, the draft as a batch of operations, the visible fallback and the demo allowance fix, and the docs (ARCHITECTURE §9, `docs/ai.md`, the README). Since 2026-10-03 the draft by operations starts from the chosen starter's access default and gets the starter's spec as its example of shape (the first M12 run with the status starter showed the model drafting from scratch, private by default, with no operation to make a team's app shared; `setDefaultAccess` now exists). Open: the benchmark run with scripted answers and a starter column, the evaluation in 2.7, and 2.8's hosted form (the CLI's `new --from <url> [--with-pictures]` is built, 2026-10-02: robots.txt, the named agent, three same-site redirects, 2 MB and 15 s, a JavaScript-only page refused; pictures kept as the site serves them, JPEG, PNG or WebP up to 1 MB, since scaling and WebP encoding in Node would need a native library).

## 4. Out of scope

- Pictures uploaded during the first build (the articles design's picture fields come first).
- A conversation longer than one round of questions: one round covers the shape; everything after is a change in Builder.
- Choosing the theme from the description (the model may set a preset already).
