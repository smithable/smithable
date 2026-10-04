# M12 first builds: gpt-6.1-sol, the second set (2026-10-04)

No price was given for this model, so the costs below read €0.0000. At OpenAI's list price ($2.00 in and $10.00 out per million tokens, today) the tokens below cost $0.55 for the first set and $1.00 for the second: see [the comparison](m12-model-comparison.md).

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 22 / 22 created, 21 type-check, 333,203 tokens (291,606 in, 41,597 out), €0.0000; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 12,782 | 1,618 | €0.0000 | 0 | 1 | 51 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 12,758 | 2,203 | €0.0000 | 0 | 1 | 54 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 13,109 | 2,103 | €0.0000 | 0 | 1 | 49 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 12,355 | 732 | €0.0000 | 0 | 1 | 27 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 12,779 | 1,948 | €0.0000 | 0 | 1 | 42 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 25,875 | 2,062 | €0.0000 | 0 | 2 | 41 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 12,441 | 1,260 | €0.0000 | 0 | 1 | 34 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | **no** | 12,441 | 1,190 | €0.0000 | 0 | 1 | 30 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 12,351 | 1,077 | €0.0000 | 0 | 1 | 30 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 12,353 | 1,200 | €0.0000 | 0 | 1 | 48 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 13,079 | 1,563 | €0.0000 | 0 | 1 | 53 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 13,073 | 2,202 | €0.0000 | 0 | 1 | 60 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 12,349 | 1,208 | €0.0000 | 0 | 1 | 43 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 12,355 | 1,043 | €0.0000 | 0 | 1 | 36 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 12,355 | 1,090 | €0.0000 | 0 | 1 | 40 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 12,354 | 1,622 | €0.0000 | 0 | 1 | 42 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 13,082 | 3,051 | €0.0000 | 0 | 1 | 59 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 12,753 | 2,991 | €0.0000 | 0 | 1 | 60 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 12,414 | 1,639 | €0.0000 | 0 | 1 | 43 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 13,087 | 1,884 | €0.0000 | 0 | 1 | 39 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 12,734 | 4,293 | €0.0000 | 0 | 1 | 68 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 12,727 | 3,618 | €0.0000 | 0 | 1 | 61 s |

Each created app's four spec files are in [m12-first-builds-gpt-6.1-sol-wide/](m12-first-builds-gpt-6.1-sol-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 1 | 3 / 4 (has 4) | 3 / 7 (has 4) | 2 / 2 (has 5) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 4 | no mention; no landing page | en | | | | |
| 2 | crm | 0 | 1 / 2 (has 3) | 2 / 3 (has 4) | 0 / 1 (has 5) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 3 | booking | 2 | 4 / 6 (has 4) | 6 / 10 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (no-timezone) | none | 3 / 4 | no mention; landing page | en | | | | |
| 4 | records (words: crm) | 2 | 0 / 1 (has 1) | 0 / 2 (has 1) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 5 | invoicing | 2 | 4 / 4 (has 5) | 5 / 7 (has 6) | 2 / 2 (has 5) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 5 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 2 | 4 / 4 (has 4) | 5 / 7 (has 6) | 2 / 2 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 4 | no mention; no landing page | en | | | | |
| 7 | marketplace | 1 | 1 / 1 (has 1) | 2 / 4 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 1 / 4 (has 2) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 1 | 1 / 1 (has 1) | 1 / 2 (has 1) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 2 | 1 / 1 (has 1) | 2 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, items; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 2 | 3 / 4 (has 3) | 4 / 8 (has 4) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | | |
| 12 | status | 2 | 4 / 4 (has 4) | 6 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 1 | 1 / 1 (has 3) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 1 | 1 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 3 | 1 / 1 (has 4) | 1 / 2 (has 5) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 4 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 3 (sv: yes (ska, kunder)) | 4 / 6 (has 4) | 7 / 10 (has 7) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 1 (shortcut-closed) | none | 3 / 4 | no mention; landing page | sv | yes (bokning) | yes (tid, och, bokning) | yes (våra, och, med) | models 4/4, fields 11/13, pages 7/7 |
| 18 | invoicing (words: records) | 2 (sv: yes (ska, kunder, offerter)) | 4 / 4 (has 6) | 4 / 7 (has 7) | 2 / 2 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 6 | no mention; no landing page | sv | no | yes (till) | none | models 6/6, fields 29/35, pages 6/7 |
| 19 | marketplace (words: records) | 2 (sv: yes (för, loppis, ska)) | 1 / 1 (has 1) | 2 / 4 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | yes (saker, ett, och) | models 1/1, fields 4/4, pages 2/2 |
| 20 | booking (words: records) | 1 (fi: no) | 4 / 6 (has 4) | 6 / 10 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin | pages home, schedule; read ClassType, Instructor, Session; create none | 0 | none | 3 / 4 | no mention; landing page | fi | no | yes (varaus) | yes (ja, sekä) | models 4/4, fields 12/14, pages 6/6 |
| 21 | crm (words: records) | 2 (fi: no) | 1 / 2 (has 4) | 0 / 3 (has 5) | 0 / 1 (has 6) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 4 | no mention; no landing page | fi | no | yes (työt) | none | models 4/4, fields 26/30, pages 5/5 |
| 22 | crm (words: records) | 3 (de: yes (die, vorbestellungen, abholzeiten)) | 2 / 2 (has 4) | 3 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 1 / 4 | no mention; no landing page | de | yes (hofladen) | no | none | models 4/4, fields 20/23, pages 4/5 |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Translation Client Ledger
  Keep track of your translation clients, the quotes you give them and the invoices they pay.

Pages
  - Clients (lists clients; search by name, email or notes)
  - Quotes (lists quotes; filter by client or status; “Send quote”; “Accept quote”; “Decline quote”)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”)
  - Invoice lines (lists invoice lines)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  - notes
  Each client lists its quotes.
  Each client lists its invoices.

Quotes
  Quotes have:
  - a client (a client, required)
  - a description (required)
  - a source language
  - a target language
  - quoted on (a date, required, today by default)
  - an amount (an amount, required)
  - status (draft, sent, accepted or declined, draft by default)

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - a quote (a quote)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - paid on (a date)
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
  For an invoice that is sent or overdue; sets status to paid and paid on to today.
  Record that the client paid the invoice in full.

Send quote
  For a quote that is draft; sets status to sent.
  Record that the quote was sent to the client.

Accept quote
  For a quote that is sent; sets status to accepted.
  Record that the client accepted the quote.

Decline quote
  For a quote that is sent; sets status to declined.
  Record that the client declined the quote.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 106 files (106 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-1/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 9 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 12 columns 1 indexes 3 fks
quotes 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lively_scarlet_spider.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-1. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-1
  smithable run

/tmp/smithable-bench-m12-StlyAq/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-StlyAq/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-StlyAq/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-StlyAq/app-1/src/db/seed.ts:29:6)
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
Agency Sales
  A shared sales pipeline for tracking agency leads, deals, and who follows up when.

Pages
  - Leads (lists leads; search by name or email; “Qualify lead”)
  - Deals (lists deals; search by name; “Mark won”; “Mark lost”)
  - Follow ups (lists follow ups; “Complete follow up”; “Take follow up”)
  - Team (who has access: invite people, change roles, remove users)

Leads
  Leads have:
  - a name (required)
  - an email (unique)
  - a phone
  - status (new, contacted, qualified or unqualified, new by default)
  - notes
  Each lead can have an account manager (a user).
  Each lead lists its deals.
  Each lead lists its follow ups.
  Only sales users and admins can change leads.
  Only admins can delete leads.

Deals
  Deals have:
  - a name (required)
  - a lead (a lead, required)
  - status (open, proposal, negotiation, won or lost, open by default)
  - a value (an amount)
  - an expected close date
  - notes
  Each deal can have an assignee (a user).
  Each deal lists its follow ups.
  Only sales users and admins can change deals.
  Only admins can delete deals.

Follow ups
  Follow ups have:
  - a subject (required)
  - a lead (a lead, required)
  - a deal (a deal)
  - due at (a date and time, required)
  - status (pending, completed or canceled, pending by default)
  - notes
  - completed at (a date and time)
  Each follow up can have an assignee (a user).

Qualify lead
  For a lead that is new or contacted; sets status to qualified.

Mark won
  For a deal that is open, proposal or negotiation; sets status to won.

Mark lost
  For a deal that is open, proposal or negotiation; sets status to lost.

Complete follow up
  For a follow up that is pending; sets status to completed and completed at to now.

Take follow up
  For a follow up that is pending; sets assignee to whoever presses it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the sales team and has full access)
  - sales (Works with leads, deals, and follow-ups)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
customers 10 columns 1 indexes 2 fks
deals 11 columns 0 indexes 3 fks
follow_ups 12 columns 0 indexes 4 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clammy_bloodstrike.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-2. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Salon Booking
  Online hair salon booking where customers choose a stylist and reserve an available appointment time.

Pages
  - Home (a landing page: hero, stylists, services and footer)
  - My bookings (lists bookings)
  - Appointment slots (lists appointment slots; only for admins)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Book an appointment (a calendar of sessions by week or month)

Services
  Services have:
  - a name (required)
  - a summary
  - duration minutes (a whole number, required, 60 by default)
  Only admins can add services.

Stylists
  Stylists have:
  - a name (required)
  - a bio
  Only admins can add stylists.

Appointment slots
  Appointment slots have:
  - a service (a service, required)
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 1 by default)
  Each appointment slot lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can add appointment slots.

Bookings
  Bookings have:
  - an appointment slot (an appointment slot, required, unique)
  At most the session's capacity bookings per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff who manage services, stylists and available appointment times)
  - member (A customer who books appointments)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-3/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
class_types 7 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_marvelous_alex_wilder.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-3. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-3
  smithable run
/tmp/smithable-bench-m12-StlyAq/app-3/smithable.yml:51:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lesson Notebook
  Keep track of your piano pupils, their weekly lesson times and what each pupil practises.

Pages
  - Pupils (lists pupils; search by name or what to practise; filter by lesson day)

Pupils
  Pupils have:
  - a name (required)
  - a lesson day (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a weekly lesson time (required)
  - a what to practise
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
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-4/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
pupils 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_damp_mandarin.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-4. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Photography Invoices
  Manage photography clients, shoots and invoices, and see what is still unpaid.

Pages
  - Invoices (lists invoices; filter by status, client or due on; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Clients (lists clients)
  - Shoots (lists shoots; “Complete shoot”; “Cancel shoot”)
  - Invoice lines (lists invoice lines)
  - Settings (lists business profiles)
  - Overview (a dashboard: latest)

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
  Each client lists its shoots.

Shoots
  Shoots have:
  - a title (required)
  - a client (a client, required)
  - scheduled at (a date and time, required)
  - a location
  - status (scheduled, completed or canceled, scheduled by default)
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

Mark overdue
  For an invoice that is sent; sets status to overdue.
  Mark an unpaid invoice as overdue after its due date.

Complete shoot
  For a shoot that is scheduled; sets status to completed.
  Mark the photography shoot as completed.

Cancel shoot
  For a shoot that is scheduled; sets status to canceled.
  Cancel the scheduled photography shoot.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 113 files (113 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-5/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
shoots 10 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sudden_miss_america.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-5. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-5
  smithable run

/tmp/smithable-bench-m12-StlyAq/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-StlyAq/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-StlyAq/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-StlyAq/app-5/src/db/seed.ts:44:6)
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
  A shared workspace for a three-person cleaning company to manage household clients and monthly invoices.

Pages
  - Invoices (lists invoices; search by number; filter by status, client, issued on or due on; “Mark sent”; “Mark paid”; “Duplicate invoice”)
  - Clients (lists clients; search by name, email or address)
  - Invoice lines (lists invoice lines)
  - Settings (lists business profiles)
  - Overview (a dashboard: latest, outstanding, overdue, paid and invoiced)
  - Team (who has access: invite people, change roles, remove users)

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
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
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
  Record that the invoice has been sent to the household.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  Record that the household has paid the invoice.

Duplicate invoice
  Makes a copy of an invoice with issued on today, due on today plus 30 days and status draft, asking for the number; its lines are copied too.
  Create the next monthly invoice using the same household and cleaning line items, asking for a new invoice number.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the cleaning company's workspace and team)
  - member (Manages shared household clients and invoices)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 108 files (108 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-6/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_shallow_firestar.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-6. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A local marketplace where anyone can post items for sale with photos and a price.

Pages
  - Items for Sale (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; contact the owner by mail)
  - Home (a landing page: hero, items where available is yes and footer)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a price (an amount, required)
  - a category (furniture, bikes, electronics, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the marketplace tidy)
  - member (Posts items for sale and contacts sellers)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-7/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_luxuriant_rachel_grey.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-7. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Office Swap Shelf
  Offer things you no longer need and claim useful items from colleagues.

Pages
  - Swap Shelf (lists items; search by title, description or collection location; filter by category, condition or available; sort by title or date added; contact the owner by mail; “Claim”)
  - Team (who has access: invite people, change roles, remove users)

Items
  Items have:
  - a title (required)
  - a description (required)
  - a category (furniture, electronics or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a collection location
  - an available (yes or no, true by default)
  - claimed at (a date and time)
  Each item can have a claimed by (a user).
  Only member users and admins can see items.

Claim
  For an item that is available; sets available to no, claimed by to whoever presses it and claimed at to now.
  Claim an available item and record who will collect it.
  Only member users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the office swap shelf tidy and manages invitations)
  - member (Offers items and claims things from colleagues)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 85 files (85 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-8/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 12 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_icy_machine_man.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-8. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  Keep track of your vinyl albums, artists, record condition and what you paid.

Pages
  - My Albums (lists albums; search by album title or artist; filter by condition)

Albums
  Albums have:
  - an album title (required)
  - an artist (required)
  - a condition (unknown, mint, near mint, very good plus, very good, good, fair or poor, unknown by default)
  - a price paid (an amount)
  Only admins can add albums.
  Only admins can change albums.
  Only admins can delete albums.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Maintains the vinyl collection)
  - member (Views the vinyl collection)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 78 files (78 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-9/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_parched_starjammers.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-9. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Explore our local museum's objects and discover the stories behind them.

Pages
  - Home (a landing page: hero, objects and footer)
  - Collection (lists objects; search by name, summary or story)

Objects
  Objects have:
  - a name (required)
  - a summary
  - a story
  - a link (a web address)
  - added on (a date, required, today by default)
  Only admins can add objects.
  Only admins can change objects.
  Only admins can delete objects.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Maintains the museum's collection and its stories)
  - member (Browses the museum's collection)
  New users get the member role.
  Open to anyone without signing in: the home page, the items page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 79 files (79 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-10/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_dashing_calypso.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-10. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  An internal status board where staff can see IT system outages, progress updates, and when service is restored.

Pages
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins)
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
  Only staff users and admins can change incidents.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  Mark the cause as identified and add a progress update.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  Mark the incident as being monitored after a fix and add a progress update.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  Resolve the incident, record the restoration time, and add an update; the component status remains manually managed.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages IT systems, the status board, and team access)
  - staff (Views incidents and writes incident updates)
  New users get the staff role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 98 files (98 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-11/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
components 7 columns 0 indexes 1 fks
incident_updates 8 columns 0 indexes 2 fks
incidents 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_gorgeous_spacker_dave.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-11. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Check the availability of municipal online services, current outages and planned maintenance.

Pages
  - Home (a landing page: hero, services, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a service)
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
  - a component (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause has been identified and a fix is being worked on.).
  Mark the cause as identified and publish an update.
  Only staff users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix has been applied and we are monitoring the service.).
  Move the incident to monitoring and publish an update.
  Only staff users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident has been resolved.).
  Close the incident and publish a resolution update; the service status remains separately managed.
  Only staff users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Manages the service status page, services and team)
  - staff (Reports outages, posts updates and manages maintenance notices)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 103 files (103 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_high_red_ghost.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-12. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  Keep a personal log of your car's fuel purchases, service visits and costs.

Pages
  - Fuel entries (lists fuel entries)
  - Service visits (lists service visits)
  - Cars (lists cars; search by name or summary)

Cars
  Cars have:
  - a name (required)
  - a summary
  Each car lists its fuel entries.
  Each car lists its service visits.
  Only admins can add cars.
  Only admins can change cars.
  Only admins can delete cars.

Fuel entries
  Fuel entries have:
  - a car (a car, required)
  - a date (required, today by default)
  - an odometer (a number, required)
  - liters (a number, required)
  - a price per liter (an amount, required)
  - notes
  The total cost is calculated as the liters times the price per liter.

Service visits
  Service visits have:
  - a car (a car, required)
  - a date (required, today by default)
  - an odometer (a number, required)
  - a garage
  - a description (required)
  - a cost (an amount, required)

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
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-13/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
fuel_entries 11 columns 0 indexes 2 fks
items 6 columns 0 indexes 1 fks
service_visits 10 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_simple_zaran.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-13. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Our Wedding Guests
  Manage our wedding guest list, RSVP responses, meal choices and seating assignments.

Pages
  - Guests (lists guests; search by name or notes; filter by RSVP, meal choice or table)
  - Seating Plan (lists seating tables)
  - Team (who has access: invite people, change roles, remove users)

Seating tables
  Seating tables have:
  - a name (required)
  - a capacity (a whole number, required)
  Each seating table lists its guests.

Guests
  Guests have:
  - a name (required)
  - a RSVP (awaiting response, attending or declined, awaiting response by default)
  - a meal choice (undecided, meat, fish, vegetarian or vegan, undecided by default)
  - dietary requirements
  - a table (a seating table)
  - a seat number (a whole number)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-14/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
guests 11 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
seating_tables 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cynical_bug.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-14. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-14
  smithable run
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Club Bird Sightings
  Keep a shared record of the birds our club sees, including species, place, date and observer.

Pages
  - Bird sightings (lists sightings; search by species, place or seen by)
  - Team (who has access: invite people, change roles, remove users)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - a date sighted (required, today by default)
  - a seen by (required)
  Only admins can add sightings.
  Only admins can change sightings.
  Only admins can delete sightings.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Maintains the club's bird sighting records)
  - member (Looks at the club's bird sightings)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-15/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_typical_cargill.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-15. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Manage plot holders, the waiting list and yearly allotment fees.

Pages
  - Plots (lists plots; search by plot number or summary)
  - Members (lists members; search by name, email or phone)
  - Waiting list (lists waiting list entries; filter by status)
  - Fees (lists fees; filter by year, status, member or plot; “Mark fee paid”)
  - Team (who has access: invite people, change roles, remove users)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - notes

Plots
  Plots have:
  - a plot number (required, unique)
  - a summary
  - a plot holder (a member)
  - added on (a date, required, today by default)
  Only admins can add plots.
  Only admins can change plots.
  Only admins can delete plots.

Waiting list entries
  Waiting list entries have:
  - a member (a member, required)
  - joined on (a date, required, today by default)
  - status (waiting, allocated or withdrawn, waiting by default)
  - notes

Fees
  Fees have:
  - a member (a member, required)
  - a plot (a plot, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (due or paid, due by default)
  - paid on (a date)

Mark fee paid
  For a fee that is due; sets status to paid and paid on to today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Maintains the society's plot records and manages access)
  - member (Uses the society's records)
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-16/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
fees 10 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
items 8 columns 1 indexes 2 fks
members 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_list_entries 8 columns 0 indexes 2 fks

[✓] Your SQL migration file ➜ drizzle/0000_productive_nuke.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-16. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Salongens bokning
  En bokningsapp där kunder kan se salongens behandlingar och boka lediga frisörtider på nätet.

Pages
  - Välkommen (a landing page: hero, behandlingar, call to action and footer)
  - Mina bokningar (lists bokningar)
  - Bokningsbara tider (lists bokningsbara tider; only for admins)
  - Behandlingar (lists behandlingar; only for admins; visitors see behandlingar on the Välkommen page)
  - Frisörer (lists frisörer; only for admins)
  - Boka tid (a calendar of sessions by week or month)
  - Administration (every kind of record, to find, open, change and delete)

Behandlingar
  Behandlingar have:
  - a namn (required)
  - a beskrivning
  - a längd i minuter (a whole number, required, 30 by default)
  - pris (an amount)
  Only admins can add behandlingar.

Frisörer
  Frisörer have:
  - a namn (required)
  - a presentation
  Only admins can add frisörer.

Bokningsbara tider
  Bokningsbara tider have:
  - a behandling (a behandling, required)
  - a frisör (a frisör, required)
  - a datum och tid (a date and time, required)
  - an antal platser (a whole number, required, 1 by default)
  Each bokningsbar tid lists its bokningar.
  The places left is calculated as the antal platser minus the number of its bookings.
  Only admins can add bokningsbara tider.

Bokningar
  Bokningar have:
  - a frisörtid (a bokningsbar tid, required, unique)
  At most the session's capacity bokningar per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongens personal som hanterar behandlingar, frisörer, tider och bokningar)
  - member (Kund som bokar frisörtider och hanterar sina egna bokningar)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 111 files (111 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-17/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_early_mattie_franklin.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-17. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-17
  smithable run
/tmp/smithable-bench-m12-StlyAq/app-17/smithable.auth.yml:6:11  warning  Visitors can't open my-bookings from the home hero's shortcuts: list it under public.pages, or choose another page.
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkontoret
  En gemensam app för byggfirmans kunder, offerter och fakturor.

Pages
  - Offerter (lists offerter; search by offertnummer; filter by kund or status; “Send quote”; “Accept quote”; “Decline quote”)
  - Fakturor (lists fakturor; search by fakturanummer; filter by kund, status or förfallodatum; “Mark sent”; “Mark paid”)
  - Kunder (lists kunder; search by namn or e-post)
  - Offertrader (lists offertrader)
  - Fakturarader (lists fakturarader)
  - Företagsuppgifter (lists företagsprofiler)
  - Team (who has access: invite people, change roles, remove users)

Företagsprofiler
  Företagsprofiler have:
  - a företagsnamn (required)
  - a momsregistreringsnummer
  - an IBAN
  - a betalningsvillkor i dagar (a whole number, required, 30 by default)
  - a fakturans sidfot

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address, required)
  - adress
  - a momsregistreringsnummer
  Each kund lists its fakturor.
  Each kund lists its offerter.

Fakturor
  Fakturor have:
  - a fakturanummer (required, unique)
  - a kund (a kund, required)
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

Offerter
  Offerter have:
  - an offertnummer (required, unique)
  - a kund (a kund, required)
  - an offertdatum (a date, required, today by default)
  - a giltig till (a date)
  - status (utkast, skickad, accepterad or avböjd, utkast by default)
  Each offert lists its offertrader.
  The total is calculated as the total belopp of its lines.

Offertrader
  Offertrader have:
  - an offert (an offert, required)
  - a beskrivning (required)
  - an antal (a number, required, 1 by default)
  - à-pris (an amount, required)
  The belopp is calculated as the antal times the à-pris.

Mark sent
  For a faktura that is utkast; sets status to skickad.
  Markera att fakturan har skickats till kunden.

Mark paid
  For a faktura that is skickad or förfallen; sets status to betald.
  Markera att kunden har betalat fakturan.

Send quote
  For an offert that is utkast; sets status to skickad.
  Markera att offerten har skickats till kunden.

Accept quote
  For an offert that is skickad; sets status to accepterad.
  Markera att kunden har accepterat offerten.

Decline quote
  For an offert that is skickad; sets status to avböjd.
  Markera att kunden har avböjt offerten.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 121 files (121 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-18/drizzle.config.ts'
12 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
quote_lines 9 columns 0 indexes 2 fks
quotes 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_complex_thunderbolt.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-18. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-18
  smithable run

/tmp/smithable-bench-m12-StlyAq/app-18/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-StlyAq/app-18/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-StlyAq/app-18/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-StlyAq/app-18/src/db/seed.ts:74:6)
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  code: 'SQLITE_CONSTRAINT_FOREIGNKEY'
}

Node.js v24.21.0
Could not add sample data; the app works without it.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår loppis
  En loppissida där alla kan lägga upp saker till försäljning med bilder och pris.

Pages
  - Loppisen (lists annonser; search by rubrik or beskrivning; filter by pris; sort by pris or date added; contact the owner by mail)
  - Välkommen (a landing page: hero, annonser and footer)

Annonser
  Annonser have:
  - a rubrik (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount, required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller ordning på loppisen)
  - member (Lägger upp och hanterar sina egna annonser)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-19/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_bent_gwen_stacy.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-19. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogavaraus
  Joogastudion tuntien, ohjaajien ja verkkovarausten hallinta.

Pages
  - Etusivu (a landing page: hero, tuntilajit, call to action and footer)
  - Omat varaukset (lists varaukset)
  - Tuntien hallinta (lists joogatunnit; only for admins)
  - Tuntilajit (lists tuntilajit; only for admins; visitors see tuntilajit on the Etusivu page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Tuntikalenteri (a calendar of sessions by week or month)

Tuntilajit
  Tuntilajit have:
  - a nimi (required)
  - kuvaus
  - a taso (kaikille tasoille, aloittelijoille or edistyneille, kaikille tasoille by default)
  - a kesto minuutteina (a whole number, required, 60 by default)
  Only admins can add tuntilajit.

Ohjaajat
  Ohjaajat have:
  - a nimi (required)
  - an esittely
  - a kuvan verkko-osoite (a web address)
  Only admins can add ohjaajat.

Joogatunnit
  Joogatunnit have:
  - a tuntilaji (a tuntilaji, required)
  - an ohjaaja (an ohjaaja, required)
  - an alkamisaika (a date and time, required)
  - a paikkamäärä (a whole number, required, 12 by default)
  Each joogatunti lists its varaukset.
  The places left is calculated as the paikkamäärä minus the number of its bookings.
  Only admins can add joogatunnit.

Varaukset
  Varaukset have:
  - a joogatunti (a joogatunti, required, unique)
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studion henkilökunta, joka hallinnoi tunteja ja ohjaajia)
  - member (Joogaaja, joka varaa paikkoja tunneille)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-20/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_flawless_shinobi_shaw.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-20. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-20
  smithable run
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Korjaamon arki
  Pienen autokorjaamon asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin)
  - Autot (lists autot; search by rekisterinumero, merkki or malli; filter by asiakas)
  - Huoltotyöt (lists huoltotyöt; filter by tila, auto or huoltoaika; “Start work”; “Complete work”; “Cancel work”)
  - Laskut (lists laskut; search by laskunumero; filter by tila, asiakas or eräpäivä; “Mark sent”; “Mark paid”; “Cancel invoice”)
  - Tiimi (who has access: invite people, change roles, remove users)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address, unique)
  - a puhelin (a phone number)
  - a muistiinpanot
  Each asiakas lists its autot.
  Each asiakas lists its laskut.
  Only admins can delete asiakkaat.

Autot
  Autot have:
  - a rekisterinumero (required, unique)
  - asiakas (an asiakas, required)
  - a merkki (required)
  - a malli (required)
  - a vuosimalli (a whole number)
  - a muistiinpanot
  Each auto lists its huoltotyöt.

Huoltotyöt
  Huoltotyöt have:
  - an auto (an auto, required)
  - työn kuvaus (required)
  - a huoltoaika (a date and time, required)
  - a tila (varattu, työn alla, valmis or peruttu, varattu by default)
  - a mittarilukema (km) (a whole number)
  - a tehdyt työt
  - a valmistumisaika (a date and time)
  Each huoltotyö lists its laskut.

Laskut
  Laskut have:
  - a laskunumero (required, unique)
  - asiakas (an asiakas, required)
  - a huoltotyö (a huoltotyö, required)
  - laskun päiväys (a date, required)
  - an eräpäivä (a date, required)
  - a loppusumma (an amount, required)
  - a tila (luonnos, lähetetty, maksettu or peruttu, luonnos by default)
  - a maksuaika (a date and time)
  - a muistiinpanot

Start work
  For a huoltotyö that is varattu; sets tila to työn alla.

Complete work
  For a huoltotyö that is työn alla; sets tila to valmis and valmistumisaika to now; asks for the tehdyt työt.

Cancel work
  For a huoltotyö that is varattu or työn alla; sets tila to peruttu.

Mark sent
  For a lasku that is luonnos; sets tila to lähetetty.

Mark paid
  For a lasku that is lähetetty; sets tila to maksettu and maksuaika to now.

Cancel invoice
  For a lasku that is luonnos or lähetetty; sets tila to peruttu.

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
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-21/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
customers 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 13 columns 1 indexes 3 fks
service_jobs 11 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
vehicles 10 columns 1 indexes 2 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_elite_kulan_gath.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-21. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Produkte, Kundenvorbestellungen und Abholzeiten für den kleinen Hofladen verwalten.

Pages
  - Vorbestellungen (lists vorbestellungen; search by bestellnummer; filter by status, kunde or abholzeit; “Place order”; “Mark ready”; “Mark collected”; “Cancel order”)
  - Produkte (lists produkte; search by name or beschreibung; filter by verfügbar)
  - Kunden (lists kunden; search by name or e-mail)
  - Bestellpositionen (lists bestellpositionen; filter by vorbestellung or produkt)
  - Team (who has access: invite people, change roles, remove users)

Kunden
  Kunden have:
  - a name (required)
  - an e-mail (an email address, unique)
  - a telefon (a phone number)
  - a notizen
  Each kunde lists its vorbestellungen.
  Only sales users and admins can change kunden.
  Only admins can delete kunden.

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - an einheit (required)
  - a preis je einheit (an amount, required)
  - a verfügbar (yes or no, required, true by default)

Vorbestellungen
  Vorbestellungen have:
  - a bestellnummer (required, unique)
  - a kunde (a kunde, required)
  - status (entwurf, bestellt, abholbereit, abgeholt or storniert, entwurf by default)
  - an abholzeit (a date and time, required)
  - a bestellt am (a date and time)
  - a notizen
  Each vorbestellung lists its bestellpositionen.
  The total is calculated as the total total of its lines.
  Only sales users and admins can change vorbestellungen.
  Only admins can delete vorbestellungen.

Bestellpositionen
  Bestellpositionen have:
  - a vorbestellung (a vorbestellung, required)
  - a produkt (a produkt, required)
  - a menge (a number, required, 1 by default)
  - a preis je einheit (an amount, required)
  The positionsbetrag is calculated as the menge times the preis je einheit.

Place order
  For a vorbestellung that is entwurf; sets status to bestellt and bestellt am to now.

Mark ready
  For a vorbestellung that is bestellt; sets status to abholbereit.

Mark collected
  For a vorbestellung that is abholbereit; sets status to abgeholt.

Cancel order
  For a vorbestellung that is entwurf, bestellt or abholbereit; sets status to storniert.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Verwaltet den Hofladen und die Zugriffsrechte)
  - sales (Erfasst Kunden und Vorbestellungen und organisiert die Abholung)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 107 files (107 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-StlyAq/app-22/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
customers 8 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
order_lines 9 columns 0 indexes 3 fks
orders 11 columns 1 indexes 2 fks
products 9 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_worthless_mad_thinker.sql 🚀

Created /tmp/smithable-bench-m12-StlyAq/app-22. Start it with:

  cd /tmp/smithable-bench-m12-StlyAq/app-22
  smithable run
```
