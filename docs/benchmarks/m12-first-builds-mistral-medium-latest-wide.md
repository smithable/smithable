# M12 first builds: mistral-medium-latest, the second set (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 21 / 22 created, 21 type-check, 362,345 tokens, €0.2088.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 17,908 | €0.0095 | 21 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 9,251 | €0.0057 | 20 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 9,241 | €0.0051 | 17 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 8,826 | €0.0042 | 16 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | **no** | **no** | 33,828 | €0.0163 | 16 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 27,419 | €0.0150 | 28 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 16,509 | €0.0081 | 18 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 15,984 | €0.0073 | 20 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 8,253 | €0.0043 | 17 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 8,174 | €0.0042 | 17 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 26,546 | €0.0132 | 32 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 21,351 | €0.0139 | 36 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 7,988 | €0.0038 | 18 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 16,090 | €0.0075 | 22 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 7,918 | €0.0037 | 18 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 10,233 | €0.0083 | 30 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 22,296 | €0.0150 | 37 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 21,636 | €0.0144 | 34 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 19,596 | €0.0122 | 29 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 22,080 | €0.0149 | 38 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 11,830 | €0.0108 | 39 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 19,388 | €0.0114 | 32 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest-wide/](m12-first-builds-mistral-medium-latest-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The runs so far:
1. From main before #169 and #174.
2. After them (#176).
3. After #180 (#181): 22 of 22.
4. After #190 (#193).
5. This one: after #194.

The kept columns now also say how many each draft has in all. In the fourth run that would have shown 6, the cleaning company, with no pages at all.

- **Better: the status drafts keep their actions.** 11 and 12 keep 3 of 3 (0 of 3 in the fourth run).
- **Better: everything created type-checks** (21 of 21), including 6 and 21, which failed in the fourth run.
- **Invoicing** keeps mark sent and mark paid in 6 (2 of 2) and one of them in 1.
- **Worse: one draft fails.** 5, the photography invoicing: Invoice's total sums its lines before the lines model exists, so `addModel Invoice` is refused and every later step fails for want of Invoice. Reported to session A.
- **Personal data.** 15, the birdwatching club, still publishes who saw each bird.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 (has 3) | 1 / 7 (has 4) | 1 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 (has 2) | 1 / 3 (has 3) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | booking | 0 | 0 / 6 (has 3) | 1 / 10 (has 4) | 0 / 0 (has 2) | private; admin, customer (customer) | stylists: admin, services: admin, appointments: admin | pages home; read Stylist, Service; create Appointment | 0 | none | 0 / 3 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 (has 3) | 0 / 10 (has 3) | 0 / 0 (has 0) | private; admin, teacher (teacher) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 3 / 4 (has 3) | 3 / 7 (has 4) | 2 / 2 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 3 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages albums, home; read Album; create none | 0 | none | 0 / 1 | no mention; landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, visitor (visitor) | none | pages home, artifacts; read Artifact; create none | 0 | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 (has 4) | 5 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages none; read none; create none | 0 | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 0 | 4 / 4 (has 4) | 8 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 0 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages sightings; read Sighting; create none | 1 (public-personal-data) | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 0 | 2 / 6 (has 5) | 1 / 10 (has 9) | 0 / 0 (has 0) | private; admin, customer (customer) | tjanster: admin, frisorer: admin, team: admin, admin: admin, tider: admin | pages hem, schema, boka-nu; read Service, Stylist, Appointment; create Booking, Message | 0 | none | 0 / 5 | no mention; landing page | sv | yes (min, frisörsalong) | yes (bokning, tid) | yes (till, min, frisörsalong) | models 5/5, fields 17/17, pages 8/9 |
| 18 | crm (words: records) | 2 (sv: yes (ska, och, offerter)) | 1 / 2 (has 3) | 0 / 3 (has 4) | 0 / 1 (has 6) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 20/20, pages 3/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 (has 1) | 3 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 0/3 |
| 20 | booking (words: records) | 0 | 4 / 6 (has 4) | 6 / 10 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | class-types: admin, instructors: admin, sessions: admin, my-bookings: member/admin, schedule: member/admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (capacity-no-unique) | none | 3 / 4 | no mention; landing page | fi | no | yes (varaus) | no | models 4/4, fields 13/15, pages 6/6 |
| 21 | crm (words: records) | 2 (fi: no) | 1 / 2 (has 6) | 1 / 3 (has 6) | 0 / 1 (has 6) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 6 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | no | none | models 6/6, fields 34/34, pages 5/6 |
| 22 | crm (words: records) | 2 (de: yes (die, vorbestellungen, und)) | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | no | none | models 3/3, fields 16/16, pages 3/4 |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Freelance Translator
  Track clients, quotes, and payments for a freelance translator.

Pages
  - Clients (lists clients; search by name or email)
  - Quotes (lists quotes; search by description or client; filter by status or client; “Mark sent”; “Mark accepted”; “Mark rejected”)
  - Payments (lists payments; filter by quote or method)
  - Team (who has access: invite people, change roles, remove users)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a phone
  - notes

Quotes
  Quotes have:
  - a client (a client, required)
  - a description (required)
  - an amount (an amount, required)
  - a currency (USD by default)
  - issued on (a date, required, today by default)
  - status (draft, sent, accepted or rejected, draft by default)
  - notes

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - a currency (USD by default)
  - paid on (a date, required, today by default)
  - a method (cash, bank transfer or online, cash by default)
  - notes

Mark sent
  For a quote that is draft; sets status to sent.
  The quote was sent to the client.

Mark accepted
  For a quote that is sent; sets status to accepted.
  The client accepted the quote.

Mark rejected
  For a quote that is sent; sets status to rejected.
  The client rejected the quote.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member (A freelance translator using the app)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
payments 10 columns 0 indexes 2 fks
quotes 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nervous_amphibian.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-1. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-1
  smithable run

/tmp/smithable-bench-m12-yHY6Ls/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-yHY6Ls/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-yHY6Ls/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-yHY6Ls/app-1/src/db/seed.ts:29:6)
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
  A sales pipeline for a six-person web agency to track leads, deals and follow-ups.

Pages
  - Leads (lists leads; search by name, email or company; sort by name, follow up date or date added; “Qualify lead”; “Disqualify lead”)
  - Deals (lists deals; search by name or lead; sort by name, value, close date or date added; “Win deal”; “Lose deal”)
  - Team (who has access: invite people, change roles, remove users)

Leads
  Leads have:
  - a name (required)
  - an email
  - a phone
  - a company
  - status (new, contacted, qualified or disqualified, new by default)
  - a source (referral, website, social or other, referral by default)
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

Disqualify lead
  For a lead that is new, contacted or qualified; sets status to disqualified; asks for the notes.
  Mark a lead as disqualified and optionally add a reason.

Win deal
  For a deal that is proposal or negotiation; sets status to won.
  Mark a deal as won.

Lose deal
  For a deal that is proposal or negotiation; sets status to lost; asks for the notes.
  Mark a deal as lost and optionally add a reason.

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
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nappy_wrecker.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-2. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Hair Salon Booking
  Online booking for a hair salon where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Appointments (lists appointments; “Confirm appointment”; “Cancel appointment”; only for admins)

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
  - status (booked, confirmed or cancelled, booked by default)
  - a customer name (required)
  - a customer email (required)
  - a customer phone

Confirm appointment
  For an appointment that is booked; sets status to confirmed.

Cancel appointment
  For an appointment that is booked or confirmed; sets status to cancelled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services, and appointments)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page, reading stylists, reading services and adding appointments.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-3/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
appointments 11 columns 0 indexes 3 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_deep_robin_chapel.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-3. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-3
  smithable run
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
  - a start time (required)
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
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
lessons 9 columns 0 indexes 2 fks
practices 9 columns 0 indexes 2 fks
pupils 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cute_cardiac.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-4. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

Failed:

```text
starter.
Smithable model (mistral-medium-latest) · 33,828 tokens · €0.0163
No model drafted a valid project.
addModel: addModel would make smithable.yml invalid. Field "Invoice.total": Invoice has no list named "lines".
addField: addField would make smithable.yml invalid. There is no model named "Invoice".
addField: There is no model named "Invoice".
addPage: There is no model named "Invoice".
addAction: There is no model named "Invoice".
addAction: There is no model named "Invoice".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-yHY6Ls/app-5 --starter invoicing

```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Cleaning Invoices
  A shared place for our cleaning company to manage monthly invoices to households.

Pages
  - Clients (lists clients; search by name, email or address)
  - Team (who has access: invite people, change roles, remove users)
  - Invoice lines (lists invoice lines; filter by invoice)
  - Invoices (lists invoices; search by number or client; filter by status, client or issued on; “Mark sent”; “Mark paid”)

Clients
  Clients have:
  - a name (required)
  - address
  - an email

Invoice lines
  Invoice lines have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an amount (an amount)
  - an invoice (an invoice, required)

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  Each invoice lists its invoice lines.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-6/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clean_master_mold.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-6. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-6
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
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wooden_zarda.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-7. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-7
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

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (office, home, electronics, books or other, office by default)
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
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-8/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nifty_zarda.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-8. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Record Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Home (a landing page: hero, albums and footer)
  - Albums (lists albums; search by title, artist or notes; filter by condition or release year)

Albums
  Albums have:
  - a title (required)
  - an artist (required)
  - a release year (a whole number)
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
  Open to anyone without signing in: the albums page, the home page and reading albums.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
albums 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_soft_vampiro.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-9. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  Browse the museum's objects and their stories online.

Pages
  - Home (a landing page: hero, artifacts where category is painting or sculpture and footer)
  - Artifacts (lists artifacts; search by name, description, period, origin or story)

Artifacts
  Artifacts have:
  - a name (required)
  - a description
  - a category (painting, sculpture, artifact or document, painting by default)
  - an image (a web address)
  - a period
  - an origin
  - a story
  Only admins can add artifacts.
  Only admins can change artifacts.
  Only admins can delete artifacts.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the museum collection)
  - visitor (Browses the collection)
  New users get the visitor role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-10/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
artifacts 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clear_masked_marvel.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-10. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems so staff see what is down and when it is back.

Pages
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

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

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is being applied; the incident is being monitored.).
  A fix is being applied; the incident moves to monitoring, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message The incident has been resolved.).
  The incident is resolved; it moves to resolved, with an update saying so.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 110 files (110 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_public_steve_rogers.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-11. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Check the current status and outages of our municipality's online services.

Pages
  - Service Status (a landing page: hero, services, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenance and footer)
  - Incident History (lists incidents)
  - Incidents (lists incidents; search by title; filter by status or component)
  - Updates (lists updates)
  - Components (lists services; only for admins; visitors see services on the Service Status page)
  - Maintenance (lists maintenance)
  - Overview (lists incidents)
  - Team (who has access: invite people, change roles, remove users)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its incidents.
  Only admins can see services.
  Only admins can add services.
  Only admins can change services.
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
  Only staff users and admins can see incidents.
  Only staff users and admins can add incidents.
  Only staff users and admins can change incidents.
  Only staff users and admins can delete incidents.

Updates
  Updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only staff users and admins can see updates.
  Only staff users and admins can add updates.
  Only staff users and admins can change updates.
  Only staff users and admins can delete updates.

Maintenance
  Maintenance have:
  - a title (required)
  - a component (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only staff users and admins can see maintenance.
  Only staff users and admins can add maintenance.
  Only staff users and admins can change maintenance.
  Only staff users and admins can delete maintenance.

Identified
  For an incident that is investigating; sets status to identified; adds an update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the service status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, the history page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 106 files (106 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_strange_surge.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-12. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-12
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
  - a category
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-13/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
costs 9 columns 0 indexes 1 fks
fuels 9 columns 0 indexes 1 fks
services 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_true_malice.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-13. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Manage the guest list and seating plan for our wedding, with RSVPs and meal choices.

Pages
  - Guests (lists guests; search by name, email, group or notes)
  - Team (who has access: invite people, change roles, remove users)

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - an attending (yes, no or maybe, yes by default)
  - a meal choice (vegetarian, meat, fish, vegan or gluten free, vegetarian by default)
  - a table number (a whole number)
  - notes
  - a group

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-14/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
guests 12 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fast_jubilee.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-14. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-14
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (Member of the birdwatching club)
  New users get the member role.
  Open to anyone without signing in: the sightings page and reading sightings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 74 files (74 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-15/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_big_molly_hayes.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-15. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-15
  smithable run
/tmp/smithable-bench-m12-yHY6Ls/app-15/smithable.auth.yml:12:10  warning  Anyone on the internet can read Sighting, including personal data in observer.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Manage plots, waiting list and yearly fees for the allotment society.

Pages
  - Plots (lists plots; search by plot number or notes; filter by status)
  - Waiting List (lists waiting list; search by name, email or notes; filter by status)
  - Yearly Fees (lists yearly fees; filter by status or year)
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
  - status (pending, paid or overdue, pending by default)
  - notes
  Only admins can delete yearly fees.
  Only admins can change yearly fees.
  Only admins can add yearly fees.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the society and its records)
  - member (Views plots and fees)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-16/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
fees 9 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
plots 9 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_optimal_havok.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-16. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Onlinebokning för frisörsalong.

Pages
  - Välkommen till Min Frisörsalong (a landing page: hero, tjänster, frisörer, contact and footer)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Välkommen till Min Frisörsalong page)
  - Frisörer (lists frisörer; only for admins; visitors see frisörer on the Välkommen till Min Frisörsalong page)
  - Boka tid (lists bokningar)
  - Mina bokningar (lists bokningar; only the viewer's own records)
  - Användare (who has access: invite people, change roles, remove users; only for admins)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Tider (lists tider; only for admins)
  - Schema (a calendar of appointments by week or month)

Tjänster
  Tjänster have:
  - a namn (required)
  - a beskrivning
  - a varaktighet (minuter) (a whole number, required, 30 by default)
  - pris (an amount, required)
  Only admins can add tjänster.
  Only admins can change tjänster.
  Only admins can delete tjänster.

Frisörer
  Frisörer have:
  - a namn (required)
  - an om mig
  Only admins can add frisörer.
  Only admins can change frisörer.
  Only admins can delete frisörer.

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
  - a frisör (a frisör, required)
  - a starttid (a date and time, required)
  - a kapacitet (a whole number, required, 1 by default)
  Only admins can add tider.
  Only admins can change tider.
  Only admins can delete tider.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongsägare. Hanterar tjänster, frisörer och tider)
  - customer (Kund som bokar tider)
  New users get the customer role.
  Open to anyone without signing in: the hem page, the schema page, the boka nu page, reading services, reading stylists, reading appointments, adding bookings and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 114 files (114 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-17/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
appointments 8 columns 0 indexes 3 fks
bookings 8 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 6 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_secret_spyke.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-17. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Offerter (lists offerter; search by offertnummer or kund; filter by status or kund; sort by offertnummer, totalt belopp, giltig till or date added; “Send quote”; “Accept quote”; “Reject quote”; “Create invoice from quote”)
  - Fakturor (lists fakturor; search by fakturanummer or kund; filter by status or kund; sort by fakturanummer, totalt belopp, förfallodatum or date added; “Send invoice”; “Mark paid”)
  - Anvandare (who has access: invite people, change roles, remove users)
  - Kunder (lists kunder; search by namn or e-post; sort by namn or date added)

Offerter
  Offerter have:
  - an offertnummer (required, unique)
  - status (utkast, skickad, accepterad or avvisad, utkast by default)
  - a totalt belopp (an amount, required)
  - a giltig till (a date)
  - an anteckningar
  - a kund (a kund, required)
  Only admins can delete offerter.

Fakturor
  Fakturor have:
  - a fakturanummer (required, unique)
  - an offert (an offert)
  - status (utkast, skickad, betald or försenad, utkast by default)
  - a totalt belopp (an amount, required)
  - a förfallodatum (a date)
  - a betald datum (a date and time)
  - an anteckningar
  - a kund (a kund, required)
  Only admins can delete fakturor.

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address, unique)
  - a telefon (a phone number)
  - a typ (privat or företag, privat by default)
  - an anteckningar
  Each kund can have an ansvarig säljare (a user).
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
  For a faktura that is skickad or försenad; sets status to betald and betald datum to now.
  Markera faktura som betald.

Create invoice from quote
  For an offert that is accepterad, makes a copy of an offert with status utkast, asking for the offertnummer.
  Skapa faktura från accepterad offert.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Administratör med fullständig åtkomst)
  - sales (Arbetar med kunder, offerter och fakturor)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-18/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
customers 10 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_free_mentor.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-18. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-18
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
  - a kategori (kläder, möbler, leksaker, böcker, elektronik, sport or övrigt, kläder by default)
  - a skick (ny, nästan ny, bra or sliten, ny by default)
  - plats
  - a tillgänglig (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller loppis i ordning)
  - member (Lägger upp och sparar föremål)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-19/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nasty_venom.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-19. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Joogastudio (a landing page: hero, tuntityypit, call to action and footer)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Joogastudio page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Tunnit (lists tunnit; search by tuntityyppi or ohjaaja; filter by tuntityyppi, ohjaaja or aloitusaika; only for admins)
  - Omat varaukset (lists varaukset; only for member users and admins)
  - Aikataulu (a calendar of sessions by week or month; only for member users and admins)

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (aloittelija, kaikki tasot or edistynyt, aloittelija by default)
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
  - admin (Studiomme työntekijä. Hallinnoi aikataulua, tunteja ja ohjaajia)
  - member (Opiskelija, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-20/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_magical_nehzno.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-20. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-20
  smithable run
/tmp/smithable-bench-m12-yHY6Ls/app-20/smithable.yml:38:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin)
  - Autot (lists autot; search by rekisterinumero, merkki, malli or asiakas)
  - Huoltotyöt (lists huoltotyöt; search by töiden numero, auto or tila; filter by tila, alkamispäivä, päätöspäivä or auto; “Start work”; “Complete work”; “Cancel work”)
  - Laskut (lists laskut; search by laskun numero, asiakas, huoltotö or tila; filter by tila, laskutuspäivä, eräpäivä or asiakas; “Send invoice”; “Mark paid”; “Cancel invoice”)
  - Palvelut (lists palvelut)
  - Team (who has access: invite people, change roles, remove users)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address)
  - a puhelin (a phone number)
  - a muistiinpanot

Autot
  Autot have:
  - a rekisterinumero (required, unique)
  - a merkki (required)
  - a malli (required)
  - a vuosimalli (a whole number)
  - asiakas (an asiakas, required)
  - a muistiinpanot

Palvelut
  Palvelut have:
  - a nimi (required)
  - kuvaus
  - a hinta (an amount, required)

Huoltotyöt
  Huoltotyöt have:
  - a töiden numero (required, unique)
  - an auto (an auto, required)
  - a tila (odottaa, käynnissä, valmis or peruutettu, odottaa by default)
  - kuvaus
  - an alkamispäivä (a date)
  - a päätöspäivä (a date)
  - a yhteensä (an amount)
  - a muistiinpanot

Huoltorivit
  Huoltorivit have:
  - a huoltotö (a huoltotö, required)
  - a palvelu (a palvelu, required)
  - a määrä (a whole number, required, 1 by default)
  - a hinta (an amount)
  - a muistiinpanot

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - a huoltotö (a huoltotö, required)
  - asiakas (an asiakas, required)
  - a tila (luonnos, lähetetty, maksettu or peruutettu, luonnos by default)
  - a laskutuspäivä (a date, today by default)
  - an eräpäivä (a date)
  - a yhteensä (an amount, required)
  - a muistiinpanot

Start work
  For a huoltotö that is odottaa; sets tila to käynnissä and alkamispäivä to today.
  Aloita huoltotö.

Complete work
  For a huoltotö that is käynnissä; sets tila to valmis and päätöspäivä to today.
  Merkitse huoltotö valmiiksi.

Send invoice
  For a lasku that is luonnos; sets tila to lähetetty and laskutuspäivä to today.
  Lähetä lasku asiakkaalle.

Mark paid
  For a lasku that is lähetetty; sets tila to maksettu.
  Merkitse lasku maksetuksi.

Cancel work
  For a huoltotö that is odottaa or käynnissä; sets tila to peruutettu.
  Peruuta huoltotö.

Cancel invoice
  For a lasku that is luonnos or lähetetty; sets tila to peruutettu.
  Peruuta lasku.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 111 files (111 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-21/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
cars 10 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
services 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
work_items 9 columns 0 indexes 3 fks
work_orders 12 columns 1 indexes 2 fks

[✓] Your SQL migration file ➜ drizzle/0000_striped_leopardon.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-21. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Verwaltung von Produkten, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Produkte (lists produkte; search by name or kategorie; sort by name, preis or verfügbar)
  - Vorbestellungen (lists vorbestellungen; search by kundenname or kundentelefon; filter by status or produkt; sort by kundenname, abholzeit or status; “Confirm pre order”; “Mark as picked up”; “Cancel pre order”)
  - Abholzeiten (lists abholzeitfenster; filter by datum; sort by datum or beginn)
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
  - status (ausstehend, bestätigt, abgeholt or storniert, ausstehend by default)

Abholzeitfenster
  Abholzeitfenster have:
  - a datum (a date, required)
  - a beginn (required)
  - an ende (required)
  - a maximale kapazität (a whole number, required, 10 by default)
  - a notizen

Confirm pre order
  For a vorbestellung that is ausstehend; sets status to bestätigt.
  Bestätige eine Vorbestellung.

Mark as picked up
  For a vorbestellung that is bestätigt; sets status to abgeholt.
  Markiere eine Vorbestellung als abgeholt.

Cancel pre order
  For a vorbestellung that is ausstehend or bestätigt; sets status to storniert.
  Storniere eine Vorbestellung.

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
Reading config file '/tmp/smithable-bench-m12-yHY6Ls/app-22/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
pickup_slots 9 columns 0 indexes 1 fks
pre_orders 10 columns 0 indexes 2 fks
products 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_aberrant_fixer.sql 🚀

Created /tmp/smithable-bench-m12-yHY6Ls/app-22. Start it with:

  cd /tmp/smithable-bench-m12-yHY6Ls/app-22
  smithable run
```
