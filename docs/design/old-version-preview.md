# Looking at an old version

Design, 2026-11-13 (Fable). Not built. It settles the one open part of milestones and summaries in Changes: opening the app as it was at an earlier change, without that old app ever touching today's data or reaching anyone outside.

## 1. The problem

Studio's preview is the project's own folder served by the development server, with the database in `data/db/app.db` and uploads, mail and text outboxes beside it under `data/`. Every change is one commit, and before it is written the database is copied whole into `data/.smithable/snapshots/`.

An old version is old code with an old schema. Run in the project's folder it would open today's database, apply or miss migrations against it, and send today's waiting mail and calls to other services with yesterday's code. So it must not run there.

## 2. The rule

**An old version runs as a copy: its own folder, its own data, its own port, and an environment that holds nothing with which it could reach outside.** What is done in it is discarded when it is closed, and nothing it does can be seen from the project's own preview.

Three choices were weighed for its data:

| Data | Verdict |
|---|---|
| Today's data, opened read-only | No. The old code expects the old schema; a read-only database also breaks sign-in and every page that writes on load. |
| The samples, seeded fresh | Yes, as the fallback: always possible, since the samples, the seed and the migrations are in the commit. |
| The data as it was at that version (the snapshot) | Yes, as the first choice while the snapshot exists: it is what "the app as it was" means to a person. |

## 3. How it runs

1. **The code.** `git worktree add --detach` of the chosen commit into a folder of Studio's own outside the project (under the user's cache folder, named by project and commit), with Git's hooks switched off for the command. Outside, so that the project's own development server, its file watchers and its build never see the old files, and so that the old app finds no `.env` of the project above it; the worktree itself has none, since those files are never committed. The project's own working tree is never checked out to another commit for this. The old app runs no Git command.
2. **Its packages** are installed for the worktree from the project's own package store (as `pnpm store path` names it in the project, passed on explicitly, since the copy's home is empty) with the commit's own lockfile. Never a link to the project's installed packages: the two servers would share build caches. With the same lockfile this takes seconds; with another it can take a minute, and Studio says so.
3. **Its data**, in the worktree's own `data/` folder, with the server started in the worktree and `DATA_DIR` pointing there. An app from before `DATA_DIR` opens `data/` under the folder it is started in, which is the same place, so both generations are held apart.
   - The database: the snapshot taken before the next change after the chosen one holds the data as it was when that version was the current one, the person's own edits up to then included. It is opened read-only and copied (`VACUUM INTO`) into the worktree; the snapshot file is not changed. When that snapshot is gone (only those of the last fifty changes are kept, a milestone's too), the database is made new from the commit's migrations and seeded from its samples, and Studio says "with sample data". The newest change is the app as it is now and has no such view.
   - Uploads: a copy of today's `data/uploads` when the folder is under 200 MB in all, so pictures show; a file removed since then is missing and the bar says the pictures are today's. Above 200 MB none are copied, and Studio says so. A real copy, never a link of any kind: the old app may delete or replace a record's file.
   - Outboxes start empty.
4. **Its environment is a list of what is allowed, not of what is removed**: the path, Node's own variables, a home folder that is an empty one made for it (so no credentials file of the user's is in reach), the preview's own three settings (the key Studio's look editor uses, a new secret for the sample users' sign-in door, and the address it is served at) and `DATA_DIR`. No mail server, no SMS provider, no payment keys, no addresses or secrets of other services, no mailbox to read, no assistant key. With none of those set the app's own fallbacks apply: mail and texts are written as files into its own outbox folder, calls to other services (webhooks) are skipped, payments use the test provider, the assistant is off. That holds for its background work too (timers, queues): whatever the copied database's queues hold is "sent" into the copy's own folder and nowhere else.
5. **Its port** is a free one Studio picks and records; the address setting follows it. It is served on `127.0.0.1`, while the preview is on `localhost`: ports do not separate cookies, so on one host name the copy's session would replace the preview's. One old version is open at a time. Preparing it (the install, the seeding) runs beside Studio, never holding its other requests up; asking for another, or closing, stops the commands still running before the folder is removed, so an install cannot make the folder again after the clean-up.
6. **Its end.** Closing it, opening another, or stopping Studio stops its server with its whole process group (the one this Studio started, directly, on any system) and removes the worktree (also from Git's list of worktrees), its packages, its data and its home folder. Studio keeps a record of the open one beside its own state and, when it starts, removes any that a crash left behind. A crash's server is stopped only when it can be told for the one started in the copy (by its working folder, on Linux); elsewhere (macOS) it is left, and if its port still answers Studio tells the person its process and port.
7. **Until it is closed** the copy holds a copy of the real dev data under the user's cache folder.

## 4. What a person sees

In Changes, each change and each milestone has **See this version**. The old app opens in a tab of its own, and the preview pane shows a bar from Studio (not from the app). A tab, not a frame: the copy is on another host name than Studio's page, and a framed page from another site keeps no sign-in cookie (SameSite, and browsers that block third-party cookies). The copy's cookies are left as its code makes them. The tab is opened at the click, so it is not a blocked pop-up, and with no way back to Studio's page (its opener is cut before it loads); Back to now closes it:

> **The app as it was on 12 November, 14:02** · after "Instructors: added a phone" · a copy with the data from then (or: with sample data). Nothing you do here is kept. — **Back to now**

The person signs in as in the preview: a development build, so the sign-in page offers each role, with the data from then or with samples alike. They can click through it like the preview, also add or remove records: it is a copy and is discarded when the view is closed. Bringing an old version back stays what it is today (undo, or going back by a new change); this view only shows.

While an old version is open the Builder and the forms are not offered for it: changes are made to the app as it is now.

## 5. What must hold, and its tests

- With the project's own preview idle, its `data/db/app.db`, uploads, outboxes and snapshots are byte-for-byte the same after an old version was opened, used (records added, a file removed, a mail-sending action run) and closed.
- The old version's process has none of the outside settings, tested with every one of them set where Studio runs.
- A mail queued in the copied database ends as a file in the copy's outbox.
- A commit with a different lockfile opens; a commit whose snapshot is gone opens with samples.
- Closing, switching and a killed Studio leave no worktree and no server behind.
- The project's working tree, branch and installed packages are untouched throughout, and Git lists no extra worktree afterwards.
- The old version's process cannot read a file in the user's real home folder through its home setting.

## 6. On the hosted service

The workspace's proxy has to pass the second port, and the copy counts against the workspace's disk and memory (a second dev server takes 600 to 1,150 MB), so one at a time holds there too. That is a change of the service and is planned with it. Until then a hosted Studio does not offer **See this version**, and its API refuses to open one.

## 6b. A held fix opened on its branch

A held fix (fixes-reach-apps §5) is opened to be edited, not looked at, so it is checked out on its own branch in the project's folder as before. Its code and its migrations meet the project's one dev database, though: so opening it keeps a snapshot of that database, and once the project is on another branch again (the owner switched back, or published), Studio puts the database back as it was before the fix was opened and says so: what changed in the dev data while the fix was open is gone. Opening a second fix while the first one's data is kept puts that back first, then keeps today's for the second. The kept snapshot is never pruned with undo's. The held version's migrations never stay on today's dev data. Opening a fix in a copy like an old version, with the owner's edits brought back into the project as one change, is an open design question.

## 7. Not in this note

The rule for a proposal made against an older state (the stale plan) is in change-verified.md. Comparing two versions side by side, and keeping an old version open as a second app, are not planned.
