# M12 first builds: mistral-medium-latest, the second set (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 22 / 22 created, 22 type-check, 323,510 tokens, €0.1898.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 8,927 | €0.0063 | 26 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 8,218 | €0.0048 | 25 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 9,318 | €0.0065 | 26 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 8,430 | €0.0047 | 16 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 8,549 | €0.0056 | 22 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 17,124 | €0.0102 | 32 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 7,563 | €0.0041 | 20 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 28,303 | €0.0123 | 34 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 7,376 | €0.0038 | 22 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 15,416 | €0.0080 | 28 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 23,803 | €0.0118 | 35 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 19,468 | €0.0127 | 37 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 14,553 | €0.0070 | 26 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 7,920 | €0.0049 | 19 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 7,301 | €0.0037 | 16 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 8,259 | €0.0056 | 22 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 19,833 | €0.0131 | 37 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 19,592 | €0.0131 | 38 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 17,730 | €0.0111 | 35 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 21,431 | €0.0153 | 43 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | invoicing | yes | yes | 27,464 | €0.0156 | 40 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 16,932 | €0.0096 | 30 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest-wide/](m12-first-builds-mistral-medium-latest-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The first run came from main before #169 (shared drafts invite-only) and #174 (the first step in any language and with `--yes`; labels and texts in the description's language). The second, #176, came after them. This one adds #180, A's fixes for the bugs the second run found.

- **All 22 are created and type-check.** The first run had 22 and 22; the second, 18 and 17. All three of the second run's bugs are fixed:
  - 10, 11 and 12 no longer end with an empty `hero:`.
  - 3, the hair salon, no longer crashes on an operation whose name is not text.
  - 8, the swap shelf, now has its `kit/Landing`.
- **No open sign-up** (open-shared-access: 13 in the first run, 0 since).
- **Personal data.** 15, the birdwatching club, still publishes who saw each bird (public-personal-data), as in the second run.
- **The six not in English** get booking, crm, marketplace, booking, invoicing and crm. In the second run 21, the car repair shop, got crm; it now gets invoicing.
  - Labels contain words of the description's language in five of six (22, German, does not). In the first run, one of six.
  - Model and field labels are present almost everywhere: fields 19/19, 20/20, 8/8, 15/17, 24/24 and 18/18.
  - Page titles are missing in 17 (0 of 7) and 19 (0 of 3).
  - No landing page has its texts in the description's language (17, 19 and 20 have a landing page); in the second run, 17 did.
  - The questions for 18, 21 and 22 are in the description's language.
- **Off-territory English descriptions** (13 to 16) all get records, as in the second run.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 | 1 / 7 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | booking | 0 | 0 / 6 | 2 / 10 | 0 / 0 | private; admin, customer (customer) | stylists: admin, services: admin, appointments: admin | pages home; read Stylist, Service; create Appointment | 0 | none | 0 / 3 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 | 0 / 10 | 0 / 0 | private; admin, teacher (teacher) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 0 | 3 / 4 | 3 / 7 | 0 / 0 | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 1 / 4 | no mention; landing page | en | | | | |
| 6 | invoicing (words: booking) | 0 | 3 / 4 | 3 / 7 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 | 4 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 0 | 1 / 1 | 3 / 4 | 0 / 0 | private; admin, member (member) | none | pages catalog; read Item; create none | 0 | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 | 1 / 2 | 0 / 0 | private; admin, member (member) | none | pages home, artifacts; read Artifact; create none | 0 | Our Collection | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 | 6 / 8 | 3 / 3 | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 12 | status | 0 | 4 / 4 | 7 / 8 | 0 / 3 | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | none | pages sightings; read Sighting; create none | 1 (public-personal-data) | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | waiting-list: admin, fees: admin | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 0 | 2 / 6 | 0 / 10 | 0 / 0 | private; admin, member (member) | tjanster: admin, frisorer: admin, meddelanden: admin, tider: admin | pages hem, schema; read Service, Stylist, Appointment; create Booking, Message | 0 | none | 0 / 5 | no mention; landing page | sv | yes (min, frisörsalong) | yes (bokning, tid) | no | models 5/5, fields 19/19, pages 0/7 |
| 18 | crm (words: records) | 2 (sv: yes (ska, och, offerter)) | 1 / 2 | 0 / 3 | 0 / 1 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 20/20, pages 4/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 | 3 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 0/3 |
| 20 | booking (words: records) | 0 | 5 / 6 | 7 / 10 | 0 / 0 | private; admin, member (member) | class-types: admin, instructors: admin, messages: admin, sessions: admin, my-bookings: member | pages home, schedule; read ClassType, Instructor, Session; create Message | 0 | none | 3 / 5 | no mention; landing page | fi | no | yes (varaus) | no | models 5/5, fields 15/17, pages 7/7 |
| 21 | invoicing (words: records) | 3 (fi: yes (laskut)) | 1 / 4 | 0 / 7 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | yes (autot, huoltotyöt) | none | models 4/4, fields 24/24, pages 4/5 |
| 22 | crm (words: records) | 2 (de: yes (vorbestellungen, für)) | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | no | none | models 3/3, fields 18/18, pages 3/4 |

"Kept" counts the starter's models, pages and actions that the draft still has by name. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
My Translation Clients
  Track my freelance translation clients, quotes, and payments.

Pages
  - Clients (lists clients; search by name, email or VAT number)
  - Quotes (lists quotes; search by description or client; filter by status or client)
  - Payments (lists payments; filter by quote or method)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its quotes.

Quotes
  Quotes have:
  - a client (a client, required)
  - a description (required)
  - an amount (an amount, required)
  - issued on (a date, required, today by default)
  - status (draft, sent, accepted or paid, draft by default)
  Each quote lists its payments.

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, cash or online, bank transfer by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 8 columns 0 indexes 1 fks
payments 8 columns 0 indexes 2 fks
quotes 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_mute_pixie.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-1. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-1
  smithable run

/tmp/smithable-bench-m12-9AJm8Y/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-9AJm8Y/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-9AJm8Y/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-9AJm8Y/app-1/src/db/seed.ts:29:6)
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
  - Leads (lists leads; search by name, email or company; sort by name, follow up date or date added)
  - Deals (lists deals; search by name or lead; sort by name, value, close date or date added)
  - Team (who has access: invite people, change roles, remove users)

Leads
  Leads have:
  - a name (required)
  - an email
  - a phone
  - a company
  - status (new, contacted, qualified or lost, new by default)
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
  - status (proposal, negotiation, closed won or closed lost, proposal by default)
  - a close date
  - notes
  Each deal can have an assignee (a user).
  Only admins can delete deals.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Works with leads and deals)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bumpy_whirlwind.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-2. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Hair Salon Booking
  Online booking for a hair salon where customers pick a stylist and a free time themselves.

Pages
  - Welcome to Our Hair Salon (a landing page: hero, services, stylists and footer)
  - Our Stylists (lists stylists; only for admins; visitors see stylists on the Welcome to Our Hair Salon page)
  - Our Services (lists services; only for admins; visitors see services on the Welcome to Our Hair Salon page)
  - Book an Appointment (lists appointments; search by customer name or customer email; filter by status, stylist or service; only for admins)
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
  - status (pending, confirmed, cancelled or completed, pending by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services, and appointments)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page, reading stylists, reading services and adding appointments.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 103 files (103 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
appointments 10 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nervous_lorna_dane.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-3. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-3
  smithable run
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's lessons: pupils, their weekly times and what each one practises.

Pages
  - Pupils (lists pupils; search by name, email or phone)
  - Lessons (lists lessons; search by practice focus)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - notes

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - a day of week (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a start time (required)
  - a duration (minutes) (a whole number, required, 60 by default)
  - practice focus

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - teacher (The piano teacher managing pupils and lessons)
  New users get the teacher role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 74 files (74 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
lessons 9 columns 0 indexes 2 fks
pupils 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_complex_secret_warriors.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-4. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Photography Invoicing
  Invoices for my photography work: clients, shoots and what is still unpaid.

Pages
  - Photography Invoicing (a landing page: hero and footer)
  - Clients (lists clients; search by name or email)
  - Shoots (lists shoots; search by name or location; filter by client)
  - Invoices (lists invoices; search by number; filter by status or shoot)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its shoots.

Shoots
  Shoots have:
  - a name (required)
  - a date (required)
  - a location
  - a client (a client, required)
  Each shoot lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a shoot (a shoot, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  Each invoice lists its invoice lines.

Invoice Lines
  Invoice Lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an amount (an amount)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
shoots 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lean_lake.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-5. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-5
  smithable run

/tmp/smithable-bench-m12-9AJm8Y/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-9AJm8Y/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-9AJm8Y/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-9AJm8Y/app-5/src/db/seed.ts:29:6)
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
  A shared place for our cleaning company to manage monthly invoices to households.

Pages
  - Households (lists households; search by name or address; sort by name)
  - Invoices (lists invoices; search by number or household; filter by household, status, issued on or due on; sort by number, issued on, due on or total)
  - Invoice lines (lists invoice lines)
  - Team (who has access: invite people, change roles, remove users)

Households
  Households have:
  - a name (required)
  - address
  Each household lists its invoices.

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
  - a household (a household, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  Each invoice lists its invoice lines.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-6/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 6 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fluffy_sasquatch.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-6. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A local marketplace where anyone can post items to sell with photos and prices.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Home (a landing page: hero, items where available is yes and footer)

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
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the marketplace tidy)
  - member (Sells and saves items)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_luxuriant_harry_osborn.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-7. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  A swap shelf for our office: colleagues offer things they no longer need and others claim them.

Pages
  - Catalog (lists items; search by title or description; filter by category, condition or available; sort by date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Team (who has access: invite people, change roles, remove users)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (furniture, bikes, electronics, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 89 files (89 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-8/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_narrow_hercules.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-8. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Record Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Records (lists records; search by title, artist or notes; filter by condition or release year; sort by title, artist, release year or price paid)

Records
  Records have:
  - a title (required)
  - an artist (required)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a price paid (an amount)
  - a release year (a whole number)
  - notes

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 71 files (71 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
records 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nasty_kang.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-9. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  Browse the museum's objects and their stories online.

Pages
  - Local Museum (a landing page: hero, objects where category is artifact and footer)
  - Objects (lists objects; search by title, description, era, origin or story; filter by type)

Objects
  Objects have:
  - a title (required)
  - a description
  - a type (artifact, document or photograph, artifact by default)
  - an era
  - an origin
  - a story
  - an image (a web address)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-10/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
artifacts 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_tiny_deadpool.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-10. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems so staff see what is down and when it is back.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents)
  - Updates (lists incident updates)
  - Components (lists components)
  - Maintenance (lists maintenances)
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
  The cause is found; the incident moves to identified.

Monitoring
  A fix is out; the incident is watched before it is closed.

Resolve
  The incident is over.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - staff (Writes incidents and their updates)
  New users get the staff role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_sour_zaran.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-11. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Check the current status and outages of our municipality's online services.

Pages
  - Service Status (a landing page: hero, services, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents)
  - Updates (lists updates)
  - Services (lists services; only for admins; visitors see services on the Service Status page)
  - Maintenances (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)
  - Overview (every kind of record, to find, open, change and delete)

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
  - a service (a service)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary
  Each incident lists its updates.
  Only staff users and admins can delete incidents.

Updates
  Updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only staff users and admins can delete updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a service (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only staff users and admins can delete maintenances.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the service status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 103 files (103 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_clear_skin.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-12. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuels; search by notes)
  - Costs (lists costs; search by description; filter by category)
  - Service (lists services; search by notes or service provider; filter by type)

Fuels
  Fuels have:
  - a date (required)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a price per liter (a number, required)
  - a total cost (an amount)
  - notes

Costs
  Costs have:
  - a date (required)
  - an amount (an amount, required)
  - a category (fuel, maintenance, insurance, tax or other, fuel by default)
  - a description (required)
  - a receipt (a web address)

Services
  Services have:
  - a date (required)
  - an odometer (a whole number, required)
  - a type (oil change, tire rotation, brake service, inspection or other, oil change by default)
  - a cost (an amount)
  - notes
  - a service provider

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-13/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
costs 9 columns 0 indexes 1 fks
fuels 10 columns 0 indexes 1 fks
services 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_spotty_ikaris.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-13. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Our Wedding
  The guest list and seating plan for our wedding, with who has answered and their meal choices.

Pages
  - Guests (lists guests; search by name, email or notes; filter by attending, meal choice or table number; sort by name, table number or date added)
  - Team (who has access: invite people, change roles, remove users)

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - an attending (yes, no or maybe, yes by default)
  - a meal choice (vegetarian, meat or fish, vegetarian by default)
  - a table number (a whole number)
  - notes
  Only admins can delete guests.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the guest list and seating plan)
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 75 files (75 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-14/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
guests 11 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_legal_wolverine.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-14. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-14
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
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the sightings page and reading sightings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 74 files (74 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-15/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_yellow_marvel_boy.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-15. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-15
  smithable run
/tmp/smithable-bench-m12-9AJm8Y/app-15/smithable.auth.yml:8:10  warning  Anyone on the internet can read Sighting, including personal data in observer.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Our Allotment Society
  Manage plots, waiting list and yearly fees for the allotment society.

Pages
  - Plots (lists plots)
  - Waiting List (lists waiting list; only for admins)
  - Yearly Fees (lists yearly fees; only for admins)
  - Team (who has access: invite people, change roles, remove users)

Plots
  Plots have:
  - a plot number (required, unique)
  - a size (m²) (a whole number)
  - status (free, assigned or reserved, free by default)
  - notes
  Each plot can have a holder (a user).
  Only admins can delete plots.

Waiting List
  Waiting List have:
  - a name (required)
  - an email (required)
  - a phone
  - a date added (required, today by default)
  - notes
  Only admins can delete waiting list.

Yearly Fees
  Yearly Fees have:
  - a year (a whole number, required, unique)
  - an amount (an amount, required)
  - a due date
  - notes
  Only admins can delete yearly fees.
  Only admins can change yearly fees.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the society)
  - member (Member of the society)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-16/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
fees 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
plots 9 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 9 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_slow_magik.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-16. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Bokningssystem för frisörsalong där kunder kan boka tid själva på nätet.

Pages
  - Hem (a landing page: hero, tjänster, frisörer, contact, call to action and footer)
  - Tjanster (lists tjänster; only for admins; visitors see tjänster on the Hem page)
  - Frisorer (lists frisörer; only for admins; visitors see frisörer on the Hem page)
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
  Only admins can add tjänster.
  Only admins can change tjänster.
  Only admins can delete tjänster.

Frisörer
  Frisörer have:
  - a namn (required)
  - a biografi
  - a porträtt (picture)
  Only admins can add frisörer.
  Only admins can change frisörer.
  Only admins can delete frisörer.

Bokningar
  Bokningar have:
  - a namn (required)
  - an e-post (an email address, required)
  - a telefon (a phone number)
  - an anteckningar
  - a tid (a tid, required, unique)
  Only the owner and admins can see bokningar.
  Only the owner and admins can change bokningar.
  Only the owner and admins can delete bokningar.
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
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongsägare eller personal som hanterar tjänster, frisörer och tider)
  - member
  New users get the member role.
  Open to anyone without signing in: the hem page, the schema page, reading services, reading stylists, reading appointments, adding bookings and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-17/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
appointments 8 columns 0 indexes 3 fks
bookings 9 columns 1 indexes 2 fks
messages 7 columns 0 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_famous_vanisher.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-17. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Offerter (lists offerter; search by offertnummer or kund; filter by status or kund)
  - Fakturor (lists fakturor; search by fakturanummer or kund; filter by status or kund)
  - Kunder (lists kunder; search by namn or e-post)
  - Användare (who has access: invite people, change roles, remove users)

Offerter
  Offerter have:
  - an offertnummer (required, unique)
  - status (utkast, skickad, accepterad or avvisad, utkast by default)
  - a totalt (an amount, required)
  - a giltig till (a date)
  - an anteckningar
  - a kund (a kund, required)

Fakturor
  Fakturor have:
  - a fakturanummer (required, unique)
  - an offert (an offert)
  - status (utkast, skickad, betald or försenad, utkast by default)
  - a totalt (an amount, required)
  - a förfallodatum (a date)
  - a betaldatum (a date)
  - an anteckningar
  - a kund (a kund, required)

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address, unique)
  - a telefon (a phone number)
  - a segment (privat, företag or kommun, privat by default)
  - an anteckningar
  Each kund can have an ansvarig säljare (a user).

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-18/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
customers 10 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_mean_tyrannus.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-18. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-18
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
  - a kategori (kläder, möbler, leksaker, elektronik, böcker or annat, kläder by default)
  - a skick (ny, bra or sliten, ny by default)
  - plats
  - a tillgänglig (yes or no, true by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller loppis sidan ren)
  - member (Lägger upp och sparar föremål)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-19/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_aspiring_randall_flagg.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-19. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Joogastudio (a landing page: hero, tuntityypit, contact, call to action and footer)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Joogastudio page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Viestit (lists viestit; only for admins)
  - Tunnit (lists tunnit; only for admins)
  - Omat varaukset (lists varaukset; only the viewer's own records; only for member users and admins)
  - Aikataulu (a calendar of sessions by week or month)

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
  - an esittely (formatted text)
  - a kuva (picture)
  Only admins can add ohjaajat.

Viestit
  Viestit have:
  - a nimi (required)
  - a sähköposti (an email address, required)
  - a viesti (required)
  Only admins can see viestit.
  Only admins can change viestit.
  Only admins can delete viestit.

Tunnit
  Tunnit have:
  - a tuntityyppi (a tuntityyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an aloitusaika (a date and time, required)
  - an osallistujamäärä (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  Only admins can add tunnit.
  Only admins can change tunnit.
  Only admins can delete tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  Each varaus can have a user (a user).
  Only member users and admins can add varaukset.
  Only member users, the owner and admins can delete varaukset.
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studiomme työntekijä. Hallinnoi aikataulua, tunteja ja ohjaajia)
  - member (Opiskelija, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 103 files (103 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-20/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 1 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
messages 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 8 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_brainy_the_leader.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-20. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-20
  smithable run
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni autokorjaamo
  Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat)
  - Autot (lists autot)
  - Huoltotyöt (lists huoltotyöt)
  - Laskut (lists laskut)
  - Team (who has access: invite people, change roles, remove users)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address)
  - a puhelinnumero (a phone number)
  - an osoite
  Each asiakas lists its autot.

Autot
  Autot have:
  - a rekisterinumero (required, unique)
  - a merkki (required)
  - a malli (required)
  - a vuosimalli (a whole number)
  - asiakas (an asiakas, required)
  Each auto lists its huoltotyöt.

Huoltotyöt
  Huoltotyöt have:
  - kuvaus (required)
  - a tila (odottaa, käynnissä, valmis or peruutettu, odottaa by default)
  - an auto (an auto, required)
  - an alkamispäivä (a date)
  - a päätöspäivä (a date)
  - a muistiinpanot
  - a lasku (a lasku)

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - asiakas (an asiakas, required)
  - a laskutuspäivä (a date, required, today by default)
  - an eräpäivä (a date, required)
  - a tila (luonnos, lähetetty, maksettu or myöhässä, luonnos by default)
  - a yhteensä (an amount)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 89 files (89 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-21/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
cars 9 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 10 columns 1 indexes 2 fks
service_jobs 11 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dark_rachel_grey.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-21. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Verwaltung von Produkten, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Produkte (lists produkte)
  - Vorbestellungen (lists vorbestellungen)
  - Abholzeiten (lists abholzeiten)
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
  - an e-mail (an email address)
  - a telefon (a phone number)
  - a produkt (a produkt, required)
  - a menge (a whole number, required, 1 by default)
  - an abholdatum (a date, required)
  - status (ausstehend, bestätigt, abgeholt or storniert, ausstehend by default)
  - a notizen

Abholzeiten
  Abholzeiten have:
  - a datum (a date, required)
  - a beginn (required)
  - an ende (required)
  - a maximale plätze (a whole number, required, 10 by default)
  - a notizen

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-9AJm8Y/app-22/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
pickup_times 9 columns 0 indexes 1 fks
pre_orders 12 columns 0 indexes 2 fks
products 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cooing_arclight.sql 🚀

Created /tmp/smithable-bench-m12-9AJm8Y/app-22. Start it with:

  cd /tmp/smithable-bench-m12-9AJm8Y/app-22
  smithable run
```
