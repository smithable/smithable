# Jira and your app

A Jira issue becomes a record in your app: a bug reported in Jira opens an incident on a status page, a request ticket becomes a case. Jira calls the app's address when something happens to an issue; the entry says what each call makes. Nothing about Jira is in the spec.

## 1. The entry

```yaml
incoming:
  issueCreated:
    create: Incident
    set:
      title: "{issue.fields.summary}"
      summary: "Jira {issue.key}: {issue.fields.description}"
      status: investigating
      detectedAt: NOW()
    signed: sha256
    header: X-Hub-Signature
    as: staff
```

- **`{path}`** reads Jira's JSON: `{issue.key}` (PAY-12), `{issue.fields.summary}`, `{issue.fields.description}`, `{issue.fields.status.name}`, `{issue.fields.priority.name}`, `{user.displayName}`, `{webhookEvent}` (`jira:issue_created`, `jira:issue_updated`).
- **`signed: sha256`** with **`header: X-Hub-Signature`**: a Jira Cloud webhook with a secret signs each call with an HMAC-SHA256 of the body, sent as `sha256=<hex>` in `X-Hub-Signature`, the plain form the entry checks by default.
- Without a secret on Jira's side (an older Jira, or a Data Center without one), use an automation rule instead (§3): it can send the secret in a header.

From the command line: `smithable op addIncoming issueCreated --create Incident --set "title={issue.fields.summary}" status=investigating "detectedAt=NOW()" --signed --header X-Hub-Signature --as staff`.

## 2. A webhook on Jira's side

1. In Jira, **Settings → System → WebHooks → Create a WebHook** (a Jira administrator's page).
2. **URL**: `https://<your app>/incoming/issueCreated`. **Secret**: the same value as the app's setting `INCOMING_ISSUECREATED_SECRET` (the entry's name in capitals). When you host the app yourself, make a long random value and set it in the app's environment. On smithable.ai, publish the app, then press **Make a secret** in the **Calls in** card on the project's page and paste the secret it shows once into Jira; the app restarts to use it ([more](../integrations.md#on-smithableai-and-on-your-own-server)).
3. **Events**: Issue → created (and updated, if a change should make a record too). A **JQL filter** such as `project = PAY` limits it to one project.
4. Save, then create an issue in that project: the incident appears in the app with the issue's summary as its title.

## 3. An automation rule instead

Jira's **Automation** (Project settings → Automation, or System → Automation rules) can call the address with a body of your own shape and any headers, which also works where webhooks have no secret:

1. **Trigger**: Issue created (or transitioned, or a scheduled rule).
2. **Action**: *Send web request*. **URL** `https://<your app>/incoming/issueCreated`, **method** POST, **body** *Custom data*:
   ```json
   { "issue": { "key": "{{issue.key}}", "fields": { "summary": "{{issue.summary}}", "description": "{{issue.description}}" } } }
   ```
   and a header `Authorization: Bearer <the secret>`.
3. In the entry, leave `signed` and `header` out: the secret comes as it is, in `Authorization`.

Jira's `{{smart values}}` fill the body on Jira's side; the app's `{issue.key}` reads what arrives. The shape above matches the webhook's, so one entry serves both ways.

## 4. A test call, and what can go wrong

```bash
BODY='{"webhookEvent":"jira:issue_created","issue":{"key":"PAY-12","fields":{"summary":"Payments are slow","description":"Since 09:00"}}}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"
curl -s -X POST https://<your app>/incoming/issueCreated -H "Content-Type: application/json" -H "X-Hub-Signature: $SIG" --data "$BODY"
```

- `401 Wrong secret or signature`: the setting is not set or is not the webhook's secret; with the automation rule, the header is not `Authorization: Bearer <secret>`.
- `422`: the record was refused: a required field the call does not fill, or a value the field does not take (a `status` that is not one of the choices).
- Two incidents for one issue: Jira retried a call that took too long. Give the entry `id: "{issue.key}"` when one issue is one record; a call with an id seen in the last day is answered as received and not acted on again. Jira's updated events then make no second record either; for them, use a second entry or your own code (`custom: true`).
