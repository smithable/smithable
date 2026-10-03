# Talking to other systems: an API, incoming calls, outgoing calls

Status: 2026-10-04, proposed by Fable at Johan's request. ARCHITECTURE §2.1 says "integrations and external endpoints come later"; this is the proposal for them. Nothing here is built. It adds constructs to the spec, so merging this document is the go-ahead for step 1 only; each later step is confirmed when its turn comes. Section 8 lists what Johan decides.

## 1. Three directions, one set of rules

An app talks to other systems in three ways:

1. **An API.** Another program reads and writes the app's records over HTTPS, with a key.
2. **Incoming calls.** Another service tells the app that something happened (a monitor, a payment provider, a form on another site): a request to an address of the app, verified, turned into a record or an action.
3. **Outgoing calls.** The app tells another system that something happened in it, or asks it for something.

**The difference between 1 and 2 is who decides what the request looks like.** With the API, the caller is written for this app: it speaks the app's language (its models, its field names, its key) and can ask as well as tell. With an incoming call, the other service decides: a monitor, a payment provider or a code host sends its own format, signed its own way, when it chooses, and cannot be changed to suit the app; so the app has an address that understands that service. Whenever the sender can be configured (a script, an automation tool), the API is enough and direction 2 is not needed; it exists for senders that cannot. That is also why it comes last in the order: with an automation tool in between, the tool receives the service's call and uses the app's API.

The same rules hold for all three:

- **Access rules are never bypassed.** Whatever comes in acts with a role and goes through the generated data functions, like a person with that role. Nothing gets a way around `access`.
- **Secrets and addresses are never in the spec or the repository.** The spec names things (a key's purpose, a target called `statusFeed`); the key itself and the target's address and secret live where settings live: the environment for a self-hosted app, the project's settings on the hosted service.
- **Nothing depends on Smithable at run time** (rule 4). The generated app answers and calls by itself.
- **The spec stays free of technology** (rule 1). It says what the app offers and what it tells others; that the wire format is JSON over HTTPS is the adapter's business.

## 2. The API

```yaml
# smithable.yml
api:
  models: [Component, Incident]      # what it offers; nothing unless listed (all: every model)
  actions: [resolve]                 # standard actions it may run
```

- **What it offers:** for each listed model, list (with the list page's search, filters, sort; pages of at most 100), get one, create, change, delete; for each listed standard action, run it on a record. What a caller may actually do is decided by its role's access, exactly as in the app: a role that may not delete gets a refusal, a private model shows only what the role may read.
- **Keys:** a key is made in the running app by an administrator (the users page gets a "Keys" part): a name saying what it is for, a role, an optional end date. The key is shown once, stored only as a hash, can be revoked, and shows when it was last used. It is sent in the `Authorization` header. A key is not a person: records it creates have no owner, and what belongs to "the owner" it cannot do.
- **The address and the format** (the adapter's, said here so they are decided once): `/api/v1/<models>` and `/api/v1/<models>/<id>`, JSON with the spec's own field names, amounts as decimal texts and dates as ISO texts (the import's formats), a refusal as a JSON problem with the same message the app shows. A description of the whole API in the OpenAPI format at `/api/v1/openapi.json`, generated from the spec, so tools and agents can use the API without reading anything else.
- **Limits:** per key, the kit's limiter (60 requests a minute to start with), bodies up to 1 MB, no cookies and no browser access from other sites (it is for programs, not pages).
- **Renames are API changes.** With an API on, an operation that renames or removes a field or a model of a listed model says so in its confirmation ("the API's field `phone` becomes `mobile`"), as it says what data a removal loses.
- **Validation:** listed models and actions exist; an action listed is a standard one; a warning when a listed model has personal data ("anyone holding a key with a role that may read Customer reads email and phone").
- **Operations:** `setApi <model…>` (none turns it off), `setApiActions <action…>`.
- **Summary:** "Other programs can read and change components and incidents with a key, and resolve an incident."
- **Left out:** keys that belong to a person (a personal token acting as that user), fields left out per model, webhooks about changes (that is section 4), a GraphQL or other format.

The five questions (§2.4): common (the first thing a business asks of any tool: "can it talk to our other system"); deterministic (generated from models and access); it removes what would otherwise be a custom route written per model; neutral; and no free text could do it.

## 3. Incoming calls

```yaml
incoming:
  monitorDown:
    create: Incident
    set: { title: "{check.name} is not responding", status: investigating, detectedAt: NOW() }
    as: staff
  paymentReceived:
    custom: true                     # src/custom/incoming/payment-received.ts decides what happens
    as: staff
```

- **What it is:** a named address of the app, `/incoming/<name>`, that another service calls. Each has its own secret, made and shown once on the same "Keys" part, and a role it acts as (`as`).
- **Two forms:**
  - **`create: <Model>` with `set`:** one record per call. Values are literals, formulas (`NOW()`), or texts with `{path}` placeholders filled from the request's JSON (`{check.name}`), the template form the spec already uses for titles. A missing path is an empty text; a required field left empty refuses the call.
  - **`custom: true`:** Smithable verifies the caller and the format, then hands the parsed body to a file created once under `src/custom/incoming/`, which uses the data functions. For everything a template cannot say (find a record and change it, several records, an answer other than "received").
- **Verifying the caller:** by default the secret in the `Authorization` header. `signed: sha256` checks a signature of the body made with the secret instead (the form GitHub, and with small differences most providers, use), with the header's name as an option. A provider's own scheme (a timestamp inside the signature, a certificate) comes with that provider's plugin.
- **Twice is once:** a call carrying an id the app has seen in the last day (the `Idempotency-Key` header, or a field named by `id: "{event.id}"`) is answered as received and not acted on again. Services retry; the app must not make two incidents.
- **Access:** the created record goes through the model's create rule for the `as` role, with a warning in validation when that role may not create it. No owner, as for a key.
- **Operations:** `addIncoming <name> --create <Model> --set field=value… --as <role>`, `addIncoming <name> --custom --as <role>`, `removeIncoming <name>`.
- **Summary:** "When the monitor calls: adds an incident titled with the check's name, as staff."
- **Left out for now:** running an action on a record found by a field (`run: resolve, find: { reference: "{id}" }`), which is the next small step and what "a monitor's recovery resolves the incident" needs; several records from one call; answering with data.

## 4. Outgoing calls

Something happens in the app, and another system is told. The points already exist: the generated hooks after a record is created, changed or deleted, the daily jobs, and now the standard actions. What is missing is a way to say "tell them" without writing delivery by hand each time. Three kinds, as Johan put it: built in, from a plugin, custom.

### 4.1 Built in: tell an address

```yaml
outgoing:
  incidentOpened:
    when: Incident created                     # created | changed | deleted, or an action: "resolve"
    where: { status: [investigating, identified] }   # optional, the usual condition
    to: statusFeed                             # a name; its address and secret are settings
```

- **What is sent:** the record as the API would show it, with what happened and when, to the address set for `statusFeed`. Signed with that target's secret (the `signed: sha256` form above), so the receiver can check it came from the app.
- **Delivery:** the call is written to an outbox in the same transaction as the change and sent after it: the change never waits for, or fails because of, the other system. A failed delivery is retried with growing pauses for a day, then given up and shown. An administrator sees the last deliveries per target (when, what, the answer's status) and can send one again.
- **Where the address lives:** a setting named after the target: `OUTGOING_STATUSFEED_URL` and `OUTGOING_STATUSFEED_SECRET` in the environment for a self-hosted app; the project's "Connections" page on the hosted service. Without it the outbox keeps the calls and a release check says the target is not set.
- **Guard:** the app refuses addresses that point at itself or at private networks, so a wrong setting cannot make the app call the machine it runs on.
- **Mail the same way (step 4b):** `to: mail` with `recipient: owner | <role> | <email field>` and a text in the content file, through the mail outbox that already exists. "Send a confirmation when a booking is made" is the most common outgoing call of all, and today it is custom code.
- **Operations:** `addOutgoing <name> --when "Incident created" [--where field=value…] --to <target>`, `removeOutgoing <name>`.
- **Summary:** "When an incident is added that is investigating or identified: tells the status feed."

### 4.2 From a plugin: a named service

A plugin (ARCHITECTURE §5.1) may contribute a connection to one service: its key in the spec (`stripe:`, `slack:`), the settings it needs, the verification its incoming calls use, and a generator that writes ordinary code into the app, calling the service with its documented library or plain requests. It hooks onto the same points and uses the same outbox, so delivery, retries and the log are the app's, not each plugin's. The generated app does not depend on the plugin. The hosted service runs only vetted plugins. No such plugin is built before a real project needs one; the first is chosen by what testers ask for.

### 4.3 Custom: code

`src/custom/hooks.ts` is already there for anything else. The kit gains one function, `tell(target, body)`, which puts a call into the same outbox, so custom code gets signing, retries and the log without writing them; plain `fetch` stays available for what needs an answer at once.

## 5. Middleware

Two things are called that, and the answer differs.

- **Inside the app** (code that every request passes through: who is calling, how often, logging): no construct in the spec. It is technology, and the app must behave the same whoever generated it. In the generated app the API and incoming routes use the framework's own request middleware for the three things they share (the key or signature, the limiter, the access log line), calling small kit functions, as rule 4 asks. A place for a project's own middleware is added when a project needs one, not before.
- **Between systems** (automation tools such as n8n, Make or Zapier, which sit in the middle and connect services): this is the reason to do the general API and the general incoming and outgoing calls first. With those three and the OpenAPI description, an app can be wired to thousands of services through such a tool on the day it is published, without Smithable building any of those connections. n8n can be self-hosted in the EU, which fits the product. A listing in those tools' catalogues can come later; it is marketing, not engineering.

## 5b. For AI assistants: the same API as tools (MCP)

Not to be confused with Smithable's own MCP server, which changes the spec while someone builds. This is the running app offering its records and actions to an assistant ("which incidents are open?", "resolve the payments one").

- **What it is:** the API of section 2 offered a second way, as tools an assistant can call, at `/mcp` of the app. One tool per listed model and verb the role may use (find, read, add, change) and one per listed standard action, generated from the spec. The spec is unusually good material for this: a model's and an action's `intent` and `rules`, the field labels and the choice values become the tools' descriptions, so an assistant knows what "resolve" means without guessing.
- **What it costs:** little once the API exists. Same definitions, same keys, same access rules, same limiter; a thin layer and its tests.
- **What it must not do:** widen anything. It offers only what `api` lists. Deleting is not offered as a tool unless the spec says so (`api.assistants: { delete: true }`), because an assistant can be talked into things by the text it reads (a record's own content is such text): a key for an assistant should have a role that can do little harm, and the how-to says so.
- **Where it is switched on:** the spec says what is offered (`api.models`, `api.actions`); that it is also offered to assistants is one more line there, `api: { assistants: true }`. The protocol's name stays out of the spec, as REST's does.
- **Who the assistant is:** in the first version, a key with a role, as for any program. The better answer, an assistant that acts as the signed-in person and sees what they see, needs sign-in for programs (OAuth) on top of the email-code sign-in; that is the same later step as keys that belong to a person, and the two should be designed together.
- **When:** right after step 1, as step 1b. It is small, it is what people will try first with an AI assistant, and no builder of this kind offers it from the spec.

## 6. What this needs outside the engine

- **The hosted service (B):** a "Connections" page per project for target addresses and secrets, kept encrypted and handed to the app as settings at start; outgoing calls from published apps allowed to the internet but not to the host's own network; per-app limits on outgoing calls (as for mail); the access log covering API and incoming calls; the threat model and data-flows documents.
- **Terms:** outgoing calls send personal data to whoever the owner names; the DPA and the app owner's own responsibility need a sentence each.
- **Docs (C):** a how-to for each direction, and one for connecting an automation tool.

## 7. Steps

1. **Keys and the API** (core: `api`, operations, validation, summary; adapter: the routes, the keys part of the users page, OpenAPI, tests).
   - **1b. The same as tools for assistants** (section 5b).
2. **Outgoing, built in** (the outbox, signing, the deliveries view, settings; then mail as 4b).
3. **Incoming** (`create` with templates, and `custom`).
4. **Running an action from an incoming call; a plugin's connection**, each when someone needs it.

Exit for steps 1 to 3: the status starter, with no custom code, takes a monitor's "down" call as an incident, tells a chat channel through an automation tool when one opens, and lets a script read the open incidents with a key.

## 8. Decisions for Johan

1. **Keys belong to a role, made by an administrator in the app.** Recommended. The alternative, a key that acts as one person, is useful later for people's own scripts; it is not what connecting systems needs.
2. **Nothing is offered unless the spec lists it** (`api.models`). Recommended: an app must never grow an API by accident.
3. **Addresses and secrets are settings, never in the spec:** environment variables when self-hosted, a Connections page on the hosted service.
4. **The first built-in outgoing call is the general one (tell an address), then mail.** No connection to a named service is built in before the beta; automation tools cover those.
5. **The order in section 7.**
6. **The API also offered to AI assistants as tools (section 5b),** as step 1b, with a role-bound key first and acting as the signed-in person later. Recommended.
