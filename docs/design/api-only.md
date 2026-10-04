# An app for programs and assistants (an app that is only an API)

Status: 2026-10-04, by Fable, from Johan's idea. Johan said yes to all four decisions (§9) the same day; nothing here is built yet.

## 1. What it is, and who wants it

An app whose users are programs and AI assistants. It has records with rules, reached through the API and the tools for assistants ([integrations.md](integrations.md) §2 and §5b). People use it only as administrators: who has access, the keys, the records, what happened. It has no landing page, no pictures and no pages for visitors.

Who asks for this:

- someone giving an assistant a place to keep things (tasks, notes, contacts) that outlives a conversation and that other assistants and people can read;
- a small system of record behind an automation tool or another site;
- the backend of a phone app someone builds elsewhere.

What Smithable gives them that a bare database does not: the rules (access by role, owners, validation, standard actions) written once in the spec and enforced for every caller; a description of the API and the tools generated from the same spec, with each model's and action's meaning in words an assistant can use; keys bound to roles; a log of who or which key changed what; backups. All of that exists today for apps with pages.

## 2. It is an app, not a mode

**Tried on main, 2026-10-04.** A project from the records starter, then six operations: close what is public, remove the two pages, `addUsersPage`, `addDataPage`, `setApi all --actions all --assistants true`. The result validates, generates and runs:

```yaml
# smithable.yml
pages:
  team: { route: /team, users: manage }
  admin: { data: all }
navigation: [team, admin]
```

```yaml
# smithable.auth.yml
api:
  models: all
  actions: all
  assistants: true
```

`/api/v1/items` refuses a call without a key, `/api/v1/openapi.json` describes the API, `/mcp` is there, and after sign-in an administrator has the team page with its keys and the data page.

So there is no `mode:` and no new keyword, and there should not be one:

- It would say nothing that the pages and the `api` block do not already say, and the spec would have two ways to say one thing (ARCHITECTURE §2.2, §2.4).
- An app for programs often grows a page later (a dashboard, a public status page). With no mode there is nothing to leave.
- One path through the generator, so everything tested for apps with pages holds for these.

"An app for programs" is then simply: models and actions, a users page, a data page and the `api` block. What a stranger may reach is said under `public`, as for any app, and is nothing unless said (§3.4).

In plain words: there is no setting that turns a project into "an API project", and no second kind of project. It is an ordinary Smithable app that happens to have no pages for visitors. Someone gets one by choosing the `api` starter or by describing it, and can add a page later without converting anything.

**Lists and forms for the records stay** (Johan's question). That is the data page ([data-page.md](data-page.md)): every model with its list, search and a form to create, open, change and delete, for administrators unless its `access` is widened, always through the models' own rules. With `data: all` a model added later is there without anyone naming it. A crud page for a model can still be added like in any app; the starter does not have one.

Where the rest of what an administrator needs lives:

| | Where |
|---|---|
| Who has access, invitations, roles | the users page |
| Keys for programs and assistants | the users page, "Keys" |
| Every model's records | the data page |
| Who or which key changed what | the data page, "Activity" |
| Backups, going back in time, logs | the host: the hosted service's project page, or `smithable backup` and `restore` |

## 3. What is missing

Found in the trial, in the order a person meets them.

### 3.1 Getting there

- **A starter**, `api`, so `smithable new --starter api` and the hosted form start from it (§4).
- **First builds** that recognise the kind (§5).
- **Removing a page that `public` names is refused** ("would make smithable.auth.yml invalid"), so turning an app with pages into this one takes knowing to run `setPublic` first. `removePage` should take the page out of `public.pages` as it takes it out of the menus, and say so in its confirmation.
- Small faults the trial hit, already with A: a model named `Item` with the API on does not type-check since #247; `setApi`'s confirmation does not say that assistants were switched on; the "PUBLIC" warning comment stays in the auth file after the block under it is emptied.

### 3.2 The first call

Today a newcomer has an API and nowhere that says how to call it. The users page's "Keys" part gets **"Using a key"**, shown under the list of keys and again in the dialog that shows a new key once:

- the API's address and the address of its description;
- one call to copy, for the app's first offered model, with the new key filled in while it is shown;
- for assistants, when the app offers tools: the tools' address and the few lines an assistant's settings need to connect, to copy;
- a button to download the description.

Generated from the spec like the description itself. No new page and nothing in the grammar.

### 3.3 The front door

- **`/` without visitor pages.** It redirects to the first menu page, which sends a signed-out visitor to sign-in. That is right for this app and stays: the sign-in page is its front door, and nothing is shown to someone who is not signed in.
- **Search engines.** A generated app answers 404 for `/robots.txt`. It should be generated from `public`: the public pages allowed, the rest not, and everything refused when nothing is public. This is its own small item for any app (in A's queue), and it settles the matter for this kind.

### 3.4 Without a key: the API for anyone (decision 3)

Johan, 2026-10-04: an API may be fully public if its maker wants that (opening hours, a catalogue, a status feed, open data).

Today every call needs a key, and `/api/v1/openapi.json` answers anyone with everything that is offered. Both are wrong in the same way: neither follows what the spec already says about who "anyone" is. The auth file has that: `public` lists what a visitor may read and add, with a `where` per model.

Proposed, one rule and no new grammar: **a call without a key is the visitor.**

- It may read the offered models that `public.read` lists, within their `where`, and add a record of the offered models that `public.create` lists. Everything else answers that a key is needed.
- So a fully public API is `api: { models: all }` with every model under `public.read`. A mixed one (the catalogue open, the orders behind keys) needs nothing more either.
- Nobody changes or deletes a record without a key, and no action runs without one. `public` has no way to say that, on purpose: a change needs someone to answer for it.
- The description follows the caller: without a key it describes what a visitor may reach, and nothing else exists as far as it tells; with a key, everything offered. An app with nothing public describes nothing to a stranger, which closes the leak of model and field names.
- **The tools for assistants always need a key** (Johan, 2026-10-04). Reading public records without a key is for plain calls only. A tool call costs the app no more than a plain one (the assistant's own model is paid by whoever runs it), but a tools connection is held open far longer than a single call, so it is the larger target for misuse, and nobody needs it open: an owner who wants a public catalogue reachable by assistants makes a key with a read-only role and hands it out. No setting for it until someone asks.
- Limits without a key are per address, with the kit's limiter, and stricter than a key's.
- Validation says it once when both are first true ("anyone can read tools and loans through the API without a key"), and the summary sentence says it. The warning for personal data in a public model already exists and covers this.

"Using a key" (§3.2) has the download button for the full description.

### 3.4b Who decides what an assistant may do

Johan's question, 2026-10-04. Three things, each already in the app, and none new for assistants:

- **What is offered at all** is the `api` block: the models, the standard actions, and `assistants: true`. Deleting is a tool only with `assistants: { delete: true }`.
- **What this assistant may do** is the role of its key. An administrator makes the key on the users page with a name, a role and an optional end date, and gives it to the assistant. The assistant gets a tool only for what that role may do, and a refusal in the app's words for the rest. The starter's `assistant` role is the example: it reads everything, adds and changes tasks and notes, deletes nothing.
- **Without a key** there are no tools at all (§3.4). What is public can be read without a key by plain calls only.

So permissions are chosen where they are chosen for people: by role, in the auth file, and by which role a key is given. An assistant acting as the signed-in person, with that person's rights, is the later step (§7).

### 3.5 Trying it as an assistant (decision 4)

[integrations.md](integrations.md) §5c put a test bench in Studio's Code mode, so that Builder would not have two boxes to type in. It is not built. Johan's proposal now is to have it on the administrator's pages of the app itself, which is the better home:

- It is one implementation in the app kit, and it serves development (the preview is the running app) and a published app alike.
- It is not beside Builder's box. It sits on the data page, as a part called "Try it as an assistant", next to "Activity", and exists only when the app offers tools.
- It is an inspector, not a chat: choose a role, type a question, and it shows which tools were called with what, what came back, and the answer. Nothing is remembered between questions.

Rules:

- **Administrators only**, whatever the data page's `access` says.
- **It acts as the chosen role**, never as the administrator, and gets exactly the tools a key of that role would get. Deleting is offered only when the spec says so, as for any assistant.
- **Text in records can steer an assistant.** The bench runs with the chosen role's rights for that reason, and its page says so in one line.
- **Every question is a line in Activity**: who asked, as which role; what its tools changed is logged like any change, with that role and "assistant test" as the origin.
- **The model comes from the host, by environment**, so generated code names no provider and depends on nothing of Smithable's (rule 4): an address, a key and a model name for a chat service that can call tools. Studio's preview gets the project's configured model; the hosted service sets its gateway, counted against the owner's allowance; someone hosting the app sets their own. Without them the part says what to set and is otherwise absent.

What stays for later, as §5c says: "ask your app" for every signed-in user, acting as that person. It needs sign-in for programs on behalf of a person.

## 4. The starter

`api`: **tasks and notes an assistant keeps**. It is the commonest reason to want this app, and small enough to read in a minute.

- Models: `Project`, `Task` (a status, a due date, who it is for), `Note`.
- Standard actions: complete and reopen a task.
- Roles: `admin`; `member` (people who work with the tasks and notes, through a data page of those two models opened to them); and `assistant`, the role keys for assistants get: it reads everything, adds and changes tasks and notes, and deletes nothing. The starter thereby shows the careful role integrations.md §5b asks for, and a first build copies it.
- Pages: `team` and `admin` only. Nothing public: an assistant's memory is private. The how-to shows the one line that opens a model to anyone.
- `api: { models: all, actions: all, assistants: true }`.
- Samples for every model, written as a person would. No pictures: no model has one and there is no landing page.

Made the way [starters.md](starters.md) says, from a sentence and through operations, with every hand edit named. Its checks differ in two places: the "looked at" pass covers sign-in, the team page with keys, the data page and the bench instead of a landing page; and its flow in `test-apps` is the app's purpose, so it makes a key in the browser, then with that key lists, adds, changes and runs an action, is refused what the role may not do, and reads the tools' list.

## 5. First builds

- `clarify` already picks a starter by what the app is. With `api` among them, "a backend for my habit app", "an API for our parts list" and "somewhere my assistant keeps tasks" choose it.
- Drafting from it adds no landing page and no crud pages, keeps `team` and `admin`, keeps the `api` block and the `assistant` role, and closes nothing that was not open. The pictures step already does nothing without a landing page.
- When someone asks for an app with pages and also says programs or an assistant will use it, the draft keeps its starter and adds the `api` block. That is a `setApi` in the draft, which exists.
- The benchmark's wide set gets two descriptions of this kind. The scorecard checks: no landing page, an `api` block, tools on when the description names an assistant, and a role other than `admin` for keys.

## 6. The hosted service

Little. The starter appears in the form. A published app of this kind shows its API address on the project page, beside the link to the app. Calls with a key are requests to a published app, so they count as use for the idle stop as any request does. Limits are the kit's per-key limiter.

## 7. Left out

- **A key made from the command line.** A key is made by an administrator in the app, one way, logged. Locally that means signing in once with the code, which without mail settings is written to the app's outbox folder instead of being sent. If making the starter shows this is the step people stumble on, `smithable run` printing a development key is the remedy to design then.
- **Keys that belong to a person**, and an assistant acting as the signed-in person: the later step of integrations.md §5b.
- **Leaving fields out of the API per model**, other formats, and change feeds beyond outgoing calls (integrations.md §4).
- **A page pattern for developers.** "Using a key" covers it without one.

## 8. Steps

1. Engine: `removePage` follows `public`; the small faults of §3.1; `robots.txt` from `public`. (A; each small.)
2. "Using a key" on the users page (§3.2), and the API without a key (§3.4) if decision 3 is yes: core says what a visitor is offered (`apiOffers` for no key), the adapter's routes, description and tools follow it. (Fable for core, A.)
3. First builds (§5): the draft rules, the two benchmark descriptions and the scorecard checks. (A, C.) This needs the starter's files, so it lands with step 4.
4. The `api` starter (§4), with its `test-apps` flow, samples and its entry on the Starters page. (A, C.)
5. "Try it as an assistant" (§3.5), if decision 4 is yes: the kit part, the environment settings, the preview's and the gateway's side. (A, B; the gateway's part is small since it already serves a chat model per project.)
6. A how-to on the docs site, "An app for programs and assistants": make it, make a key, the first call, connect an assistant, try it on the bench. (C.)

## 9. Decisions (Johan, 2026-10-04: yes to all four)

1. **No mode and no keyword:** an app with a users page, a data page and the `api` block is the app for programs. Recommended: yes.
2. **The starter is `api`, "tasks and notes an assistant keeps", with an `assistant` role**, and is made now rather than after the company website, since it shares nothing with it. Recommended: yes.
3. **A call without a key is the visitor** (§3.4): it reads and adds what `public` allows and nothing else, and the description shows a stranger only that. A fully public API is then every model under `public.read`; changing and deleting always need a key. This replaces both "every call needs a key" and "the description answers anyone", for every app. Recommended: yes.
4. **One test bench, on the administrator's data page of the app itself**, in place of the Code-mode panel of integrations.md §5c; in a published app it is on for administrators and counts against the owner's AI allowance. Recommended: yes.
