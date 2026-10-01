# Point-in-time recovery: any second of the last seven days, previewed before it is restored (design)

Status: proposed 2026-10-01 by Fable, from Johan's question "is PITR possible?" and his brainstorm: show it on the app's admin page, preview the data at that point, and say "412 new items, 668 updated, 12 removed since then". All of it is doable with what exists; §3.4 says how the numbers are computed exactly, and §3.5 goes one step further (bring back only the 12). Merging this document is the go-ahead; §5 splits the work. Step 1 (the stream) built 2026-10-01 by Opus (smithable-cloud#15), with two changes to §3.1 that the host forces. Litestream 0.5.17 runs *inside* each app's container as its entrypoint (running the app with `exec`), because gVisor keeps file locks inside its sandbox, so a process in a separate container could not follow the database safely. It writes to a host folder (`/srv/smithable/backups/pitr/<app>`) that the host copies to `pitr/` in the backups bucket every minute, so no AWS credentials enter a customer's container. `l0-retention` keeps the per-second files for the whole window, **30 days** as Johan set it on 2026-10-01 (with monthly copies of each app's data kept for a year, and service records and access logs for 90 days), (Litestream's default of 5 minutes would leave only 30 s, 5 min and 1 h steps). `publishes.json` sits beside each stream. The service's database is streamed too.

Today an app can be restored to a backup moment (after each session, nightly, kept 30 days in S3). This design makes it **any second within a retention window**, lets the owner **look before restoring**, and makes the common accident — records deleted or overwritten by mistake — a two-minute fix rather than a rollback of everything.

## 1. What people get

On the app's page in the hosted service (and, in the app itself, a link from the admin data page: "Restore data…"):

- **A timeline** of the last seven days (thirty on a paid plan) with a time picker to the second, and markers for what happened: sessions, publishes, schema changes, restores.
- **A preview at that time.** Choosing a time shows, within a few seconds, what has happened *since*: "Since Tue 14:36: **412 new** records, **668 changed**, **12 removed**", per model ("Bookings: 12 removed"), with the removed ones listed by name. A "Look" button opens the app **as it was** at that time, read-only, on its staging address, so the owner can check a record before deciding.
- **Two ways back:**
  - **Bring back the removed** (and, optionally, undo the changes to the 668): the current data stays, and the records that were lost since that time are put back. This is the case people actually have.
  - **Restore everything to that time**: the whole database as it was, after a plain-words confirmation ("This removes the 412 records added since Tue 14:36. A backup of today is kept for 30 days."). The app's schema at that time comes with it (§3.6).
- **Self-hosted:** `smithable restore --at "2026-10-01 14:36"` with the same preview printed as text, and `smithable backup --continuous --target s3://…` to keep the WAL stream that makes it possible.

Nothing changes in generated apps except one link on the admin page; the mechanism lives in the host (the service or the CLI), so the "no Smithable dependency" rule holds.

## 2. Why it fits

Every generated app runs SQLite in WAL mode, every table has `id`, `createdAt` and `updatedAt`, references declare `restrict` or `set null`, pictures are content-named files, and every schema change is a Git commit with its migration. Those five facts are what the design uses; none was added for it.

## 3. How it works

### 3.1 The stream: Litestream beside every database

[Litestream](https://litestream.io) tails a SQLite WAL and uploads its segments to S3 continuously (about every second while the database is written, nothing while it idles), with `litestream restore -timestamp` rebuilding the database as it was at any second the segments cover. Hosted, one Litestream process runs **beside** each published app and each workspace with data worth keeping, as a sidecar container sharing the app's data volume, writing to `pitr/<app>/` in the existing bucket; the service's own database gets one too. Retention (`-retention 168h`) is the window; S3 Object Lock covers the prefix as it does backups, so a deleted app's stream cannot be wiped by mistake for 14 days.

Cost: S3 PUTs, one per segment; an app with steady writes makes a few thousand a day (cents a month), an idle one none. Storage is the WAL's size, small for these apps. Restore time is proportional to the database's size: seconds for the megabytes a small business has.

The nightly `VACUUM INTO` backups stay (a full copy is the simplest thing to hand someone, and it is what the drill restores); Litestream adds the seconds between them.

### 3.2 Uploads and pictures

Pictures live as files, named by their content and never overwritten (articles.md). They are outside the WAL; the nightly copy has them, and a restore to a time keeps the current files, so a picture restored with its record is there unless it was uploaded and removed between two nightly copies — a corner the preview can name ("2 pictures from that time are no longer stored").

### 3.3 The preview: restore into a scratch file

Choosing a time makes the service restore the stream **into a scratch file** (`/srv/smithable/pitr/<app>/<timestamp>.db`), kept for the session and reused when the owner moves the picker back. Nothing touches the live database. Everything below reads that file next to the live one.

### 3.4 The numbers: "412 new, 668 changed, 12 removed"

With the live database and the scratch one open in one connection (`ATTACH DATABASE … AS then`), each model's table is compared by `id` and `updatedAt`:

```sql
-- new since then: in the live table, not in the old one
SELECT count(*) FROM main.bookings b WHERE NOT EXISTS (SELECT 1 FROM then.bookings t WHERE t.id = b.id);
-- removed since then: in the old table, not in the live one
SELECT count(*) FROM then.bookings t WHERE NOT EXISTS (SELECT 1 FROM main.bookings b WHERE b.id = t.id);
-- changed since then: in both, written since
SELECT count(*) FROM main.bookings b JOIN then.bookings t ON t.id = b.id WHERE b.updated_at <> t.updated_at;
```

Three queries per model, indexed by the primary key: milliseconds. The removed records are listed by their title field (the same `titleField` the kit uses) so the owner reads "Anna Berg, 30 Sept 09:00", not an id. Ids are never reused (SQLite `AUTOINCREMENT`), so a record deleted and another created never masquerade as a change.

### 3.5 Bringing back only what was lost

"Bring back the 12 removed" inserts the rows of `then.bookings` that are missing from `main.bookings`, in dependency order (the models' order the seed already uses), inside one transaction:

- A record whose reference points at something that no longer exists (its session was removed too) is brought back with it when that record is in the same selection, or refused with the reason ("Anna Berg's booking needs session Vinyasa 09:00, which is also gone: bring both back").
- "Undo the changes to the 668" copies the old row over the current one, for the records the owner ticks or all of them; the current values go into the day's backup first.
- Both run through the app's own database, not its data functions (there is no viewer; this is the owner restoring their data), and they are logged in the change trace as a restore, undoable for the session like any change: the scratch file of "now" is kept until the next restore or for 24 hours, so a restore can itself be undone.

### 3.6 Schema at that time

If the app's schema changed since the chosen time (a field added, a model removed), the old database does not fit the current code. The stream is tagged with the app's spec commit at each publish (`pitr/<app>/publishes.json`: time → commit), so the service knows the schema at any time:

- **Bring back / undo changes** (§3.5) maps old rows onto the current schema: columns that no longer exist are dropped with a note, columns added since get their default. This covers almost every accident, since schema changes are rare next to data changes.
- **Restore everything** to a time before a schema change restores the app *at that commit* to staging first (the code, the migrations and the data of that moment), and putting it live means the current schema changes are undone too — said in words before confirming ("This also takes back the field 'waiting list' added on Wed").

### 3.7 Where it shows

- **Hosted:** the app's page in the service gets a "Data" section with the timeline, the preview and the two buttons; Studio's data page (the app's admin view) gets a link "Restore data…" that opens it. The preview's "Look" starts the restored database on the staging address (`st-<id>`) with a banner "Data as of Tue 14:36, read-only", using the existing staging path; it is stopped when the owner leaves or restores.
- **The generated app's admin page** shows only the link, and only when the app runs hosted (an environment variable the service sets, `SMITHABLE_HOST_URL`); self-hosted apps show nothing and use the CLI.
- **CLI:** `smithable restore --at <time> [--preview] [--bring-back Model,...] [--all]` prints the same counts and names, and `smithable backup --continuous --target s3://bucket/prefix` runs Litestream (detected, not bundled, like the security tools) for a self-hosted app.

## 4. What it does not do

- It is not versioning of individual records for users of the app (a history tab per record); that is a different feature with its own table, and this design would make it cheap later since the stream has every state.
- It does not protect against a compromised host deleting the bucket: Object Lock and the separate backup copy do, as today.
- Seven days is the beta's promise, not a hard limit: the window is a number.

## 5. Order of work

1. **Stream (cloud):** Litestream sidecar per published app and workspace, the service's database too; retention, Object Lock on the prefix, `publishes.json` tags; the restore drill also restores one app to a random second of the last day and checks it opens. Opus.
2. **Preview and restore (cloud):** the scratch restore, the counts and names (§3.4), the staging "Look", bring back and undo changes (§3.5) with the schema mapping (§3.6), the app page's Data section, the change-trace entry and its undo. Fable (the diff and the mapping are engine-shaped: a `packages/core` module, `dataDiff(models, then, now)`, the service calls it).
3. **The link on the admin page** (adapter, tiny) and the CLI's `restore --at` and `backup --continuous`. Fable.
4. **Docs:** ARCHITECTURE §12 (backups), the deployment contract, the hosted docs and the beta terms' "backups up to 30 days" line become "every second of the last 7 days, and daily copies for 30".

Steps 1 and 2 are two to three days each; 3 a day. The legal must-builds (account deletion, backup deletion) come first, since a restore feature and a deletion promise touch the same bucket and should be designed as one lifecycle.
