# Another service with a key

A service that calls the app's API can read records, add and change them, and run the app's actions: an automation in Make, Zapier or n8n, a spreadsheet script, a monitoring tool. It does this with a key the app gives it. The key has a role, like a person, and may do exactly what that role may.

This page uses the status starter: a monitoring service reports an outage as an incident. [The API](../api.md) has every call and answer in full.

## 1. What the app gets

- An incident appears when the service reports one, as if someone on the team had added it.
- The service can read the components and incidents, and resolve an incident with the same button a person presses, with the same checks.
- The service can't do what the key's role may not do, and can never make keys or manage people.

## 2. The lines in the spec

The API offers nothing until the app says what it offers, in `smithable.auth.yml`:

```yaml
api:
  models: [Component, Incident]
  actions: [resolve]
```

For your own app, the operation sets it: `smithable op setApi Component Incident --actions resolve`. Who may do what is still the roles' access, as for people.

## 3. The key

An administrator makes the key in the running app, on the users page (the status starter's **Team** page):

1. Under **Keys**, give the key a name that says who uses it, such as "Uptime monitor".
2. Choose the smallest role that does the job: here **Staff**, which may report and resolve incidents but not manage the team.
3. Give it an end date if the service is only for a while.
4. Copy the key when it is shown. It is shown only once.

This works the same on smithable.ai and on your own server. Revoking the key on the same page stops it.

## 4. On the service's side

Every call sends the key in a header: `Authorization`, with the word `Bearer`, a space, then the key.

- **Make:** an **HTTP → Make a request** module, the header under **Headers**, and for a new record **Body type** Raw with **Content type** JSON.
- **Zapier:** **Webhooks by Zapier** (a premium app, on Zapier's paid plans), with **GET**, **POST** or **Custom Request**, and the header under **Headers**.
- **n8n:** an **HTTP Request** node, with the header under **Headers** or as a **Header Auth** credential.
- **A monitoring tool:** most have a "webhook" or "custom HTTP" alert, where you give the address, the method, the header and the body.

The app describes its whole API at `https://status.example.com/api/v1/openapi.json`, in the OpenAPI format, and reading it needs no key. A tool that reads OpenAPI learns from it which addresses and fields there are.

To report an incident, the call is a `POST` to `https://status.example.com/api/v1/incidents` with the incident as JSON:

```json
{ "title": "Checkout is slow", "status": "investigating", "detectedAt": "2026-10-04T09:30:00Z", "component": 1 }
```

A reference, such as `component`, is the other record's id. Make the JSON with the tool's own JSON step where it has one (Make's **JSON → Create JSON**), so a value with quotes in it can't break it.

## 5. A test call

With the key in `$KEY` (`KEY=…`), list two components:

```sh
curl -s "https://status.example.com/api/v1/components?limit=2" -H "Authorization: Bearer $KEY"
```

The answer is the records as JSON, each with its `id`: the number a new incident's `component` takes. If they come back, the key works. Whether its role may also add incidents shows at the service's first call: a `201` with the new incident, or a `403`.

## 6. What can go wrong

| What you see | What it means |
|---|---|
| `401` "A valid key is needed" | No key in the call, or one that is wrong, revoked or past its end date. Check that the value starts with `Bearer ` |
| `403` "You are not allowed to do this." | The key's role may not do that; choose a role that may, or make a new key |
| `404` "No such incident, or not one this key may read." | The record isn't there, or the key's role may not read it |
| `422` with `errors` | A value doesn't fit its field. `errors` names each field and what is wrong with it |
| `429` | More than 60 calls in a minute with one key; wait, then try again |
| `404` with the app's "Not found" page instead of JSON | The `api` block doesn't offer that model, or its address is misspelled (`/api/v1/incidents`, in the plural) |

The [refusals table](../api.md#4-when-the-app-says-no) on the API page has every answer.
