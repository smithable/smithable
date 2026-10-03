# M12 first builds: mistral-medium-latest, the second set (2026-10-03)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 21 / 22 created, 20 type-check, 385,312 tokens, €0.2169.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 17,261 | €0.0087 | 21 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 9,251 | €0.0057 | 23 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 9,709 | €0.0060 | 23 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 8,983 | €0.0045 | 19 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | **no** | **no** | 35,707 | €0.0177 | 21 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 17,276 | €0.0085 | 20 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 8,360 | €0.0044 | 16 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 15,971 | €0.0073 | 20 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 16,949 | €0.0086 | 22 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 8,147 | €0.0041 | 16 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 19,671 | €0.0117 | 31 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 19,351 | €0.0113 | 43 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 7,988 | €0.0038 | 30 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 8,915 | €0.0057 | 38 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 7,920 | €0.0037 | 31 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 39,213 | €0.0207 | 49 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 10,664 | €0.0079 | 36 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 31,765 | €0.0189 | 46 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 19,625 | €0.0122 | 34 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | **no** | 41,309 | €0.0231 | 47 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 11,930 | €0.0110 | 37 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 19,347 | €0.0114 | 27 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest-wide/](m12-first-builds-mistral-medium-latest-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Against the earlier runs

The runs so far:
1. From main before #169 and #174.
2. After them (#176).
3. After #180 (#181).
4. After #190 (#193).
5. After #194 (#195).
6. This one: after #196 and #197.

The actions column now names what a draft left out.

- **Status keeps 3 of 3 actions; invoicing keeps 2 of 2** in 6 and one of 2 in 1.
- **Still failing: 5, the photography invoicing.** This time the model never adds the invoice lines at all, so the total that #197 moves to the end is still refused. Reported to session A, with the suggestion that a formula field still refused after the last round is left out like an action.
- **New: 20, the Finnish yoga booking, does not type-check.** Its `book` action was left out, and the record page still declares a `router` it no longer uses (TS6133). Reported to session A.
- **Left out:** 16, the allotment society, leaves out `assignPlot`; 20 leaves out `book`.
- **No open sign-up and no public personal data** in this set.

## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 (has 3) | 1 / 7 (has 3) | 1 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 (has 2) | 1 / 3 (has 3) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | booking | 0 | 0 / 6 (has 3) | 1 / 10 (has 4) | 0 / 0 (has 2) | private; admin, customer (customer) | stylists: admin, services: admin, appointments: admin | pages home; read Stylist, Service; create Appointment | 0 | none | 0 / 3 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 (has 3) | 0 / 10 (has 3) | 0 / 0 (has 0) | private; admin, teacher (teacher) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 2 / 4 (has 2) | 2 / 7 (has 4) | 2 / 2 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 2 / 2 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 3 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 (has 1) | 0 / 2 (has 1) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, artifacts; read Artifact; create none | 0 | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 (has 4) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | incidents: admin/staff, updates: admin/staff, components: admin, maintenance: admin/staff, overview: admin/staff | pages none; read none; create none | 0 | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 0 | 4 / 4 (has 4) | 8 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home, history; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | guests: admin | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page | en | | | | |
| 15 | records (words: booking) | 0 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 4); left out: assignPlot | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 0 | 1 / 6 (has 4) | 0 / 10 (has 6) | 0 / 0 (has 0) | private; admin, customer (customer) | tjanster: admin, stylister: admin, tider: admin, mina-bokningar: customer/admin | pages hem, schema; read Service, Stylist, Appointment; create Booking | 0 | none | 0 / 4 | no mention; landing page | sv | yes (min, frisörsalong) | yes (tid, bokning) | yes (min, frisörsalong) | models 4/4, fields 15/16, pages 6/6 |
| 18 | crm (words: records) | 2 (sv: yes (ska, och, offerter)) | 1 / 2 (has 3) | 0 / 3 (has 4) | 0 / 1 (has 5) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 20/20, pages 4/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 (has 1) | 3 / 4 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 0/3 |
| 20 | booking (words: records) | 0 | 4 / 6 (has 4) | 6 / 10 (has 6) | 0 / 0 (has 1); left out: book | private; admin, member (member) | class-types: admin, instructors: admin, sessions: admin, my-bookings: member/admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (capacity-no-unique) | none | 3 / 4 | no mention; landing page | fi | no | yes (varaus) | no | models 4/4, fields 13/15, pages 6/6 |
| 21 | crm (words: records) | 3 (fi: yes (laskut)) | 1 / 2 (has 6) | 0 / 3 (has 6) | 0 / 1 (has 6) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 6 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | no | none | models 6/6, fields 34/34, pages 6/6 |
| 22 | crm (words: records) | 2 (de: yes (die, vorbestellungen, und)) | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | de | yes (hofladen) | no | none | models 3/3, fields 18/18, pages 3/4 |

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
  - Payments (lists payments; filter by quote or method)

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
  - a currency (EUR by default)
  - issued on (a date, required, today by default)
  - status (draft, sent, accepted or rejected, draft by default)
  - notes

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - a currency (EUR by default)
  - paid on (a date, required, today by default)
  - a method (bank transfer, paypal, cash or other, bank transfer by default)
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
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-1/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 9 columns 0 indexes 1 fks
payments 10 columns 0 indexes 2 fks
quotes 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_rainy_blue_marvel.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-1. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-1
  smithable run

/tmp/smithable-bench-m12-mlOr6b/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-mlOr6b/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-mlOr6b/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-mlOr6b/app-1/src/db/seed.ts:29:6)
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
Generated 91 files (91 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-2/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
deals 11 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_glorious_magik.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-2. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-2
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
  - Book an Appointment (lists appointments; “Confirm booking”; “Cancel booking”; only for admins)

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

Confirm booking
  For an appointment that is booked; sets status to confirmed.

Cancel booking
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
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-3/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
appointments 11 columns 0 indexes 3 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_furry_gwen_stacy.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-3. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-3
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
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-4/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
lessons 9 columns 0 indexes 2 fks
practices 9 columns 0 indexes 2 fks
pupils 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_stale_robbie_robertson.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-4. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

Failed:

```text
There is no model named "InvoiceLine".
setSignUp: setSignUp would make smithable.auth.yml invalid. With "selfSignUp: false" only invited people can sign in, but no page invites them. Only invited people and administrators may sign in, and there is no administrator: nobody can sign in.
addField: addField would make smithable.yml invalid. There is no model named "InvoiceLine".
addField: addField would make smithable.yml invalid. Field "Invoice.total": Invoice has no list named "lines".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-mlOr6b/app-5 --starter invoicing

```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Cleaning Invoices
  A shared place for our cleaning company to manage monthly invoices to households.

Pages
  - Invoices (lists invoices; search by number or client; filter by status, client or issued on; “Mark sent”; “Mark paid”)
  - Clients (lists clients; search by name, email or address)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

Clients
  Clients have:
  - a name (required)
  - address
  - an email
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
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
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-6/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
clients 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_broken_mother_askani.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-6. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-6
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
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nostalgic_wiccan.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-7. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-7
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
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-8/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_grey_aqueduct.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-8. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Albums (lists albums; search by title, artist or notes; filter by year or condition; sort by title, artist, year or price paid)

Albums
  Albums have:
  - a title (required)
  - an artist (required)
  - a year (a whole number)
  - a condition (mint, near mint, good, fair or poor, mint by default)
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
Generated 73 files (73 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-9/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
albums 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_petite_riptide.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-9. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  Browse the museum's objects and their stories online.

Pages
  - Home (a landing page: hero, artifacts where status is on display and footer)
  - Artifacts (lists artifacts; search by name, description, category, period or story; sort by name, period or date added)

Artifacts
  Artifacts have:
  - a name (required)
  - a description
  - a category
  - a period
  - an image (a web address)
  - a story
  - status (on display, in storage or on loan, on display by default)
  Only admins can add artifacts.
  Only admins can change artifacts.
  Only admins can delete artifacts.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages the collection)
  - member (Views the collection)
  New users get the member role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 75 files (75 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-10/drizzle.config.ts'
5 tables
account 13 columns 1 indexes 1 fks
artifacts 11 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_mighty_lifeguard.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-10. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems so staff see what is down and when it is back.

Pages
  - Incidents (lists incidents; only for staff users and admins)
  - Updates (lists incident updates; only for staff users and admins)
  - Components (lists components; only for admins)
  - Maintenance (lists maintenances; only for staff users and admins)
  - Overview (lists incidents; only for staff users and admins)
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
  - a summary
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
Generated 112 files (112 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_yellow_katie_power.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-11. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Check the current status and outages of our municipality's online services.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - History (lists incidents)
  - Incidents (lists incidents; search by title; filter by status or component; sort by detected at, resolved at or title)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Overview (lists incidents)
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
Generated 108 files (108 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_plain_lady_vermin.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-12. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-12
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
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-13/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
costs 9 columns 0 indexes 1 fks
fuels 9 columns 0 indexes 1 fks
services 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_milky_kid_colt.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-13. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Manage the guest list and seating plan for our wedding, with RSVPs and meal choices.

Pages
  - Wedding Guest List (a landing page: hero and footer)
  - Guests (lists guests; search by name, email or group; only for admins)
  - Team (who has access: invite people, change roles, remove users)

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - an attending (yes, no or maybe, yes by default)
  - a meal choice (chicken, beef, fish or vegetarian, chicken by default)
  - a table number (a whole number)
  - notes
  - a group
  Only admins can delete guests.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the guest list and seating plan)
  - member
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 77 files (77 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-14/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
guests 12 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clumsy_captain_cross.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-14. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-14
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
Generated 76 files (76 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-15/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_flaky_surge.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-15. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Left out, since it could not be made valid:
  addAction assignPlot: A standard action sets fields of a record, so it takes no input or output.

Allotment Society
  Manage plots, waiting list and yearly fees for the allotment society.

Pages
  - Plots (lists plots; search by plot number or notes; filter by status; “Mark as available”)
  - Waiting List (lists waiting list; search by name, email or notes; filter by status; “Assign from waiting list”)
  - Yearly Fees (lists yearly fees; filter by year or status; “Mark fee paid”; “Mark fee overdue”)
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

Assign from waiting list
  For a waiting list entry that is active; sets status to assigned.
  Assign a plot to this person from the waiting list.

Mark fee paid
  For a yearly fee that is pending or overdue; sets status to paid.
  Mark this fee as paid.

Mark fee overdue
  For a yearly fee that is pending; sets status to overdue.
  Mark this fee as overdue.

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
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-16/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
fees 9 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
plots 9 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_lists 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_brave_northstar.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-16. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Onlinebokning för frisörsalong.

Pages
  - Min Frisörsalong (a landing page: hero, tjänster, stylister and footer)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Min Frisörsalong page)
  - Stylister (lists stylister; only for admins; visitors see stylister on the Min Frisörsalong page)
  - Tider (lists tider; only for admins)
  - Mina bokningar (lists bokningar; only for customer users and admins)
  - Schema (a calendar of appointments by week or month)

Tjänster
  Tjänster have:
  - a namn (required)
  - a beskrivning
  - a varaktighet (minuter) (a whole number, required, 30 by default)
  - pris (an amount, required)
  Only admins can delete tjänster.

Stylister
  Stylister have:
  - a namn (required)
  - an om stylisten
  - a bild (picture)
  Only admins can delete stylister.

Tider
  Tider have:
  - a tjänst (a tjänst, required)
  - a stylist (a stylist, required)
  - a starttid (a date and time, required)
  - a kapacitet (a whole number, required, 1 by default)
  Each tid lists its bokningar.
  Only admins can delete tider.

Bokningar
  Bokningar have:
  - a tid (a tid, required, unique)
  - a namn (required)
  - an e-post (an email address, required)
  - a telefon (a phone number)
  At most the appointment's capacity bokningar per appointment.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongsägare eller personal)
  - customer (Kund som bokar tider)
  New users get the customer role.
  Open to anyone without signing in: the hem page, the schema page, reading services, reading stylists, reading appointments and adding bookings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-17/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
appointments 8 columns 0 indexes 3 fks
bookings 8 columns 1 indexes 2 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_melodic_wolverine.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-17. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-17
  smithable run
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Offerter (lists offerter; search by offertnummer or kund; filter by status or kund; sort by offertnummer, totalt belopp, giltig till or date added; “Send quote”; “Accept quote”; “Reject quote”)
  - Fakturor (lists fakturor; search by fakturanummer or kund; filter by status or kund; sort by fakturanummer, totalt belopp, förfallodatum or date added; “Send invoice”; “Mark paid”)
  - Kunder (lists kunder; search by namn or e-post; sort by namn or date added)
  - Användare (who has access: invite people, change roles, remove users)

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
  Skicka offert till kunden.

Accept quote
  For an offert that is skickad; sets status to accepterad.
  Acceptera offert.

Reject quote
  For an offert that is skickad; sets status to avvisad.
  Avvisa offert.

Send invoice
  For a faktura that is utkast; sets status to skickad.
  Skicka faktura till kunden.

Mark paid
  For a faktura that is skickad or försenad; sets status to betald and betald datum to now.
  Markera faktura som betald.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Administratör med fullständig åtkomst)
  - sales (Säljare som hanterar kunder, offerter och fakturor)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-18/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
customers 10 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 12 columns 1 indexes 3 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_quiet_amphibian.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-18. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-18
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
  - a kategori (kläder, möbler, leksaker, elektronik, böcker, sport or annat, kläder by default)
  - a skick (ny, nästan ny, bra or sliten, ny by default)
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
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-19/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_ancient_ultimatum.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-19. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Left out, since it could not be made valid:
  addAction book: addAction would make smithable.yml invalid. Booking has a capacity per session, but "session" is not unique: one person can take several places. "placesLeft" in "when" of action "book": compares a choice field with one of its values (or a list of them), and a yes/no field with true or false. Booking in "add" of action "book": session is filled with the record the action runs on; leave it out.

Joogastudio
  Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Joogastudio (a landing page: hero, tuntityypit and footer)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Joogastudio page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Tunnit (lists tunnit; only for admins)
  - Omat varaukset (lists varaukset; only the viewer's own records; “Cancel booking”; only for member users and admins)
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
  Only admins can delete tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required)
  Each varaus can have a user (a user).
  Only member users and admins can add varaukset.
  Only member users and admins can delete varaukset.
  At most the session's capacity varaukset per session.

Cancel booking
  Makes a copy of a varaus.
  Peru varaus.
  Only member users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studiomme työntekijä. Hallinnoi aikataulua, tunteja ja ohjaajia)
  - member (Opiskelija, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-20/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
bookings 6 columns 0 indexes 3 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_absent_power_pack.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-20. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-20
  smithable run
/tmp/smithable-bench-m12-mlOr6b/app-20/smithable.yml:39:7  warning  Booking has a capacity per session, but "session" is not unique: one person can take several places.
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
  - Tiimi (who has access: invite people, change roles, remove users)

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
Generated 112 files (112 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-21/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_lumpy_the_fallen.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-21. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Verwaltung von Produkten, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Produkte (lists produkte; search by name or kategorie)
  - Vorbestellungen (lists vorbestellungen; search by kundenname, e-mail or produkt; filter by status or abholzeit; sort by abholzeit or kundenname; “Confirm pre order”; “Mark picked up”; “Cancel pre order”)
  - Abholzeiten (lists abholzeitfenster)
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
  - an abholzeit (a date and time, required)
  - status (ausstehend, bestätigt, abgeholt or storniert, ausstehend by default)
  - a notizen

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

Mark picked up
  For a vorbestellung that is bestätigt; sets status to abgeholt.
  Markiere eine Vorbestellung als abgeholt.

Cancel pre order
  For a vorbestellung that is ausstehend or bestätigt; sets status to storniert; asks for the notizen.
  Storniere eine Vorbestellung.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-mlOr6b/app-22/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
pickup_slots 9 columns 0 indexes 1 fks
pre_orders 12 columns 0 indexes 2 fks
products 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_rare_virginia_dare.sql 🚀

Created /tmp/smithable-bench-m12-mlOr6b/app-22. Start it with:

  cd /tmp/smithable-bench-m12-mlOr6b/app-22
  smithable run
```
