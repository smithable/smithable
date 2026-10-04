# Let other programs use your app

An app can offer its records to other programs: a monitoring tool that reports an outage, a spreadsheet that reads this month's invoices, an automation that resolves an incident. They call the app's API with a key. A key works with a role, like a person: it may do exactly what that role may, and nothing more.

This page uses the status starter, which offers its components and incidents and the **resolve** action. Every call below was made for real against a new status app, and the answers are shown as they came back (shortened where noted).

## 1. Say what the API offers

Nothing is offered until the app says so. The status starter already has this in `smithable.auth.yml`:

```yaml
api:
  models: [Component, Incident]
  actions: [resolve]
```

For your own app, the operation sets it:

```sh
smithable op setApi Component Incident --actions resolve
```

`setApi all` offers every model, also those added later (`--except` leaves some out), and `setApi` with nothing turns the API off. Offering a model is not giving it away: what a key may do with it is still its role's access.

## 2. Make a key

Keys are made in the running app, by an administrator, on the users page (the status starter's **Team** page): what the key is for, its role, and an optional end date. The key is shown once; copy it then.

![The Keys part of the team page: a key for "Uptime monitor" with the role Staff, shown once with a Copy button](api/keys.webp)

Give a key the smallest role that does the job. Here **Staff** may report and resolve incidents but not manage the team. A key owns nothing it creates, can never make keys or manage people (whatever its role), and stops working when it is revoked, when its end date passes, or when the administrator who made it is removed. Every key made or revoked is in the app's activity log, by name, never the key itself.

## 3. Call the API

Send the key in the `Authorization` header. The app at `https://status.example.com` stands for yours (in development, `http://localhost:3000`).

```sh
KEY=smk_…   # the key you copied
curl -s https://status.example.com/api/v1/components?limit=2 -H "Authorization: Bearer $KEY"
```

```json
{
  "items": [
    { "id": 3, "name": "Mobile app", "status": "operational", "description": "The app for iOS and Android.", "createdAt": "2026-10-04T06:53:17.287Z", "updatedAt": "2026-10-04T06:53:17.287Z" },
    { "id": 2, "name": "Payments", "status": "degraded", "description": "Card payments at checkout.", "createdAt": "2026-10-04T06:53:17.287Z", "updatedAt": "2026-10-04T06:53:17.287Z" }
  ],
  "page": 1,
  "pages": 2,
  "total": 3
}
```

The answers here leave out each record's lists (`incidents` on a component, `updates` on an incident), which the API gives as `null` for now. A list comes a page at a time: `limit` (at most 100) and `page`. Fields have the names they have in the spec; amounts come as decimal texts (`"12.50"`) and times as ISO texts in UTC.

**Report an incident** (a monitoring tool would do this):

```sh
curl -s -X POST https://status.example.com/api/v1/incidents \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"title": "Checkout is slow", "status": "investigating", "detectedAt": "2026-10-04T09:30:00Z", "component": 1}'
```

```json
{ "id": 3, "title": "Checkout is slow", "status": "investigating", "component": 1, "detectedAt": "2026-10-04T09:30:00.000Z", "resolvedAt": null, "summary": null, "createdAt": "…", "updatedAt": "…" }
```

It answers `201` with the new record. A reference (`component`) is the other record's id. `PATCH /api/v1/incidents/3` changes only the fields it is given, and `DELETE` removes the record, each as the key's role may.

**Run an action:** the same button a person presses, with the same checks.

```sh
curl -s -X POST https://status.example.com/api/v1/incidents/3/actions/resolve -H "Authorization: Bearer $KEY"
```

```json
{ "id": 3, "title": "Checkout is slow", "status": "resolved", "resolvedAt": "2026-10-04T06:54:25.856Z", "…": "…" }
```

### Without a key

What the app lets anyone read or add (`public` in `smithable.auth.yml`) can be called without a key, as a visitor. A status page that shows its incidents to everyone lets a program list and read them too: `curl -s https://status.example.com/api/v1/incidents`. Changing, deleting and actions always need a key, and so does everything when nothing is public. Without a key, the description at `/api/v1/openapi.json` and the tools at `/mcp` show only what a visitor may do.

## 4. When the app says no

A refusal is a JSON problem (`application/problem+json`) in the app's own words, with the HTTP status that fits:

| What happened | Status | The answer |
|---|---|---|
| No key for what needs one, or a revoked, expired or wrong key | 401 | `{"status": 401, "title": "A valid key is needed: Authorization: Bearer <key>."}` |
| Resolving an incident that is already resolved | 409 | `{"status": 409, "title": "This cannot be done now."}` |
| A field the record does not have | 400 | `{"status": 400, "title": "There is no field \"colour\" to set. Fields: title, status, component, detectedAt, resolvedAt, summary."}` |
| A value that does not fit (a missing title, an unknown status) | 422 | the fields and what is wrong with each, under `errors` |
| What the key's role may not do | 403 | `{"status": 403, "title": "You are not allowed to do this."}` |
| A record that is not there, or not one the key may read | 404 | `{"status": 404, "title": "No such incident, or not one this key may read."}` |
| More than 60 calls in a minute with one key | 429 | wait, and try again |

## 5. What the API looks like, for tools

`/api/v1/openapi.json` describes every path, field and refusal in the OpenAPI 3.1 format, and needs no key to read. Tools that understand OpenAPI (Postman, n8n's HTTP Request node, an AI agent) can read it to learn what the app offers. For the status starter its paths are:

```text
/api/v1/components
/api/v1/components/{id}
/api/v1/incidents
/api/v1/incidents/{id}
/api/v1/incidents/{id}/actions/resolve
```

## 6. For AI assistants

With `assistants: true` in the `api` block (the status starter has it), the same offer is also there as tools for AI assistants, at `/mcp` in the Model Context Protocol, with the same keys. Point an assistant that speaks MCP over HTTP (Claude, ChatGPT and others) at `https://status.example.com/mcp` with the header `Authorization: Bearer <key>`. Asked for its tools, the status app answers:

```text
find_components, read_component, add_component, change_component,
find_incidents, read_incident, add_incident, change_incident, resolve
```

There are no delete tools unless the auth file says `assistants: { delete: true }`. A refusal comes back as the tool's error, in the app's words, so the assistant can read it and try again:

```json
{ "content": [{ "type": "text", "text": "There is no tool \"listIncidents\"." }], "isError": true }
```

Each request carries one message (no batches), so every tool call counts toward the key's 60 a minute.

Each call is in the app's access log under the key (`key:<n>`) in place of a person, and every change it makes is in the activity log like anyone's.
