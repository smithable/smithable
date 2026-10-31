# Leaving, tried out

An app made with Smithable is yours to take elsewhere: it is an ordinary TypeScript project with a Dockerfile, and it needs nothing from Smithable to build or run. This page shows it with a sample you can download, instead of asking you to take it on trust. Every command was run for real, and the output is what it printed.

The sample is the booking starter, Stillwater Yoga, exported the way **Download everything** on smithable.ai exports an app ([Take it with you](start-hosted.md#take-it-with-you)): **[stillwater-export.zip](leave/stillwater-export.zip)** (0.7 MB). Its records are the starter's sample data, standing in for an app's real records. One page, the instructors list, has been made the owner's own, so the export also carries hand-written code. The script that makes the sample is in the repository (`scripts/sample-export.mjs`).

You need Git, Docker, `unzip`, `openssl` and `curl` to run it, and Node 24 with pnpm to change it. Not Smithable.

## What is in the download

- `project.bundle`: the code with its whole Git history.
- `data/`: the database (`db/app.db`, SQLite) and the uploaded pictures (`uploads/`). Sign-in sessions, codes and links are left out, so everyone signs in again.
- `tables/`: each table as a CSV file, for a spreadsheet.
- `README.md`: what is in it, and how to open it in Smithable again (`smithable studio`) or run it without (`pnpm dev`).

## Run it with Docker

Unpack it and make the code a working folder again, with its data beside it, as the README says:

```console
$ unzip -q stillwater-export.zip && cd stillwater
$ git clone project.bundle stillwater
Cloning into 'stillwater'...
$ cp -r data stillwater/
$ cd stillwater
```

Build the image. The first build took five and a half minutes here, most of it installing the packages. The image holds no data: the project's `.dockerignore` leaves out `data/`, `node_modules/` and `.git`.

```console
$ docker build -t stillwater .
```

The app signs people in with a code by email, so it needs a mail server. To try it on your own machine, [Mailpit](https://mailpit.axllent.org) catches every mail and shows it on a page instead of sending it:

```console
$ docker network create stillwater
$ docker run -d --name mailpit --network stillwater -p 8425:8025 axllent/mailpit:v1.27
```

Then run the app, with its data in the `data` folder. The session key is made once and kept in `SECRET`, since a new one signs everyone out:

```console
$ SECRET=$(openssl rand -hex 32)
$ docker run -d --name stillwater --network stillwater --user "$(id -u):$(id -g)" -p 8420:3000 \
    -v "$PWD/data:/data" \
    -e BETTER_AUTH_SECRET="$SECRET" \
    -e BETTER_AUTH_URL=http://localhost:8420 \
    -e SMTP_URL=smtp://mailpit:1025 -e MAIL_FROM=hello@stillwater.example \
    stillwater
$ curl localhost:8420/health
{"status":"ok"}
```

`--user "$(id -u):$(id -g)"` runs the app as you, so it can write to a folder of yours; with a Docker volume instead of a folder it is not needed. `http://localhost:8420` is the yoga studio's site, with its classes, its blog and its pictures. Sign in as the sample's administrator, `owner@sample.example`: the code arrives in Mailpit, at `http://localhost:8425` ("Your code for Stillwater Yoga is …"). Signed in, the studio's own pages are there, the instructors list among them, with the records and pictures from the export.

Without any mail settings, the sign-in page says the app cannot send mail. In your own export, the administrator is you, at your own address.

## Change it and run its tests

The instructors page is in `src/custom/`, the code that is the owner's own and that Smithable never overwrites. Change it like any React page; here, a line under the heading:

```console
$ git diff
--- a/src/custom/pages/instructors.tsx
+++ b/src/custom/pages/instructors.tsx
@@ -38,6 +38,7 @@ export function InstructorsPage() {
         title={pageUi["instructors"].title}
         actions={newButton}
       />
+      <p className="mb-4 text-muted-foreground">Everyone who teaches at Stillwater.</p>
       {selectable && (
```

Then the type check and the app's own tests (who may do what, per role, and the formulas of the home page's calculator):

```console
$ pnpm install
$ pnpm typecheck
$ pnpm test
 Test Files  2 passed (2)
      Tests  31 passed (31)
```

Commit it, build the image again and replace the container. The data stays in its folder:

```console
$ git commit -qam "Instructors: a line under the heading"
$ docker build -t stillwater .
$ docker rm -f stillwater
```

and the same `docker run` as above, with the same `SECRET`. It took three minutes here, the packages coming from the first build. The files under `src/generated/` are written from the spec, so change those through Smithable while you use it; after the next step they are ordinary files too.

## If you leave Smithable for good

This step is optional: the app already runs without Smithable. `smithable detach` (in the [Smithable CLI](start-local.md)) removes what only Smithable uses:

```console
$ smithable detach
Detached: 178 files no longer mention Smithable, the README is rewritten, and smithable.auth.yml, smithable.content.yml, smithable.ux.yml, smithable.yml moved to docs/smithable/ as documentation.
This is now an ordinary TanStack Start + Drizzle project.
```

It leaves the changes uncommitted, for you to look through and commit as one. Your own code in `src/custom/` is left as it is, and the app's checks pass as before:

```console
$ pnpm typecheck && pnpm test
 Test Files  2 passed (2)
      Tests  31 passed (31)
```

## What it needs of its own

The export holds the code and the data. These are set where the app runs, as environment variables, and none of them is in the download:

- **The session key**, `BETTER_AUTH_SECRET`: any long random value, kept the same from one start to the next, or everyone is signed out.
- **Its address**, `BETTER_AUTH_URL`: the address people use, such as `https://book.stillwater.example`. Your domain points at the server, and a proxy in front of the app (Caddy, nginx or Traefik) handles HTTPS; then set `TRUST_PROXY=1` ([Self-hosting](self-host.md#deploy-to-docker)).
- **Mail**, `SMTP_URL` (or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) and `MAIL_FROM`: a mail service's settings, for the sign-in codes and every mail the app sends.
- **Sign in with Google or Facebook**, if the app offers it: an OAuth client of your own, registered for the new address, as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (or `FACEBOOK_…`) ([Sign in with Google](google-sign-in.md)).
- **The app's assistant**: `ASSISTANT_URL`, `ASSISTANT_KEY` and `ASSISTANT_MODEL` for a model of your choice ([Ask](../ai.md#the-apps-assistant-ask)). Without them, Ask answers by its rules alone.
- **Integrations**: for each call out, the address and secret (`OUTGOING_<NAME>_URL`, `OUTGOING_<NAME>_SECRET`); for each call in, a secret (`INCOMING_<NAME>_SECRET`), which the service that calls needs too ([Integrations](integrations.md#on-smithableai-and-on-your-own-server)).
- **Backups**: on smithable.ai they are made for you; elsewhere `smithable backup` while you use Smithable ([Self-hosting](self-host.md#back-up-and-restore)), or a copy of the `data` folder made while the app is stopped.

[Self-hosting](self-host.md) goes on from here: deploying with the release checks, backups and updates.
