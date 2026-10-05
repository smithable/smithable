# A fast start for every app: workspaces that are not tied to a starter

Status: proposed 2026-10-05 by Fable, on Johan's idea and go-ahead of the same day ("Could some
studios be running and the spec and content etc replaced to a specific app? Then we could have a
pool of these and only cold start the preview?" … "Yes, do it"). For review by B before either
side builds. Not built.

## Where the time goes today

On the hosted beta (B's measurements, 2026-10-05, idle host, two vCPUs, gVisor):

| Path | Studio answers | Preview answers |
|---|---|---|
| A starter with a running workspace waiting (crm, booking, invoicing) | about 5 s | about 5 s |
| Any other starter, cold | 15 s | 25 to 27 s |
| The same, prepared and stopped, then started (measured as a reopened project) | 9 s | 17 s |
| A described app | the draft (about 10 s) and then the cold path | |

A cold start is: the container (2 s), `smithable new` (about 13 s: generate, the first migration,
the sample records), Studio's own start, then the preview's dev server (about 10 s).

Locally, without the sandbox, the same cold start is about 9 s, of which the preview is 3 s:
Vite is ready in 0.6 s, the app's server side answers `/health` at about 2.9 s, and the warm-up
of the start page's 240 modules ends at about 4.3 s.

## What does not help: a shared dependency cache

Measured three times each on an idle machine (the CRM): with Vite's dependency cache present the
preview answers 0.2 to 0.4 s sooner than with none (2.7 s against 3.0 s). Vite 8 bundles the
twenty dependencies in a fraction of a second. So a cache built once and shared by every
workspace is not worth building. One line of it is needed for the rest of this note, below.

## The idea

Since #327 every app of a stack profile has the same packages. So a running workspace is no
longer a CRM's or a booking site's by what is installed in it: only its project files say which
app it is. A workspace can therefore wait with Studio running, and get its app when someone
claims it.

Tried by hand locally: under a running Studio, a CRM's files were replaced by the marketplace
starter's (everything but `node_modules` and Studio's own preview settings) in under half a
second. Studio showed the new app at its next request with no restart; the preview's dev server
was started again and answered on the new app.

What a claim then costs is the preview's start alone: about 3 s locally, so an estimated 8 to
10 s on the host, with Studio on the screen from the first second. That is for all seven
starters from one pool, where today three have a workspace of their own and four start cold.

## Design

### The engine

1. **`smithable studio --replaceable`.** Studio starts on a project as usual (any starter: it
   is only there so the dependencies are linked and the dev server has run once), and accepts
   one replacement of that project. Without the flag the request below is refused: on a
   person's own project it would destroy it. After one replacement the flag is spent.

2. **`POST /api/project/replace`**, guarded like every change (Studio's own page or, hosted, the
   proxy's token). Its body says where the app comes from:
   - `{ "from": "<directory>" }`: a finished project on the workspace's own disk, as
     `smithable new` made it: spec files, generated code, migrations, the database with its
     sample records. Everything but `node_modules`.
   - `{ "describe": "…", "starter": "…", "answers": "…" }`: Studio makes the app itself, as
     `smithable new --describe` does, with the model it is configured with.
   - with either: `name` (the app's name as the person typed it) and `admin` (their address),
     applied before the answer.

   What it does, in this order: stops the preview; removes the project's files except
   `node_modules`; puts the new ones in; writes its own preview settings again; applies the name
   and the administrator; starts the preview; tells the pages that are open; answers. The
   project's history starts anew (no Git repository until its first change, as for a new app),
   and Studio's memory of the old one goes: its log, a pending proposal, the last failure.
   It refuses when the packages of what comes in are not the ones installed (another stack
   profile, or packages the owner added): then the workspace is not the place for it.

3. **The preview never recompiles its dependencies after a swap.** Today an app with a Markdown
   field brings `react-markdown` into Vite's dependency list and one without does not, so a
   swap from the second to the first compiles it on the first visit and reloads the page. The
   generated `vite.config.ts` lists it for every app (`optimizeDeps.include`); it is the only
   dependency that differs across the seven starters (twenty are compiled in all, each
   starter's list read from Vite's own record).

4. **A check**, in `test-studio`: Studio started with `--replaceable` on the CRM; replaced by a
   finished booking project; Studio shows the booking app, the preview answers on it and shows
   a booking page, the history is empty, nothing recompiled, and a second replacement is
   refused. Without the flag: refused, nothing touched.

### The service (B)

5. **The pool holds workspaces that are no starter's.** `POOL` becomes a number, not a list by
   starter. A waiting workspace runs Studio with `--replaceable` on a small starter, with its
   preview answering.

6. **The finished projects** of the seven starters are made once, where the prepared dependency
   set is made (`smithable new <dir> --starter <name>`, then without `node_modules`), and are
   in the image, say `/opt/deps/starters/<name>`. They are made again when the engine changes,
   as the set is.

7. **A claim** for a starter: `POST /api/project/replace` with `from`, the name and the
   administrator; then what a claim does today. For a description: the workspace is claimed at
   once, Studio opens, and the same request carries `describe` and the answers.

8. **The smoke check** claims a starter that used to start cold (marketplace) and holds the
   preview to a tighter time than 90 s once the numbers are known.

## What it should give

| Path | today | with this (estimated) |
|---|---|---|
| Any starter | 5 s for three, 25 s for four | Studio at once, preview in 8 to 10 s |
| A described app | draft, then 25 s | Studio at once; draft, then generate and migrate, then the preview |
| Memory | three running workspaces, one per starter | as many as the pool is set to, serving every path |

The three starters that have a workspace of their own today would go from about 5 s to about
8 to 10 s for the preview. If that matters, the pool can keep one of the most used starter
ready-made beside the generic ones; B's numbers after the first build decide.

## Open questions for B

- Is `from` a directory in the image right for you, or would you rather send the files in the
  request?
- Does the claim reach Studio's API with the proxy's token today, or only through the workspace's
  start script?
- What must not survive a swap on your side (the workspace's id, AI token and addresses are the
  entry's from the start, so nothing, I think)?
- The preview timings of release e311018 from the host, cold and pooled: they replace the
  estimates above.

## Not in this

Keeping the dev server running across the swap (no restart at all). It would save most of the
remaining seconds, but the server side holds the old database open and Studio already restarts
the preview after every rollback for that reason. To look at only if 8 to 10 s is not enough.
