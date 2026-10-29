# Sending mail

An app sends mail for three things: sign-in codes, the mail its [`outgoing` entries](../outgoing.md) send, and the replies in a support thread. On smithable.ai a published app's mail is sent for you, so this page is for an app on your own server. There, the app sends through a mail server you give it, with an address of your own as the sender.

## 1. What the app gets

- **Sign-in codes** reach people, so they can sign in to the published app.
- **`outgoing` entries** with `to: mail` reach the people they name.
- **Mail has your address as its sender,** such as `Harbour Support <support@harbour.example>`, and replies go back to it.

Without mail settings, nothing leaves the machine. Each mail is written to `data/mail/outbox` as an `.eml` file instead, which is what development uses. A published app without them can't sign anyone in with a code: its sign-in page says it can't send mail, and `smithable deploy` warns before publishing.

## 2. The lines in the spec

None for sign-in codes. For mail about records, an `outgoing` entry, such as:

```yaml
outgoing:
  bookingMade:
    when: Booking created
    to: mail
    recipient: owner
```

The mail's subject and text are in `smithable.content.yml` ([the mail's words](../outgoing.md#the-mails-words)). The server and the sender are never in the spec. They are settings.

## 3. The settings

Set them as environment variables where the app runs, then restart it:

| Setting | What it holds |
|---|---|
| `SMTP_URL` | The server, user and password in one address: `smtp://user:password@smtp.example.eu:587`, or `smtps://…:465` for a server that wants TLS from the first byte |
| `MAIL_FROM` | The sender, with a name: `Harbour Support <support@harbour.example>` |

Instead of `SMTP_URL`, the parts can be set one by one: `SMTP_HOST`, `SMTP_PORT` (587 unless said), `SMTP_USER` and `SMTP_PASSWORD`. A password with characters such as `@` or `/` must be written encoded in `SMTP_URL` (`%40`, `%2F`), so the separate settings are easier for it.

Set that way, port 465 means TLS from the first byte, and any other port must switch to TLS before the password is sent. `SMTP_URL` is taken as written: `smtps://` for TLS from the first byte, and `?requireTLS=true` at the end to insist on the switch with `smtp://`.

Without `MAIL_FROM`, mail goes out from `app@localhost`, which most servers refuse.

`smithable deploy` passes `SMTP_URL` (or the separate settings) and `MAIL_FROM` to the container when they are set in the shell you deploy from ([Self-hosting](../self-host.md)).

## 4. On the mail provider's side

Any provider that offers SMTP works: your own domain's mail service, or a service made for sending mail from apps.

1. **Get SMTP credentials.** Most providers have a page for it, often called *SMTP*, *SMTP relay* or *app passwords*. Note the host, the port (usually 587), the user and the password. A mail service for apps often makes an *SMTP key* instead of a password.
2. **Let the provider send for your domain.** The provider gives you DNS records to add to the sender's domain: SPF (which servers may send for it), DKIM (a signature on each mail) and DMARC (what a receiver does with a mail that fails both). Without them, much of the app's mail ends up in spam or is refused.
3. **Use an address the provider accepts as the sender.** Many providers refuse a `MAIL_FROM` they haven't verified.
4. **Check that your server may send.** Some hosting companies block outgoing mail ports on a new server until you ask them to open them.

## 5. A test

Open the published app's sign-in page and ask for a code to your own address. The mail should arrive within a minute.

For mail from an `outgoing` entry, make the change that sends it, such as a new booking. **Admin → Activity** then has a line for the mail, sent or failed, with a **Send again** button for one that was given up ([delivery and its history](../outgoing.md#3-delivery-and-its-history)).

## 6. What can go wrong

| What you see | What it means |
|---|---|
| The sign-in page says it can't send mail | Neither `SMTP_URL` nor `SMTP_HOST` is set where the app runs |
| No mail arrives, and the app's log has the mail server's refusal | The user or password is wrong, or the provider refuses the sender in `MAIL_FROM` |
| The mail arrives in spam | The sender's domain lacks the provider's SPF, DKIM or DMARC records, or they aren't valid yet (DNS can take an hour) |
| `.eml` files in `data/mail/outbox` instead of sent mail | The app was started without the settings; set them and restart it |
| A mail in Activity marked as failed | The server didn't answer or refused it. The app tried again, less and less often, for a day, then gave up. **Send again** tries once more |
| No mail at all, and the log says the connection timed out | The server's host blocks outgoing mail ports; ask it to open them, or use a provider on port 465 or 587 |
