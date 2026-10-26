# Run an app on your own machine

A Smithable app is an ordinary TypeScript project with a Dockerfile, and it depends on nothing from Smithable, so you can run it anywhere Docker runs. This page puts an app into a container, says what it needs, where its data lives, how to back it up and bring it back, and how to update it. Every command was run for real; the output is what it printed (a CRM made with `smithable new my-crm --starter crm`).

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

It took three minutes, most of it the security scans. A failed check stops the deploy; findings are never suppressed. "Dependencies, at their source" reads each package's own advisory list on GitHub, where a hole is published days before the scanners' databases list it. An "Accepted" line is an advisory that names an installed version and does not reach a generated app, with the reason; it is shown every time. The lists are kept a day on your machine, so repeated checks ask GitHub nothing; without a network, or past GitHub's sixty reads an hour from your address (set `GITHUB_TOKEN` to any token to lift that, or wait for the time the message names), the check fails rather than pass unchecked. The default port is 3000. `--target ssh://user@host` deploys to Docker on another machine over SSH, and `--url https://crm.example.com` gives the app its public address.

A deploy that replaces a running version keeps the data volume. If the new version does not start or does not answer `/health`, the previous one runs again; and when the new version had a migration to apply, it first kept a copy of the database as it was (`db/before-migration.db`), which the deploy puts back before the previous version starts, so old code never runs on a changed schema.

The container serves plain HTTP. In front of it, put a proxy that handles HTTPS for your domain (Caddy, nginx or Traefik), and deploy with `--url` set to the address people use. Set `TRUST_PROXY=1` only when such a proxy is in front: the app then takes the visitor's address from the proxy's `X-Forwarded-For` (for its limits) and its `X-Forwarded-Proto` (to send `Strict-Transport-Security`, so browsers keep to HTTPS); without it the app believes neither header, since anyone can send them, and its proxy may send HSTS itself. With `SMTP_HOST` on any port but 465, mail is sent only after the connection turns to TLS (STARTTLS); an `SMTP_URL` is used as written, and `?requireTLS=true` asks for the same. `SCAN_URL`, when set, is sent every uploaded file before it is stored (a virus scanner behind a small HTTP front, such as ClamAV), and any answer but OK refuses the upload; without it nothing is scanned.

## What it needs

`smithable deploy` passes the container its environment:

- `BETTER_AUTH_SECRET`: the key that signs sessions. Made once and kept in the project's `data/.smithable/auth-secret` (never committed), so sign-ins survive a redeploy.
- `BETTER_AUTH_URL`: the app's public address, from `--url`.
- `DATA_DIR=/data` and `PORT=3000`, set in the image.
- From your shell, when they are set there: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`, and the mail settings `SMTP_URL` (or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) with `MAIL_FROM`.

**Signing in.** A production build signs people in with a code by email, so a self-hosted app needs mail settings (`SMTP_URL` and `MAIL_FROM`); without them its sign-in page says it cannot send mail, and other mail is written to `/data/mail/outbox` instead of sent. An app that also offers Google or Facebook needs an OAuth client of its own for each: the app's README says how to make one, with the redirect address for your domain. The development sign-in (any role, one click) is left out of production builds.

**Pictures an AI made.** Most pictures from the Smithable image library are made with an AI, and the app marks them with a small "AI-generated" or "AI" badge where they could pass for photographs. Some are real photographs, dedicated to the public domain (CC0) on Wikimedia Commons: they carry no badge, and `public/images/CREDITS.md` lists each one with its source ([where the pictures come from](pictures.md)). The badge is on unless you switch it off (`aiBadge: false` in `smithable.ux.yml`, or `smithable op setAiBadge false`); whether your audience needs it is your responsibility.

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

The app's name is added to the path, so one bucket holds several apps. A backup is a consistent copy taken while the app runs; `restore` brings back the newest one (or `--backup <time>`) and restarts the app. Run the backup from cron for a nightly copy. Smithable does not encrypt the copies: a folder's permissions, or the bucket's own encryption at rest and its access policy, are what protect them, so keep the folder or the bucket private. For every change as it happens, `smithable backup --continuous` streams the database with [Litestream](https://litestream.io) (installed separately), and `smithable restore --at <time>` then reaches any second of the last 30 days.

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

Compose names the volume and the container after the folder (`my-crm_data`, `my-crm-app-1`); back it up with `smithable backup --container my-crm-app-1`.

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
