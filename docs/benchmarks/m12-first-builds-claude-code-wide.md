# M12 first builds: claude-code, the second set (2026-10-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 22 / 22 created, 21 type-check, 620,775 tokens (563,311 in, 57,464 out), $1.5571 (as Claude Code reports it; the run was on a subscription); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 23,636 | 1,994 | $0.0582 | 0 | 1 | 33 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | **no** | 23,578 | 2,334 | $0.0645 | 0 | 1 | 33 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 24,024 | 2,182 | $0.0651 | 0 | 1 | 32 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 22,935 | 1,583 | $0.0444 | 0 | 1 | 25 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 23,635 | 2,007 | $0.0584 | 0 | 1 | 31 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 23,636 | 2,207 | $0.0624 | 0 | 1 | 36 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 23,069 | 1,682 | $0.0474 | 0 | 1 | 53 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 46,774 | 2,208 | $0.0768 | 0 | 2 | 58 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 22,931 | 1,820 | $0.0491 | 0 | 1 | 45 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 22,933 | 1,488 | $0.0424 | 0 | 1 | 34 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 24,027 | 2,844 | $0.0783 | 0 | 1 | 44 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 24,022 | 2,872 | $0.0788 | 0 | 1 | 44 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 22,925 | 1,531 | $0.0432 | 0 | 1 | 32 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 22,936 | 1,808 | $0.0489 | 0 | 1 | 34 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 22,934 | 979 | $0.0323 | 0 | 1 | 28 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 47,121 | 2,491 | $0.0852 | 0 | 2 | 43 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 23,992 | 3,680 | $0.0948 | 0 | 1 | 47 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 23,605 | 5,431 | $0.1267 | 0 | 1 | 61 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 23,042 | 2,500 | $0.0636 | 0 | 1 | 35 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 24,000 | 4,263 | $0.1065 | 0 | 1 | 57 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 23,556 | 4,678 | $0.1112 | 0 | 1 | 52 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | booking | yes | yes | 24,000 | 4,882 | $0.1189 | 0 | 1 | 59 s |

Each created app's four spec files are in [m12-first-builds-claude-code-wide/](m12-first-builds-claude-code-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 2 | 1 / 4 (has 3) | 2 / 7 (has 4) | 0 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 3 | 0 / 2 (has 2) | 1 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 1 (no-timezone) | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | booking | 3 | 1 / 6 (has 4) | 4 / 10 (has 7) | 0 / 0 (has 0) | private; admin, customer (customer) | slots: admin, stylists: admin, services: admin | pages home, schedule; read Service, Stylist, Slot; create none | 2 (no-timezone, shortcut-closed) | none | 0 / 4 | no mention; landing page | en | | | | |
| 4 | records (words: crm) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 3 | 3 / 4 (has 4) | 4 / 7 (has 5) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 3 | 2 / 4 (has 3) | 3 / 7 (has 5) | 2 / 2 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 3 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 3 | 1 / 1 (has 1) | 1 / 4 (has 3) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 2 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 1 / 1 (has 1) | 2 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, items; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 3 | 4 / 4 (has 4) | 6 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, it, staff (staff) | none | pages none; read none; create none | 0 | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 3 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 4) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 3 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 3 (sv: yes (kunderna, ett, för)) | 1 / 6 (has 4) | 2 / 10 (has 7) | 0 / 0 (has 0) | private; admin, customer (customer) | tider: admin, tjanster: admin, frisorer: admin | pages home, boka; read Service, Stylist, Slot; create none | 1 (shortcut-closed) | none | 0 / 4 | no mention; landing page | sv | no | yes (tid, bokning, till) | yes (boka, på, nätet) | models 4/4, fields 14/16, pages 7/7 |
| 18 | invoicing (words: records) | 3 (sv: yes (ska, att, en)) | 2 / 4 (has 5) | 0 / 7 (has 7) | 2 / 2 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 5 | no mention; no landing page | sv | no | yes (till) | none | models 5/5, fields 26/32, pages 6/7 |
| 19 | marketplace (words: records) | 3 (sv: yes (ska, lägga, saker)) | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris, till) | yes (på, vår, loppis) | models 1/1, fields 7/7, pages 4/4 |
| 20 | booking (words: records) | 3 (fi: yes (asiakkaat, tai)) | 4 / 6 (has 4) | 7 / 10 (has 7) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (shortcut-closed) | none | 3 / 4 | no mention; landing page | fi | no | yes (varaukset, varaus) | yes (ja, verkossa, tunnit) | models 4/4, fields 14/14, pages 7/7 |
| 21 | crm (words: records) | 3 (fi: yes (asiakkaat, tai)) | 1 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 4 | no mention; no landing page | fi | no | no | none | models 4/4, fields 24/27, pages 4/5 |
| 22 | booking (words: records) | 3 (de: yes (die, vorbestellungen, abholzeiten)) | 0 / 6 (has 4) | 2 / 10 (has 5) | 0 / 0 (has 3) | private; admin, customer (customer) | none | pages home, produkte; read Product; create none | 1 (capacity-no-unique) | none | 0 / 4 | no mention; landing page | de | yes (hofladen) | no | yes (und, hofladen) | models 4/4, fields 14/16, pages 5/5 |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Translation Clients
  Keep track of my translation clients, the quotes I send them and the payments they make.

Pages
  - Clients (lists clients; search by name, company or email)
  - Quotes (lists quotes; filter by status or client; “Mark accepted”; “Mark declined”)
  - Payments (lists payments)
  - Overview (a dashboard: open quotes, accepted quotes, received and latest payments)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - a company
  - notes
  Each client lists its quotes.
  Each client lists its payments.

Quotes
  Quotes have:
  - a client (a client, required)
  - a description (required)
  - a source language
  - a target language
  - a word count (a whole number)
  - an amount (an amount, required)
  - quoted on (a date, required, today by default)
  - status (sent, accepted or declined, sent by default)
  Each quote lists its payments.

Payments
  Payments have:
  - a client (a client, required)
  - a quote (a quote)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - notes

Mark accepted
  For a quote that is sent; sets status to accepted.
  The client accepted the quote.

Mark declined
  For a quote that is sent; sets status to declined.
  The client declined the quote.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 9 columns 0 indexes 1 fks
payments 9 columns 0 indexes 3 fks
quotes 12 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_majestic_xavin.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-1. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-1
  smithable run

/tmp/smithable-bench-m12-4VaGel/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-4VaGel/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-4VaGel/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-4VaGel/app-1/src/db/seed.ts:29:6)
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  code: 'SQLITE_CONSTRAINT_FOREIGNKEY'
}

Node.js v24.21.0
Could not add sample data; the app works without it.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Agency Pipeline
  A sales pipeline for our web agency: leads, deals and who follows up when.

Pages
  - Deals (lists deals; search by title; “Mark won”; “Mark lost”)
  - Leads (lists leads; search by company, contact name or email; “Qualify”; “Disqualify”)
  - Follow ups (a calendar of deals by week or month)
  - Overview (a dashboard: open pipeline, open deals, won deals and new leads)
  - Team (who has access: invite people, change roles, remove users)

Leads
  Leads have:
  - a company (required)
  - a contact name
  - an email
  - a phone
  - a website (a web address)
  - a source (referral, website, outreach, event or other, referral by default)
  - status (new, contacted, qualified or disqualified, new by default)
  - a next follow up (a date)
  - notes
  Each lead can have an assigned to (a user).
  Each lead lists its deals.
  Only admins can delete leads.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a stage (proposal, negotiation, won or lost, proposal by default)
  - a value (an amount)
  - a next follow up (a date)
  - an expected close (a date)
  - closed at (a date)
  - a lost reason
  - notes
  Each deal can have an assigned to (a user).
  Only admins can delete deals.

Qualify
  For a lead that is new or contacted; sets status to qualified.
  Mark a lead as a real sales opportunity.

Disqualify
  For a lead that is new, contacted or qualified; sets status to disqualified.
  Drop a lead that is not a fit.

Mark won
  For a deal that is proposal or negotiation; sets stage to won and closed at to today.
  Close a deal as won.

Mark lost
  For a deal that is proposal or negotiation; sets stage to lost and closed at to today; asks for the lost reason.
  Close a deal as lost, with the reason.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Works with leads and deals)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-2/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
deals 14 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 14 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_massive_sway.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-2. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-2
  smithable run
/tmp/smithable-bench-m12-4VaGel/app-2/smithable.yml:47:14  warning  Page "follow-ups" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Salon Booking
  Online booking for a hair salon where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists, faq, call to action and footer)
  - Free times (a calendar of slots by week or month)
  - My bookings (lists bookings)
  - Slots (lists slots; filter by stylist or starts at; only for admins)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Admin (every kind of record, to find, open, change and delete)

Services
  Services have:
  - a name (required)
  - a summary
  - duration minutes (a whole number, required, 45 by default)
  Only admins can add services.

Stylists
  Stylists have:
  - a name (required)
  - a bio
  Only admins can add stylists.

Slots
  Slots have:
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  Each slot lists its bookings.
  The places left is calculated as 1 minus the number of its bookings.
  Only admins can add slots.

Bookings
  Bookings have:
  - a slot (a slot, required, unique)
  - a service (a service, required)
  - a note
  At most 1 bookings per slot.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services and free times)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page, the schedule page, reading services, reading stylists and reading slots.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 113 files (113 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-3/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 7 columns 1 indexes 3 fks
services 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
slots 7 columns 0 indexes 2 fks
stylists 6 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_grey_madame_web.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-3. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-3
  smithable run
/tmp/smithable-bench-m12-4VaGel/app-3/smithable.yml:53:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-4VaGel/app-3/smithable.auth.yml:6:11  warning  Visitors can't open my-bookings from the home hero's shortcuts: list it under public.pages, or choose another page.
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's pupils, their weekly lesson times and the pieces each one practises.

Pages
  - Pupils (lists pupils; search by name or notes; filter by lesson day, level or status)
  - Pieces (lists pieces; search by title or composer; filter by pupil or status; “Start polishing”; “Mark done”)

Pupils
  Pupils have:
  - a name (required)
  - a lesson day (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a lesson time
  - lesson minutes (a whole number, 30 by default)
  - a level (beginner, intermediate or advanced, beginner by default)
  - status (active, paused or left, active by default)
  - an email
  - a phone
  - notes
  Each pupil lists its pieces.

Pieces
  Pieces have:
  - a pupil (a pupil, required)
  - a title (required)
  - a composer
  - status (learning, polishing or done, learning by default)
  - started on (a date, today by default)
  - practice notes

Start polishing
  For a piece that is learning; sets status to polishing.
  Mark that the pupil knows the notes and is now polishing the piece.

Mark done
  For a piece that is learning or polishing; sets status to done.
  Mark a piece as finished.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 88 files (88 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
pieces 10 columns 0 indexes 2 fks
pupils 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_puzzling_magma.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-4. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Shutter Ledger
  Invoices for my photography work: clients, shoots and what is still unpaid.

Pages
  - Overview (a dashboard: latest)
  - Invoices (lists invoices; filter by status or client; “Mark sent”; “Mark paid”)
  - Shoots (lists shoots; filter by kind, client or date)
  - Clients (lists clients; search by name or email)
  - Invoice lines (lists invoice lines)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - a phone
  - address
  - a VAT number
  Each client lists its shoots.
  Each client lists its invoices.

Shoots
  Shoots have:
  - a title (required)
  - a client (a client, required)
  - a date (required)
  - a kind (portrait, wedding, event, commercial, product or other, portrait by default)
  - a location
  - notes
  Each shoot lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

Invoice lines
  Invoice lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  The amount is calculated as the quantity times the unit price.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 102 files (102 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-5/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 9 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
shoots 10 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_parched_jean_grey.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-5. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-5
  smithable run

/tmp/smithable-bench-m12-4VaGel/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-4VaGel/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-4VaGel/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-4VaGel/app-5/src/db/seed.ts:29:6)
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  code: 'SQLITE_CONSTRAINT_FOREIGNKEY'
}

Node.js v24.21.0
Could not add sample data; the app works without it.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Tidy Ledger
  One place for our cleaning company to invoice its households every month and see what has been paid.

Pages
  - Invoices (lists invoices; search by number; filter by status, household or issued on; “Mark sent”; “Mark paid”; “Mark overdue”; “Duplicate invoice”)
  - Households (lists households; search by name, email or phone)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: latest)
  - Team (who has access: invite people, change roles, remove users)

Households
  Households have:
  - a name (required)
  - an email (required)
  - a phone
  - address
  - notes
  Each household lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a household (a household, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

Invoice lines
  Invoice lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  The amount is calculated as the quantity times the unit price.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the household.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The household paid the invoice.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The household has not paid by the due date.

Duplicate invoice
  Makes a copy of an invoice with status draft, issued on today and due on today plus 30 days, asking for the number; its lines are copied too.
  Start next month's invoice for the same household from this one.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 105 files (105 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-6/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
households 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_glossy_roulette.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-6. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Post things you want to sell, with photos and a price, and browse what your neighbors are selling.

Pages
  - For sale (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Home (a landing page: hero, items where available is yes and footer)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a price (an amount)
  - a category (furniture, clothing, books, bikes, electronics, toys, household or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the flea market tidy)
  - member (Sells and saves items)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_worthless_surge.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-7. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Shelf (lists items; search by title, description or pickup spot; filter by category, condition or status; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Team (who has access: invite people, change roles, remove users)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description
  - a category (furniture, books, electronics, kitchen, stationery, plants or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a pickup spot
  - status (available, claimed or gone, available by default)
  Each item can have a claimed by (a user).
  Only the owner and admins can delete items.
  Only the owner and admins can change items.

Claim
  For an item that is available; sets status to claimed and claimed by to whoever presses it.
  Claim an available item for yourself.
  Only member users and admins can use it.

Mark gone
  For an item that is claimed; sets status to gone.
  Mark the item as picked up.
  Only member users and admins can use it.

Release
  For an item that is claimed; sets status to available.
  Put a claimed item back on the shelf.
  Only member users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (Offers and claims items)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 12 columns 0 indexes 2 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_stiff_wallow.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-8. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Vinyl Shelf
  A personal catalog of my vinyl records: albums, artists, condition and what I paid.

Pages
  - Albums (lists albums; search by title, label or notes; filter by artist, condition or year; sort by title, year, price paid or bought on)
  - Artists (lists artists; search by name or country)
  - Overview (a dashboard: albums, total paid and latest)

Artists
  Artists have:
  - a name (required)
  - a country
  - notes
  Each artist lists its albums.

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number)
  - a label
  - a condition (mint, near mint, very good plus, very good, good or poor, mint by default)
  - a price paid (an amount)
  - bought on (a date)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-9/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
albums 12 columns 0 indexes 2 fks
artists 7 columns 0 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_abnormal_dagger.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-9. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Our local museum's collection online, so visitors can browse the objects and their stories.

Pages
  - Home (a landing page: hero, objects where status is published and footer)
  - Collection (lists objects; search by name, summary, story, category, maker or origin; filter by status)

Objects
  Objects have:
  - a name (required)
  - an accession number (unique)
  - a summary
  - a story
  - a category
  - a maker
  - an origin
  - a period
  - status (draft or published, draft by default)
  - a link (a web address)
  - added on (a date, required, today by default)
  Only admins can add objects.
  Only admins can change objects.
  Only admins can delete objects.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the collection)
  - member (Looks at it)
  New users get the member role.
  Open to anyone without signing in: the home page, the items page and reading items where status is published.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-10/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 15 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_early_crusher_hogan.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-10. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  See which of our IT systems are down, what is being done, and when they will be back.

Pages
  - Systems (lists components)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open, down and latest)
  - Team (who has access: invite people, change roles, remove users)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.
  Only it users and admins can change components.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - expected back at (a date and time)
  - resolved at (a date and time)
  - a summary
  Each incident lists its incident updates.
  Only it users and admins can change incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only it users and admins can change incident updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only it users and admins can change maintenances.

Identified
  For an incident that is investigating; sets status to identified; asks for the expected back at; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified with an expected time back, and an update saying so.
  Only it users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only it users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved. The system is back.).
  The incident is over and the system is back, with an update saying so.
  Only it users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - it (The IT team: writes incidents, updates, maintenance and system states)
  - staff (Sees what is down and when it is back)
  New users get the staff role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 106 files (106 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-11/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 11 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_acoustic_shotgun.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-11. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Check whether the municipality's online services are working, what is being fixed and what maintenance is planned.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Overview (a dashboard: open, per month and latest)
  - Team (who has access: invite people, change roles, remove users)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary
  Each incident lists its incident updates.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents, their updates and planned maintenance)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 109 files (109 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-12/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
api_key 10 columns 1 indexes 0 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_great_glorian.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-12. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuel entries)
  - Service (lists service visits; search by workshop or work; filter by kind or date)
  - Expenses (lists expenses; filter by category or date)
  - Overview (a dashboard: fuel costs, service costs, other costs and recent service)

Fuel entries
  Fuel entries have:
  - a date (required, today by default)
  - an odometer (a whole number)
  - liters (a number, required)
  - a total (an amount, required)
  - a full tank (yes or no, true by default)
  - a station
  The price per liter is calculated as the total divided by the liters.

Service visits
  Service visits have:
  - a date (required, today by default)
  - a kind (maintenance, repair, inspection, tires or other, maintenance by default)
  - an odometer (a whole number)
  - a workshop
  - a work
  - a cost (an amount)

Expenses
  Expenses have:
  - a date (required, today by default)
  - a category (insurance, tax, parking, tolls, washing or other, insurance by default)
  - an amount (an amount, required)
  - a note

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-13/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
expenses 8 columns 0 indexes 1 fks
fuel_entries 11 columns 0 indexes 1 fks
service_visits 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_eager_sentry.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-13. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guests
  The guest list and seating plan for our wedding, with who has answered and their meal choices.

Pages
  - Guests (lists guests; search by name or email; filter by rsvp, meal, table or side; “Mark attending”; “Mark declined”)
  - Tables (lists tables)
  - Overview (a dashboard: attending, awaiting answer, declined and vegetarian meals)
  - Team (who has access: invite people, change roles, remove users)

Tables
  Tables have:
  - a name (required)
  - seats (a whole number, required, 8 by default)
  - notes
  Each table lists its guests.

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - a side (both, bride or groom, both by default)
  - a rsvp (pending, attending or declined, pending by default)
  - a meal (undecided, meat, fish, vegetarian, vegan or child, undecided by default)
  - dietary notes
  - a table (a table)
  - notes

Mark attending
  For a guest that is pending or declined; sets rsvp to attending; asks for the meal.
  Record that the guest is coming, with their meal choice.

Mark declined
  For a guest that is pending or attending; sets rsvp to declined.
  Record that the guest cannot come.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-14/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
guests 13 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tables 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sloppy_prism.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-14. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-14
  smithable run
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Birding Log
  The club's shared record of bird sightings: which species, where, when and who saw it.

Pages
  - Sightings (lists sightings; search by place or notes)
  - Species (lists specieses; search by name or scientific name)
  - Team (who has access: invite people, change roles, remove users)

Specieses
  Specieses have:
  - a name (required, unique)
  - a scientific name
  - notes
  Each species lists its sightings.

Sightings
  Sightings have:
  - species (a species, required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a count (a whole number, 1 by default)
  - notes
  Each sighting can have an observer (a user).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (Logs and looks at sightings)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-15/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 10 columns 0 indexes 3 fks
specieses 7 columns 1 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_damp_gwen_stacy.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-15. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of who has which plot, the waiting list for plots and each member's yearly fee.

Pages
  - Plots (lists plots; search by number; filter by status or member; “Vacate”)
  - Members (lists members; search by name, email or phone)
  - Waiting list (lists waiting list; search by name or email; filter by status; “Offer plot”; “Mark allotted”; “Withdraw”)
  - Fees (lists fees; filter by status, year or member; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - address
  - a member since (a date, today by default)
  - notes
  Each member lists its plots.
  Each member lists its fees.

Plots
  Plots have:
  - a number (required, unique)
  - a size (m²) (a number)
  - a member (a member)
  - status (vacant or let, vacant by default)
  - notes

Waiting list
  Waiting list have:
  - a name (required)
  - an email
  - a phone
  - added on (a date, required, today by default)
  - status (waiting, offered, allotted or withdrawn, waiting by default)
  - notes

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (due or paid, due by default)
  - paid on (a date)

Mark paid
  For a fee that is due; sets status to paid and paid on to today.
  Record that a member has paid the yearly fee.

Offer plot
  For a waiting list entry that is waiting; sets status to offered.
  Note that a plot has been offered to this person.

Mark allotted
  For a waiting list entry that is offered; sets status to allotted.
  Note that the person accepted a plot.

Withdraw
  For a waiting list entry that is waiting or offered; sets status to withdrawn.
  Take the person off the waiting list.

Vacate
  For a plot that is let; sets status to vacant.
  Mark a plot as vacant when its member gives it up.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 109 files (109 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-16/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
fees 9 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
members 10 columns 0 indexes 1 fks
plots 9 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_list_entries 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_cool_captain_stacy.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-16. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Salongen
  Onlinebokning för en frisörsalong där kunderna själva bokar sin tid.

Pages
  - Hem (a landing page: hero, tjänster, frisörer, faq, call to action and footer)
  - Boka tid (a calendar of slots by week or month)
  - Mina bokningar (lists bokningar)
  - Tider (lists tider; only for admins)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Hem page)
  - Frisörer (lists frisörer; only for admins; visitors see frisörer on the Hem page)
  - Administration (every kind of record, to find, open, change and delete)

Tjänster
  Tjänster have:
  - a namn (required)
  - a beskrivning
  - a längd (minuter) (a whole number, required, 45 by default)
  - pris (an amount)
  Only admins can add tjänster.

Frisörer
  Frisörer have:
  - a namn (required)
  - an om frisören (formatted text)
  - a porträtt (picture)
  Only admins can add frisörer.

Tider
  Tider have:
  - a tjänst (a tjänst, required)
  - a frisör (a frisör, required)
  - a starttid (a date and time, required)
  - an antal platser (a whole number, required, 1 by default)
  Each tid lists its bokningar.
  The places left is calculated as the antal platser minus the number of its bookings.
  Only admins can add tider.

Bokningar
  Bokningar have:
  - a tid (a tid, required, unique)
  - a telefon (a phone number)
  - a meddelande till frisören
  At most the slot's capacity bokningar per slot.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongens personal. Hanterar tider, tjänster och frisörer)
  - customer (En kund som bokar tid)
  New users get the customer role.
  Open to anyone without signing in: the home page, the boka page, reading services, reading stylists and reading slots.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 119 files (119 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-17/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 7 columns 1 indexes 2 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
slots 9 columns 0 indexes 3 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_slimy_scarlet_spider.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-17. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-17
  smithable run
/tmp/smithable-bench-m12-4VaGel/app-17/smithable.auth.yml:6:11  warning  Visitors can't open mina-bokningar from the home hero's shortcuts: list it under public.pages, or choose another page.
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkoll
  Håller ordning på kunder, offerter och fakturor för en liten byggfirma.

Pages
  - Offerter (lists offerter; search by nummer or arbete; filter by status or kund; “Send quote”; “Accept quote”; “Decline quote”)
  - Fakturor (lists fakturor; filter by status or kund; “Mark sent”; “Mark paid”)
  - Kunder (lists kunder; search by namn, e-post or telefon)
  - Offertrader (lists offertrader)
  - Fakturarader (lists fakturarader)
  - Översikt (a dashboard: latest quotes)
  - Team (who has access: invite people, change roles, remove users)

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address)
  - a telefon (a phone number)
  - adress
  Each kund lists its offerter.
  Each kund lists its fakturor.

Offerter
  Offerter have:
  - a nummer (required, unique)
  - a kund (a kund, required)
  - an arbete (required)
  - a datum (a date, required, today by default)
  - a giltig till (a date, the datum plus 30 days by default)
  - status (utkast, skickad, godkänd or nekad, utkast by default)
  Each offert lists its offertrader.
  The total is calculated as the total belopp of its lines.

Offertrader
  Offertrader have:
  - an offert (an offert, required)
  - a beskrivning (required)
  - an antal (a number, required, 1 by default)
  - à-pris (an amount, required)
  The belopp is calculated as the antal times the à-pris.

Fakturor
  Fakturor have:
  - a fakturanummer (required, unique)
  - a kund (a kund, required)
  - an offert (an offert)
  - a fakturadatum (a date, required, today by default)
  - a förfallodatum (a date, required, the fakturadatum plus 30 days by default)
  - status (utkast, skickad, betald or förfallen, utkast by default)
  Each faktura lists its fakturarader.
  The total is calculated as the total belopp of its lines.

Fakturarader
  Fakturarader have:
  - a faktura (a faktura, required)
  - a beskrivning (required)
  - an antal (a number, required, 1 by default)
  - à-pris (an amount, required)
  The belopp is calculated as the antal times the à-pris.

Send quote
  For an offert that is utkast; sets status to skickad.
  Offerten har skickats till kunden.

Accept quote
  For an offert that is skickad; sets status to godkänd.
  Kunden har godkänt offerten.

Decline quote
  For an offert that is skickad; sets status to nekad.
  Kunden har tackat nej till offerten.

Mark sent
  For a faktura that is utkast; sets status to skickad.
  Fakturan har skickats till kunden.

Mark paid
  For a faktura that is skickad or förfallen; sets status to betald.
  Kunden har betalat fakturan.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 119 files (119 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-18/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
customers 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 3 fks
quote_lines 9 columns 0 indexes 2 fks
quotes 11 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bright_fixer.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-18. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-18
  smithable run
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår loppis
  Lägg upp saker du vill sälja, med bilder och pris, och fynda bland andras.

Pages
  - Saker till salu (lists saker; search by rubrik or beskrivning; filter by kategori, pris, skick or till salu; sort by pris or date added; records can be saved as favorites; contact the owner by mail)
  - Mina saker (lists saker; only the viewer's own records)
  - Sparade (lists saker; only the viewer's saved records)
  - Välkommen (a landing page: hero, saker where available is yes and footer)

Saker
  Saker have:
  - a rubrik (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount)
  - a kategori (möbler, kläder, böcker, kök, elektronik, leksaker or övrigt, möbler by default)
  - a skick (som ny, bra or sliten, som ny by default)
  - a till salu (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (Lägger upp och sparar saker)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-19/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 11 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_powerful_domino.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-19. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogavaraus
  Joogastudion tuntikalenteri, ohjaajat ja tuntien varaaminen verkossa.

Pages
  - Etusivu (a landing page: hero, tuntityypit, ohjaajat, call to action and footer)
  - Tuntikalenteri (a calendar of sessions by week or month)
  - Omat varaukset (lists varaukset)
  - Tunnit (lists tunnit; only for admins)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Etusivu page)
  - Ohjaajat (lists ohjaajat; only for admins; visitors see ohjaajat on the Etusivu page)
  - Ylläpito (every kind of record, to find, open, change and delete)

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (kaikille tasoille, aloittelijat or edistyneet, kaikille tasoille by default)
  - a kesto (min) (a whole number, required, 60 by default)
  Only admins can add tuntityypit.

Ohjaajat
  Ohjaajat have:
  - a nimi (required)
  - an esittely
  - a kuva (picture)
  Only admins can add ohjaajat.

Tunnit
  Tunnit have:
  - a tuntityyppi (a tuntityyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an alkaa (a date and time, required)
  - a paikkoja (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The paikkoja jäljellä is calculated as the paikkoja minus the number of its varaukset.
  Only admins can add tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studion henkilökunta: hallitsee tunteja, tuntityyppejä ja ohjaajia)
  - member (Joogaaja, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 117 files (117 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-20/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_plain_starjammers.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-20. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-20
  smithable run
/tmp/smithable-bench-m12-4VaGel/app-20/smithable.auth.yml:6:11  warning  Visitors can't open my-bookings from the home hero's shortcuts: list it under public.pages, or choose another page.
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Korjaamo
  Pienen autokorjaamon asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Huoltotyöt (lists huoltotyöt; “Start work”; “Complete job”)
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin)
  - Autot (lists autot; search by rekisterinumero, merkki or malli)
  - Laskut (lists laskut; search by laskun numero; filter by tila or eräpäivä; “Send invoice”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address, unique)
  - a puhelin (a phone number)
  - a muistiinpanot
  Each asiakas lists its autot.

Autot
  Autot have:
  - a rekisterinumero (required, unique)
  - a merkki
  - a malli
  - a vuosimalli (a whole number)
  - a mittarilukema (km) (a whole number)
  - asiakas (an asiakas, required)
  Each auto lists its huoltotyöt.

Huoltotyöt
  Huoltotyöt have:
  - an auto (an auto, required)
  - kuvaus (required)
  - a tila (varattu, työn alla or valmis, varattu by default)
  - an ajankohta (a date and time)
  - a työ (an amount)
  - an osat (an amount)
  Each huoltotyö can have a mekaanikko (a user).
  The yhteensä is calculated as the työ plus the osat.
  Each huoltotyö lists its laskut.

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - a huoltotyö (a huoltotyö, required)
  - a summa (an amount, required)
  - a tila (luonnos, lähetetty or maksettu, luonnos by default)
  - an eräpäivä (a date)
  - a maksupäivä (a date)

Start work
  For a huoltotyö that is varattu; sets tila to työn alla and mekaanikko to whoever presses it.
  Aloita huoltotyö ja ota se itsellesi.

Complete job
  For a huoltotyö that is työn alla; sets tila to valmis.
  Merkitse huoltotyö valmiiksi.

Send invoice
  For a lasku that is luonnos; sets tila to lähetetty.
  Merkitse lasku lähetetyksi.

Mark paid
  For a lasku that is lähetetty; sets tila to maksettu and maksupäivä to today.
  Merkitse lasku maksetuksi.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 107 files (107 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-21/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
cars 10 columns 1 indexes 2 fks
customers 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 10 columns 1 indexes 2 fks
jobs 12 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_overconfident_mentor.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-21. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Produkte, Vorbestellungen der Kunden und Abholzeiten für einen kleinen Hofladen.

Pages
  - Startseite (a landing page: hero, produkte where available is yes, faq, call to action and footer)
  - Vorbestellungen (lists vorbestellungen; filter by status or abholzeit; “Mark ready”; “Mark picked up”; “Cancel”)
  - Produkte (lists produkte; search by name or beschreibung)
  - Abholzeiten (lists abholzeiten)
  - Verwaltung (every kind of record, to find, open, change and delete)

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - preis (an amount, required)
  - an einheit
  - a verfügbar (yes or no, true by default)
  Only admins can add produkte.
  Only admins can change produkte.
  Only admins can delete produkte.

Abholzeiten
  Abholzeiten have:
  - a beginn (a date and time, required)
  - an ende (a date and time)
  - a plätze (a whole number, required, 10 by default)
  Each abholzeit lists its vorbestellungen.
  Only admins can add abholzeiten.
  Only admins can change abholzeiten.
  Only admins can delete abholzeiten.

Vorbestellungen
  Vorbestellungen have:
  - an abholzeit (an abholzeit, required)
  - an anmerkung
  - status (offen, abholbereit, abgeholt or storniert, offen by default)
  Each vorbestellung lists its positionen.
  At most the pickup slot's capacity vorbestellungen per pickup slot (counting those with status open or ready).

Positionen
  Positionen have:
  - a vorbestellung (a vorbestellung, required)
  - a produkt (a produkt, required)
  - a menge (a whole number, required, 1 by default)

Mark ready
  For a vorbestellung that is offen; sets status to abholbereit.
  Die Vorbestellung ist gepackt und liegt zur Abholung bereit.
  Only admins can use it.

Mark picked up
  For a vorbestellung that is abholbereit; sets status to abgeholt.
  Der Kunde hat die Vorbestellung abgeholt.
  Only admins can use it.

Cancel
  For a vorbestellung that is offen or abholbereit; sets status to storniert.
  Die Vorbestellung wird storniert.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Betreiber des Hofladens. Pflegt Produkte, Abholzeiten und bearbeitet Vorbestellungen)
  - customer (Kunde, der Produkte vorbestellt und abholt)
  New users get the customer role.
  Open to anyone without signing in: the home page, the produkte page and reading products where available is yes.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 113 files (113 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-4VaGel/app-22/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
order_lines 7 columns 0 indexes 3 fks
pickup_slots 7 columns 0 indexes 1 fks
preorders 7 columns 0 indexes 2 fks
products 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_mysterious_zodiak.sql 🚀

Created /tmp/smithable-bench-m12-4VaGel/app-22. Start it with:

  cd /tmp/smithable-bench-m12-4VaGel/app-22
  smithable run
/tmp/smithable-bench-m12-4VaGel/app-22/smithable.yml:36:7  warning  Preorder has a capacity per pickupSlot, but "pickupSlot" is not unique: one person can take several places.
    hint: Write "pickupSlot: PickupSlot! unique" for one preorder per person and pickupslot (unique per owner with private access).
```
