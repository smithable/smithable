# The first build, second version: questions first, a better starting point, no silent fallback (design and plan)

Status: 2026-09-30, proposed by Fable after Johan's "a site to show my dogs" came out as the plain CRM. What happened (from the workspace's log): the demo guest's €0.05 allowance could not cover the reserved cost of one draft, the gateway answered 402 before any model call, `smithable new --describe` fell back to the CRM starter, and Studio said nothing. The two bugs are with Opus already (the allowance and the silent fallback). This is the rest: what the first build should do so that a short description becomes the right app.

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

`smithable new --describe` already prints the reason. The workspace start script writes it to `.smithable/first-build.txt` in the project, and Studio shows it once as a notice at the top of Builder ("The description could not be used: the demo's AI allowance is used up. This is the CRM starter; describe the changes you want below.") and deletes the file after showing it. The service logs the same line, so it can be seen without reading a container's log.

### 2.6 Cost and the demo

A clarify call is a few hundred tokens with the small model; the draft is as today. The demo allowance rises to cover one first build and a few changes (Opus's fix); the gateway reserves the draft at a realistic maximum rather than the model's hard cap.

## 3. Order of work

1. **Bugs first** (with Opus): the demo allowance and the reservation; the visible fallback (2.5).
2. **`clarify`** in `packages/ai` with tests against the fake model (`scripts/fake-model.mjs` learns the clarify shape), and the CLI's questions, `--answers` and `--yes`.
3. **The records starter**, its example texts, `test:apps` and the starter-choice test in `draft.test.ts` (the ten benchmark descriptions choose sensibly, with the fake model answering the starter names).
4. **Hosted:** the two-step form on the projects and demo pages, `ANSWERS` through the workspace, a test in `test/hosted.cjs`.
5. **Benchmark:** `scripts/bench-m12.mjs` runs the ten descriptions with questions answered by a fixed script (the fake answers), so the numbers stay comparable, plus a column for the starter chosen; a report next to the existing ones.
6. **Docs:** ARCHITECTURE §9 (the first build), `docs/ai.md`, the README's "describe" lines.

Steps 2 and 3 are the model-facing part; I'd do those. Steps 1, 4 and 6 suit Opus.

## 4. Out of scope

- Pictures uploaded during the first build (the articles design's picture fields come first).
- A conversation longer than one round of questions: one round covers the shape; everything after is a change in Builder.
- Choosing the theme from the description (the model may set a preset already).
