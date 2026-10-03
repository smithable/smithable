# M12 first builds: mistral-medium-latest, the second set (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 18 / 22 created, 17 type-check, 275,885 tokens, €0.1710.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 8,428 | €0.0055 | 27 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 8,079 | €0.0047 | 24 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | **no** | **no** | 0 | €0.0000 | 12 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 8,065 | €0.0041 | 20 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 16,221 | €0.0089 | 23 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 31,323 | €0.0164 | 31 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 7,485 | €0.0041 | 19 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | **no** | 7,306 | €0.0037 | 19 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 7,809 | €0.0049 | 18 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | **no** | **no** | 15,328 | €0.0080 | 11 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | **no** | **no** | 15,935 | €0.0083 | 10 s |
| Service status for our municipality's online services, for residents to check outages. | status | **no** | **no** | 20,197 | €0.0138 | 20 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 7,584 | €0.0044 | 15 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 7,923 | €0.0051 | 19 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 7,221 | €0.0037 | 15 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 8,896 | €0.0070 | 24 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 19,492 | €0.0129 | 31 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 19,172 | €0.0127 | 52 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 8,247 | €0.0056 | 41 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 20,802 | €0.0148 | 60 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 21,078 | €0.0153 | 51 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 9,294 | €0.0071 | 35 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest-wide/](m12-first-builds-mistral-medium-latest-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the first run (before #169 and #174)

The baseline is this report's previous version: the same 22 descriptions, from main before #169 (shared drafts invite-only) and #174 (the first step in any language and with `--yes`; labels and texts in the description's language).

- **Better: sign-up.** No draft is shared with open sign-up (open-shared-access warnings: 13 before, 0 now).
- **Better: the six not in English.** Before, all six fell to records; now they get booking, crm, marketplace, booking, crm and crm.
  - Their model and field labels are almost all in the content file: fields 15/15, 19/19, 8/8, 16/18, 26/26 and 19/19.
  - Labels contain words of the description's language in five of six (21, Finnish, does not); before, one of six.
  - The app's name is in the language in five of six (20, Finnish, is not).
  - Of the three with a landing page, only 17 has landing texts in the language.
  - Page titles are missing in 19 (0 of 4) and are complete or nearly in the rest.
  - The three for which the first step has questions (18, 21, 22) would be asked them in the description's language.
- **Off-territory English descriptions.** The four that fit no starter (13 to 16) all get records; the word match would have given status, invoicing, booking and booking. Elsewhere, `new` and the word match differ in 1, 4, 6, 8, 9 and 10, each time by meaning (the translator's clients get invoicing, the piano teacher booking).
- **Worse: four drafts fail and one does not type-check** (18 of 22 created and 17 type-check; before, 22 and 22).
  - 10, 11 and 12 end with an empty `hero:` (the same picture bug as in the first set).
  - 3, the hair salon, crashes in `applyOperation`: the model sent an operation whose name is not a string, and the "did you mean" suggestion throws instead of returning a diagnostic for the retry.
  - 8, the swap shelf, imports `#/kit/Landing`, which the project lacks.
  - All three bugs are reported to session A.
- **Worse: personal data.** 15, the birdwatching club, publishes who saw each bird (public-personal-data; before, none in this set).

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 | 1 / 7 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 2 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 | 0 / 10 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 0 | 3 / 4 | 3 / 7 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 3 / 4 | 2 / 7 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 | 4 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 0 | 1 / 1 | 3 / 4 | 0 / 0 | private; admin, member (member) | none | pages catalog; read Item; create none | 0 | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 | 1 / 2 | 0 / 0 | private; admin, member (member) | none | pages home, artifacts; read Artifact; create none | 0 | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 | 7 / 8 | 0 / 3 | shared; admin, staff (staff) | incidents: staff, updates: staff, components: admin, maintenance: staff | pages home; read none; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 12 | status | 0 | 4 / 4 | 7 / 8 | 3 / 3 | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, guest (guest) | guests: admin | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 0 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | none | pages sightings; read Sighting; create none | 1 (public-personal-data) | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 | 0 / 2 | 0 / 0 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 0 | 1 / 6 | 0 / 10 | 0 / 0 | private; admin, customer (customer) | tjanster: admin, stylister: admin, tider: admin | pages hem, schema; read Service, Stylist, Appointment; create none | 0 | none | 0 / 4 | no mention; landing page | sv | yes (min, frisörsalong) | yes (bokning, tid) | yes (min, frisörsalong) | models 4/4, fields 15/15, pages 6/6 |
| 18 | crm (words: records) | 2 (sv: yes (av, ska, för)) | 1 / 2 | 0 / 3 | 0 / 1 | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 19/19, pages 3/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 | 4 / 4 | 0 / 0 | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 0/4 |
| 20 | booking (words: records) | 0 | 5 / 6 | 7 / 10 | 0 / 0 | private; admin, member (member) | class-types: admin, instructors: admin, messages: admin, sessions: admin, my-bookings: member | pages home, schedule; read ClassType, Instructor, Session; create Message | 0 | none | 3 / 5 | no mention; landing page | fi | no | yes (varaus) | no | models 5/5, fields 16/18, pages 7/7 |
| 21 | crm (words: records) | 3 (fi: yes (laskut)) | 1 / 2 | 0 / 3 | 0 / 1 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 5 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | no | none | models 4/5, fields 26/26, pages 5/5 |
| 22 | crm (words: records) | 2 (de: yes (die, vorbestellungen, und)) | 0 / 2 | 1 / 3 | 0 / 1 | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | yes (vorbestellungen) | none | models 3/3, fields 19/19, pages 3/4 |

"Kept" counts the starter's models, pages and actions that the draft still has by name. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Freelance Translator Clients
  Track clients, quotes, and payments for a freelance translator.

Pages
  - Clients (lists clients; search by name or email)
  - Quotes (lists quotes; search by quote number or description; filter by client or status)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its quotes.

Quotes
  Quotes have:
  - a quote number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - an amount (an amount, required)
  - status (draft, sent, accepted or paid, draft by default)
  - a description

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 77 files (77 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-1/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
clients 8 columns 0 indexes 1 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_tired_lady_mastermind.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-1. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-1
  smithable run

/tmp/smithable-bench-m12-Ngigjk/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-Ngigjk/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-Ngigjk/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-Ngigjk/app-1/src/db/seed.ts:29:6)
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
  - Leads (lists leads; search by name, company or email; sort by name, company, follow up date or date added)
  - Deals (lists deals; search by name or lead; sort by name, value, close date or date added)
  - Team (who has access: invite people, change roles, remove users)

Leads
  Leads have:
  - a name (required)
  - a company
  - an email
  - a phone
  - status (new, contacted, qualified or lost, new by default)
  - a source (referral, website, social or other, referral by default)
  - notes
  - a follow up date
  Each lead can have an assignee (a user).

Deals
  Deals have:
  - a name (required)
  - a lead (a lead, required)
  - a value (an amount)
  - status (proposal, negotiation, won or lost, proposal by default)
  - a close date
  - notes
  Each deal can have an assignee (a user).

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
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wandering_red_hulk.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-2. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

Failed:

```text
une/repos/smithable-clarify/packages/core/dist/apply.js:51:53)
    at applyAll (file:///home/oakenfortune/repos/smithable-clarify/packages/ai/dist/draft-operations.js:153:22)
    at draftProjectByOperations (file:///home/oakenfortune/repos/smithable-clarify/packages/ai/dist/draft-operations.js:317:29)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async create (file:///home/oakenfortune/repos/smithable-clarify/packages/cli/dist/new.js:88:15)
    at async file:///home/oakenfortune/repos/smithable-clarify/packages/cli/dist/bin.js:3:20

Node.js v24.21.0

```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Track my pupils, their weekly lesson times and what each one practises.

Pages
  - Pupils (lists pupils; search by name, email or phone)
  - Lessons (lists lessons; search by pupil or day of week; filter by pupil or day of week)
  - Practices (lists practices; search by lesson or piece; filter by lesson or date)

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
  - duration minutes (a whole number, required, 60 by default)
  - notes

Practices
  Practices have:
  - a lesson (a lesson, required)
  - a date (required)
  - a piece (required)
  - minutes (a whole number)
  - notes

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
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
lessons 9 columns 0 indexes 2 fks
practices 9 columns 0 indexes 2 fks
pupils 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_light_silk_fever.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-4. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Photography Invoices
  Invoices for my photography work: clients, shoots and what is still unpaid.

Pages
  - Clients (lists clients; search by name or email)
  - Invoices (lists invoices; search by number or client; filter by status or client)
  - Invoice Lines (lists invoice lines)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
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
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 82 files (82 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-5/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_windy_mongoose.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-5. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-5
  smithable run
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Cleaning Invoices
  A shared place for our cleaning company to manage monthly household invoices.

Pages
  - Households (lists households; search by name or address)
  - Invoices (lists invoices; search by number; filter by status, household or issued on)
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
  - issued on (a date, required)
  - due on (a date)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  - an amount (an amount, the total amount of its lines by default)
  Each invoice lists its invoice lines.

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
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-6/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 6 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sweet_reptil.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-6. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Flea Market
  A town flea market site where anyone can post things to sell, with photos and a price.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Home (a landing page: hero and footer)

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
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_polite_the_spike.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-7. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-7
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
  - a category (furniture, bikes, electronics, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the swap shelf tidy)
  - member (Offers and claims items)
  New users get the member role.
  Open to anyone without signing in: the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 84 files (84 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-8/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_small_komodo.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-8. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Record Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Albums (lists albums; search by title, artist or summary; filter by condition; sort by title, artist, release year or price paid)

Albums
  Albums have:
  - a title (required)
  - an artist (required)
  - a release year (a whole number)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a price paid (an amount)
  - a summary

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
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
albums 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bent_rawhide_kid.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-9. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

Failed:

```text
nly their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Left out a picture the texts named but the app does not have.
/tmp/smithable-bench-m12-Ngigjk/app-10/smithable.content.yml:29:10  error  "hero" of page "home" must be a mapping of keys to values.

1 error in /tmp/smithable-bench-m12-Ngigjk/app-10/smithable.content.yml.

```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

Failed:

```text
s:
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Left out a picture the texts named but the app does not have.
/tmp/smithable-bench-m12-Ngigjk/app-11/smithable.content.yml:4:10  error  "hero" of page "home" must be a mapping of keys to values.

1 error in /tmp/smithable-bench-m12-Ngigjk/app-11/smithable.content.yml.

```

### 12. Service status for our municipality's online services, for residents to check outages.

Failed:

```text
 in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Left out a picture the texts named but the app does not have.
/tmp/smithable-bench-m12-Ngigjk/app-12/smithable.content.yml:69:10  error  "hero" of page "home" must be a mapping of keys to values.

1 error in /tmp/smithable-bench-m12-Ngigjk/app-12/smithable.content.yml.

```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuel entries)
  - Service (lists service visits)
  - Costs (lists costs)

Fuel Entries
  Fuel Entries have:
  - a date (required)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a cost (an amount)
  - notes

Service Visits
  Service Visits have:
  - a date (required)
  - an odometer (a whole number, required)
  - a type (required)
  - a cost (an amount)
  - notes
  - a provider

Costs
  Costs have:
  - a date (required)
  - an amount (an amount, required)
  - a category (fuel, service, insurance or other, fuel by default)
  - notes

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-13/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
costs 8 columns 0 indexes 1 fks
fuels 9 columns 0 indexes 1 fks
services 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_shallow_callisto.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-13. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Our Wedding
  Manage the guest list and seating plan for our wedding, with RSVPs and meal choices.

Pages
  - Guests (lists guests; search by name, email or seating group; only for admins)
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
  - a seating group
  Only admins can delete guests.
  Only the owner and admins can change guests.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the guest list and seating)
  - guest (Views their own RSVP)
  New users get the guest role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-14/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
guests 12 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lush_sabra.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-14. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-14
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
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-15/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fancy_mauler.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-15. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-15
  smithable run
/tmp/smithable-bench-m12-Ngigjk/app-15/smithable.auth.yml:8:10  warning  Anyone on the internet can read Sighting, including personal data in observer.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Our Allotment Society
  Manage plots, waiting list and yearly fees for the allotment society.

Pages
  - Plots (lists plots; search by plot number or holder; filter by status)
  - Waiting List (lists waiting list; search by name or email; filter by status)
  - Yearly Fees (lists yearly fees)
  - Team (who has access: invite people, change roles, remove users)

Plots
  Plots have:
  - a plot number (required, unique)
  - a size
  - status (free, assigned or reserved, free by default)
  - a yearly fee (an amount)
  - notes
  Each plot can have a holder (a user).
  Only admins can delete plots.
  Only the owner and admins can change plots.

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

Yearly Fees
  Yearly Fees have:
  - a year (a whole number, required, unique)
  - an amount (an amount, required)
  - a due date (required)
  - notes
  Only admins can delete yearly fees.
  Only admins can change yearly fees.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the society and its records)
  - member (Member of the society with a plot)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-16/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
fees 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
plots 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_naive_squadron_sinister.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-16. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Onlinebokning för frisörsalong där kunder kan boka tid själva.

Pages
  - Min Frisörsalong (a landing page: hero, tjänster, stylister, call to action and footer)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Min Frisörsalong page)
  - Stylister (lists stylister; only for admins; visitors see stylister on the Min Frisörsalong page)
  - Mina bokningar (lists bokningar; only the viewer's own records)
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

Stylister
  Stylister have:
  - a namn (required)
  - a biografi
  - a porträtt (picture)
  Only admins can add stylister.
  Only admins can change stylister.
  Only admins can delete stylister.

Bokningar
  Bokningar have:
  - a namn (required)
  - an e-post (an email address, required)
  - a telefon (a phone number)
  - a tid (a tid, required, unique)
  At most the appointment's capacity bokningar per appointment.

Tider
  Tider have:
  - a tjänst (a tjänst, required)
  - a stylist (a stylist, required)
  - a starttid (a date and time, required)
  - a kapacitet (a whole number, required, 1 by default)
  Only admins can add tider.
  Only admins can change tider.
  Only admins can delete tider.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongsägare eller personal som hanterar bokningar och tjänster)
  - customer (Kund som bokar tider)
  New users get the customer role.
  Open to anyone without signing in: the hem page, the schema page, reading services, reading stylists and reading appointments.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 95 files (95 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-17/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
appointments 8 columns 0 indexes 3 fks
bookings 8 columns 1 indexes 2 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_outstanding_yellowjacket.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-17. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Offerter (lists offerter; search by offertnummer or kund)
  - Fakturor (lists fakturor; search by fakturanummer or kund)
  - Kunder (lists kunder; search by namn or e-post)
  - Anvandare (who has access: invite people, change roles, remove users)

Offerter
  Offerter have:
  - an offertnummer (required, unique)
  - status (utkast, skickad, accepterad or avvisad, utkast by default)
  - a totalt (an amount, required)
  - a giltig till (a date)
  - an anteckningar
  - a kund (a kund, required)
  Only admins can delete offerter.

Fakturor
  Fakturor have:
  - a fakturanummer (required, unique)
  - an offert (an offert)
  - status (utkast, skickad, betald or försenad, utkast by default)
  - a totalt (an amount, required)
  - a förfallodatum (a date)
  - an anteckningar
  - a kund (a kund, required)
  Only admins can delete fakturor.

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address, unique)
  - a telefon (a phone number)
  - a segment (privat, företag or kommun, privat by default)
  - an anteckningar
  Each kund can have an ansvarig säljare (a user).
  Only admins can delete kunder.

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Administratör. Full åtkomst)
  - sales (Säljare. Hanterar kunder, offerter och fakturor)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 84 files (84 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-18/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
customers 10 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 11 columns 1 indexes 3 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_concerned_ultragirl.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-18. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-18
  smithable run
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår Loppis
  En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

Pages
  - Catalog (lists föremål; search by titel, beskrivning or plats; filter by kategori, pris, skick or tillgänglig; sort by pris or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists föremål; only the viewer's own records)
  - Saved (lists föremål; only the viewer's saved records)
  - Home (a landing page: hero, föremål where available is yes and footer)

Föremål
  Föremål have:
  - a titel (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount)
  - a kategori (möbler, cyklar, elektronik, sport, barn or övrigt, möbler by default)
  - a skick (som ny, bra or sliten, som ny by default)
  - plats
  - a tillgänglig (yes or no, true by default)

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller loppis-sidan ren)
  - member (Lägger upp och sparar föremål)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-19/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_material_mister_sinister.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-19. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-19
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
  - Tunnit (lists tunnit; search by tuntityyppi or ohjaaja; filter by tuntityyppi, ohjaaja or aloitusaika; only for admins)
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
  - a vapaat paikat (a whole number, the osallistujamäärä minus the number of its bookings by default)
  Each tunti lists its varaukset.
  Only admins can add tunnit.
  Only admins can change tunnit.
  Only admins can delete tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  Each varaus can have an attendee (a user).
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with Google.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studiovastaava. Hallinnoi tunteja, ohjaajia ja varauksia)
  - member (Asiakas, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 106 files (106 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-20/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 1 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
messages 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_violet_dakota_north.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-20. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-20
  smithable run
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni Autokorjaamo
  Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin; sort by nimi or date added)
  - Laskut (lists laskut; search by laskun numero or asiakas; filter by tila, asiakas or huoltotö; sort by laskun numero, myönnetty, eräpäivä or tila)
  - Tiimi (who has access: invite people, change roles, remove users)
  - Autot (lists autot; search by rekisterinumero, merkki or malli; sort by rekisterinumero, merkki or vuosimalli)
  - Huoltotyöt (lists huoltotyöt; search by työnumero or kuvaus; filter by tila, auto or asiakas; sort by työnumero or tila)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address)
  - a puhelin (a phone number)
  - a muistiinpanot

Services
  Services have:
  - a palvelu (required)
  - kuvaus
  - a hinta (an amount, required)

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - asiakas (an asiakas, required)
  - a tila (luonnos, lähetetty, maksettu or peruutettu, luonnos by default)
  - a yhteensä (an amount, required)
  - an eräpäivä (a date)
  - a myönnetty (a date and time, now by default)
  - a huoltotö (a huoltotö)

Autot
  Autot have:
  - a rekisterinumero (required, unique)
  - a merkki (required)
  - a malli (required)
  - a vuosimalli (a whole number)
  - asiakas (an asiakas, required)
  - a muistiinpanot

Huoltotyöt
  Huoltotyöt have:
  - a työnumero (required, unique)
  - asiakas (an asiakas, required)
  - an auto (an auto, required)
  - a tila (odottaa, käynnissä, valmis or peruutettu, odottaa by default)
  - kuvaus
  - a yhteensä (an amount)

Sign-in and access
  People sign in with Google.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-21/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
cars 10 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 11 columns 1 indexes 3 fks
services 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
work_orders 10 columns 1 indexes 3 fks

[✓] Your SQL migration file ➜ drizzle/0000_boring_cerise.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-21. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Verwaltung von Produkten, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Produkte (lists produkte; search by name or kategorie)
  - Vorbestellungen (lists vorbestellungen; search by kundenname or kundentelefon; filter by status, abholdatum or produkt)
  - Abholzeiten (lists abholzeiten; filter by datum)
  - Team (who has access: invite people, change roles, remove users)

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - preis (an amount, required)
  - a bestand (a whole number, required, 0 by default)
  - an einheit (stück, kilogramm or liter, stück by default)
  - a kategorie

Vorbestellungen
  Vorbestellungen have:
  - a kundenname (required)
  - a kundentelefon (a phone number)
  - a produkt (a produkt, required)
  - a menge (a whole number, required)
  - a bestelldatum (a date, required, today by default)
  - an abholdatum (a date, required)
  - status (ausstehend, bereit, abgeholt or storniert, ausstehend by default)
  - a notizen

Abholzeiten
  Abholzeiten have:
  - a datum (a date, required)
  - a beginn (required)
  - an ende (required)
  - a max. vorbestellungen (a whole number, required, 10 by default)
  - a notizen

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
Reading config file '/tmp/smithable-bench-m12-Ngigjk/app-22/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
pickup_slots 9 columns 0 indexes 1 fks
pre_orders 12 columns 0 indexes 2 fks
products 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_handy_nitro.sql 🚀

Created /tmp/smithable-bench-m12-Ngigjk/app-22. Start it with:

  cd /tmp/smithable-bench-m12-Ngigjk/app-22
  smithable run
```
