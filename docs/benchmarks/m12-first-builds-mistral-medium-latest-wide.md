# M12 first builds: mistral-medium-latest, the second set (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 22 / 22 created, 22 type-check, 333,691 tokens, €0.1905.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 9,794 | €0.0062 | 18 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 9,561 | €0.0058 | 19 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 35,666 | €0.0165 | 28 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 9,069 | €0.0042 | 16 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 17,373 | €0.0086 | 19 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 26,722 | €0.0135 | 24 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 8,697 | €0.0046 | 17 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 8,652 | €0.0045 | 17 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 8,593 | €0.0045 | 13 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 16,546 | €0.0076 | 19 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 18,725 | €0.0099 | 23 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 19,278 | €0.0107 | 23 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 8,292 | €0.0039 | 15 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 9,575 | €0.0065 | 22 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 8,234 | €0.0038 | 14 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 10,139 | €0.0076 | 22 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 10,938 | €0.0080 | 23 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 22,509 | €0.0150 | 35 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 20,345 | €0.0126 | 29 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 10,686 | €0.0075 | 21 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | invoicing | yes | yes | 21,467 | €0.0135 | 31 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 22,830 | €0.0155 | 37 s |

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
8. After #204 (#205).
9. This one: after #206.

- **All 22 are created and type-check**, for the first time since the third run. 3, the hair salon, works again; it leaves out `book`.
- **Invoicing:** five descriptions get the invoicing starter, and all keep mark sent and mark paid (2 of 2 in 5, 6 and 21; one in 1).
  - 21, the Finnish car repair shop, has an invoice total worked out over its service jobs.
  - 1, 5 and 6 keep one amount per invoice, without lines.
- **Status keeps 3 of 3 actions** in 11 and 12.
- **No open sign-up and no public personal data** in this set.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 (has 3) | 1 / 7 (has 4) | 1 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 (has 2) | 1 / 3 (has 3) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | booking | 0 | 1 / 6 (has 4) | 2 / 10 (has 5) | 0 / 0 (has 0); left out: book | private; admin, customer (customer) | stylists: admin, services: admin, appointment-slots: admin | pages home, appointment-slots; read Stylist, Service, AppointmentSlot; create Booking | 0 | none | 0 / 4 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 (has 3) | 0 / 10 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 0 | 2 / 4 (has 3) | 2 / 7 (has 3) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 2 / 4 (has 2) | 2 / 7 (has 3) | 2 / 2 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 2 / 2 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 4 / 4 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | no mention; landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages albums, home; read Album; create none | 0 | none | 0 / 1 | no mention; landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, artifacts; read Artifact; create none | 0 | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 (has 4) | 5 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff | pages none; read none; create none | 0 | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, guest (guest) | guests: admin | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page | en | | | | |
| 15 | records (words: booking) | 0 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages home, sightings; read Sighting; create none | 0 | none | 0 / 1 | no mention; landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 0 | 1 / 6 (has 4) | 0 / 10 (has 6) | 0 / 0 (has 0) | private; admin, customer (customer) | tjanster: admin, stylister: admin, tider: admin, mina-bokningar: customer/admin | pages hem, schema; read Service, Stylist, Appointment; create none | 0 | none | 0 / 4 | no mention; landing page | sv | yes (min, frisörsalong) | yes (tid, bokning) | yes (till, min, frisörsalong) | models 4/4, fields 15/17, pages 6/6 |
| 18 | crm (words: records) | 2 (sv: yes (av, ska, för)) | 1 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 5) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 20/20, pages 3/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 (has 1) | 3 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 0/3 |
| 20 | booking (words: records) | 0 | 4 / 6 (has 4) | 6 / 10 (has 7) | 0 / 0 (has 0) | private; admin, member (member) | class-types: admin, instructors: admin, sessions: admin, my-bookings: member/admin | pages home, schedule; read ClassType, Instructor, Session; create none | 0 | none | 3 / 4 | no mention; landing page | fi | no | yes (varaus) | no | models 4/4, fields 12/14, pages 6/7 |
| 21 | invoicing (words: records) | 3 (fi: yes (laskut)) | 1 / 4 (has 4) | 0 / 7 (has 4) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | yes (autot, huoltotyöt) | none | models 4/4, fields 25/25, pages 4/4 |
| 22 | crm (words: records) | 2 (de: yes (vorbestellungen, den)) | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | no | none | models 3/3, fields 18/18, pages 3/4 |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names actions the draft dropped because they could not be made valid. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Freelance Translator
  Track clients, quotes, and payments for a freelance translator.

Pages
  - Clients (lists clients; search by name or email)
  - Quotes (lists quotes; search by description or client; filter by status or client; “Mark sent”; “Mark accepted”; “Mark rejected”)
  - Payments (lists payments)
  - Team (who has access: invite people, change roles, remove users)

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
  - a currency (USD by default)
  - issued on (a date, required, today by default)
  - expires on (a date)
  - status (draft, sent, accepted or rejected, draft by default)
  Only the owner and admins can delete quotes.

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - a currency (USD by default)
  - paid on (a date, required, today by default)
  - a method
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
Generated 95 files (95 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
clients 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
payments 10 columns 0 indexes 2 fks
quotes 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_gifted_catseye.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-1. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-1
  smithable run

/tmp/smithable-bench-m12-C1pPFr/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-C1pPFr/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-C1pPFr/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-C1pPFr/app-1/src/db/seed.ts:29:6)
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_short_rachel_grey.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-2. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Left out, since it could not be made valid:
  addAction book: addAction: "when.placesLeft" must be a string or true or false or a list.

Hair Salon Booking
  Online booking for a hair salon where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Appointment slots (lists appointment slots; only for admins)
  - My bookings (lists bookings)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a portrait (picture)
  Only admins can delete stylists.
  Only admins can add stylists.

Services
  Services have:
  - a name (required)
  - a description
  - duration minutes (a whole number, required, 30 by default)
  - a price (an amount, required)
  Only admins can delete services.
  Only admins can add services.

Appointment slots
  Appointment slots have:
  - a stylist (a stylist, required)
  - a service (a service, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 1 by default)
  Each appointment slot lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can delete appointment slots.
  Only admins can add appointment slots.

Bookings
  Bookings have:
  - an appointment slot (an appointment slot, required, unique)
  - a customer name (required)
  - a customer email (required)
  - a customer phone
  - notes
  At most the appointment slot's capacity bookings per appointment slot.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services, and appointment slots)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page, the appointment slots page, reading stylists, reading services, reading appointment slots and adding bookings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-3/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
appointment_slots 9 columns 0 indexes 3 fks
bookings 9 columns 1 indexes 2 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_serious_timeslip.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-3. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-3
  smithable run
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-4/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
lessons 9 columns 0 indexes 2 fks
practices 9 columns 0 indexes 2 fks
pupils 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_right_crystal.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-4. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Pages
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
  - a name (required)
  - a date (required)
  - a client (a client, required)
  - a description

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
  - a date (required, today by default)
  - a due date
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
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
  - member (A photographer managing their invoices)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-5/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 7 columns 0 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
shoots 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_broken_wraith.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-5. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-5
  smithable run

/tmp/smithable-bench-m12-C1pPFr/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-C1pPFr/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-C1pPFr/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-C1pPFr/app-5/src/db/seed.ts:29:6)
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
Pages
  - Clients (lists clients; search by name or email)
  - Invoices (lists invoices; search by number or client; filter by status or client; “Mark sent”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users)

Clients
  Clients have:
  - a name (required)
  - an email
  - address

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required)
  - due on (a date, required)
  - status (draft, sent or paid, draft by default)
  - a total (an amount)

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent; sets status to paid.
  The client paid the invoice.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 86 files (86 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-6/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_parched_magneto.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-6. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-6
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_crazy_genesis.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-7. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-7
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-8/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_solid_mother_askani.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-8. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Home (a landing page: hero, albums and footer)
  - Albums (lists albums; search by title, artist, catalog number or notes; filter by condition or year)

Albums
  Albums have:
  - a title (required)
  - an artist (required)
  - a year (a whole number)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a price paid (an amount)
  - a catalog number
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
Generated 75 files (75 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
albums 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_third_ultimatum.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-9. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-9
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-10/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
artifacts 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fluffy_maestro.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-10. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-10
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_new_nomad.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-11. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-11
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_tricky_killraven.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-12. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-12
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-13/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
costs 9 columns 0 indexes 1 fks
fuels 9 columns 0 indexes 1 fks
services 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_curious_thunderbolt.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-13. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-13
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-14/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
guests 12 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_chilly_xavin.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-14. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-14
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-15/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_robust_carnage.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-15. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Manage plots, waiting list and yearly fees for the allotment society.

Pages
  - Plots (lists plots; search by plot number, size or notes; filter by status)
  - Waiting list (lists waiting list; search by name, email or notes; filter by status)
  - Fees (lists yearly fees; filter by status or year)
  - Team (who has access: invite people, change roles, remove users)

Plots
  Plots have:
  - a plot number (required, unique)
  - a size
  - status (available, assigned or reserved, available by default)
  - notes
  Each plot can have a holder (a user).
  Only admins can delete plots.
  Only admins can change plots.

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
  - status (open, paid or overdue, open by default)
  - notes
  Only admins can delete yearly fees.
  Only admins can change yearly fees.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the society)
  - member (Member of the society)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 89 files (89 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-16/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
fees 9 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
plots 9 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_thankful_stryfe.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-16. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Onlinebokning för frisörsalong där kunder kan boka tid själva.

Pages
  - Välkommen till Min Frisörsalong (a landing page: hero, tjänster, stylister and footer)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Välkommen till Min Frisörsalong page)
  - Stylister (lists stylister; only for admins; visitors see stylister on the Välkommen till Min Frisörsalong page)
  - Tider (lists tider; only for admins)
  - Mina bokningar (lists bokningar; only for customer users and admins)
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
  - an om stylisten
  - a porträtt (picture)
  Only admins can add stylister.
  Only admins can change stylister.
  Only admins can delete stylister.

Tider
  Tider have:
  - a tjänst (a tjänst, required)
  - a stylist (a stylist, required)
  - a starttid (a date and time, required)
  - a kapacitet (a whole number, required, 1 by default)
  Each tid lists its bokningar.
  The places left is calculated as the kapacitet minus the number of its bookings.
  Only admins can add tider.
  Only admins can change tider.
  Only admins can delete tider.

Bokningar
  Bokningar have:
  - a tid (a tid, required, unique)
  - a namn (required)
  - an e-post (an email address, required)
  - a telefon (a phone number)
  Only customer users and admins can add bokningar.
  Only the owner and admins can see bokningar.
  Only the owner and admins can change bokningar.
  Only the owner and admins can delete bokningar.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongsägare eller personal som hanterar bokningar och tjänster)
  - customer (Kund som bokar tider)
  New users get the customer role.
  Open to anyone without signing in: the hem page, the schema page, reading services, reading stylists and reading appointments.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-17/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
appointments 9 columns 0 indexes 3 fks
bookings 8 columns 1 indexes 2 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_gorgeous_shatterstar.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-17. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Offerter (lists offerter; search by offertnummer or kund; filter by status or kund; sort by offertnummer, totalt, giltig till or date added; “Send quote”; “Accept quote”; “Reject quote”)
  - Fakturor (lists fakturor; search by fakturanummer or kund; filter by status or kund; sort by fakturanummer, totalt, förfallodatum or date added; “Send invoice”; “Mark as paid”)
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

Mark as paid
  For a faktura that is skickad; sets status to betald and betald datum to now.
  Markera faktura som betald.

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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-18/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
customers 10 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wonderful_kingpin.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-18. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-18
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-19/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nebulous_the_captain.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-19. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Joogastudio (a landing page: hero, luokkatyypit, call to action and footer)
  - Luokkatyypit (lists luokkatyypit; only for admins; visitors see luokkatyypit on the Joogastudio page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Tunnit (lists tunnit; only for admins)
  - Omat varaukset (lists varaukset; only for member users and admins)
  - Aikataulu (a calendar of sessions by week or month)
  - Team (who has access: invite people, change roles, remove users)

Luokkatyypit
  Luokkatyypit have:
  - a nimi (required)
  - kuvaus
  - a taso (aloittelija, kaikki tasot or edistynyt, aloittelija by default)
  - a kesto (minuuttia) (a whole number, required, 60 by default)
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
  - a kapasiteetti (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The places left is calculated as the kapasiteetti minus the number of its bookings.
  Only admins can add tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studiomme työntekijä. Hallinnoi tunnit, luokkatyypit ja ohjaajat)
  - member (Opiskelija, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 104 files (104 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-20/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_concerned_magik.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-20. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-20
  smithable run
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelinnumero)
  - Autot (lists autot; search by rekisterinumero, merkki or malli)
  - Huoltotyöt (lists huoltotyöt; search by kuvaus; filter by tila or auto)
  - Laskut (lists laskut; filter by tila or asiakas; “Mark sent”; “Mark paid”)

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
  - an auto (an auto, required)
  - kuvaus (required)
  - a tila (odottaa, käynnissä, valmis or peruutettu, odottaa by default)
  - an alkamispäivä (a date)
  - a päätöspäivä (a date)
  - kokonaiskustannus (an amount)
  - a lasku (a lasku)

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - asiakas (an asiakas, required)
  - a laskutuspäivä (a date, required, today by default)
  - an eräpäivä (a date)
  - a tila (luonnos, lähetetty, maksettu or myöhästynyt, luonnos by default)
  Each lasku lists its huoltotyöt.
  The yhteensä is calculated as the total kokonaiskustannus of its huoltotyöt.

Mark sent
  For a lasku that is luonnos; sets tila to lähetetty.
  Lasku lähetetty asiakkaalle.

Mark paid
  For a lasku that is lähetetty or myöhästynyt; sets tila to maksettu.
  Asiakas on maksanut laskun.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-21/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
cars 9 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invoices 10 columns 1 indexes 2 fks
service_jobs 11 columns 0 indexes 3 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_grey_outlaw_kid.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-21. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-21
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
Reading config file '/tmp/smithable-bench-m12-C1pPFr/app-22/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
pickup_times 8 columns 0 indexes 1 fks
pre_orders 12 columns 0 indexes 2 fks
products 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_magical_bromley.sql 🚀

Created /tmp/smithable-bench-m12-C1pPFr/app-22. Start it with:

  cd /tmp/smithable-bench-m12-C1pPFr/app-22
  smithable run
```
