# A fast start for every app: workspaces that are not tied to a starter

Status: built and live on the beta, 2026-10-05 (engine #353, cloud #116). On the host a starter without a workspace of its own now opens Studio in 2 to 3 s and its first page in 5 to 6 s; cold it was 18 s and 29 s. Proposed 2026-10-05 by Fable, on Johan's idea and go-ahead of the same day ("Could some
studios be running and the spec and content etc replaced to a specific app? Then we could have a
pool of these and only cold start the preview?" … "Yes, do it"). B agreed on the same day: finished projects in the image, the claim calls Studio's API with the
proxy's token, and the flag only for a workspace nobody has claimed.

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

What a claim then costs depends on what happens to the preview's dev server.

### Started again, or kept running

On the host the dev server takes 15 to 17 s to answer after it is started (B's log lines from
release e311018; 3 s locally). A profile taken there (16.5 s, `~/repos/smithable-profiles`) has
no one culprit: Vite is ready after 4.3 s, and the first answer comes 12 s later, when the whole
app's server side has been compiled, file by file. Looking up and loading files from disk is
about 4.7 s of it, waiting on background work 2.7 s, Vite's own work 2.4 s, Tailwind 2.3 s,
TanStack's compile of the pages 1.9 s, memory clean-up 1.3 s, Prettier (the route tree) 0.6 s.
Settings would shave a fifth, not five times.

So the dev server is not started again. A finished project comes in under the running preview
the way any change does: only the files that differ are written, each whole and under a new
name that takes the old one's place, and what is the same is not touched (the kit, the
settings). The dev server keeps what it has compiled of the shared files and takes in the rest.
The database is another file now, so the module that opens it is marked as changed and the
app's server side loads anew.

Measured locally (records to booking, 144 files written or removed of about 150 that differ):

| | the new app's page answers |
|---|---|
| preview's process started again | 3.3 to 3.9 s after the request |
| kept running, only what differs written | 0.8 to 2.9 s |
| every file rewritten under the running server | 13 s (it stumbles over the half-swapped state and restarts itself: not done) |

On the host (B, two runs of the smoke check after cloud #116; marketplace, which has no waiting
workspace of its own, claiming a generic one that waited with the records starter):

| | cold, the same release | with the swap |
|---|---|---|
| the replace request, to its answer | | 1.8 s and 1.6 s |
| "Build it" to Studio answering | 18 s | 3 s and 2 s |
| "Build it" to the new app's first page | 29 s | 6 s and 5 s |

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

   A finished project (`from`): what is gone is removed, what differs is written, nothing else
   is touched; the name and the administrator are applied and the files that follow from them
   generated again (no tool runs: the tables are the same); the database is opened again; the
   pages that are open are told when the dev server has settled. The preview's process is the
   same before and after. An app from a description is made beside the project as
   `smithable new` makes it, on the packages installed there (a link, and no install), and then
   comes in the same way, so the preview is not started for it either and a description that
   fails never leaves the project empty; if the model cannot make it, the starter is made
   instead and Studio says why, once.
   Either way the project's history starts anew (no Git repository until its first change, as
   for a new app), and Studio's memory of the old one goes: its log, a pending proposal, a
   notice. It refuses when the packages of what comes in are not the ones installed (another
   stack profile, or packages the owner added), and may then be asked again.

3. **The preview never recompiles its dependencies after a swap.** Today an app with a Markdown
   field brings `react-markdown` into Vite's dependency list and one without does not, so a
   swap from the second to the first compiles it on the first visit and reloads the page. The
   generated `vite.config.ts` lists it for every app (`optimizeDeps.include`); it is the only
   dependency that differs across the seven starters (twenty are compiled in all, each
   starter's list read from Vite's own record).

4. **A check**, in `test-studio`: Studio started with `--replaceable` on one starter; an app
   with other packages is refused; a finished booking project comes in, Studio shows it under
   the person's name, the preview answers on a page only it has, the history is empty, nothing
   was bundled again, and a second replacement is refused. From a description without a model:
   the starter comes in and Studio says why. Without the flag: refused, nothing touched.

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

## What it gives

| Path | before (host) | now |
|---|---|---|
| A starter with a workspace of its own | about 5 s | the same (the pool keeps one for the CRM) |
| Any other starter | Studio 15 to 18 s, first page 27 to 29 s | Studio 2 to 3 s, first page 5 to 6 s |
| A described app | the draft, then the cold path (27 to 29 s) | the draft, then about 2 s: the preview answered 32 s after "Build it", of which 5 s were the questions and 24.5 s the replace request with a real draft in it |

As set up on the service: the pool waits as `crm:1,any:2`; the finished projects are made where
the prepared dependency set is made and are at `/opt/starters/<name>`; a replace that fails has
the workspace made again from nothing.

## B's answers (2026-10-05)

`from` is a directory in the image (`/opt/deps/starters/<name>`, made where the prepared set
is made). The claim calls Studio's API itself with the proxy's token. Nothing of the workspace
needs to survive on the service's side. `--replaceable` is passed only when a workspace nobody
has claimed starts: a claimed one that is stopped as idle and started again must not get it.

## After an undo

The same way of taking in a database that was put back spares the preview its start after an
undo, a redo and a change that was rolled back (#358): the snapshot takes the old file's place
by rename, and the preview opens it in the process it runs in. On the host (B, release with
engine 2ca3155, a CRM demo, two rounds): the undo request answered in 0.5 and 0.4 s, and the
preview's page answered 0.7 and 1.0 s after that. Before, it was a dev server start, about 15 s.

## Next

A described app still keeps the person on the service's "Starting" page until the replace
request has answered, draft included (about 30 s). Studio could be shown at once and say that
the app is being made; the time is the draft's either way.

One known leftover: the connection to the old database stays open on the file that is gone until
the preview's process ends. One connection for a replacement or an undo.
