# M12 first builds: mistral-medium-latest, the second set (2026-10-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 22 / 22 created, 22 type-check, 309,104 tokens, €0.1747.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 17,783 | €0.0082 | 32 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 10,103 | €0.0064 | 23 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 10,146 | €0.0059 | 61 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 9,455 | €0.0045 | 56 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 18,690 | €0.0099 | 59 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 25,749 | €0.0112 | 49 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 8,977 | €0.0046 | 41 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 17,093 | €0.0076 | 37 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 8,771 | €0.0044 | 34 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 8,813 | €0.0045 | 29 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 19,886 | €0.0110 | 38 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 21,274 | €0.0127 | 45 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 8,635 | €0.0041 | 23 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 9,142 | €0.0051 | 24 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 8,452 | €0.0037 | 19 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 28,293 | €0.0142 | 34 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 11,046 | €0.0077 | 31 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 11,142 | €0.0085 | 30 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 20,724 | €0.0126 | 32 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 11,443 | €0.0085 | 33 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 12,692 | €0.0116 | 43 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 10,795 | €0.0078 | 27 s |

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
9. After #206 (#207).
10. After #211, #212 and #213 (#215).
11. This one: after #217.

- **All 22 are created and type-check**, nothing is left out, and no warnings are worth naming. 21, the Finnish car repair shop, works again.
- **Booking:**
  - 17, the Swedish hair salon, and 20, the Finnish yoga studio, book through a capacity.
  - 3, the hair salon, works out its places with a formula (`capacity - COUNT(bookings)`) and makes each time slot unique to one booking, without a capacity. For a salon's one-person slot that holds, but the app gets no Book button.
  - 4, the piano lessons, needs none.
- **Status keeps 3 of 3 actions.**
- **Invoicing:** 5 keeps 2 of 2 actions. 6, the cleaning company, has none this time.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 (has 3) | 1 / 7 (has 4) | 1 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 (has 2) | 1 / 3 (has 3) | 0 / 1 (has 6) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | booking | 0 | 1 / 6 (has 4) | 2 / 10 (has 6) | 0 / 0 (has 0) | private; admin, customer (customer) | none | pages home; read none; create none | 0 | none | 0 / 4 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 (has 3) | 0 / 10 (has 3) | 0 / 0 (has 0) | private; admin, teacher (teacher) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 0 | 2 / 4 (has 3) | 2 / 7 (has 3) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 3 / 4 (has 3) | 0 / 7 (has 0) | 0 / 2 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 2 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 (has 1) | 0 / 2 (has 1) | 0 / 0 (has 0) | private; admin, member (member) | none | pages albums; read Album; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, visitor (visitor) | none | pages home, artifacts; read Artifact; create none | 0 | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 (has 4) | 5 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages none; read none; create none | 0 | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 0 | 4 / 4 (has 4) | 8 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff, overview: admin/staff, team: admin | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 0 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages sightings; read Sighting; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 6) | shared; admin, member (member) | plots: admin/member, waiting-list: admin, fees: admin/member | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 0 | 2 / 6 (has 4) | 3 / 10 (has 6) | 0 / 0 (has 0) | private; admin, customer (customer) | services: admin, stylists: admin, sessions: admin | pages home, schedule; read Service, Stylist, Session; create none | 0 | none | 0 / 4 | no mention; landing page | sv | yes (min, frisörsalong) | yes (bokning) | yes (min, frisörsalong) | models 4/4, fields 15/17, pages 6/6 |
| 18 | crm (words: records) | 2 (sv: yes (ska, och, offerter)) | 1 / 2 (has 3) | 0 / 3 (has 4) | 0 / 1 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 18/18, pages 4/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 (has 1) | 3 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (saker, bilder, pris) | no | models 1/1, fields 8/8, pages 0/3 |
| 20 | booking (words: records) | 0 | 4 / 6 (has 4) | 4 / 10 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | class-types: admin, instructors: admin, sessions: admin, my-bookings: member/admin | pages koti, aikataulu; read ClassType, Instructor, Session; create none | 0 | none | 3 / 4 | no mention; landing page | fi | no | yes (varaus) | yes (tunnit, ohjaajat, ja) | models 4/4, fields 12/14, pages 6/6 |
| 21 | crm (words: records) | 3 (fi: yes (laskut)) | 1 / 2 (has 6) | 1 / 3 (has 6) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 6 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | no | none | models 6/6, fields 35/35, pages 5/6 |
| 22 | crm (words: records) | 2 (de: yes (vorbestellungen, für)) | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | yes (kunden) | none | models 3/3, fields 20/20, pages 3/4 |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
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
  - a VAT number
  Each client lists its quotes.

Quotes
  Quotes have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - status (draft, sent, accepted or rejected, draft by default)
  - an amount (an amount, required)
  - a description

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, cash or online, bank transfer by default)

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
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-1/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
payments 8 columns 0 indexes 2 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fearless_king_cobra.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-1. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-1
  smithable run

/tmp/smithable-bench-m12-KIINBV/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-KIINBV/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-KIINBV/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-KIINBV/app-1/src/db/seed.ts:29:6)
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
  - Leads (lists leads; search by name, email or company; sort by name, follow up date or date added; “Mark contacted”; “Mark qualified”; “Mark lost”)
  - Deals (lists deals; search by name or lead; sort by name, value, close date or date added; “Mark proposal”; “Mark negotiation”; “Mark won”)
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
  - status (proposal, negotiation, won or lost, proposal by default)
  - a close date
  - notes
  Each deal can have an assignee (a user).
  Only admins can delete deals.

Mark contacted
  For a lead that is new; sets status to contacted; asks for the follow up date.

Mark qualified
  For a lead that is contacted; sets status to qualified.

Mark lost
  For a lead that is new, contacted or qualified; sets status to lost.

Mark proposal
  For a deal that is proposal or negotiation; sets status to proposal.

Mark negotiation
  For a deal that is proposal; sets status to negotiation.

Mark won
  For a deal that is proposal or negotiation; sets status to won and close date to today.

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
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-2/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_violet_jack_murdock.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-2. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Hair Salon Booking
  Online booking for a hair salon where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, stylists, services and footer)
  - Stylists (lists stylists)
  - Services (lists services)
  - Time slots (lists time slots)
  - My bookings (lists bookings)
  - Book now (lists time slots; filter by stylist, service or starts at)

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

Time slots
  Time slots have:
  - a stylist (a stylist, required)
  - a service (a service, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 1 by default)
  Each time slot lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.

Bookings
  Bookings have:
  - a time slot (a time slot, required, unique)
  - a customer name (required)
  - a customer email (required)
  - a customer phone
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services, and time slots)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 104 files (104 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-3/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 9 columns 1 indexes 2 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
time_slots 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_outstanding_norrin_radd.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-3. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-3
  smithable run
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's lessons: pupils, their weekly times and what each one practises.

Pages
  - Pupils (lists pupils)
  - Lessons (lists lessons)
  - Practice (lists practices)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - notes
  Only teacher users and admins can delete pupils.

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - a day of week (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a start time (required)
  - duration minutes (a whole number, required, 60 by default)
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
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-4/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
lessons 9 columns 0 indexes 2 fks
practices 9 columns 0 indexes 2 fks
pupils 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_mighty_doctor_octopus.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-4. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Pages
  - Clients (lists clients; search by name or email)
  - Shoots (lists shoots)
  - Invoices (lists invoices; search by number; filter by status or client; “Mark sent”; “Mark paid”)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - address

Shoots
  Shoots have:
  - a name (required)
  - a client (a client, required)
  - a date (required)
  - a location
  - a description

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
  - issued on (a date, required)
  - due on (a date)
  - status (draft, sent, overdue or paid, draft by default)
  - a total (an amount, required)
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
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-5/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 8 columns 0 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
shoots 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_panoramic_reavers.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-5. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-5
  smithable run

/tmp/smithable-bench-m12-KIINBV/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-KIINBV/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-KIINBV/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-KIINBV/app-5/src/db/seed.ts:29:6)
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
  A shared place for our cleaning company to manage monthly invoices to households.

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  Each client lists its invoices.

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
  - issued on (a date, required, today by default)
  - status (draft, sent, paid or overdue, draft by default)
  The due on is calculated as the issued on plus 30 days.
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 76 files (76 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-6/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 7 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_outstanding_centennial.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-6. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A local marketplace where anyone can post things to sell with photos and a price.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Home (a landing page: hero, items and footer)

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
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_young_reptil.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-7. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Items (lists items; search by title or description; filter by category, condition or available; sort by date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Team (who has access: invite people, change roles, remove users)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (furniture, electronics, books, kitchen or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

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
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sharp_network.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-8. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Albums (lists albums; search by name, artist or notes; filter by condition or release year)

Albums
  Albums have:
  - a name (required)
  - an artist (required)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a purchase price (an amount)
  - a release year (a whole number)
  - notes
  - a cover image (a web address)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the albums page and reading albums.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 77 files (77 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
albums 11 columns 0 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_windy_cassandra_nova.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-9. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  Browse the museum's objects and their stories online.

Pages
  - Home (a landing page: hero, artifacts and footer)
  - Artifacts (lists artifacts; search by name, description, story, period or origin; sort by name, period or added on)

Artifacts
  Artifacts have:
  - a name (required)
  - a description
  - a category (artifact, painting, sculpture, document or other, artifact by default)
  - an image (a web address)
  - a period
  - an origin
  - a story
  - added on (a date, required, today by default)
  Only admins can add artifacts.
  Only admins can change artifacts.
  Only admins can delete artifacts.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the museum collection)
  - visitor (Browses the museum collection)
  New users get the visitor role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 80 files (80 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-10/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
artifacts 12 columns 0 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_charming_plazm.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-10. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems showing what is down and when it will be back.

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
  Only admins can add components.
  Only admins can change components.
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
  Only staff users and admins can add incidents.
  Only staff users and admins can change incidents.
  Only admins can delete incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only staff users and admins can add incident updates.
  Only staff users and admins can change incident updates.
  Only admins can delete incident updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only staff users and admins can add maintenances.
  Only staff users and admins can change maintenances.
  Only admins can delete maintenances.

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
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 115 files (115 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-11/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nappy_dakota_north.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-11. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipality Service Status
  Check the current status and outages of our municipality's online services.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - History (lists incidents)
  - Incidents (lists incidents; search by title or summary; filter by status or component; only for staff users and admins; visitors see incidents on the Home page)
  - Updates (lists incident updates; only for staff users and admins)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances; only for staff users and admins; visitors see maintenances on the Home page)
  - Overview (lists incidents; only for staff users and admins; visitors see incidents on the Home page)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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
  Only staff users and admins can delete incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  Only staff users and admins can delete incident updates.

Maintenances
  Maintenances have:
  - a title (required)
  - a component (a component)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description
  Only staff users and admins can delete maintenances.

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
  - admin (Runs the service status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, the history page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 112 files (112 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-12/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
maintenances 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_new_inhumans.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-12. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel entries (lists fuel entries)
  - Service visits (lists service visits)
  - Costs (lists costs)

Fuel entries
  Fuel entries have:
  - a date (required)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a cost (an amount)
  - notes

Service visits
  Service visits have:
  - a date (required)
  - an odometer (a whole number, required)
  - a provider (required)
  - a description
  - a cost (an amount)
  - notes

Costs
  Costs have:
  - a date (required)
  - a category (required)
  - an amount (an amount, required)
  - a description
  - a receipt (a web address)

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
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-13/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
costs 9 columns 0 indexes 1 fks
fuel_entries 9 columns 0 indexes 1 fks
service_visits 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_good_ronan.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-13. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Manage the guest list and seating plan for our wedding, with RSVPs and meal choices.

Pages
  - Guests (lists guests; search by name, email or notes; filter by attending, meal choice or table number)
  - Tables (lists tables)

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - an attending (yes, no or maybe, yes by default)
  - a meal choice (standard, vegetarian, vegan or gluten free, standard by default)
  - a table number (a whole number)
  - notes
  - a party size (a whole number, 1 by default)
  Only admins can delete guests.
  Only admins can change guests.
  Only admins can add guests.

Tables
  Tables have:
  - a number (a whole number, required, unique)
  - a capacity (a whole number, required)
  - a location
  - notes
  Only admins can delete tables.
  Only admins can change tables.
  Only admins can add tables.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the guest list and seating plan)
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 82 files (82 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-14/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
guests 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
tables 8 columns 1 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_daffy_the_executioner.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-14. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-14
  smithable run
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Bird Sightings
  A place for our birdwatching club to record and share bird sightings.

Pages
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
  Open to anyone without signing in: the sightings page and reading sightings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-15/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_quiet_silvermane.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-15. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Our Allotment Society
  Track who has which plot, the waiting list and yearly fees for the allotment society.

Pages
  - Plots (lists plots; search by number or notes; filter by status; “Reserve plot”; “Assign plot”; “Mark as available”; only for member users and admins)
  - Waiting list (lists waiting lists; search by name, email or notes; filter by status; “Assign from waiting list”; only for admins)
  - Fees (lists fees; filter by year or status; “Mark as paid”; “Mark as overdue”; only for member users and admins)
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
  - status (pending, paid or overdue, pending by default)
  - notes
  Only admins can delete fees.
  Only admins can change fees.

Reserve plot
  For a plot that is available; sets status to reserved.
  Reserve this plot temporarily.

Assign from waiting list
  For a waiting list that is active; sets status to assigned.
  Assign a plot to this person from the waiting list.

Mark as paid
  For a fee that is pending or overdue; sets status to paid.
  Mark this fee as paid.

Mark as overdue
  For a fee that is pending; sets status to overdue.
  Mark this fee as overdue.

Assign plot
  For a plot that is available or reserved; sets status to assigned and holder to whoever presses it.
  Assign this plot to a member.

Mark as available
  For a plot that is assigned; sets status to available.
  Mark this plot as available.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages plots, waiting list, and fees)
  - member (Views plots and fees)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 105 files (105 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-16/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
fees 9 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
plots 9 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_lovely_mister_fear.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-16. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Onlinebokning för frisörsalong där kunder kan boka tid själva.

Pages
  - Min Frisörsalong (a landing page: hero, tjänster, frisörer, contact and footer)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Min Frisörsalong page)
  - Frisörer (lists frisörer; only for admins; visitors see frisörer on the Min Frisörsalong page)
  - Tidsbokningar (lists tidsbokningar; only for admins)
  - Mina bokningar (lists bokningar)
  - Boka tid (a calendar of sessions by week or month)

Tjänster
  Tjänster have:
  - a namn (required)
  - a beskrivning
  - a varaktighet (minuter) (a whole number, required, 30 by default)
  - pris (an amount, required)
  Only admins can delete tjänster.

Frisörer
  Frisörer have:
  - a namn (required)
  - a beskrivning
  - a porträtt (picture)
  Only admins can delete frisörer.

Tidsbokningar
  Tidsbokningar have:
  - a tjänst (a tjänst, required)
  - a frisör (a frisör, required)
  - a starttid (a date and time, required)
  - a kapacitet (a whole number, required, 1 by default)
  Each tidsbokning lists its bokningar.
  The places left is calculated as the kapacitet minus the number of its bookings.
  Only admins can delete tidsbokningar.

Bokningar
  Bokningar have:
  - a tidsbokning (a tidsbokning, required, unique)
  - a namn (required)
  - an e-post (an email address, required)
  - a telefon (a phone number)
  At most the session's capacity bokningar per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongsägare eller personal som hanterar bokningar och tjänster)
  - customer (Kund som bokar tider)
  New users get the customer role.
  Open to anyone without signing in: the home page, the schedule page, reading services, reading stylists and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 102 files (102 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-17/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 8 columns 1 indexes 2 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_third_avengers.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-17. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Kunder (lists kunder; search by namn or e-post; sort by namn or date added)
  - Offerter (lists offerter; search by offertnummer or kund; filter by status or kund; sort by offertnummer, totalt belopp, giltig till or date added; “Accept quote”; “Reject quote”)
  - Fakturor (lists fakturor; search by fakturanummer or kund; filter by status or kund; sort by fakturanummer, totalt belopp, förfallodatum or date added; “Mark invoice paid”)
  - Användare (who has access: invite people, change roles, remove users)

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address, unique)
  - a telefon (a phone number)
  - an anteckningar
  Each kund can have a kontoansvarig (a user).
  Only admins can delete kunder.

Offerter
  Offerter have:
  - an offertnummer (required, unique)
  - a kund (a kund, required)
  - status (utkast, skickad, accepterad or avvisad, utkast by default)
  - a totalt belopp (an amount, required)
  - a beskrivning
  - a giltig till (a date)
  Only admins can delete offerter.

Fakturor
  Fakturor have:
  - a fakturanummer (required, unique)
  - a kund (a kund, required)
  - an offert (an offert)
  - status (utkast, skickad, betald or försenad, utkast by default)
  - a totalt belopp (an amount, required)
  - a förfallodatum (a date)
  - a betald datum (a date and time)
  Only admins can delete fakturor.

Accept quote
  For an offert that is skickad; sets status to accepterad.
  Acceptera en skickad offert.

Reject quote
  For an offert that is skickad; sets status to avvisad.
  Avvisa en skickad offert.

Mark invoice paid
  For a faktura that is skickad; sets status to betald and betald datum to now.
  Markera en skickad faktura som betald.

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
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-18/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
customers 9 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 11 columns 1 indexes 3 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_careful_bug.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-18. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-18
  smithable run
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår Loppis
  En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

Pages
  - Catalog (lists saker; search by titel, beskrivning or plats; filter by kategori, pris, skick or tillgänglig; sort by pris or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, saker where available is yes and footer)
  - My items (lists saker; only the viewer's own records)

Saker
  Saker have:
  - a titel (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount)
  - a kategori (kläder, möbler, elektronik, leksaker, böcker, sport or övrigt, kläder by default)
  - a skick (ny, som ny, bra or sliten, ny by default)
  - plats
  - a tillgänglig (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller loppis-sidan ren och snygg)
  - member (Lägger upp och sparar saker)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 89 files (89 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-19/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_optimal_firebrand.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-19. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Joogastudio (a landing page: hero, tuntityypit, gallery, faq and footer)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Joogastudio page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Tunnit (lists tunnit; only for admins)
  - Varaukseni (lists varaukset; only for member users and admins)
  - Aikataulu (a calendar of sessions by week or month)

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (aloittelija, kaikki tasot or edistynyt, aloittelija by default)
  - a kesto (minuuttia) (a whole number, required, 60 by default)
  Only admins can add tuntityypit.

Ohjaajat
  Ohjaajat have:
  - a nimi (required)
  - an esittely (formatted text)
  - a kuva (picture)
  Only admins can add ohjaajat.

Tunnit
  Tunnit have:
  - a tuntityyppi (a tuntityyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an aloitusaika (a date and time, required)
  - a paikkamäärä (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The places left is calculated as the paikkamäärä minus the number of its bookings.
  Only admins can add tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studiomme työntekijä. Hallinnoi aikataulua, tunteja ja ohjaajia)
  - member (Opiskelija, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the koti page, the aikataulu page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 104 files (104 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-20/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_dusty_boomerang.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-20. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-20
  smithable run
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin)
  - Autot (lists autot; search by rekisterinumero, merkki or malli)
  - Huoltotyöt (lists huoltotyöt; search by tunnus or kuvaus; filter by tila, auto, alkamispäivä or päätöspäivä; “Mark work order completed”)
  - Laskut (lists laskut; search by laskun numero or asiakas; filter by tila, asiakas, laskutuspäivä or eräpäivä; “Mark invoice sent”; “Mark invoice paid”)
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
  - tunnus (required, unique)
  - an auto (an auto, required)
  - a tila (odottaa, käsittelyssä, valmis or peruutettu, odottaa by default)
  - kuvaus
  - an alkamispäivä (a date)
  - a päätöspäivä (a date)
  - a yhteensä (an amount)
  - a muistiinpanot

Työrivit
  Työrivit have:
  - a huoltotö (a huoltotö, required)
  - a palvelu (a palvelu, required)
  - a määrä (a number, 1 by default)
  - a yksikköhinta (an amount)
  - a muistiinpanot
  The yhteensä is calculated as the määrä times the yksikköhinta.

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - a huoltotö (a huoltotö, required)
  - asiakas (an asiakas, required)
  - a tila (luonnos, lähetetty, maksettu or peruutettu, luonnos by default)
  - a laskutuspäivä (a date, today by default)
  - an eräpäivä (a date)
  - a yhteensä (an amount)
  - a muistiinpanot

Mark work order completed
  For a huoltotö that is käsittelyssä; sets tila to valmis and päätöspäivä to today.

Mark invoice sent
  For a lasku that is luonnos; sets tila to lähetetty and laskutuspäivä to today.

Mark invoice paid
  For a lasku that is lähetetty; sets tila to maksettu.

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
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-21/drizzle.config.ts'
12 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
cars 10 columns 1 indexes 2 fks
customers 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
services 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
work_items 10 columns 0 indexes 3 fks
work_orders 12 columns 1 indexes 2 fks

[✓] Your SQL migration file ➜ drizzle/0000_aromatic_electro.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-21. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Verwaltung von Produkten, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Produkte (lists produkte; search by name or kategorie)
  - Vorbestellungen (lists vorbestellungen; search by kundenname, kunden-e-mail or produkt; filter by status, abholdatum or produkt; sort by bestelldatum, abholdatum or kundenname; “Confirm pre order”; “Mark as picked up”; “Cancel pre order”)
  - Abholzeiten (lists abholzeiten)
  - Team (who has access: invite people, change roles, remove users)

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - preis (an amount, required)
  - a kategorie
  - a verfügbar (yes or no, true by default)
  - a bild (a web address)

Vorbestellungen
  Vorbestellungen have:
  - a kundenname (required)
  - a kunden-e-mail (an email address)
  - a kundentelefon (a phone number)
  - a produkt (a produkt, required)
  - a menge (a whole number, required)
  - a bestelldatum (a date, today by default)
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

Confirm pre order
  For a vorbestellung that is ausstehend; sets status to bestätigt.
  Bestätige die Vorbestellung.

Mark as picked up
  For a vorbestellung that is bestätigt; sets status to abgeholt.
  Markiere die Vorbestellung als abgeholt.

Cancel pre order
  For a vorbestellung that is ausstehend or bestätigt; sets status to storniert.
  Storniere die Vorbestellung.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-KIINBV/app-22/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
pickup_times 9 columns 0 indexes 1 fks
pre_orders 13 columns 0 indexes 2 fks
products 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_mute_silhouette.sql 🚀

Created /tmp/smithable-bench-m12-KIINBV/app-22. Start it with:

  cd /tmp/smithable-bench-m12-KIINBV/app-22
  smithable run
```
