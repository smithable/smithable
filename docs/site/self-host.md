# Run an app on your own machine

<!-- asked as: own server, self-host, run it myself, my own hosting -->

A Smithable app is an ordinary TypeScript project with a Dockerfile, and it depends on nothing from Smithable, so you can run it anywhere Docker runs. This page puts an app into a container, says what it needs, where its data lives, how to back it up and bring it back, and how to update it. Every command was run for real; the output is what it printed (a CRM made with `smithable new my-crm --starter crm`). `smithable deploy` deploys to Docker on this machine unless `--target` says otherwise, and names the image, its container and its volume after the app (`name` in its `package.json`, here `acme-crm`).

## Deploy to Docker

From the project:

```console
$ smithable deploy --port 8410
Release checks first:
Building the image acme-crm…
Security check (release):
  ✓ Type check (pnpm typecheck)
  ✓ Tests (pnpm test)
  ✓ Dependencies (OSV-Scanner (image v2.6.0))
  ✓ Dependencies, at their source (the packages' advisory lists)
      Accepted, since it is in Better Auth's organization plugin, which a generated app does not use: better-auth@1.7.7: GHSA-fmh4-wcc4-5jm3 (high) better-auth: Organization invitations can be accepted by an unverified account
  ✓ Secrets (Gitleaks (image v8.30.1))
  ✓ Code (Semgrep (image 1.178.0))
  ✓ Smoke tests (pnpm test:smoke)
  ✓ Container image (Trivy (image 0.74.0))
  ✓ Running app (OWASP ZAP (image 2.16.1))

All checks passed.
Deploying acme-crm to Docker on this machine…
Deployed: http://localhost:8410 (data in the Docker volume acme-crm-data).
```

It took three minutes, most of it the security scans. A failed check stops the deploy; findings are never suppressed. "Dependencies, at their source" reads each package's own advisory list on GitHub, where a vulnerability is published days before the scanners' databases list it. An "Accepted" line is an advisory that names an installed version and does not reach a generated app, with the reason; it is shown every time. The lists are kept a day on your machine, so repeated checks ask GitHub nothing; without a network, or past GitHub's sixty reads an hour from your address (set `GITHUB_TOKEN` to any token to lift that, or wait for the time the message names), the check fails rather than passing unchecked. The default port is 3000. `--target ssh://user@host` deploys to Docker on another machine over SSH, and `--url https://crm.example.com` gives the app its public address.

A deploy that replaces a running version keeps the data volume. If the new version does not start or does not answer `/health`, the previous one runs again; and when the new version had a migration to apply, it first kept a copy of the database as it was (`db/before-migration.db`), which the deploy puts back before the previous version starts, so old code never runs on a changed schema.

The container serves plain HTTP. In front of it, put a proxy that handles HTTPS for your domain (Caddy, nginx or Traefik), and deploy with `--url` set to the address people use. Set `TRUST_PROXY=1` (on the container: `smithable deploy` does not pass it, nor `SCAN_URL` below) only when such a proxy is in front: the app then takes the visitor's address from the proxy's `X-Forwarded-For` (for its limits) and its `X-Forwarded-Proto` (to send `Strict-Transport-Security`, so browsers keep to HTTPS); without it the app believes neither header, since anyone can send them, and its proxy may send HSTS itself. With `SMTP_HOST` on any port but 465, mail is sent only after the connection turns to TLS (STARTTLS); an `SMTP_URL` is used as written, and `?requireTLS=true` asks for the same. When `SCAN_URL` is set, every uploaded file is sent to it before it is stored (a virus scanner behind a small HTTP front, such as ClamAV), and any answer but OK refuses the upload; without it nothing is scanned.

## What it needs

`smithable deploy` passes the container its environment:

- `BETTER_AUTH_SECRET`: the key that signs sessions. Made once and kept in the project's `data/.smithable/auth-secret` (never committed), so sign-ins survive a redeploy.
- `BETTER_AUTH_URL`: the app's public address, from `--url`.
- `DATA_DIR=/data` and `PORT=3000`, set in the image.
- From your shell, when they are set there: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`, and the mail settings `SMTP_URL` (or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) with `MAIL_FROM`.

**Signing in.** A production build signs people in with a code by email, so a self-hosted app needs mail settings (`SMTP_URL` and `MAIL_FROM`); without them its sign-in page says it cannot send mail, and other mail is written to `/data/mail/outbox` instead of sent. An app that also offers Google or Facebook needs an OAuth client of its own for each: the app's README says how to make one, with the redirect address for your domain. The development sign-in (any role, one click) is left out of production builds.

**Pictures an AI made.** Most pictures from the Smithable image library are made with an AI, and the app marks them with a small "AI-generated" or "AI" badge where they could pass for photographs. Some are real photographs, released under CC0 or in the public domain: they carry no badge, and `public/images/CREDITS.md` lists each one with its source ([where the pictures come from](pictures.md)). The badge is on unless you switch it off (`aiBadge: false` in `smithable.ux.yml`, or `smithable op setAiBadge false`); switching it off, or where the app is hosted, does not take away what the law asks of you or of Smithable.

## Every setting

The app reads these from its environment. None is needed beyond the ones `smithable deploy` passes (above); each of the others turns something on or changes a default. A setting not set is the default. Names with `<NAME>` come from the app's own spec: an entry named `statusFeed` reads `OUTGOING_STATUSFEED_URL`.

**Address, data and the server**

| Setting | Default | What it is for |
|---|---|---|
| `BETTER_AUTH_URL` | none | The app's public address (`https://…`): in links in mail, sign-in, push and payment returns. |
| `BETTER_AUTH_SECRET` | none | The key that signs sessions. Keep it: a new one signs everyone out. |
| `PORT` | `3000` | The port the server listens on. |
| `DATA_DIR` | `data` | The folder with the database, uploads and outboxes (`/data` in the image). |
| `TRUST_PROXY` | off | `1` behind a proxy you run: the visitor's address and host are read from its `X-Forwarded-For` (last hop) and `X-Forwarded-Host`. Leave it off when the app is reached directly, or anyone could claim any address. |
| `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY` | none | An egress proxy for the app's outgoing calls (connections, SMS, payments, the assistant). Without one, the app checks each address itself and refuses its own machine and private networks. |
| `NODE_ENV` | `production` in the image | In production, each mail kept in the outbox for want of mail settings is also logged as a warning. |

**Sign-in**

| Setting | Default | What it is for |
|---|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | none | Google sign-in, for an app that offers it ([how to make the client](google-sign-in.md)). |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | none | Facebook sign-in, for an app that offers it. |
| `DEMO_SIGN_IN` | off | `1`: the sign-in page offers every role with one click, as in development. For a demo only, never for an app with real people in it. |
| `DEV_DOOR_SECRET` | none | The secret the development sign-in's door asks for, for tools that sign in by themselves (tests, sample users). Without it the door stays shut. |

**Mail, SMS and push**

| Setting | Default | What it is for |
|---|---|---|
| `SMTP_URL` | none | Where mail is sent (`smtp://user:password@host:587`); or the four below. Without either, mail is written to `DATA_DIR/mail/outbox`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | none | The same, one part each. |
| `MAIL_FROM` | none | The sender of the app's mail (`Acme <hello@acme.example>`). |
| `SMS_PROVIDER` | none | The SMS provider (`46elks`). Without it, texts are written to `DATA_DIR/sms/outbox`. |
| `SMS_KEY`, `SMS_SECRET`, `SMS_FROM` | none | The provider's account and the sender name or number. |
| `SMS_MAX_PER_DAY` | `50` | The most texts the app sends in a day (and at most ten to one number); a text over it is not sent and is marked failed. |
| `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY` | made once | The app's keys for notifications to browsers and phones. Without them the app makes a pair once and keeps it in its database; set them to keep the same pair across a new database. |
| `PUSH_VAPID_SUBJECT` | `MAIL_FROM`'s address | Who the push services may write to about the app (`mailto:` or `https:`). |

**Payments**

| Setting | Default | What it is for |
|---|---|---|
| `PAYMENTS_SECRET_KEY` | none | The provider's secret key (the provider is named in `smithable.context.yml`). |
| `PAYMENTS_WEBHOOK_SECRET` | none | The provider's signing secret for its calls to the app (Stripe's `whsec_…`). |
| `PAYMENTS_HOLD_MINUTES` | `30` | How long a record waiting for its payment holds its place before it is released. |
| `PAYMENTS_HOLD_CHECK_SECONDS` | `60` | How often the app looks for holds to release. |
| `PAYMENTS_FAKE` | off | `on`: the fake provider, which takes no money, outside development. For a preview or a test; **never in a live app**. |
| `PAYMENTS_FAKE_REFUSE_REFUNDS` | off | `on`: the fake provider refuses refunds, for testing what the app says then. |

**Uploads and the activity log**

| Setting | Default | What it is for |
|---|---|---|
| `UPLOADS_MAX_BYTES` | no cap | The most the uploads may take together, in bytes. When full, a new file is refused with a message. Without it the disk is the only limit. |
| `SCAN_URL` | none | A virus check: each file is sent there before it is stored, and anything but OK refuses it (no answer refuses it too). Without it files are not scanned. |
| `AUDIT_DAYS` | `365` | Days a line of the activity log is kept. |
| `AUDIT_CLIENT_DAYS` | `90` | Days a line keeps the client's address and browser, before they are blanked. Say both in your privacy notice. |

**The assistant (Ask) and connections**

| Setting | Default | What it is for |
|---|---|---|
| `ASSISTANT_URL`, `ASSISTANT_KEY`, `ASSISTANT_MODEL` | none | The model Ask uses (an OpenAI-compatible address, its key, the model's name). Without them Ask answers from the records alone and sends nothing anywhere. |
| `ASSISTANT_PROVIDER`, `ASSISTANT_REGION` | none | Who runs that model and where, as Ask's notice tells its users. |
| `OUTGOING_<TARGET>_URL`, `OUTGOING_<TARGET>_SECRET` | none | Where an outgoing entry's calls go, and the secret they are signed with. Until both are set, the calls wait. |
| `INCOMING_<NAME>_SECRET` | none | The secret an incoming entry's caller signs with. Without it the entry refuses every call. |
| `INCOMING_<NAME>_ADDRESS` | `MAIL_FROM` | For an incoming mail entry: the mailbox it is fed from, given as `Reply-To` on the app's mail in its threads. |

**Demos and hosting services**

| Setting | Default | What it is for |
|---|---|---|
| `DEMO_VISITORS` | off | `1`: each visitor works on a copy of the app's data of their own, for a public demo. |
| `DEMO_VISITORS_KEPT` | `500` | The most visitors' copies kept; the least recently seen go first. |
| `VISITOR_ROWS` | `10000` | The most records visitors without an account may add to a model they may create in (a contact form's messages), so a flood stops there. |
| `HOST_PAGE_URL`, `DATA_AS_OF`, `SMITHABLE_HOSTED_LEVEL` | none | Set by a hosting service that runs the app: its own page for the app's data, the time of a copy of the data being looked at, and its privacy level. Leave them unset. |
| `SMOKE_PORT` | `3100` | The port the app's own smoke tests run it on. |

## Where the data lives

Everything the app keeps is in the `/data` volume (here `acme-crm-data`): the SQLite database in `db/app.db`, uploaded pictures in `uploads/`, and the mail outbox. The image itself holds no data, so a container can be replaced at any time; the volume stays.

## Back up and restore

To a folder:

```console
$ smithable backup --container acme-crm --to ../backups
Backed up to ../backups/acme-crm/20261003-094216 (1 file(s)).

$ smithable restore --container acme-crm --from ../backups
Restored acme-crm/20261003-094216 (1 file(s)).
```

To an S3-compatible bucket (AWS S3, Scaleway, Backblaze B2, MinIO, SeaweedFS…), with its credentials in the usual variables:

```console
$ export AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… AWS_ENDPOINT_URL=https://s3.example.com
$ smithable backup --container acme-crm --to s3://backups
Backed up to s3://backups/acme-crm/20261003-094317 (1 file(s)).

$ smithable restore --container acme-crm --from s3://backups
Restored acme-crm/20261003-094317 (1 file(s)).
```

The app's name is added to the path, so one bucket holds several apps. A backup is a consistent copy taken while the app runs; `restore` brings back the newest one (or `--backup <time>`, a backup folder's name such as `20261003-094216`) and restarts the app. Run the backup from cron for a nightly copy. Smithable does not encrypt the copies: a folder's permissions, or the bucket's own encryption at rest and its access policy, are what protect them, so keep the folder or the bucket private. For every change as it happens, `smithable backup --continuous` streams the database with [Litestream](https://litestream.io) (installed separately), and `smithable restore --at <time>` then reaches any second of the last 30 days.

## With Docker Compose

```console
$ smithable deploy --target compose --port 8411
Wrote compose.yaml, with its secrets in .env. Set BETTER_AUTH_URL there to the app's public address, then:

  docker compose up -d
```

It writes `compose.yaml` (the app, its port and its data volume) and `.env` (the session secret and the address, with a commented line for mail), which `.gitignore` keeps out of Git. After setting `BETTER_AUTH_URL` in `.env`:

```console
$ docker compose up -d
 Volume my-crm_data  Created
 Container my-crm-app-1  Created
 Container my-crm-app-1  Started
```

Compose names the volume and the container after the folder (`my-crm_data`, `my-crm-app-1`); back it up with `smithable backup --container my-crm-app-1 --to ../backups`.

## Update

Two commands bring an app forward, and each keeps its change only when the type check and the tests pass:

```console
$ smithable update --security
…
All checks passed.
Already up to date.

$ smithable upgrade
No schema changes, nothing to migrate 😴
Already up to date (stack profile 2026-09).
```

`update --security` brings in the security fixes your Smithable knows about (newer dependency versions); `upgrade` moves the app to your Smithable's spec version and stack profile. With a newer Smithable installed they have something to do; then `smithable deploy` again replaces the container, and the data volume stays. An app you have [detached](start-local.md#running-it-elsewhere) is updated like any other TypeScript project instead.
