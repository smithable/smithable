# GitHub webhooks

When someone opens an issue in a GitHub repository, the app makes a record of it, for example a report your team then triages. GitHub calls the app at an address of its own and signs each call, so the app takes calls from your repository and refuses everyone else's.

The same steps work for any other GitHub event, such as pull requests, releases or pushes. Only the event you choose and the fields you take from it change.

## 1. What the app gets

A model for the reports, if the app doesn't have one yet:

```sh
smithable op addModel Report title=string! link=url reportedBy=string status=new\|triaged\|done
```

Each new issue becomes a report with the issue's title, its link on GitHub, the login of the person who opened it, and the status `new`. Editing, closing or labelling the issue later makes no new report.

## 2. The lines in the spec

```sh
smithable op addIncoming newIssue --custom --signed --header X-Hub-Signature-256 --as staff
```

This adds the entry to `smithable.yml`. GitHub signs its calls in a header of its own, `X-Hub-Signature-256`, which `--header` names:

```yaml
incoming:
  newIssue:
    custom: true
    signed: sha256                   # GitHub signs the body with the secret
    header: X-Hub-Signature-256      # the header GitHub sends the signature in
    as: staff                        # the role the call acts as
```

The app now answers at `/incoming/newIssue`, and the entry's code is in `src/custom/incoming/new-issue.ts`. Smithable creates that file once and never overwrites it. Write what a call does there:

```ts
// A new GitHub issue becomes a report; GitHub's ping and every other issue event are only received.
import { reportData } from "#/generated/report.server";
import type { Viewer } from "#/kit/access";

type Delivery = { action?: string; issue?: { title: string; html_url: string; user: { login: string } } };

export async function handle(body: unknown, caller: Viewer): Promise<void> {
  const { action, issue } = body as Delivery;
  if (action !== "opened" || !issue) return;
  await reportData.create(caller, { title: issue.title, link: issue.html_url, reportedBy: issue.user.login, status: "new" });
}
```

The report is made as `staff` (the entry's `as`), so it goes through that role's rules like a report someone makes on the page.

**Without code.** An entry with `create` and `set` instead of `custom` makes a record for every call, for example `title: "{issue.title}"`. That suits an event GitHub sends only once per change, such as a push. For issues, GitHub sends a call on every edit, label and close too, and each would become a new record. GitHub's first call, the *ping*, is refused with `422`, since it carries no issue.

## 3. The secret

The app reads the secret from the setting `INCOMING_NEWISSUE_SECRET`, which is the entry's name in capitals:

- **On your own server:** make a long random secret, for example with `openssl rand -hex 32`. Set it as an environment variable where the app runs, then restart the app.
- **On smithable.ai:** publish the app, then open the **Calls in** card on the project's page. It shows the entry's address, live and staging. **Make a secret** makes one and shows it once: paste it into the service there and then. The app gets it as `INCOMING_NEWISSUE_SECRET` and restarts to use it ([more](../integrations.md#on-smithableai-and-on-your-own-server)).

Without the setting, the address refuses every call with `401`.

## 4. On GitHub's side

1. In the repository, open **Settings → Webhooks** and choose **Add webhook**.
2. **Payload URL:** the app's published address and the entry's path, such as `https://reports.example.com/incoming/newIssue`. GitHub can't reach an app on your own computer (`localhost`).
3. **Content type:** choose `application/json`. GitHub's default, `application/x-www-form-urlencoded`, is refused with `400`.
4. **Secret:** the same secret as `INCOMING_NEWISSUE_SECRET`.
5. **Which events would you like to trigger this webhook?** Choose **Let me select individual events**, tick **Issues**, and untick **Pushes**.
6. Leave **Active** ticked and choose **Add webhook**.

GitHub then sends a ping. Under the webhook's **Recent Deliveries**, it shows a green tick and the app's answer, `200 {"received":true}`. Open an issue to see the first report.

## 5. A test call

You can sign a call yourself, the way GitHub does, without opening an issue:

```sh
BODY='{"action":"opened","issue":{"title":"A test from the docs","html_url":"https://github.com/acme/web/issues/1","user":{"login":"you"}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -s -X POST https://reports.example.com/incoming/newIssue \
  -H "Content-Type: application/json" -H "X-Hub-Signature-256: sha256=$SIG" -d "$BODY"
```

It answers `{"received":true}`, and the report "A test from the docs" is on the reports page. In development, use `http://localhost:3000` and set the secret before `pnpm dev`.

## 6. What can go wrong

| What you see | What it means |
|---|---|
| `401 {"error":"Wrong secret or signature."}` | The secret on GitHub and `INCOMING_NEWISSUE_SECRET` differ, the setting isn't set, or the entry has no `header: X-Hub-Signature-256` |
| `400 {"error":"The body is not JSON."}` | The webhook's content type is `application/x-www-form-urlencoded`; change it to `application/json` |
| `422` with the fields that are wrong | An entry without code got a call it can't make a record from, such as the ping |
| `200 {"received":true}` but no report | The call wasn't a new issue (`action` isn't `opened`), or the code didn't run to the end; the app's log says why |
| Two reports for one issue | GitHub's **Redeliver** sends a delivery again, and the code makes a report each time. Delete the extra one, or have the code look for a report with the same link first |

GitHub keeps every delivery for a few days under **Recent Deliveries**, with the request it sent and the app's answer. **Redeliver** sends one again. The [incoming reference](../../spec/v0.1.md#incoming) has the full rules for an entry.
