# Slack and your app

A slash command in Slack opens a record in your app: `/incident Payments are slow` makes an incident on a status page, `/lead Northwind, wants a quote` a lead in a CRM. Slack events can reach the app the same way. Nothing about Slack is in the spec: the entry says how the call comes (a form), how Slack signs it (the time and the body, with its signing secret) and that Slack checks a new address first.

## 1. A slash command that opens a record

In `smithable.yml`, on the status starter:

```yaml
incoming:
  chatCommand:
    create: Incident
    set: { title: "{text}", status: investigating, detectedAt: NOW() }
    body: form
    signed: { sha256: "v0:{timestamp}:{body}", prefix: "v0=", timestamp: X-Slack-Request-Timestamp }
    header: X-Slack-Signature
    challenge: challenge
    as: staff
```

- **`body: form`**: Slack sends a slash command form-encoded, not as JSON. `{text}` is what the person typed after the command; `{user_name}`, `{channel_name}` and `{response_url}` are there too.
- **`signed`**: Slack signs each call with your app's *signing secret*: the text `v0:<timestamp>:<body>`, HMAC-SHA256, sent as `v0=<hex>` in `X-Slack-Signature`, with the time in `X-Slack-Request-Timestamp`. The entry says exactly that, and a call whose time is more than five minutes off is refused.
- **`challenge`**: when you turn on events (below), Slack first sends `{ "type": "url_verification", "challenge": "…" }` and wants the value back. The entry answers it and does nothing else. Slack sends that check as JSON, which the entry reads as JSON even though commands come as a form.
- **`as: staff`**: the incident goes through the staff role's rules, as if a member of staff had added it.

From the command line: `smithable op addIncoming chatCommand --create Incident --set "title={text}" status=investigating "detectedAt=NOW()" --form --signed-text "v0:{timestamp}:{body}" --signed-prefix v0= --timestamp X-Slack-Request-Timestamp --header X-Slack-Signature --challenge challenge --as staff`.

## 2. On Slack's side

1. At [api.slack.com/apps](https://api.slack.com/apps), create an app (from scratch) in your workspace.
2. Under **Basic Information**, copy the **Signing Secret**. In your app it is the setting `INCOMING_CHATCOMMAND_SECRET` (the entry's name in capitals), set in the app's environment when you host it yourself. On smithable.ai, publish the app, then paste it into the **Calls in** card on the project's page under **Or use the service's own**, and press **Use this secret**; the app restarts to use it ([more](../integrations.md#on-smithableai-and-on-your-own-server)).
3. Under **Slash Commands**, create the command (`/incident`) with the **Request URL** `https://<your app>/incoming/chatCommand`.
4. Install the app to the workspace. Type `/incident Payments are slow` in any channel: the incident appears in the app, titled "Payments are slow".

Slack shows the person what the address answers. The app answers with the record's id, which Slack shows as is; to tell the channel something in words, let the app post back when the record is made: an `outgoing` entry on `Incident created` to a target whose address is a Slack *incoming webhook* ([mail and calls out](../outgoing.md)).

## 3. Events instead of a command

Slack's **Event Subscriptions** (a message in a channel, a reaction, a new member) come as JSON, signed the same way, after the setup check. Make a second entry for them, without `body: form`, and let your own code decide what each event does:

```yaml
incoming:
  chatEvents:
    custom: true                     # src/custom/incoming/chat-events.ts
    signed: { sha256: "v0:{timestamp}:{body}", prefix: "v0=", timestamp: X-Slack-Request-Timestamp }
    header: X-Slack-Signature
    challenge: challenge
    as: staff
```

The **Request URL** is `https://<your app>/incoming/chatEvents`; Slack checks it when you save it. Both entries share the app's signing secret: set `INCOMING_CHATEVENTS_SECRET` to the same value.

## 4. A test call, and what can go wrong

With the secret in `$SECRET` and the time in `$TS`:

```bash
BODY='text=Payments+are+slow&user_name=ada'
TS=$(date +%s)
SIG="v0=$(printf 'v0:%s:%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')"
curl -s -X POST https://<your app>/incoming/chatCommand \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Slack-Request-Timestamp: $TS" -H "X-Slack-Signature: $SIG" --data "$BODY"
```

- `401 Wrong secret or signature`: the setting is not set, is another app's signing secret, or the clock of the sender is more than five minutes off.
- `422`: the record was refused, for example an empty command (`title` is required) or a value a field does not take.
- Slack says "dispatch_failed" or times out: the app did not answer within three seconds. The preview on your own machine is not reachable from Slack; publish the app, or use a tunnel while you try it out.
