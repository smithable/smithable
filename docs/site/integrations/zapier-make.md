# Zapier and Make

Zapier and Make connect thousands of services that have no page here: a form, a spreadsheet, a calendar, a shop. A zap's or scenario's last step can call the app, and the app makes a record from what the call carries. In this example, each new form entry becomes a lead.

On smithable.ai, these calls can't be set up yet ([why](../integrations.md#on-smithableai-and-on-your-own-server)). There, the same step can add the lead through [the API with a key](api-key.md) instead.

## 1. What the app gets

A model for the leads, if the app doesn't have one yet:

```sh
smithable op addModel Lead name=string! email=email! message=text source=string
```

Each call becomes one lead, with the name, address and message the form had, and where it came from (`Zapier` or `Make`) as its source.

## 2. The lines in the spec

```sh
smithable op addIncoming newLead --create Lead --set "name={name},email={email},message={message},source={source}" --as staff
```

This adds the entry to `smithable.yml`:

```yaml
incoming:
  newLead:
    create: Lead
    set:
      name: "{name}"                 # {path}: a value from the call's JSON
      email: "{email}"
      message: "{message}"
      source: "{source}"
    as: staff                        # a role of your app; the call acts as it
```

The app now answers at `/incoming/newLead`. A value in braces is taken from the JSON the call sends, so `{name}` is the call's `name`. A nested one is written with dots, `{customer.email}`. A value without braces, such as `status: new`, is set as it is.

## 3. The secret

Make a long random secret, for example with `openssl rand -hex 32`. The app reads it from the setting `INCOMING_NEWLEAD_SECRET`, which is the entry's name in capitals:

- **On your own server:** an environment variable where the app runs, then restart the app.
- **On smithable.ai:** there's no place to set it yet (see [Integrations](../integrations.md#on-smithableai-and-on-your-own-server)).

The call sends it in the `Authorization` header: the word `Bearer`, a space, then the secret.

## 4. In Zapier

1. Add an action step to the zap, after the step that brings the form entry.
2. **App:** Webhooks by Zapier. **Action event:** POST. Webhooks by Zapier is a premium app, so the zap needs one of Zapier's paid plans.
3. **URL:** the app's published address and the entry's path, such as `https://leads.example.com/incoming/newLead`.
4. **Payload type:** `json`.
5. **Data:** one line per value, with the name the entry uses on the left (`name`, `email`, `message`) and the form's field on the right, picked from the earlier step. Add a line `source` with the text `Zapier`.
6. **Wrap request in array:** No.
7. **Headers:** `Authorization` on the left. On the right, the word `Bearer`, a space, then the secret.
8. Choose **Test step**. The answer is `{"id": …}`, the new lead's number. The test makes a real lead, which you can delete in the app.

## 5. In Make

1. Add a **JSON → Create JSON** module after the one that brings the form entry. Give it a data structure with the fields `name`, `email`, `message` and `source`. Map the form's values into the first three, picking them from the mapping panel, and type `Make` into `source`. The module writes the values as valid JSON, even a message with quotes or line breaks in it.
2. Add **HTTP → Make a request** after it.
3. **URL:** the app's published address and the entry's path, such as `https://leads.example.com/incoming/newLead`. **Method:** POST.
4. **Headers:** one header with the name `Authorization`. Its value is the word `Bearer`, a space, then the secret.
5. **Body type:** Raw. **Content type:** JSON (application/json).
6. **Request content:** the **JSON string** from the Create JSON module, picked from the mapping panel.
7. Choose **Run once**. The module's output has the status `201` and the new lead's id. The run makes a real lead, which you can delete in the app.

## 6. A test call

With the secret in `$SECRET` (`SECRET=…`, the same value as `INCOMING_NEWLEAD_SECRET`):

```sh
curl -s -X POST https://leads.example.com/incoming/newLead \
  -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","message":"Do you deliver to Mariehamn?","source":"test"}'
```

It answers `{"id":1}`, and the lead is in the app. In development, use `http://localhost:3000` and set the secret before `pnpm dev`.

**Repeats.** Zapier and Make may send a step again, for example when you replay a zap's run. A call with an `Idempotency-Key` header the app saw in the last day is answered `200 {"received":true,"repeat":true}` and makes no second lead. Use a value that is the same on every try, such as the form entry's own id.

## 7. What can go wrong

| What you see | What it means |
|---|---|
| `401 {"error":"Wrong secret or signature."}` | The secret differs from `INCOMING_NEWLEAD_SECRET`, the setting isn't set, or the header lacks the word `Bearer` and a space before the secret |
| `422 {"error":"email: Enter a valid email address"}` | A value doesn't fit its field. The answer names each field and what is wrong |
| `422 {"error":"name: Required; email: …"}` | The call's JSON doesn't have the names the entry uses. In Zapier, also check that **Wrap request in array** is No |
| `400 {"error":"The body is not JSON."}` | The payload type is `form` (Zapier) or the body type isn't Raw JSON (Make) |
| A lead with an empty message or source | The call had no `message` or `source`. A missing value is empty text, and only a required field refuses the call |

The [incoming reference](../../spec/v0.1.md#incoming) has the full rules for an entry, and [Mail and calls in](../incoming.md) shows more examples.
