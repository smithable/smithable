# Integrations

An app can work with other services in four ways:

- **Calls in:** a service tells the app that something happened, and the app makes a record of it.
- **Calls out:** the app tells a service that something happened in it.
- **Mail out:** the app mails people.
- **The API:** a service reads and changes the app's records with a key.

The how-tos [Mail and calls in](incoming.md), [Mail and calls out](outgoing.md) and [The API](api.md) explain how each one works. The pages below are recipes for one service or pattern at a time. Each one goes through the same steps:

1. **What the app gets.** What happens in your app once it is set up.
2. **The lines in the spec.** These never name the service. An entry says what a call does, and the address and secret are settings.
3. **The secret, key or settings** the two sides share.
4. **On the service's side.** The steps, with the service's own names for its screens and buttons.
5. **A test.** One you can make yourself before the service does.
6. **What can go wrong.** The answers you may see, and what each one means.

## The pages

| Page | The way | What the app gets |
|---|---|---|
| [GitHub webhooks](integrations/github.md) | Calls in | A record for each new issue, or for another event in a repository |
| [Slack](integrations/slack.md) | Calls in | A record from a slash command, such as `/incident Payments are slow`, or from a Slack event |
| [Jira](integrations/jira.md) | Calls in | A record for an issue, from a webhook or an automation rule |
| [Zapier and Make](integrations/zapier-make.md) | Calls in | A record from any step of a zap or scenario: a form, a spreadsheet row, a mail |
| [Sending mail](integrations/mail.md) | Mail out | Sign-in codes, the mail `outgoing` entries send and support replies, through your own mail server |
| [Another service with a key](integrations/api-key.md) | The API | A spreadsheet, an automation or a script that reads and changes records |

Pages for services with a sign-in of their own (where you'd click "Connect" and log in to the service) will come later, as plugins.

## On smithable.ai and on your own server

Every page works for an app on your own server. Secrets and mail settings are environment variables, set where the app runs, and API keys are made in the app.

On smithable.ai:

- **Mail** is sent for you; there's nothing to set up.
- **Calls out** take their address and secret from the project's **Connections** page.
- **The API** takes keys made in the app itself, on its users page.
- **Calls in** take their secret from the **Calls in** card on the project's page. Once the app is published, the card lists each incoming entry with its address, live and staging, to give the service. Then either:
  - **Make a secret**: it makes a long random secret and shows it once. Copy it into the service before you leave the page. If it's lost, **Make a new secret** replaces it, and the service needs the new one.
  - **Or use the service's own**: paste a secret the service made, such as Slack's signing secret, then **Use this secret**.

  One secret serves both the live and the staging app. They get it as the setting `INCOMING_<NAME>_SECRET` and restart to use it. An entry without a secret refuses every call with `401`.
