# M12 first builds: mistral-medium-latest, the second set (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 22 / 22 created, 20 type-check, 285,350 tokens, €0.1744.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 16,877 | €0.0085 | 20 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 9,012 | €0.0055 | 20 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 9,940 | €0.0068 | 20 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 8,616 | €0.0041 | 15 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 24,592 | €0.0117 | 25 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | **no** | 8,045 | €0.0035 | 12 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 16,015 | €0.0078 | 20 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 8,084 | €0.0042 | 15 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 8,594 | €0.0054 | 16 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 8,649 | €0.0055 | 16 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 9,581 | €0.0063 | 19 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 11,420 | €0.0100 | 28 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 15,240 | €0.0068 | 15 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 8,596 | €0.0054 | 19 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 7,770 | €0.0037 | 11 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 9,946 | €0.0081 | 23 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 20,809 | €0.0134 | 32 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 21,373 | €0.0144 | 33 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 19,018 | €0.0118 | 25 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 23,499 | €0.0171 | 40 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | invoicing | yes | **no** | 9,900 | €0.0073 | 23 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 9,774 | €0.0071 | 21 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest-wide/](m12-first-builds-mistral-medium-latest-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The runs so far:
1. From main before #169 and #174.
2. After them (#176).
3. After #180 (#181): 22 of 22 created and type-checking.
4. This one: after #184, #187, #188 and #190 (see the first set's report).

- **Worse: the status drafts drop their actions.** 11 and 12 keep 0 of 3 (3 of 3 in the third run). Reported to session A.
- **Better: invoicing keeps its new actions** in 1, 5 and 21 (2 of 2 each). 6, the cleaning company, keeps neither.
- **Worse: two drafts do not type-check** (20 of 22; in the third run, 22). Both are generator bugs, reported to session A:
  - 6, the cleaning company's invoicing: `__root.tsx` imports `pageAccess` and the smoke test declares `visit` and `warm`, all unused (TS6133).
  - 21, the Finnish car repair shop: two models that refer to each other (service jobs and invoices) need explicit types in `schema.ts` (TS7022, TS7024), and `access.test.ts` has a type mismatch.
- **No open sign-up and no public personal data** in this set.
- **The six not in English.** They get booking, crm, marketplace, booking, invoicing and crm, as in the third run.
  - Field labels are present in five of six. 21, the Finnish car repair shop, has none (0 of 31).
  - Page titles are complete in 17 and 20 this time. 19 still has none.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 | 1 / 7 | 2 / 2 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 2 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | booking | 0 | 0 / 6 | 3 / 10 | 0 / 0 | private; admin, customer (customer) | stylists: admin, services: admin, appointments: admin | pages home, schedule; read Stylist, Service; create Appointment | 1 (no-timezone) | none | 0 / 3 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 | 0 / 10 | 0 / 0 | private; admin, teacher (teacher) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 0 | 2 / 4 | 3 / 7 | 2 / 2 | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 1 / 3 | no mention; landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 2 / 4 | 0 / 7 | 0 / 2 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 2 / 2 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 | 4 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 | 4 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | no mention; landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 | 1 / 2 | 0 / 0 | private; admin, curator (curator) | artifacts: admin/curator | pages home, artifacts; read Artifact; create none | 0 | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 | 7 / 8 | 0 / 3 | shared; admin, staff (staff) | components: admin, team: admin, overview: admin/staff | pages home; read none; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 12 | status | 0 | 4 / 4 | 8 / 8 | 0 / 3 | shared; admin, staff (staff) | components: admin | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 0 | 2 / 6 | 0 / 10 | 0 / 0 | private; admin, kund (kund) | tjanster: admin, stylister: admin, meddelanden: admin, tider: admin | pages hem, schema; read Service, Stylist, Appointment; create Message, Booking | 0 | none | 0 / 5 | no mention; landing page | sv | yes (min, frisörsalong) | yes (bokning, tid) | no | models 5/5, fields 18/18, pages 7/7 |
| 18 | crm (words: records) | 2 (sv: yes (av, ska, för)) | 1 / 2 | 0 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 19/19, pages 3/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 | 3 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 0/3 |
| 20 | booking (words: records) | 0 | 4 / 6 | 7 / 10 | 0 / 0 | private; admin, member (member) | class-types: admin, instructors: admin, team: admin, admin: admin, sessions: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (capacity-no-unique) | none | 3 / 4 | no mention; landing page | fi | no | yes (varaus) | no | models 4/4, fields 13/15, pages 8/8 |
| 21 | invoicing (words: records) | 3 (fi: yes (laskut)) | 2 / 4 | 1 / 7 | 2 / 2 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 5 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | no | none | models 5/5, fields 0/31, pages 4/4 |
| 22 | crm (words: records) | 2 (de: yes (die, vorbestellungen, und)) | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | yes (vorbestellungen) | none | models 3/3, fields 15/15, pages 3/4 |

"Kept" counts the starter's models, pages and actions that the draft still has by name. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Freelance Translator
  Track clients, quotes, and payments for a freelance translator.

Pages
  - Clients (lists clients; search by name or email)
  - Quotes (lists quotes; search by number, description or client; filter by status or client; “Mark sent”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its quotes.

Quotes
  Quotes have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - an amount (an amount, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a description

Mark sent
  For a quote that is draft; sets status to sent.
  The quote was sent to the client.

Mark paid
  For a quote that is sent or overdue; sets status to paid.
  The client paid the quote.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (A freelance translator using the app)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_legal_king_bedlam.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-1. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-1
  smithable run

/tmp/smithable-bench-m12-TCopiB/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-TCopiB/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-TCopiB/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-TCopiB/app-1/src/db/seed.ts:29:6)
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
Web Agency CRM
  A sales pipeline for our six-person web agency: leads, deals and who follows up when.

Pages
  - Leads (lists leads; search by name, email or company; sort by name, follow up date or date added; “Qualify lead”; “Lose lead”)
  - Deals (lists deals; search by name or lead; sort by name, value, close date or date added; “Win deal”; “Lose deal”)
  - Team (who has access: invite people, change roles, remove users)

Leads
  Leads have:
  - a name (required)
  - an email
  - a phone
  - a company
  - a source (referral, website, social or other, referral by default)
  - status (new, contacted, qualified or lost, new by default)
  - notes
  - a follow up date
  Each lead can have an assignee (a user).
  Only admins can delete leads.

Deals
  Deals have:
  - a name (required)
  - a lead (a lead, required)
  - a value (an amount)
  - status (proposal, negotiation, won or lost, proposal by default)
  - a close date
  - notes
  Each deal can have an assignee (a user).
  Only admins can delete deals.

Qualify lead
  For a lead that is new or contacted; sets status to qualified.
  Mark a lead as qualified to move it to the next stage.

Lose lead
  For a lead that is new, contacted or qualified; sets status to lost.
  Mark a lead as lost.

Win deal
  For a deal that is proposal or negotiation; sets status to won.
  Mark a deal as won.

Lose deal
  For a deal that is proposal or negotiation; sets status to lost.
  Mark a deal as lost.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Works with leads and deals)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_famous_mulholland_black.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-2. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Hair Salon Booking
  Online booking for a hair salon where customers pick a stylist and a free time themselves.

Pages
  - Welcome to Our Hair Salon (a landing page: hero, services, stylists and footer)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Welcome to Our Hair Salon page)
  - Services (lists services; only for admins; visitors see services on the Welcome to Our Hair Salon page)
  - My Appointments (lists appointments; “Confirm appointment”; “Cancel appointment”; “Complete appointment”; only for admins)
  - Schedule (a calendar of appointments by week or month)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a portrait (picture)

Services
  Services have:
  - a name (required)
  - a description
  - duration minutes (a whole number, required, 30 by default)
  - a price (an amount, required)

Appointments
  Appointments have:
  - a service (a service, required)
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  - a customer name (required)
  - a customer email (required)
  - a customer phone
  - status (booked, confirmed, canceled or completed, booked by default)
  - notes

Confirm appointment
  For an appointment that is booked; sets status to confirmed.
  Confirm a booked appointment.

Cancel appointment
  For an appointment that is booked or confirmed; sets status to canceled; asks for the notes.
  Cancel an appointment.

Complete appointment
  For an appointment that is confirmed; sets status to completed.
  Mark an appointment as completed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services, and appointments)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page, the schedule page, reading stylists, reading services and adding appointments.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 110 files (110 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
appointments 12 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_steep_satana.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-3. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-3
  smithable run
/tmp/smithable-bench-m12-TCopiB/app-3/smithable.yml:49:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's lessons: pupils, their weekly times and what each one practises.

Pages
  - Pupils (lists pupils)
  - Lessons (lists lessons)
  - Practices (lists practices)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  Only teacher users and admins can delete pupils.

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - a day of week (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a time (required)
  - duration minutes (a whole number, required, 30 by default)
  - notes
  Only teacher users and admins can delete lessons.

Practices
  Practices have:
  - a lesson (a lesson, required)
  - a date (required)
  - a piece (required)
  - minutes (a whole number)
  - notes
  Only teacher users and admins can delete practices.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - teacher (The piano teacher who manages pupils and lessons)
  New users get the teacher role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
lessons 9 columns 0 indexes 2 fks
practices 9 columns 0 indexes 2 fks
pupils 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_smooth_korvac.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-4. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Photography Invoices
  Invoices for my photography work: clients, shoots and what is still unpaid.

Pages
  - Home (a landing page: hero and footer)
  - Clients (lists clients)
  - Shoots (lists shoots)
  - Admin (every kind of record, to find, open, change and delete)
  - Invoices (lists invoices; “Mark sent”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number

Shoots
  Shoots have:
  - a name (required)
  - a date (required)
  - a client (a client, required)
  - a location
  - a description
  Each shoot lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a shoot (a shoot, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)

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
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
shoots 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_loose_young_avengers.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-5. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-5
  smithable run

/tmp/smithable-bench-m12-TCopiB/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-TCopiB/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-TCopiB/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-TCopiB/app-5/src/db/seed.ts:29:6)
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
CleanSweep Invoicing
  Monthly invoicing for a small cleaning company.

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 69 files (69 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-6/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
clients 7 columns 0 indexes 1 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_stiff_young_avengers.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-6. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A local marketplace where anyone can post things to sell with photos and a price.

Pages
  - Home (a landing page: hero, items where available is yes and footer)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)

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
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wakeful_dust.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-7. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Catalog (lists items; search by title or description; filter by category, condition or available; sort by date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Home (a landing page: hero, items where available is yes and footer)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (office, electronics, furniture, books or other, office by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the swap shelf tidy)
  - member (Offers and claims items)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-8/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fluffy_nemesis.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-8. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Albums (lists albums; search by title, artist or notes; sort by title, artist, year or price paid)

Albums
  Albums have:
  - a title (required)
  - an artist (required)
  - a year (a whole number)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a price paid (an amount)
  - a cover image (a web address)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
albums 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fancy_wonder_man.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-9. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  Browse the museum's objects and their stories online.

Pages
  - Home (a landing page: hero, objects where status is on display and footer)
  - Artifacts (lists objects; search by title, description, category, historical period or story; sort by title, historical period or date added; only for curator users and admins; visitors see objects on the Home page)

Objects
  Objects have:
  - a title (required)
  - a description
  - a category
  - a historical period
  - an image URL (a web address)
  - a story
  - display status (on display, in storage or on loan, on display by default)
  Only curator users and admins can add objects.
  Only curator users and admins can change objects.
  Only admins can delete objects.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the museum collection)
  - curator (Adds and edits objects and stories)
  New users get the curator role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-10/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
artifacts 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cute_aaron_stack.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-10. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems so staff see what is down and when it is back.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents)
  - Updates (lists incident updates)
  - Components (lists components; only for admins)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Overview (every kind of record, to find, open, change and delete; only for staff users and admins)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.
  Only admins can delete components.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its incident updates.
  Only admins can delete incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only admins can delete incident updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only admins can delete maintenances.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 105 files (105 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-11/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_smooth_exodus.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-11. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Check the current status and outages of our municipality's online services.

Pages
  - Municipal Service Status (a landing page: hero, services, incidents where status is investigating or identified or monitoring and footer)
  - Incident History (lists incidents)
  - Incidents (lists incidents; search by title; filter by status or component)
  - Updates (lists updates)
  - Components (lists services; only for admins; visitors see services on the Municipal Service Status page)
  - Maintenance (lists maintenance)
  - Overview (lists incidents)
  - Team (who has access: invite people, change roles, remove users)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its incidents.
  Only admins can delete services.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a service)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its updates.
  Only staff users and admins can delete incidents.

Updates
  Updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only staff users and admins can delete updates.

Maintenance
  Maintenance have:
  - a title (required)
  - a component (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only staff users and admins can delete maintenance.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the service status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, the history page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-12/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_overconfident_whistler.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-12. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuels)
  - Service (lists services)
  - Costs (lists costs)
  - Team (who has access: invite people, change roles, remove users)

Fuels
  Fuels have:
  - a date (required)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a cost (an amount)
  - notes

Services
  Services have:
  - a date (required)
  - an odometer (a whole number, required)
  - a description (required)
  - a cost (an amount)
  - notes

Costs
  Costs have:
  - a date (required)
  - a description (required)
  - an amount (an amount, required)
  - a category (fuel, service or other, fuel by default)
  - notes

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
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-13/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
costs 9 columns 0 indexes 1 fks
fuels 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
services 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sour_prima.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-13. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Manage the guest list and seating plan for our wedding, with RSVPs and meal choices.

Pages
  - Guests (lists guests; search by full name, email or group; sort by full name, table number or attending)
  - Team (who has access: invite people, change roles, remove users)

Guests
  Guests have:
  - a full name (required)
  - an email
  - a phone
  - an attending (yes, no or maybe, yes by default)
  - a meal choice (vegetarian, meat, vegan or gluten-free, vegetarian by default)
  - a table number (a whole number)
  - notes
  - a group

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the guest list and seating plan)
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 75 files (75 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-14/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
guests 12 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_tan_blob.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-14. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-14
  smithable run
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Bird Sightings
  A place for our birdwatching club to record and share bird sightings.

Pages
  - Sightings (lists sightings; search by species or place)
  - Team (who has access: invite people, change roles, remove users)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - a date (required)
  Each sighting can have an observer (a user).
  Only admins can delete sightings.
  Only member users and admins can change sightings.
  Only member users and admins can add sightings.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (Member of the birdwatching club)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 74 files (74 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-15/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_worthless_odin.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-15. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Manage plots, waiting list and yearly fees for the allotment society.

Pages
  - Plots (lists plots; search by plot number or notes; filter by status)
  - Waiting List (lists waiting list; search by name, email or notes; filter by status; “Assign from waiting list”)
  - Yearly Fees (lists yearly fees; filter by status or year; “Mark fee as paid”)
  - Team (who has access: invite people, change roles, remove users)

Plots
  Plots have:
  - a plot number (required, unique)
  - a size (sqm) (a whole number)
  - status (available, assigned or reserved, available by default)
  - notes
  Each plot can have a holder (a user).
  Only admins can delete plots.
  Only admins can change plots.
  Only admins can add plots.

Waiting List
  Waiting List have:
  - a name (required)
  - an email (required)
  - a phone
  - a date added (required, today by default)
  - status (active, assigned or withdrawn, active by default)
  - notes
  Only admins can delete waiting list.
  Only admins can change waiting list.
  Only member users and admins can add waiting list.

Yearly Fees
  Yearly Fees have:
  - a year (a whole number, required, unique)
  - an amount (an amount, required)
  - a due date (required)
  - status (pending or paid, pending by default)
  - notes
  Only admins can delete yearly fees.
  Only admins can change yearly fees.
  Only admins can add yearly fees.

Assign from waiting list
  For a waiting list entry that is active; sets status to assigned.
  Assign a plot to this person from the waiting list.

Mark fee as paid
  For a yearly fee that is pending; sets status to paid.
  Mark this yearly fee as paid.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the society and its records)
  - member (Member of the society)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-16/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
fees 9 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
plots 9 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_skinny_vance_astro.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-16. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Onlinebokning för frisörsalong.

Pages
  - Välkommen (a landing page: hero, tjänster, stylister, contact and footer)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Välkommen page)
  - Stylister (lists stylister; only for admins; visitors see stylister on the Välkommen page)
  - Mina bokningar (lists bokningar)
  - Meddelanden (lists meddelanden; only for admins)
  - Tider (lists tider; only for admins)
  - Schema (a calendar of appointments by week or month)

Tjänster
  Tjänster have:
  - a namn (required)
  - a beskrivning
  - a varaktighet (minuter) (a whole number, required, 30 by default)
  - pris (an amount, required)
  Only admins can see tjänster.
  Only admins can change tjänster.
  Only admins can delete tjänster.

Stylister
  Stylister have:
  - a namn (required)
  - a biografi
  - a porträtt (picture)
  Only admins can see stylister.
  Only admins can change stylister.
  Only admins can delete stylister.

Bokningar
  Bokningar have:
  - a namn (required)
  - an e-post (an email address, required)
  - a telefon (a phone number)
  - a tid (a tid, required, unique)
  At most the appointment's capacity bokningar per appointment.

Meddelanden
  Meddelanden have:
  - a namn (required)
  - an e-post (an email address, required)
  - a meddelande (required)
  Only admins can see meddelanden.
  Only admins can change meddelanden.
  Only admins can delete meddelanden.

Tider
  Tider have:
  - a tjänst (a tjänst, required)
  - a stylist (a stylist, required)
  - a starttid (a date and time, required)
  - a kapacitet (a whole number, required, 1 by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongsägare eller personal)
  - kund (Kund som bokar tider)
  New users get the kund role.
  Open to anyone without signing in: the hem page, the schema page, reading services, reading stylists, reading appointments, adding messages and adding bookings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-17/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
appointments 8 columns 0 indexes 3 fks
bookings 8 columns 1 indexes 2 fks
messages 7 columns 0 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_perfect_silver_samurai.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-17. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Offerter (lists offerter; search by offertnummer or kund; filter by status or kund; sort by offertnummer, totalt, giltig till or date added; “Send quote”; “Accept quote”; “Reject quote”)
  - Fakturor (lists fakturor; search by fakturanummer or kund; filter by status or kund; sort by fakturanummer, totalt, förfallodatum or date added; “Send invoice”; “Mark paid”)
  - Kunder (lists kunder; search by namn or e-post; sort by namn or date added)
  - Anvandare (who has access: invite people, change roles, remove users)

Offerter
  Offerter have:
  - an offertnummer (required, unique)
  - status (utkast, skickad, accepterad or avvisad, utkast by default)
  - a totalt (an amount, required)
  - a giltig till (a date)
  - a beskrivning
  - a kund (a kund, required)
  Only admins can delete offerter.

Fakturor
  Fakturor have:
  - a fakturanummer (required, unique)
  - an offert (an offert)
  - status (utkast, skickad, betald or försenad, utkast by default)
  - a totalt (an amount, required)
  - a förfallodatum (a date)
  - a betaldatum (a date and time)
  - a kund (a kund, required)
  Only admins can delete fakturor.

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address, unique)
  - a telefon (a phone number)
  - a segment (privat, företag or kommun, privat by default)
  - an anteckningar
  Each kund can have an ansvarig (a user).
  Only admins can delete kunder.

Send quote
  For an offert that is utkast; sets status to skickad.
  Skicka offert till kund.

Accept quote
  For an offert that is skickad; sets status to accepterad.
  Acceptera offert.

Reject quote
  For an offert that is skickad; sets status to avvisad.
  Avvisa offert.

Send invoice
  For a faktura that is utkast; sets status to skickad.
  Skicka faktura till kund.

Mark paid
  For a faktura that is skickad or försenad; sets status to betald and betaldatum to now.
  Markera faktura som betald.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Administratör. Full åtkomst)
  - sales (Säljare. Hanterar kunder, offerter och fakturor)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-18/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
customers 10 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 11 columns 1 indexes 3 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_confused_doctor_octopus.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-18. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-18
  smithable run
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår Loppis
  En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

Pages
  - Catalog (lists föremål; search by titel, beskrivning or plats; filter by kategori, pris, skick or tillgänglig; sort by pris or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, föremål where available is yes and footer)
  - My items (lists föremål; only the viewer's own records)

Föremål
  Föremål have:
  - a titel (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount)
  - a kategori (kläder, möbler, elektronik, leksaker, böcker, sport or övrigt, kläder by default)
  - a skick (ny, bra or sliten, ny by default)
  - plats
  - a tillgänglig (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller loppis sidan ren)
  - member (Lägger upp och sparar föremål)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-19/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bored_misty_knight.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-19. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Joogastudio (a landing page: hero, luokkatyypit, contact and footer)
  - Luokkatyypit (lists luokkatyypit; only for admins; visitors see luokkatyypit on the Joogastudio page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Tiimi (who has access: invite people, change roles, remove users; only for admins)
  - Ylläpito (every kind of record, to find, open, change and delete; only for admins)
  - Tunnit (lists tunnit; search by luokkatyyppi or ohjaaja; filter by luokkatyyppi, ohjaaja or aloitusaika; only for admins)
  - Omat varaukset (lists varaukset; only the viewer's own records)
  - Aikataulu (a calendar of sessions by week or month)

Luokkatyypit
  Luokkatyypit have:
  - a nimi (required)
  - kuvaus
  - a taso (aloittelija, kaikille or edistynyt, aloittelija by default)
  - a kesto (min) (a whole number, required, 60 by default)
  Only admins can add luokkatyypit.

Ohjaajat
  Ohjaajat have:
  - a nimi (required)
  - an esittely (formatted text)
  - a kuva (picture)
  Only admins can add ohjaajat.

Tunnit
  Tunnit have:
  - a luokkatyyppi (a luokkatyyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an aloitusaika (a date and time, required)
  - an osallistujamäärä (a whole number, required, 12 by default)
  - a vapaat paikat (a whole number, the osallistujamäärä minus the number of its bookings by default)
  Each tunti lists its varaukset.
  Only admins can add tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required)
  Each varaus can have a user (a user).
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studiomme työntekijä. Hallinnoi tunnit, luokat ja opettajat)
  - member (Joogaopiskelija, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 118 files (118 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-20/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_productive_union_jack.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-20. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-20
  smithable run
/tmp/smithable-bench-m12-TCopiB/app-20/smithable.yml:38:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni Autokorjaamo
  Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by name, email or phone)
  - Autot (lists autot; search by registration number, make or model)
  - Huoltotyöt (lists huoltotyöt; search by description; filter by status or car; sort by start date, end date or total cost)
  - Laskut (lists laskut; filter by status or customer; sort by issued on, due on or total; “Mark sent”; “Mark paid”)

Asiakkaat
  Asiakkaat have:
  - a name (required)
  - an email (required)
  - a phone
  - address
  Each asiakas lists its autot.

Autot
  Autot have:
  - a registration number (required, unique)
  - a make (required)
  - a model (required)
  - a year (a whole number)
  - a customer (an asiakas, required)
  Each auto lists its huoltotyöt.

Huoltotyöt
  Huoltotyöt have:
  - a car (an auto, required)
  - a description (required)
  - status (odottaa, käynnissä, valmis or peruutettu, odottaa by default)
  - a start date
  - an end date
  - a total cost (an amount)
  - an invoice (a lasku)

Laskut
  Laskut have:
  - a number (required, unique)
  - a customer (an asiakas, required)
  - a service job (a huoltotö)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (luonnos, lähetetty, maksettu or myöhässä, luonnos by default)
  - a total (an amount)
  Each lasku lists its laskurivit.

Laskurivit
  Laskurivit have:
  - an invoice (a lasku, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an amount (an amount)

Mark sent
  For a lasku that is luonnos; sets status to lähetetty.
  Lasku lähetetty asiakkaalle.

Mark paid
  For a lasku that is lähetetty or myöhässä; sets status to maksettu.
  Asiakas on maksanut laskun.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (Autokorjaamon työntekijä)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-21/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
cars 9 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 3 fks
service_jobs 11 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_noisy_wendigo.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-21. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-21
  smithable run

/tmp/smithable-bench-m12-TCopiB/app-21/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-TCopiB/app-21/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-TCopiB/app-21/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-TCopiB/app-21/src/db/seed.ts:48:6)
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  code: 'SQLITE_CONSTRAINT_FOREIGNKEY'
}

Node.js v24.21.0
Could not add sample data; the app works without it.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Verwaltung von Produkten, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Produkte (lists produkte; search by name or kategorie)
  - Vorbestellungen (lists vorbestellungen; search by kundenname or kundentelefon; filter by status or abholzeit; “Mark ready”; “Mark picked up”; “Cancel pre order”)
  - Abholzeiten (lists abholzeitfenster; filter by datum)
  - Team (who has access: invite people, change roles, remove users)

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - preis (an amount, required)
  - a kategorie
  - a verfügbar (yes or no, true by default)

Vorbestellungen
  Vorbestellungen have:
  - a kundenname (required)
  - a kundentelefon (a phone number)
  - a produkt (a produkt, required)
  - a menge (a whole number, required, 1 by default)
  - an abholzeit (a date and time, required)
  - status (ausstehend, bereit, abgeholt or storniert, ausstehend by default)

Abholzeitfenster
  Abholzeitfenster have:
  - a datum (a date, required)
  - a beginn (required)
  - an ende (required)
  - a maximale vorbestellungen (a whole number, required, 10 by default)

Mark ready
  For a vorbestellung that is ausstehend; sets status to bereit.
  Markiert eine Vorbestellung als bereit zur Abholung.

Mark picked up
  For a vorbestellung that is bereit; sets status to abgeholt.
  Markiert eine Vorbestellung als abgeholt.

Cancel pre order
  For a vorbestellung that is ausstehend or bereit; sets status to storniert.
  Storniert eine Vorbestellung.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-TCopiB/app-22/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
pickup_slots 8 columns 0 indexes 1 fks
pre_orders 10 columns 0 indexes 2 fks
products 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bright_energizer.sql 🚀

Created /tmp/smithable-bench-m12-TCopiB/app-22. Start it with:

  cd /tmp/smithable-bench-m12-TCopiB/app-22
  smithable run
```
