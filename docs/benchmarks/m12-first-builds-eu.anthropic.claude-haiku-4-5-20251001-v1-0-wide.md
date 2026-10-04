# M12 first builds: eu.anthropic.claude-haiku-4-5-20251001-v1:0, the second set (2026-10-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 22 / 22 created, 22 type-check, 659,202 tokens (613,881 in, 45,321 out), $0.3674; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

Prompt caching: of the input of the 56 calls the model answered (the response cache's are not counted), 562,768 tokens were read from the cache (the fixed system text, at a tenth of the price), 0 written to it (a quarter more than the price) and 80,205 were new.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 35,491 | 870 | $0.0111 | 0 | 4 | 20 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 35,849 | 1,901 | $0.0171 | 0 | 3 | 25 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 18,309 | 1,603 | $0.0126 | 0 | 3 | 26 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 18,310 | 430 | $0.0061 | 0 | 2 | 15 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 54,359 | 3,054 | $0.0274 | 0 | 6 | 33 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 35,705 | 1,428 | $0.0144 | 0 | 3 | 22 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 17,535 | 1,154 | $0.0092 | 0 | 3 | 22 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 17,534 | 840 | $0.0075 | 0 | 2 | 19 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 34,940 | 1,072 | $0.0116 | 0 | 3 | 19 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 17,438 | 723 | $0.0068 | 0 | 2 | 18 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 18,263 | 2,266 | $0.0162 | 0 | 4 | 27 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 18,258 | 2,075 | $0.0151 | 0 | 2 | 28 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 17,434 | 916 | $0.0078 | 0 | 2 | 17 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 17,441 | 590 | $0.0060 | 0 | 2 | 32 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 17,444 | 602 | $0.0061 | 0 | 3 | 46 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 17,440 | 920 | $0.0079 | 0 | 3 | 61 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 18,287 | 2,618 | $0.0181 | 0 | 4 | 51 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 57,141 | 6,192 | $0.0478 | 0 | 6 | 60 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 36,641 | 4,203 | $0.0306 | 0 | 5 | 50 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 18,291 | 3,532 | $0.0232 | 0 | 3 | 43 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | records | yes | yes | 36,253 | 3,334 | $0.0254 | 0 | 4 | 41 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | marketplace | yes | yes | 55,518 | 4,998 | $0.0394 | 0 | 6 | 42 s |

Each created app's four spec files are in [m12-first-builds-eu.anthropic.claude-haiku-4-5-20251001-v1-0-wide/](m12-first-builds-eu.anthropic.claude-haiku-4-5-20251001-v1-0-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 2 | 1 / 4 (has 2) | 1 / 7 (has 2) | 1 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 2 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 0) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | booking | 3 | 2 / 6 (has 5) | 3 / 10 (has 7) | 0 / 0 (has 0) | private; admin, customer (customer) | appointments: admin, stylists: admin, services: admin, admin: admin, team: admin | pages home; read Stylist, Service; create Message | 0 | none | 0 / 5 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 (has 2) | 1 / 10 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 1 (no-timezone) | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 2 | 4 / 4 (has 5) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 5 | no mention; landing page | en | | | | |
| 6 | invoicing (words: booking) | 2 | 2 / 4 (has 3) | 2 / 7 (has 4) | 2 / 2 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 2 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 2 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 2 | 0 / 1 (has 1) | 0 / 2 (has 1) | 0 / 0 (has 0) | private; admin, collector (collector) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 1 / 1 (has 1) | 2 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, items; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 12 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 2 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 1) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 2 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages home; read Sighting; create none | 1 (public-personal-data) | none | 0 / 1 | no mention; landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 0) | shared; admin, member (member) | members: admin, plots: admin, waiting-list: admin, fees: admin | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 3 (sv: yes (kan, kunderna, de)) | 1 / 6 (has 4) | 2 / 10 (has 6) | 0 / 0 (has 0) | private; admin, customer (customer) | services: admin, stylists: admin, timeslots: admin, bookings: admin | pages home, schedule; read ServiceType, Stylist, TimeSlot; create Booking | 0 | none | 0 / 4 | no mention; landing page | sv | yes (frisörsalong, bokning) | yes (tid, bokning) | no | models 4/4, fields 0/15, pages 5/6 |
| 18 | invoicing (words: records) | 2 (sv: yes (en, och)) | 2 / 4 (has 5) | 2 / 7 (has 6) | 1 / 2 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 5 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 5/5, fields 14/30, pages 0/6 |
| 19 | marketplace (words: records) | 2 (sv: yes (kan, lägga, saker)) | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 1 / 1 | no mention; landing page | sv | yes (loppis) | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 3/4 |
| 20 | booking (words: records) | 2 (fi: yes (ja, ohjaajat)) | 6 / 6 (has 6) | 10 / 10 (has 10) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin, messages: admin, posts: admin, admin: admin | pages home; read ClassType, Instructor, Session, Post; create Message | 0 | none | 4 / 6 | no mention; landing page | fi | yes (varausjärjestelmä) | yes (varaus) | no | models 6/6, fields 0/24, pages 9/10 |
| 21 | records | 3 (fi: yes (asiakkaat, ovat)) | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page | fi | yes (autokorjaamo) | no | none | models 4/4, fields 21/21, pages 0/5 |
| 22 | marketplace (words: records) | 3 (de: yes (produkte, hofladen, und)) | 0 / 1 (has 3) | 0 / 4 (has 4) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | no | none | models 3/3, fields 16/16, pages 3/4 |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
My Clients
  Track my clients as a freelance translator: who they are, what I quoted and what they paid.

Pages
  - Clients (lists clients)
  - Quotes (lists quotes; “Mark accepted”; “Mark paid”)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  Each client lists its quotes.

Quotes
  Quotes have:
  - a client (a client, required)
  - a description (required)
  - a quoted amount (an amount, required)
  - a paid amount (an amount, required, 0 by default)
  - status (pending, accepted or paid, pending by default)
  - quoted on (a date, required, today by default)
  - paid on (a date)

Mark accepted
  For a quote that is pending; sets status to accepted.
  The client accepted the quote.

Mark paid
  For a quote that is pending or accepted; sets status to paid and paid on to today.
  The client paid the quote.

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
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 7 columns 0 indexes 1 fks
quotes 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_rich_bruce_banner.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-1. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-1
  smithable run

/tmp/smithable-bench-m12-dFu9CK/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-dFu9CK/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-dFu9CK/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-dFu9CK/app-1/src/db/seed.ts:29:6)
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
Sales Pipeline
  Sales pipeline for a web agency: leads, deals and who follows up when.

Pages
  - Follow ups (lists follow ups; search by notes; filter by status or type)
  - Team (who has access: invite people, change roles, remove users)
  - Leads (lists leads; search by name, company or email; filter by status or source)
  - Deals (lists deals; search by name; filter by stage)

Follow ups
  Follow ups have:
  - a type (call, email, meeting, proposal or other, call by default)
  - a scheduled for (a date and time, required)
  - status (pending, completed or canceled, pending by default)
  - notes
  - completed at (a date and time)
  - a lead (a lead, required)
  Each follow up can have an assigned to (a user).

Leads
  Leads have:
  - a name (required)
  - a company (required)
  - an email
  - a phone
  - a source (website, referral, cold call, event or other, website by default)
  - status (new, contacted, qualified, proposal, won or lost, new by default)
  - notes
  - a follow up date
  - a value (an amount)
  Each lead can have an assigned to (a user).

Deals
  Deals have:
  - a name (required)
  - a lead (a lead, required)
  - a stage (discovery, proposal, negotiation, closed won or closed lost, discovery by default)
  - a value (an amount, required)
  - an expected close date
  - notes
  Each deal can have an assigned to (a user).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with leads and deals)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
deals 11 columns 0 indexes 3 fks
follow_ups 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 14 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_curly_screwball.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-2. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Hair Salon Booking
  Online booking for a hair salon: customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, stylists, services, contact and footer)
  - Appointments (lists appointments; only for admins)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - My bookings (lists bookings)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a picture
  Only admins can add stylists.

Services
  Services have:
  - a name (required)
  - a description
  - duration minutes (a whole number, required, 60 by default)
  - a price (an amount, required)
  Only admins can add services.

Appointments
  Appointments have:
  - a stylist (a stylist, required)
  - a service (a service, required)
  - starts at (a date and time, required)
  Each appointment lists its bookings.
  Only admins can add appointments.

Bookings
  Bookings have:
  - an appointment (an appointment, required, unique)
  At most 1 bookings per appointment.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage the schedule, stylists and services)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page, reading stylists, reading services and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 123 files (123 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-3/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
appointments 7 columns 0 indexes 3 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_stormy_maestro.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-3. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-3
  smithable run
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Schedule and management of piano lessons for pupils, their weekly times and practice assignments.

Pages
  - Pupils (lists pupils)
  - Lessons (lists lessons)
  - Schedule (a calendar of lessons by week or month)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 30 by default)
  - a practice

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
lessons 8 columns 0 indexes 2 fks
pupils 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_peaceful_surge.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-4. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-4
  smithable run
/tmp/smithable-bench-m12-dFu9CK/app-4/smithable.yml:24:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Photography Invoices
  Invoices for photography work: manage clients, shoots and track unpaid invoices.

Pages
  - Home (a landing page: hero and footer)
  - Clients (lists clients)
  - Shoots (lists shoots)
  - Invoice lines (lists invoice lines)
  - Settings (lists business profiles)
  - Invoices (lists invoices; “Mark sent”; “Mark paid”)
  - Overview (a dashboard: latest, outstanding, overdue and paid)

Business profiles
  Business profiles have:
  - a business name (required)
  - a VAT number
  - an IBAN
  - payment term days (a whole number, required, 30 by default)
  - an invoice footer

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its invoices.

Shoots
  Shoots have:
  - a name (required)
  - a client (a client, required)
  - a date (required)
  - a description
  - deliverables

Invoice lines
  Invoice lines have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an invoice (an invoice, required)
  The amount is calculated as the quantity times the unit price.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
  - issued on (a date, required, today by default)
  - status (draft, sent, paid or overdue, draft by default)
  The due on is calculated as the issued on plus 30 days.
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

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
  - member (A photographer using the app)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 107 files (107 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-5/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
shoots 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_zippy_vanisher.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-5. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-5
  smithable run

/tmp/smithable-bench-m12-dFu9CK/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-dFu9CK/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-dFu9CK/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-dFu9CK/app-5/src/db/seed.ts:44:6)
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
Cleaning Invoices
  Invoice management for a cleaning company serving households.

Pages
  - Households (lists households)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; “Mark sent”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users)

Households
  Households have:
  - a name (required)
  - an email (required)
  - address
  Each household lists its invoices.

Invoice lines
  Invoice lines have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an invoice (an invoice, required)
  The amount is calculated as the quantity times the unit price.

Invoices
  Invoices have:
  - a number (required, unique)
  - a household (a household, required)
  - issued on (a date, required, today by default)
  - status (draft, sent, paid or overdue, draft by default)
  The due on is calculated as the issued on plus 30 days.
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the household.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The household paid the invoice.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-6/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
households 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_magenta_satana.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-6. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Buy and sell second-hand things in your town.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, items and footer)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a price (an amount)
  - a category (furniture, bikes, electronics, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the marketplace tidy)
  - member (Sells and saves items)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_curious_lilith.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-7. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  A swap shelf for colleagues to offer things they no longer need and claim items from others.

Pages
  - Items (lists items; search by title or description; filter by category, condition or available; sort by date added; records can be saved as favorites)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Team (who has access: invite people, change roles, remove users)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (furniture, electronics, books, clothing, sports, kitchen or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the swap shelf tidy)
  - member (Offers and claims items)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_outgoing_hannibal_king.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-8. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  A place to keep track of my vinyl record albums, artists, condition and purchase prices.

Pages
  - Albums (lists albums; search by title or artist; filter by condition)

Albums
  Albums have:
  - a title (required)
  - an artist (required)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a price (an amount)
  - notes
  - added on (a date, required, today by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - collector (Manages the vinyl collection)
  New users get the collector role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
albums 10 columns 0 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_slow_jetstream.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-9. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Browse the museum's collection of objects and their stories online.

Pages
  - Home (a landing page: hero, items and footer)
  - Items (lists items; search by name or summary)

Items
  Items have:
  - a name (required)
  - a summary
  - a kind (general, favorite or archived, general by default)
  - a link (a web address)
  - added on (a date, required, today by default)
  Only admins can add items.
  Only admins can change items.
  Only admins can delete items.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the collection)
  - member (Looks at it)
  New users get the member role.
  Open to anyone without signing in: the home page, the items page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-10/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_tan_obadiah_stane.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-10. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board showing what IT systems are down and when they are back.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Team (who has access: invite people, change roles, remove users)
  - Components (lists components)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open, per month and latest)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.
  Only admins can delete components.
  Only admins can change components.

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
  The incident is over, with an update saying so. The component's state stays what the team sets.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 117 files (117 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_smart_surge.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-11. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Service Status
  Check the status of our municipality's online services and outages.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Overview (every kind of record, to find, open, change and delete)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary
  Each incident lists its incident updates.
  Only staff users and admins can change incidents.

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
  The incident is over, with an update saying so. The component's state stays what the team sets.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 128 files (128 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_dry_roland_deschain.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-12. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Maintenance Log
  Track your car's fuel consumption, service visits and maintenance costs.

Pages
  - Fuel (lists fuel entries)
  - Service (lists service visits)
  - Costs (lists maintenance costs)

Fuel entries
  Fuel entries have:
  - a date (required)
  - a mileage (a whole number, required)
  - liters (a number, required)
  - a cost per liter (an amount, required)
  - notes
  The total cost is calculated as the liters times the cost per liter.

Service visits
  Service visits have:
  - a date (required)
  - a mileage (a whole number, required)
  - a service type (required)
  - a description
  - a cost (an amount, required)
  - a mechanic
  - notes

Maintenance costs
  Maintenance costs have:
  - a date (required)
  - a category (fuel, service, repair or other, fuel by default)
  - a description (required)
  - an amount (an amount, required)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-13/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
fuel_entries 10 columns 0 indexes 1 fks
maintenance_costs 9 columns 0 indexes 1 fks
service_visits 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_chunky_pet_avengers.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-13. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Guest list and seating plan for our wedding, with RSVPs and meal choices.

Pages
  - Guests (lists guests; search by name or email; filter by status, meal choice or table)

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - a party size (a whole number, required, 1 by default)
  - status (pending, accepted or declined, pending by default)
  - a meal choice (chicken, fish, vegetarian or vegan, chicken by default)
  - dietary restrictions
  - a table (a whole number)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 78 files (78 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-14/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
guests 13 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_special_the_fury.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-14. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-14
  smithable run
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Bird Sightings
  A place to record and share bird sightings from our birdwatching club.

Pages
  - Home (a landing page: hero, sightings and footer)
  - Sightings (lists sightings; search by species or place)
  - Team (who has access: invite people, change roles, remove users)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - a date (required)
  Each sighting can have an observer (a user).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (Records and views bird sightings)
  New users get the member role.
  Open to anyone without signing in: the home page and reading sightings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-15/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_flimsy_raza.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-15. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-15
  smithable run
/tmp/smithable-bench-m12-dFu9CK/app-15/smithable.auth.yml:12:10  warning  Anyone on the internet can read Sighting, including personal data in observer.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Manage allotment plots, waiting list, and yearly fees for our society.

Pages
  - Members (lists members; only for admins)
  - Plots (lists plots; only for admins)
  - Waiting list (lists waiting lists; only for admins)
  - Fees (lists fees; only the viewer's own records; only for admins)
  - Team (who has access: invite people, change roles, remove users)

Members
  Members have:
  - a name (required)
  - an email (required, unique)
  - a phone
  - joined on (a date, required, today by default)

Plots
  Plots have:
  - a number (required, unique)
  - a size (a number)
  - a member (a member)
  - assigned on (a date)

Waiting lists
  Waiting lists have:
  - a member (a member, required, unique)
  - a position (a whole number, required)
  - added on (a date, required, today by default)

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - a paid (yes or no, false by default)
  - paid on (a date)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages plots, members, waiting list and fees)
  - member (Views their own plot and fee information)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-16/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
fees 9 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
members 8 columns 1 indexes 1 fks
plots 8 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 7 columns 1 indexes 2 fks

[✓] Your SQL migration file ➜ drizzle/0000_kind_tarot.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-16. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Frisörsalong Bokning
  Bokningssystem för frisörsalong där kunder kan boka tid online.

Pages
  - Home (a landing page: hero, tjänster, frisörer, faq and footer)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Home page)
  - Frisörer (lists frisörer; only for admins; visitors see frisörer on the Home page)
  - Tider (lists tider; only for admins)
  - Bokningar (lists bokningar; only for admins)
  - Boka tid (a calendar of time slots by week or month)

Tjänster
  Tjänster have:
  - a name (required)
  - a description
  - duration minutes (a whole number, required, 30 by default)
  Only admins can add tjänster.
  Only admins can change tjänster.
  Only admins can delete tjänster.

Frisörer
  Frisörer have:
  - a name (required)
  - a bio
  Only admins can add frisörer.
  Only admins can change frisörer.
  Only admins can delete frisörer.

Tider
  Tider have:
  - a service type (a tjänst, required)
  - a stylist (a frisör, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 1 by default)
  Each tid lists its bokningar.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can add tider.
  Only admins can change tider.
  Only admins can delete tider.

Bokningar
  Bokningar have:
  - a time slot (a tid, required, unique)
  - a customer name (required)
  - a customer email (required)
  - a customer phone (required)
  At most the time slot's capacity bokningar per time slot.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Frisörsalong personal. Hanterar tjänster, frisörer och bokningar)
  - customer (Kund som bokar tid online)
  New users get the customer role.
  Open to anyone without signing in: the home page, the schedule page, reading service types, reading stylists, reading time slots and adding bookings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-17/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 8 columns 1 indexes 2 fks
service_types 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 6 columns 0 indexes 1 fks
time_slots 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_equal_sharon_ventura.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-17. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma
  Hantera offerter, kunder och fakturor för byggfirman.

Pages
  - Customers (lists kunder)
  - Quote lines (lists offertrader)
  - Invoice lines (lists fakturerade)
  - Quotes (lists offerter; “Send quote”; “Accept quote”; “Reject quote”)
  - Invoices (lists fakturor; “Send invoice”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users)

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address, required)
  - adress
  - a telefon (a phone number)
  Each kund lists its offerter.
  Each kund lists its fakturor.

Offertrader
  Offertrader have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - a quote (an offert, required)
  The amount is calculated as the quantity times the unit price.

Fakturerade
  Fakturerade have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an invoice (a faktura, required)
  The amount is calculated as the quantity times the unit price.

Offerter
  Offerter have:
  - an offernummer (required, unique)
  - a kund (a kund, required)
  - a skapad (a date, required, today by default)
  - status (utkast, skickad, accepterad or avvisad, utkast by default)
  The giltig till is calculated as the skapad plus 30 days.
  Each offert lists its offertrader.
  The total is calculated as the total amount of its lines.

Fakturor
  Fakturor have:
  - a fakturanummer (required, unique)
  - a kund (a kund, required)
  - an utfärdad (a date, required, today by default)
  - status (utkast, skickad, betald or förfallen, utkast by default)
  The förfallen is calculated as the utfärdad plus 30 days.
  Each faktura lists its fakturerade.
  The total is calculated as the total amount of its lines.

Send quote
  For an offert that is utkast; sets status to skickad.
  Skicka offerten till kunden.

Accept quote
  For an offert that is skickad; sets status to accepterad.
  Kunden accepterade offerten.

Reject quote
  For an offert that is skickad; sets status to avvisad.
  Kunden avvisade offerten.

Send invoice
  For a faktura that is utkast; sets status to skickad.
  Skicka fakturan till kunden.

Mark paid
  For a faktura that is skickad or förfallen; sets status to betald.
  Kunden betalade fakturan.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 114 files (114 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-18/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
customers 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
quote_lines 9 columns 0 indexes 2 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fine_prodigy.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-18. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-18
  smithable run
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppis
  En plats där folk kan lägga upp saker de vill sälja, med bilder och pris.

Pages
  - Katalog (lists saker; search by titel, beskrivning or plats; filter by kategori, pris, skick or tillgänglig; sort by pris or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, saker and footer)
  - Mina saker (lists saker; only the viewer's own records)
  - Sparade (lists saker; only the viewer's saved records)

Saker
  Saker have:
  - a titel (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount)
  - a kategori (möbler, cyklar, elektronik, sport, barn or övrigt, möbler by default)
  - a skick (som ny, bra or använd, som ny by default)
  - plats
  - a tillgänglig (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller marknadsplatsen ren)
  - member (Säljer och sparar saker)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-19/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_groovy_omega_flight.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-19. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Jooga-varausjärjestelmä
  Tunnit, ohjaajat ja varaukset verkossa joogastudiollemme.

Pages
  - Home (a landing page: hero, tunnit, gallery, faq, artikkelit, contact and footer)
  - Aikataulu (a calendar of sessions by week or month)
  - Istunnot (lists istunnot; only for admins)
  - Tunnityypit (lists tunnit; only for admins; visitors see tunnit on the Home page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Viestit (lists viestit; only for admins)
  - Blogi (posts as articles, newest first, each on its own page)
  - Artikkelit (lists artikkelit; only for admins; visitors see artikkelit on the Home page)
  - Omat varaukset (lists varaukset)
  - Hallinto (every kind of record, to find, open, change and delete; only for admins)

Tunnit
  Tunnit have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Only admins can add tunnit.

Ohjaajat
  Ohjaajat have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Only admins can add ohjaajat.

Istunnot
  Istunnot have:
  - a class type (a tunti, required)
  - an instructor (an ohjaaja, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each istunto lists its varaukset.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can add istunnot.

Varaukset
  Varaukset have:
  - a session (an istunto, required, unique)
  At most the session's capacity varaukset per session.

Artikkelit
  Artikkelit have:
  - a title (required)
  - address (unique)
  - a summary
  - a cover (picture)
  - a body (formatted text, required)
  - published on (a date)
  - status (draft or published, draft by default)
  Only admins can add artikkelit.
  Only admins can change artikkelit.
  Only admins can delete artikkelit.

Viestit
  Viestit have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see viestit.
  Only admins can change viestit.
  Only admins can delete viestit.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studio-henkilökunta. Hallinnoi aikataulua, tunteja ja ohjaajia)
  - member (Opiskelija, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, reading class types, reading instructors, reading sessions, reading posts where status is published and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 138 files (138 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-20/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
messages 7 columns 0 indexes 1 fks
posts 11 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dry_eddie_brock.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-20. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-20
  smithable run
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Customers (lists asiakkaat)
  - Cars (lists autot)
  - Invoices (lists laskut)
  - Services (lists huoltotyöt)
  - Team (who has access: invite people, change roles, remove users)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address)
  - a puhelin (a phone number)
  - an osoite

Autot
  Autot have:
  - a merkki (required)
  - a malli (required)
  - a rekisterinumero (required, unique)
  - a vuosi (a whole number)
  - asiakas (an asiakas, required)

Laskut
  Laskut have:
  - a numero (required, unique)
  - asiakas (an asiakas, required)
  - a summa (an amount, required)
  - a päivämäärä (a date, required, today by default)
  - an eräpäivä (a date)
  - a tila (draft, sent or paid, draft by default)
  - a huomautukset

Huoltotyöt
  Huoltotyöt have:
  - kuvaus (required)
  - an auto (an auto, required)
  - a päivämäärä (a date, required)
  - a tila (pending, in progress or completed, pending by default)
  - a huomautukset

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-21/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
cars 9 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 11 columns 1 indexes 2 fks
services 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_illegal_shape.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-21. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Produkte, Vorbestellungen und Abholzeiten für meinen kleinen Hofladen.

Pages
  - Produkte (lists produkte)
  - Abholzeiten (lists abholzeiten)
  - Vorbestellungen (lists vorbestellungen; “Confirm”; “Mark picked up”)
  - Team (who has access: invite people, change roles, remove users)

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - preis (an amount, required)
  - a verfügbar (yes or no, true by default)

Abholzeiten
  Abholzeiten have:
  - a datum (a date, required)
  - a startzeit (required)
  - an endzeit (required)
  - a maximale kapazität (a whole number, required, 10 by default)
  - a beschreibung

Vorbestellungen
  Vorbestellungen have:
  - a produkt (a produkt, required)
  - a kundenname (required)
  - an e-mail (an email address, required)
  - a telefon (a phone number)
  - a menge (a whole number, required, 1 by default)
  - an abholzeit (a date and time, required)
  - status (ausstehend, bestätigt or abgeholt, ausstehend by default)

Confirm
  For a vorbestellung that is ausstehend; sets status to bestätigt.

Mark picked up
  For a vorbestellung that is bestätigt; sets status to abgeholt.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Verwaltet Produkte und Vorbestellungen)
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-dFu9CK/app-22/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
pickup_slots 9 columns 0 indexes 1 fks
preorders 11 columns 0 indexes 2 fks
products 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_chunky_network.sql 🚀

Created /tmp/smithable-bench-m12-dFu9CK/app-22. Start it with:

  cd /tmp/smithable-bench-m12-dFu9CK/app-22
  smithable run
```
