# Logs: who did what, what the app did, and one id for a request

Status: 2026-10-04, proposed by Fable from Johan's requirements: access logs, app logs and audit logs; every create, change, delete and action linked to a person, with the client's details; everything written for one request carrying the same trace id; OpenTelemetry later. Nothing here adds to the spec: every app gets it, the same way, with nothing to configure. Section 7 lists what Johan decides.

## 1. What is logged today

- **In a generated app: almost nothing.** Three lines to the console: an unexpected database error, a mail that could not be sent for lack of mail settings, a picture that failed to load. No line per request, no record of who changed what, no id that connects anything. A record knows who created it (`owner`) and when it was created and last changed, and nothing else: not who changed it, not what was changed, not who deleted a record that is gone.
- **On the hosted service:** the front door (Caddy) writes an access log for published apps, a JSON file a day kept 90 days, without cookies or credentials. It knows the address and the answer's status, not the person or the role. The service has its own logs and the error reports testers choose to send.

So the three logs Johan asks for do not exist in the app, and nothing ties a line at the front door to what the app did.

## 2. One id for one request

- **The id:** every request gets a trace id when it arrives. If the caller or the front door already sent one (the `traceparent` header, the W3C standard that OpenTelemetry uses), the app continues it; otherwise it makes one in that same format.
- **Where it goes:** into every line the three logs write for that request, into the answer (a `traceparent` header, and "Reference: 4bf9…2f" on the app's error page, so a person can quote it), onto every mail and outgoing call the request causes (the outbox rows carry it and send it on), and into an error report.
- **How:** one small kit module holds the id for the duration of the request; the logs ask it. Generated and custom code never pass the id around by hand.
- **The front door** on the hosted service adds the header when a request has none, so its own access line and the app's lines share the id.

## 3. The three logs

All three are the app's own: they work the same self-hosted and hosted, and nothing depends on Smithable (rule 4).

### 3.1 Access log: every request

One line per request, as JSON on the app's standard output (where a container's logs are collected; no files inside the app): the time, the trace id, the method and path, the answer's status and how long it took, who asked (the user's id, a key's name, or "visitor"), their role, the client's address and browser, and the size of the answer. Not logged: cookies, keys, bodies, and the values in the address's query (a search may be a person's name); the query's names are.

### 3.2 App log: what the app says about itself

A kit function, `log.info`, `log.warn`, `log.error`, replaces the three console lines and is what custom code uses. Each line is JSON on the same output with the time, the level, the trace id, the user if there is one, a message and named values. An error carries its stack. The rule for what goes in: what happened, never a record's contents.

### 3.3 Audit log: who changed what

A table in the app's own database, written in the same transaction as the change: there is no change without its line, and no line for a change that did not happen.

- **A line says:** when; the trace id; who (the user, or the key by its name, or the incoming call by its name, or "the app" for a daily job); the role they acted with; the client's address and browser; what was done (created, changed, deleted, the action's name, or copied from which record); to which model and record, with the record's title at that moment (so a deleted record can still be named); and for a change, which fields changed.
- **Also audited, beyond records:** signing in and out, a failed sign-in, an invitation sent and accepted, a role changed, a user removed, a key or a secret made or revoked, an export of the data, the import of a file.
- **Old and new values are not stored** in the first version: only the names of the fields that changed. Values would put a second copy of personal data where deleting a record cannot reach it. A model can ask for them later (section 6).
- **Reading it:** the administrator's data page gets "Activity": the lines newest first, filtered by person, by record, by what was done and by time; a record's page shows its own history to those who may see everything about it (administrators at first). The table is part of the export, so leaving takes it along.
- **It cannot be edited** through the app: no page, operation, API or tool writes to it or deletes from it, and the generated access test proves that for every role.
- **Keeping:** the client's address and browser are blanked after 90 days (the access-log period); the line itself, who did what to which record, is kept 12 months and then removed by the daily job. Both periods are settings.

## 4. Linked to a person, always

"Who" is never empty. A person is their user; a program is the key it used, and the key's line in the audit log says which administrator made it; an incoming call is the call's name and its role; the app's own work (a daily job, a retry from the outbox) is "the app", with the trace id of the request that caused it when there was one. A visitor who may create a record without signing in (a contact form) is "visitor", with the client's details as the only identification, which is all there is.

## 5. What it needs elsewhere

- **The adapter and kit (A):** the trace module, the access line in the request path, `log`, the audit table with its migration and the writes in the generated data functions (create, update, delete, actions, copy) and in the sign-in and users code, the Activity view, the history on a record, the retention job, tests.
- **The hosted service (B):** the front door passing and adding `traceparent`; collecting each app's output and showing its owner the app and access lines of the last 90 days on the project page, searchable by trace id; the error report carrying the id; the service's own logs in the same shape; the data-flows and retention documents.
- **Integrations:** API keys, incoming and outgoing calls (docs/design/integrations.md) are written into these logs from their first version: they are built on top of this, so this comes first.

## 6. Later

- **OpenTelemetry.** The ids are already in its format. Later, when an address for a collector is set in the environment, the kit also sends each request as a span and the log lines as its events, with a small library added then and not before. The log sites do not change, because they all go through the kit's one module.
- **Values in the audit log** for a model that needs them (`audit: values` on the model): what a field was and became, with those lines deleted when the record's person asks to be forgotten.
- **Alerts** on the app log (an error rate), for the hosted service's alarms.

## 7. Decisions for Johan

1. **On in every app, nothing to switch off and nothing in the spec.** Recommended: a log that can be turned off is not there on the day it is needed.
2. **The audit log stores which fields changed, not their old and new values,** in the first version. Recommended, for the personal-data reason in 3.3; say if you want values from the start.
3. **Keeping:** client details 90 days, audit lines 12 months, both as settings. Recommended; these follow your earlier retention decisions.
4. **Order: this before the API.** The trace id and the audit line are what make a key's actions accountable, so the adapter builds logging first and the API on top. The core of the API step, which needs no logging, is being built now.
