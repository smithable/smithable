# Ask your app: an assistant in the app, and tools that cost few tokens

Status: 2026-10-04, by Fable, on Johan's go. Johan said yes to all six decisions (§11) the same day; nothing here is built yet.

Johan, 2026-10-04: "The MCP working solidly with as few tokens needed as possible is a key feature of Smithable. And this will be used both on the admin page and for potential end users."

This design has two parts that depend on each other. The first is the tools themselves, which every assistant uses: an outside one through `/mcp` with a key ([integrations.md](integrations.md) §5b), and the one inside the app. The second is that assistant inside the app, "Ask", for administrators and for the people who use the app. It replaces the test bench of [api-only.md](api-only.md) §3.5 and the "later" of integrations.md §5c: they are the same thing in two modes.

## 1. The principle: the model chooses, the app computes

An assistant is cheap and right when the model only decides what to ask the app, and the app does the finding, counting and adding up in the database and shows the result itself.

- A number is never worked out by a model reading rows. "How many items are there in region X" is one question to the database.
- A list is shown by the app as a list. The model does not copy it out.
- What the wording rules can read needs no model at all (§5).

Everything below follows from that.

## 2. Where the tokens go today

Measured on main on 2026-10-04, on the CRM starter with `api: { models: all, actions: all, assistants: true }` (tokens estimated at 3.6 characters each; the bench of §9 measures them properly):

| | Today |
|---|---|
| Tools for 2 models | 8 tools, about 910 tokens, sent with every request |
| Per model added | 4 tools, about 455 tokens |
| A ten-model app | about 4,500 tokens before a question is asked |
| `find_customers` | 100 whole records a page, about 7,900 tokens, no search, no filter, no total |
| "How many customers are enterprise?" | every page read, and the model counts |

The last line is the real problem. The tools can add, change and read one record, but they cannot answer a question about the records without handing all of them to the model.

## 3. The tools: a few, the same for every app

Seven tools whatever the app's size, and a short description of the app in place of a schema per model and verb.

| Tool | What it does |
|---|---|
| `find` | Records of one kind, with `where`, `search`, `sort`, the `fields` wanted, a `limit` (10 unless said, 50 at most) and the total |
| `measure` | A number from the database: count, or sum, average, smallest, largest of a number field; with `where`; optionally `by` a field or by month |
| `read` | One record with all its fields |
| `add` | Add a record |
| `change` | Change fields of a record |
| `run` | One of the app's standard actions on a record |
| `describe` | What a kind of record means: its fields' meanings, its rules, its actions; only when the summary is not enough |

Delete is an eighth tool only where the spec says so, as today (`api: { assistants: { delete: true } }`), and only for a key whose role may delete.

**Whether an outside assistant asks its user before deleting** (Johan's question, 2026-10-04) is that assistant's doing, not the app's: the app sees a tool call and cannot see whether a person approved it. What the app does:

- Each tool says what kind it is, in the protocol's own way: `find`, `measure`, `read` and `describe` are marked as reading only; `change`, `run` and `delete` as changing what exists; `add` as only adding. Assistants that ask their user before a risky call go by these marks.
- A delete needs both the line in the spec and a role that may delete, so an owner who wants an assistant that can never delete gives its key a role that cannot.
- Every delete is in Activity under the key's name, and the host's backups bring a record back.

"Ask" in the app never deletes, whatever the spec says (decision 4): there the app itself is the one asking the person, and a delete stays a thing done on the page.

**The app's summary** goes with the tools as the server's instructions. It is generated from the spec, one line per kind of record:

```
Acme CRM: customers and their orders.
Customer (customers): name*, email, phone, segment (small business | mid-market | enterprise), accountManager -> User, creditLimit money, notes. Title: name.
Order (orders): number*, customer -> Customer*, status (draft | confirmed | shipped | cancelled), total money, orderedOn date. Title: number.
Actions: markShipped (Order, when confirmed), cancel (Order, when draft or confirmed).
* required. You act as: sales.
```

It lists only what the caller's role may reach. A model's `description` and `intent`, a field's label and help text, and an action's rules are in `describe`, fetched when needed and not sent every time.

A choice field's `description`, when it is short (120 characters at most), follows its values in the line (`status (operational | degraded | down; down means unreachable; a degraded component is not down)`), so the model reads the app's words for the values before it filters on one; a longer one stays in `describe` (Fable 79). Under each read's result the panel says what was asked, in the app's words ("Components where status is down · 0 of 4"), with how the records split by the field when a filter on a choice found none, counted by the app; a row's title opens its record (Fable 78).

What this costs, for the same CRM:

| | Today | Proposed |
|---|---|---|
| Fixed | 0 | 7 tools, about 720 tokens |
| Per model | about 455 tokens | one line, about 45 tokens |
| Ten models | about 4,500 | about 1,200 |
| "How many customers are enterprise?" | pages of 7,900 tokens | `{"total":37}`, 3 tokens |
| "How many per segment?" | the same pages | one answer, about 26 tokens |

**What `where` can say.** The spec's own condition (integrations and actions use it already: a choice field's value or a list of them, a yes/no field), and three things a question needs: a number or date range (`{ "from": …, "to": … }`), a reference by id or by the referred record's title, and `mine` for the caller's own records. Text is `search`, which is the list page's search.

**What comes back.** Rows as `{ columns, rows, total }` (the keys once, not on every row), the id and the title always, other fields only when asked for, no empty values, a reference as its title and id. Ten rows of id, title and one field are about 100 tokens; today one record is about 80.

**Refusals** stay as they are: in the app's own words, so an assistant can explain them or correct itself. An unknown field in `where` answers with the fields that exist, which is cheaper than sending every schema up front.

**Why not keep a tool per model and verb.** Typed tools let a client check arguments before calling. The app checks them anyway, and says what is wrong. Against that, their cost grows with the app, and a client that loads many servers has the least room for exactly the apps that have the most to offer. The bench decides (§9): both forms on the same questions.

**Where it is built.** Core describes the tools and the summary from the spec, the auth file and a role (a pure function, framework-neutral, as `apiOffers` is). The adapter generates what runs them: `where`, `search`, `sort`, counting and adding up in each model's data module, behind the same access checks as every list. The plain API gets the same as query parameters, which is the list page's search, filters and sort that integrations.md §2 promised and A's backlog item 12 was to build.

## 4. The assistant in the app

One part of the app kit, in two modes.

**For the people who use the app: "Ask".** A button in the app's frame opens a panel: a field to type in, and under it the answer, shown by the app as a number, a short table, a record, or a link that opens the list page with the filter set. On a phone it is a sheet over the page.

- **It acts as the person asking.** The tools are called inside the app through the same data functions as the pages, with the signed-in person as the viewer. No key and no sign-in for programs is needed, and it can see and do exactly what the person can.
- **Reading by default.** Adding, changing and running an action are on only where the spec says so (§6), and each one is shown as a card in the app's own words ("Mark order 2026-014 as shipped") that the person confirms. Nothing is changed by a sentence alone. It never deletes.
- **It says what answered.** Johan, 2026-10-04: the panel states that answers may be provided by AI and that those answers can be wrong. So under the field, always: "Answers may come from an AI and can be wrong. Check what matters." And on each answer, which of the two it was: a number or a list the app worked out from the records is marked as that ("from your records"), and anything a model worded or chose is marked "AI". A person is never left thinking a sentence a model wrote is the app's own word. (The EU's AI rules ask for the same: people are told when they are dealing with an AI.)
- **One model call for a lookup.** The model answers with the tool call and a short caption; the app runs it and shows the result. There is no second call to have the model repeat what the app already shows. A second call happens only when the first result is needed to decide the next step.

**For administrators: the same panel on the data page, as an inspector.** It adds what api-only.md §3.5 asked for: a choice of role to act as (what a key of that role would get), and under each answer the tools that were called, with what, what came back, the tokens and the time. This is where an owner sees what an outside assistant will be able to do before handing out a key, and where we see what a question costs.

### 4.1 One set of tools, two ways in

Johan's question, 2026-10-04: does "Ask" use MCP?

It uses the same tools, not the protocol. The tools are one piece of generated code in the app. An outside assistant reaches them over `/mcp`; "Ask" calls them directly, inside the app's server.

| | An outside assistant | "Ask" in the app |
|---|---|---|
| The way in | `/mcp`, the Model Context Protocol | the app's own panel |
| Who it acts as | a key's role | the signed-in person (or the role chosen in the inspector) |
| Whose model reads the question | the assistant's own, paid by whoever runs it | the rules first, then the host's model |
| The tools, the summary, the access checks, the refusals | the same code | the same code |

So an improvement to a tool, or a token saved in a result, is made once and both get it. The inspector on the administrator's page therefore shows exactly what an outside assistant would get.

What differs is who understands the sentence. With an outside assistant the question never reaches the app: its model reads it and the app only sees tool calls. With "Ask" the app reads it, by the wording rules of §5 and then a model. The rules are the app's own and cost an outside assistant nothing either way.

## 5. Without a model: the wording rules

Builder reads most change requests with rules and no model. The same works for questions, and the spec gives the vocabulary: the kinds of record and their plural labels, the choice values, the field labels.

- "how many customers", "how many enterprise customers", "how many orders are shipped", "orders per status", "total of orders this month"
- "show the overdue invoices", "customers in Mariehamn", "my open tasks"
- "open Nordic Timber", "the order 2026-014"

Each becomes the same tool call a model would have made, and the app shows the result. It costs nothing, answers at once, and works with no model configured at all, which makes "Ask" useful in a self-hosted app from the first day.

A question the rules do not read goes to the model, if there is one and the person may use it.

## 6. Who gets it, and what it may do

```yaml
# smithable.auth.yml
assistant:
  for: [admin, staff]     # roles that get "Ask"; signed-in = everyone who signs in; anyone = visitors too
  may: read               # read (the default) | change: also add, change and run actions, each confirmed
```

- Without the block there is no "Ask" for the people who use the app. The administrator's inspector exists whenever the app offers tools to assistants or has this block.
- **Visitors** (`for: anyone`) get answers by the wording rules only, over what is public, and never a model. Their "Ask" only reads, whatever `may` says: a public contact form is the visitor's to send. That is the marketplace visitor asking how many items there are in a region: free for the owner, and nothing a stranger can run up. A model for visitors would be a cost anyone on the internet controls.
- It covers what the person may read and do in the app. It is not limited to the `api` block, which is about programs from outside.
- The operation is `setAssistant [roles…] [--may read|change]`; with nothing it is switched off. The summary says it in a sentence ("Staff can ask the app questions; it changes nothing").

The five questions (ARCHITECTURE §2.4): common (an assistant in an app is becoming the expected way in for people who do not learn the screens); deterministic (the tools, the summary and the rules are generated from the spec); it replaces what would be a custom integration per app; neutral (no model or provider is named); and no free text could say who may use it and whether it may change things.

## 7. What keeps it safe

- **Text in records can steer a model.** A record's content is read as data, and the assistant has only the rights of the person asking (or of the role chosen in the inspector). The worst a planted sentence can do is propose a change, which the person sees as a card and declines.
- **No tool reaches users, roles, keys or what is public.** Those stay on the administrator's pages.
- **Limits.** A number of model-answered questions per person per day and per app per month, set by the host. When they are used up, "Ask" answers by the rules only and says so. On the hosted service the cost counts against the owner's allowance.
- **What is logged.** A change made through the assistant is in Activity like any change, as the person, marked "through Ask". A question itself is counted (how many, which tools, the tokens) and its text is not stored. The inspector shows the administrator's own questions while the page is open.

## 8. The model, and voice

**The model comes from the host**, by environment, as api-only.md §3.5 says: an address, a key and a model name for a chat service that can call tools (`ASSISTANT_URL`, `ASSISTANT_KEY`, `ASSISTANT_MODEL`; the person asking in `X-Assistant-Person`). The generated app names no provider and depends on nothing of Smithable's. Studio's preview gets the project's configured model; the hosted service sets its gateway; someone hosting the app sets their own, or none.

- The summary and the tools are the same for everyone with the same role in one app, so they are sent as a cached prefix where the provider caches (C measured 85 to 88% of input read from the cache in first builds).
- Choosing a tool is a small job. Rule 3 asks for the cheapest model that can do it; the bench says which that is.

**Voice.**
- **In:** a phone's keyboard already has dictation, and it costs nothing and needs nothing built. A microphone button using the browser's own speech recognition is a setting that is off unless the owner turns it on, because in some browsers the sound goes to the browser's maker.
- **Out:** a button that reads the answer aloud with the browser's speech, which runs on the device.
- A speech service chosen by the host is a later setting, with its own address in the environment.

## 9. Measuring it

"Few tokens" is a number we keep, not an intention.

- **A bench**, `bench-ask`: about twenty-five questions per starter against the sample records, each with a checked answer (a number, the ids found, the record changed). Per model and per tool form: right or wrong, model calls per question, tokens in and out, cost, time, and how many the rules read without a model.
- **It compares** today's tool per model and verb with the seven tools, and Haiku 4.5, Mistral Small and Sonnet 4.6 as the model.
- **Targets to start from:** nine in ten right; one model call for a lookup; a ten-model app's tools and summary under 1,500 tokens; a count answered in under 50 tokens of result.
- **In the gate:** a unit test holds the size of each starter's tools and summary under a budget, so a change that makes them heavier fails before it merges.

## 10. Steps

1. **Core:** the tools and the summary described from the spec, the auth file and a role; `where` as the condition grammar with ranges, references and `mine`. (Fable. Built 2026-10-04: `assistantOffer` in `packages/core/src/assistant.ts`. Measured on the six starters, as an administrator inside the app: 6 or 7 tools of about 860 to 1,040 tokens whatever the number of models, and a summary of about 60 to 250 tokens; booking with six models is about 1,150 in all.)
2. **Adapter:** `where`, `search`, `sort`, counting and adding up in the data modules; the seven tools at `/mcp` and the same as query parameters on the API. This is backlog item 12, reshaped. (A, core parts reviewed by Fable.) (Built 2026-10-05.)
3. **The bench** of §9, on the tools alone through `/mcp`, before any panel exists: it settles decision 1 with numbers. (C.) (Run 2026-10-04 and 05 on the six starters, 130 questions on the old tools and the same plus four deletes on the seven: Sonnet 4.6 130/130 then 134/134, Haiku 4.5 124/130 then 131/134, Mistral Small 105/130 then 119/134; tokens in per question down 21, 24 and 32 %; a tool's result about 50 tokens where it was 650; no answer wrong any more because a model added up rows itself. The first run on the seven tools was a few answers short: names matched exactly, a search wanted the whole phrase, computed fields could not be measured, a largest value did not say whose it was, and a sum per client gave ids. Each was a gap in a tool, closed before the tools merged.)
4. **The wording rules for questions**, a pure function from a sentence and the spec to a tool call. (Fable.)
5. **The kit's panel:** the rules first, then the model's tool loop, the results shown by the app, the confirmation cards. As the administrator's inspector first, since that needs no new grammar. (A.) (The inspector: built 2026-10-05, the data page's `ask` when the app offers tools to assistants; a change is shown and never run there, the confirmation cards come with "Ask" in step 6. The host's model comes as `ASSISTANT_URL`, `_KEY` and `_MODEL`, neutral names since a generated app names nothing of Smithable's.)
6. **The `assistant` block** and `setAssistant`, and "Ask" for the people who use the app. (Fable for core, A.) (The block, `setAssistant`, the summary sentence and `asksWith` in core: built 2026-10-04. Inside the app the offer only reads unless the block says `may: change`.) (Ask for the app's people, reading: built 2026-10-05: the Ask button and sheet for the roles the block names, answered as the person, visitors by the rules only. The confirmation cards for `may: change` are next.)
7. **The service:** the model's address for previews and published apps, the limits, the counts on the usage page. (B.)
8. **Voice:** the read-aloud button, then the microphone setting. (A.)
9. **Answers grounded in the tools** ([ask-checks.md](ask-checks.md), 2026-10-14): tools that say why a result is empty and show their ties and lists, and a check of the answer against what the tools returned, with a retry and the cascade escalating on it. (A, B; C measures.) (The read-aloud button: built 2026-10-05 on the inspector's answers, the browser's own speech, the words, numbers and first rows of an answer.)

## 11. Decisions (Johan, 2026-10-04: yes to all six)

1. **Seven tools and a summary of the app replace a tool per model and verb**, for outside assistants and for "Ask" alike, if the bench shows fewer tokens with answers at least as often right. Recommended: yes. **Settled 2026-10-05: it does, for every model tried (step 3); the seven tools are what `/mcp` serves.**
2. **The `assistant` block in the auth file**: who gets "Ask" and whether it may change things; off unless written; reading only unless `may: change`. Recommended: yes.
3. **Visitors get answers by the wording rules only, never a model.** Recommended: yes.
4. **A change through "Ask" is always confirmed by the person in the app, and it never deletes.** Recommended: yes.
5. **Voice:** the device's own dictation and a read-aloud button first; the browser's speech recognition as a setting that is off by default; a speech service later. Recommended: yes.
6. **A question's text is not stored;** what it changed is logged as the person, marked "through Ask". Recommended: yes.
