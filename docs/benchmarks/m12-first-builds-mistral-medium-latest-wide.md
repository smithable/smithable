# M12 first builds: mistral-medium-latest, the second set (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 21 / 22 created, 21 type-check, 394,991 tokens, €0.2232.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 17,320 | €0.0082 | 21 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 9,561 | €0.0058 | 20 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | **no** | **no** | 37,104 | €0.0186 | 22 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 9,069 | €0.0042 | 16 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 17,313 | €0.0086 | 18 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 25,748 | €0.0119 | 20 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 8,697 | €0.0046 | 18 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 8,652 | €0.0045 | 17 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 9,059 | €0.0054 | 18 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 16,546 | €0.0076 | 19 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 18,725 | €0.0099 | 24 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 19,278 | €0.0107 | 25 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 8,292 | €0.0039 | 15 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 9,606 | €0.0065 | 24 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 8,234 | €0.0038 | 17 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 18,326 | €0.0099 | 23 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 42,900 | €0.0235 | 44 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 22,287 | €0.0147 | 32 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 20,345 | €0.0126 | 31 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 24,178 | €0.0169 | 41 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 20,921 | €0.0159 | 43 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 22,830 | €0.0155 | 36 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest-wide/](m12-first-builds-mistral-medium-latest-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The runs so far:
1. From main before #169 and #174.
2. After them (#176).
3. After #180 (#181).
4. After #190 (#193).
5. After #194 (#195).
6. After #196 and #197 (#199).
7. After #200 and #201 (#202).
8. This one: after #204.

- **Better: every invoicing draft is created**: 1, 5 and 6, against two failures in the seventh run.
  - 6, the cleaning company, has InvoiceLine with a computed amount and an invoice total over it.
  - 1, the translator, and 5, the photography, are drafted without line items: one amount per quote or invoice. That is a valid, simpler design.
- **Worse: 3, the hair salon, fails.** Its AppointmentSlot model never lands. Reported to session A with the first set's two.
- **Everything created type-checks** (21 of 21). Status keeps 3 of 3 actions.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 (has 3) | 1 / 7 (has 4) | 1 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 (has 2) | 1 / 3 (has 3) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 (has 3) | 0 / 10 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 0 | 2 / 4 (has 3) | 3 / 7 (has 5) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 1 / 3 | no mention; landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 3 / 4 (has 3) | 3 / 7 (has 4) | 2 / 2 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 4 / 4 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | no mention; landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 (has 1) | 0 / 2 (has 1) | 0 / 0 (has 0) | private; admin, member (member) | none | pages albums; read Album; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, artifacts; read Artifact; create none | 0 | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 (has 4) | 5 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff | pages none; read none; create none | 0 | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, guest (guest) | guests: admin | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page | en | | | | |
| 15 | records (words: booking) | 0 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages home, sightings; read Sighting; create none | 0 | none | 0 / 1 | no mention; landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 6) | shared; admin, member (member) | plots: admin/member, waiting-list: admin, fees: admin/member | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 0 | 2 / 6 (has 5) | 0 / 10 (has 7) | 0 / 0 (has 0); left out: Appointment.placesLeft | private; admin, customer (customer) | tjanster: admin, frisorer: admin, mina-bokningar: customer, meddelanden: admin, tider: admin | pages hem, schema; read Service, Stylist, Appointment; create Booking, Message | 0 | none | 0 / 5 | no mention; landing page | sv | yes (min, frisörsalong) | yes (bokning, tid) | yes (min, frisörsalong, boka) | models 5/5, fields 18/18, pages 7/7 |
| 18 | crm (words: records) | 2 (sv: yes (av, ska, för)) | 1 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 5) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 20/20, pages 3/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 (has 1) | 3 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 0/3 |
| 20 | booking (words: records) | 0 | 6 / 6 (has 6) | 9 / 10 (has 10) | 0 / 0 (has 0) | private; admin, member (member) | class-types: admin, instructors: admin, messages: admin, posts: admin, sessions: admin, my-bookings: member/admin | pages home, schedule, blog; read ClassType, Instructor, Session; create Message | 1 (capacity-no-unique) | none | 4 / 6 | no mention; landing page | fi | no | yes (varaus) | no | models 6/6, fields 23/25, pages 9/10 |
| 21 | crm (words: records) | 3 (fi: yes (laskut)) | 1 / 2 (has 5) | 1 / 3 (has 1) | 0 / 1 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 5 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | none | none | models 0/5, fields 0/23, pages 0/1 |
| 22 | crm (words: records) | 2 (de: yes (die, vorbestellungen, und)) | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | no | none | models 3/3, fields 18/18, pages 3/4 |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names actions the draft dropped because they could not be made valid. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Freelance Translator
  Track clients, quotes, and payments for a freelance translator.

Pages
  - Clients (lists clients)
  - Quotes (lists quotes; “Mark sent”; “Mark accepted”; “Mark rejected”)
  - Team (who has access: invite people, change roles, remove users)
  - Payments (lists payments)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a phone
  - notes
  Only the owner and admins can delete clients.

Quotes
  Quotes have:
  - a client (a client, required)
  - a description (required)
  - an amount (an amount, required)
  - a currency (EUR by default)
  - issued on (a date, required, today by default)
  - a valid until (a date)
  - status (draft, sent, accepted or rejected, draft by default)
  Only the owner and admins can delete quotes.

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - a currency (EUR by default)
  - paid on (a date, required, today by default)
  - a method (bank transfer, paypal, cash or other, bank transfer by default)
  - notes
  Only the owner and admins can delete payments.

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
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
payments 10 columns 0 indexes 2 fks
quotes 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_white_sharon_carter.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-1. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-1
  smithable run

/tmp/smithable-bench-m12-QXE0td/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-QXE0td/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-QXE0td/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-QXE0td/app-1/src/db/seed.ts:29:6)
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
  A sales pipeline for a six-person web agency to track leads, deals, and follow-ups.

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
  - a source (referral, website, social or other, referral by default)
  - status (new, contacted, qualified or disqualified, new by default)
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
  Mark a lead as qualified for further follow-up.

Disqualify lead
  For a lead that is new, contacted or qualified; sets status to disqualified; asks for the notes.
  Mark a lead as disqualified with an optional reason.

Win deal
  For a deal that is proposal or negotiation; sets status to won.
  Mark a deal as won.

Lose deal
  For a deal that is proposal or negotiation; sets status to lost; asks for the notes.
  Mark a deal as lost with an optional reason.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - sales (Works with leads and deals)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bright_raza.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-2. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

Failed:

```text
named "bookings".
addField: addField would make smithable.yml invalid. There is no model named "AppointmentSlot". A contact form's model cannot link to other records (Booking has appointmentSlot): visitors would have to choose among them. Use a model of its own for messages, e.g. Message with name, email and message.
addPage: There is no model named "AppointmentSlot".
setPublic: setPublic would make smithable.auth.yml invalid. There is no model named "AppointmentSlot" in smithable.yml.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-QXE0td/app-3 --starter booking

```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's lessons: my pupils, their weekly times and what each one practises.

Pages
  - Pupils (lists pupils)
  - Lessons (lists lessons)
  - Practice (lists practices)
  - Team (who has access: invite people, change roles, remove users)

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
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-4/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
lessons 9 columns 0 indexes 2 fks
practices 9 columns 0 indexes 2 fks
pupils 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cloudy_sleepwalker.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-4. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Pages
  - Home (a landing page: hero and footer)
  - Team (who has access: invite people, change roles, remove users)
  - Clients (lists clients)
  - Shoots (lists shoots)
  - Invoices (lists invoices; “Mark sent”; “Mark paid”)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - a phone

Shoots
  Shoots have:
  - a client (a client, required)
  - a date (required)
  - a location
  - a description

Invoices
  Invoices have:
  - a client (a client, required)
  - a shoot (a shoot)
  - a number (required, unique)
  - a date (required, today by default)
  - a due date
  - status (draft, sent, paid or overdue, draft by default)
  - an amount (an amount, required)
  - notes

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
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
shoots 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cultured_deathstrike.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-5. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-5
  smithable run

/tmp/smithable-bench-m12-QXE0td/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-QXE0td/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-QXE0td/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-QXE0td/app-5/src/db/seed.ts:29:6)
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
  - Clients (lists clients)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; “Mark sent”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users)

Clients
  Clients have:
  - a name (required)
  - address
  - an email
  Each client lists its invoices.
  Only admins can delete clients.

Invoice lines
  Invoice lines have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an invoice (an invoice, required)
  The amount is calculated as the quantity times the unit price.
  Only admins can delete invoice lines.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - status (draft, sent, paid or overdue, draft by default)
  The due on is calculated as the issued on plus 30 days.
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.
  Only admins can delete invoices.

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
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-6/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_condemned_sabretooth.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-6. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A local marketplace where anyone can post things to sell with photos and a price.

Pages
  - Home (a landing page: hero, items where available is yes and footer)
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
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
Generated 88 files (88 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_overrated_lady_vermin.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-7. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-7
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
  - Home (a landing page: hero and footer)
  - Team (who has access: invite people, change roles, remove users)

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
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-8/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_perpetual_luckman.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-8. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Albums (lists albums; search by title, artist or notes; filter by condition or year)

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
  Open to anyone without signing in: the albums page and reading albums.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
albums 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_jittery_cargill.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-9. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  Browse the museum's objects and their stories online.

Pages
  - Home (a landing page: hero, artifacts where status is on display and footer)
  - Artifacts (lists artifacts; search by name, description or story)

Artifacts
  Artifacts have:
  - a name (required)
  - a description
  - a category
  - a period
  - an image (a web address)
  - a story
  - status (on display, in storage or on loan, on display by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-10/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
artifacts 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_quiet_puma.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-10. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems so staff see what is down and when it is back.

Pages
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”; only for staff users and admins)
  - Updates (lists incident updates; only for staff users and admins)
  - Components (lists components; only for admins)
  - Maintenance (lists maintenances; only for staff users and admins)
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

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 111 files (111 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_brainy_robbie_robertson.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-11. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Check the current status and outages of our municipality's online services.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; only for staff users and admins; visitors see incidents on the Home page)
  - Updates (lists incident updates; only for staff users and admins)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances; only for staff users and admins)
  - History (lists incidents)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

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
  - a summary (formatted text)
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
  Open to anyone without signing in: the home page, the history page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 116 files (116 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_petite_exodus.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-12. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-12
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
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-13/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
costs 9 columns 0 indexes 1 fks
fuels 9 columns 0 indexes 1 fks
services 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_square_nova.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-13. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Manage the guest list and seating plan for our wedding, with RSVPs and meal choices.

Pages
  - Our Wedding (a landing page: hero and footer)
  - Guests (lists guests; search by full name, email or group; sort by full name, table number or attending; “Confirm attendance”; “Decline attendance”; only for admins)
  - Team (who has access: invite people, change roles, remove users)

Guests
  Guests have:
  - a full name (required)
  - an email
  - a phone
  - an attending (yes, no or maybe, yes by default)
  - a meal choice (vegetarian, standard, vegan or gluten-free, vegetarian by default)
  - a table number (a whole number)
  - notes
  - a group
  Only admins can delete guests.
  Only the owner and admins can change guests.

Confirm attendance
  For a guest that is maybe; sets attending to yes.
  Confirm the guest's attendance.

Decline attendance
  For a guest that is maybe; sets attending to no.
  Decline the invitation.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the guest list and seating)
  - guest (Views their own RSVP)
  New users get the guest role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 83 files (83 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-14/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
guests 12 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_curvy_the_stranger.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-14. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-14
  smithable run
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Bird Sightings
  A place for our birdwatching club to record and share bird sightings.

Pages
  - Home (a landing page: hero, sightings and footer)
  - Sightings (lists sightings; search by species, place or observer)
  - Team (who has access: invite people, change roles, remove users)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - a date (required)
  - an observer (required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the sightings page and reading sightings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 77 files (77 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-15/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wakeful_the_fallen.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-15. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Manage plots, waiting list and yearly fees for the allotment society.

Pages
  - Plots (lists plots; search by number or notes; filter by status; “Reserve plot”; “Assign plot”; “Mark as available”; only for member users and admins)
  - Waiting list (lists waiting lists; search by name, email or notes; filter by status; “Assign from waiting list”; “Withdraw from waiting list”; only for admins)
  - Fees (lists fees; filter by year or status; “Mark fee paid”; only for member users and admins)
  - Team (who has access: invite people, change roles, remove users)

Plots
  Plots have:
  - a number (required, unique)
  - a size
  - status (available, assigned or reserved, available by default)
  - notes
  Each plot can have a holder (a user).
  Only admins can delete plots.
  Only admins can change plots.

Waiting lists
  Waiting lists have:
  - a name (required)
  - an email (required)
  - a phone
  - a date added (required, today by default)
  - status (active, assigned or withdrawn, active by default)
  - notes
  Only admins can delete waiting lists.
  Only admins can change waiting lists.

Fees
  Fees have:
  - a year (a whole number, required, unique)
  - an amount (an amount, required)
  - a due date (required)
  - status (pending or paid, pending by default)
  - notes
  Only admins can delete fees.
  Only admins can change fees.

Reserve plot
  For a plot that is available; sets status to reserved.
  Reserve this plot temporarily.

Mark fee paid
  For a fee that is pending; sets status to paid.
  Mark this fee as paid.

Assign from waiting list
  For a waiting list that is active; sets status to assigned.
  Assign a plot to this person from the waiting list.

Withdraw from waiting list
  For a waiting list that is active; sets status to withdrawn.
  Withdraw this person from the waiting list.

Assign plot
  For a plot that is available or reserved; sets status to assigned.
  Assign this plot to a member.

Mark as available
  For a plot that is assigned; sets status to available.
  Mark this plot as available.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the society and its records)
  - member (Views plots and fees)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-16/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
fees 9 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
plots 9 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_chilly_nightmare.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-16. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Left out, since it could not be made valid:
  addField Appointment.placesLeft: addField would make smithable.yml invalid. Field "Appointment.placesLeft": "[" cannot be used in a formula.

Min Frisörsalong
  Onlinebokning för frisörsalong där kunder kan boka tid själva.

Pages
  - Min Frisörsalong (a landing page: hero, tjänster, frisörer, contact and footer)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Min Frisörsalong page)
  - Frisörer (lists frisörer; only for admins; visitors see frisörer on the Min Frisörsalong page)
  - Mina bokningar (lists bokningar; only for customer users and admins)
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
  - a tid (a tid, required, unique)
  Only the owner and admins can see bokningar.
  Only the owner and admins can change bokningar.
  Only the owner and admins can delete bokningar.
  Only customer users and admins can add bokningar.

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
  Open to anyone without signing in: the hem page, the schema page, reading services, reading stylists, reading appointments, adding bookings and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-17/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_young_santa_claus.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-17. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Offerter (lists offerter; search by offertnummer or kund; filter by status or kund; sort by offertnummer, totalt, giltig till or date added; “Accept quote”; “Reject quote”; “Send quote”)
  - Fakturor (lists fakturor; search by fakturanummer or kund; filter by status or kund; sort by fakturanummer, totalt, förfallodatum or date added; “Mark invoice paid”; “Send invoice”)
  - Team (who has access: invite people, change roles, remove users)
  - Kunder (lists kunder; search by namn or e-post; sort by namn or date added)

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
  - a betald datum (a date and time)
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

Accept quote
  For an offert that is skickad; sets status to accepterad.
  Acceptera en offert.

Reject quote
  For an offert that is skickad; sets status to avvisad.
  Avvisa en offert.

Mark invoice paid
  For a faktura that is skickad; sets status to betald and betald datum to now.
  Markera en faktura som betald.

Send quote
  For an offert that is utkast; sets status to skickad.
  Skicka en offert till kunden.

Send invoice
  For a faktura that is utkast; sets status to skickad.
  Skicka en faktura till kunden.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Administratör. Full åtkomst)
  - sales (Säljare. Hanterar kunder, offerter och fakturor)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-18/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
customers 10 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dapper_lightspeed.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-18. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-18
  smithable run
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår Loppis
  En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

Pages
  - Home (a landing page: hero, saker where available is yes and footer)
  - Catalog (lists saker; search by titel, beskrivning or plats; filter by kategori, pris, skick or tillgänglig; sort by pris or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists saker; only the viewer's own records)

Saker
  Saker have:
  - a titel (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount)
  - a kategori (kläder, möbler, leksaker, böcker, elektronik, sport or annat, kläder by default)
  - a skick (ny, som ny, bra or sliten, ny by default)
  - plats
  - a tillgänglig (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller loppis sidan ren och snygg)
  - member (Lägger upp och sparar saker)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-19/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_marvelous_boomerang.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-19. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Varausjärjestelmä joogastudiolle: tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Joogastudio (a landing page: hero, tuntityypit, contact and footer)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Joogastudio page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Viestit (lists viestit; only for admins)
  - Blogi (posts as articles, newest first, each on its own page)
  - Artikkelit (lists artikkelit; only for admins)
  - Team (who has access: invite people, change roles, remove users)
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

Artikkelit
  Artikkelit have:
  - an otsikko (required)
  - an osoite (unique)
  - a yhteenveto
  - a kansikuva (picture)
  - a sisältö (formatted text, required)
  - a julkaistu (a date)
  - a tila (luonnos or julkaistu, luonnos by default)
  Only admins can add artikkelit.
  Only admins can change artikkelit.
  Only admins can delete artikkelit.

Tunnit
  Tunnit have:
  - a tuntityyppi (a tuntityyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an aloitusaika (a date and time, required)
  - an osallistujamäärä (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The vapaat paikat is calculated as the osallistujamäärä minus the number of its bookings.
  Only admins can add tunnit.
  Only admins can change tunnit.
  Only admins can delete tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required)
  Each varaus can have a user (a user).
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studiovastaava. Hallinnoi tunnit, ohjaajat ja varaukset)
  - member (Asiakas, joka varaa tunneille)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 118 files (118 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-20/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
posts 11 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_rainy_grandmaster.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-20. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-20
  smithable run
/tmp/smithable-bench-m12-QXE0td/app-20/smithable.yml:64:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
    hint: Write "session: Session! unique" for one booking per person and session (unique per owner with private access).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Team (who has access: invite people, change roles, remove users)

Customers
  Customers have:
  - a name (required)
  - an email
  - a phone
  - notes

Cars
  Cars have:
  - a registration number (required, unique)
  - a make (required)
  - a model (required)
  - a year (a whole number)
  - a customer (a customer, required)
  - notes

Services
  Services have:
  - a name (required)
  - a description
  - a price (an amount, required)

Work order lines
  Work order lines have:
  - a service (a service, required)
  - a quantity (a whole number, required, 1 by default)
  - a unit price (an amount)
  - a work order (a work order, required)
  The total is calculated as the quantity times the unit price.

Work orders
  Work orders have:
  - a number (required, unique)
  - a car (a car, required)
  - status (pending, in progress, completed or canceled, pending by default)
  - a description
  - a total (an amount)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-21/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
cars 10 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
services 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
work_order_lines 9 columns 0 indexes 3 fks
work_orders 9 columns 1 indexes 2 fks

[✓] Your SQL migration file ➜ drizzle/0000_greedy_infant_terrible.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-21. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Verwaltung von Produkten, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Abholzeiten (lists abholzeiten; filter by datum)
  - Produkte (lists produkte; search by name or kategorie)
  - Vorbestellungen (lists vorbestellungen; search by kundenname or kundentelefon; filter by status, abholdatum or produkt; “Confirm pre order”; “Mark as picked up”; “Cancel pre order”)
  - Team (who has access: invite people, change roles, remove users)

Abholzeiten
  Abholzeiten have:
  - a datum (a date, required)
  - a beginn (required)
  - an ende (required)
  - a notizen

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - preis (an amount, required)
  - a kategorie (obst, gemüse, backwaren or sonstiges, obst by default)
  - a verfügbar (yes or no, true by default)
  - a bild-url

Vorbestellungen
  Vorbestellungen have:
  - a kundenname (required)
  - a kundentelefon (a phone number)
  - a produkt (a produkt, required)
  - a menge (a whole number, required)
  - a bestelldatum (a date, today by default)
  - an abholdatum (a date, required)
  - status (offen, bestätigt, abgeholt or storniert, offen by default)
  - a notizen

Confirm pre order
  For a vorbestellung that is offen; sets status to bestätigt.

Mark as picked up
  For a vorbestellung that is bestätigt; sets status to abgeholt.

Cancel pre order
  For a vorbestellung that is offen or bestätigt; sets status to storniert.

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
Reading config file '/tmp/smithable-bench-m12-QXE0td/app-22/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
pickup_times 8 columns 0 indexes 1 fks
pre_orders 12 columns 0 indexes 2 fks
products 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_plain_gateway.sql 🚀

Created /tmp/smithable-bench-m12-QXE0td/app-22. Start it with:

  cd /tmp/smithable-bench-m12-QXE0td/app-22
  smithable run
```
