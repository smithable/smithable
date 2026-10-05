# M12 first builds: eu.anthropic.claude-sonnet-4-6, the second set (2026-10-05)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 24 / 24 created, 21 type-check, 904,114 tokens (816,104 in, 88,010 out), $2.0118; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

Prompt caching: of the input of the 64 calls the model answered (the response cache's are not counted), 723,489 tokens were read from the cache (the fixed system text, at a tenth of the price), 18,551 written to it (a quarter more than the price) and 106,621 were new.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 19,966 | 1,867 | $0.1120 | 0 | 1 | 91 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 42,180 | 7,086 | $0.1459 | 0 | 2 | 50 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | **no** | 62,112 | 3,787 | $0.1022 | 0 | 3 | 35 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 40,525 | 2,880 | $0.0711 | 0 | 2 | 26 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 19,964 | 2,767 | $0.0564 | 0 | 1 | 25 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 19,966 | 1,949 | $0.0429 | 0 | 1 | 22 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 40,016 | 2,454 | $0.0624 | 0 | 2 | 25 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 19,533 | 1,965 | $0.0418 | 0 | 1 | 21 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 60,612 | 4,284 | $0.1054 | 0 | 3 | 34 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 40,499 | 4,799 | $0.1026 | 0 | 2 | 38 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 40,996 | 3,385 | $0.0809 | 0 | 2 | 31 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 41,409 | 3,672 | $0.0870 | 0 | 2 | 32 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 19,433 | 2,093 | $0.0436 | 0 | 1 | 22 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 19,440 | 1,861 | $0.0398 | 0 | 1 | 29 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 19,443 | 985 | $0.0253 | 0 | 1 | 44 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 19,439 | 3,311 | $0.0637 | 0 | 1 | 68 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | **no** | 63,205 | 4,836 | $0.1231 | 0 | 3 | 67 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 19,944 | 5,090 | $0.0947 | 0 | 1 | 56 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 61,444 | 4,623 | $0.1138 | 0 | 3 | 47 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 20,290 | 6,370 | $0.1170 | 0 | 1 | 55 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 43,576 | 9,263 | $0.1864 | 0 | 2 | 68 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | booking | yes | yes | 42,769 | 6,386 | $0.1363 | 0 | 2 | 47 s |
| A backend for my habit app: habits, daily check-ins and streaks. | api | yes | **no** | 19,673 | 1,103 | $0.0280 | 0 | 1 | 16 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 19,670 | 1,194 | $0.0295 | 0 | 1 | 17 s |

Each created app's four spec files are in [m12-first-builds-eu.anthropic.claude-sonnet-4-6-wide/](m12-first-builds-eu.anthropic.claude-sonnet-4-6-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

2 of 24 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 3 / 4 (has 3) | 4 / 7 (has 4) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 3 | 0 / 2 (has 3) | 1 / 3 (has 5) | 0 / 1 (has 5) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | booking | 2 | 1 / 6 (has 4) | 3 / 10 (has 8) | 0 / 0 (has 3) | private; admin, customer (customer) | stylists: admin, service-types: admin, appointments: admin, messages: admin | pages home; read ServiceType; create Message | 3 (no-timezone, shortcut-closed) | **shortcut-closed** |  | none | 0 / 4 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 (has 3) | 0 / 10 (has 3) | 0 / 0 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 1 | 4 / 4 (has 5) | 5 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home; read none; create none | 0 | none |  | none | 3 / 5 | no mention; landing page | en | | | | |
| 6 | invoicing (words: booking) | 2 | 3 / 4 (has 3) | 4 / 7 (has 5) | 2 / 2 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 2 | 1 / 1 (has 1) | 4 / 4 (has 5) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home; read Item; create none | 0 | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 3 / 4 (has 4) | 0 / 0 (has 2) | private; admin, member (member) | team: admin | pages home, catalog; read Item; create none | 0 | none |  | none | 1 / 1 | no mention; landing page | en | | | | |
| 9 | records (words: crm) | 3 | 0 / 1 (has 2) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, artists; read Artist, Album; create none | 0 | none |  | none | 0 / 2 | no mention; landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 3) | private; admin, member (member) | none | pages home, objects; read MuseumObject; create none | 0 | none |  | Our Collection | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, writer (writer) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 2 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 2) | 0 / 2 (has 4) | 0 / 0 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: api) | 3 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, sightings; read Sighting; create none | 0 | none |  | none | 0 / 1 | no mention; landing page | en | | | | |
| 16 | records (words: booking) | 3 | 0 / 1 (has 5) | 1 / 2 (has 8) | 0 / 0 (has 5) | private; admin, member (member) | none | pages home, plots; read Plot; create none | 0 | none |  | none | 0 / 5 | no mention; landing page | en | | | | |
| 17 | booking (words: records) | 3 (sv: yes (ska, kunderna, kunna)) | 2 / 6 (has 5) | 3 / 10 (has 8) | 0 / 0 (has 0) | private; admin, customer (customer) | slots: admin, services: admin, stylists: admin, messages: admin | pages home, schema; read Service, Stylist, Slot; create Message | 1 (shortcut-closed) | **shortcut-closed** |  | none | 0 / 5 | no mention; landing page | sv | yes (min, frisörsalong) | yes (tid, bokning) | yes (min, frisörsalong, boka) | models 5/5, fields 15/17, pages 7/8 |
| 18 | invoicing (words: records) | 3 (sv: yes (ska, en, till)) | 2 / 4 (has 5) | 3 / 7 (has 7) | 2 / 2 (has 5) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 5 | no mention; no landing page | sv | no | yes (till) | none | models 5/5, fields 25/33, pages 4/7 |
| 19 | marketplace (words: records) | 2 (sv: yes (lägga, saker, till)) | 1 / 1 (has 1) | 4 / 4 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read Item; create none | 0 | none |  | none | 0 / 1 | no mention; landing page | sv | no | yes (bilder, pris) | yes (på, vår, loppis) | models 1/1, fields 8/8, pages 4/5 |
| 20 | booking (words: records) | 2 (fi: no) | 6 / 6 (has 6) | 10 / 10 (has 11) | 0 / 0 (has 2) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin, posts: admin, messages: admin | pages home, schedule, blog; read ClassType, Instructor, Session, Post; create Message | 0 | none |  | none | 4 / 6 | no mention; landing page | fi | no | yes (varaus) | yes (tunnit, verkossa) | models 6/6, fields 20/24, pages 8/11 |
| 21 | crm (words: records) | 2 (fi: no) | 1 / 2 (has 5) | 2 / 3 (has 5) | 0 / 1 (has 6) | shared; admin, mechanic (mechanic) | team: admin | pages none; read none; create none | 0 | none |  | none | 1 / 5 | no mention; no landing page | fi | no | no | none | models 5/5, fields 28/31, pages 4/5 |
| 22 | booking (words: records) | 3 (de: yes (vorbestellungen)) | 0 / 6 (has 4) | 1 / 10 (has 6) | 0 / 0 (has 3) | private; admin, customer (customer) | products: admin, pickup-slots: admin, order-lines: admin | pages home; read Product, PickupSlot; create none | 1 (capacity-no-unique) | none |  | none | 0 / 4 | no mention; landing page | de | yes (hofladen) | no | yes (unsere, produkte, und) | models 4/4, fields 17/19, pages 4/6 |
| 23 | api | 3 | 0 / 3 (has 3) | 2 / 2 (has 2) | 0 / 2 (has 2) | private; admin, member, assistant (member) | admin: admin/member | pages none; read none; create none | 0 | none | yes | none | 0 / 3 | no mention; no landing page | en | | | | |
| 24 | api | 1 | 3 / 3 (has 3) | 2 / 2 (has 2) | 2 / 2 (has 2) | shared; admin, member, assistant (member) | admin: admin/member | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
My Translation Clients
  Track your freelance translation clients, quotes, and payments in one place.

Pages
  - Clients (lists clients; search by name or email)
  - Invoices (lists invoices; search by number, language from or language to; filter by status, client, issued on or due on; “Mark sent”; “Mark paid”)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: latest)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - address
  - notes
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a language from (required)
  - a language to (required)
  - notes
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 9 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 13 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_overjoyed_komodo.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-1. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-1
  smithable run

/tmp/smithable-bench-m12-SxJQo7/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-SxJQo7/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-SxJQo7/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-SxJQo7/app-1/src/db/seed.ts:29:6)
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
Agency Pipeline
  Sales pipeline for a web agency to track leads, deals and follow-ups.

Pages
  - Follow ups (lists follow ups; search by notes; filter by status, type or due date; sort by due date; “Complete follow up”; “Skip follow up”)
  - Team (who has access: invite people, change roles, remove users)
  - Overview (a dashboard: pending follow ups, open leads, active deals, pipeline value, won deals, won revenue and recent deals)
  - Leads (lists leads; search by company name, contact name or email; filter by source or service; sort by company name or estimated value; “Qualify lead”)
  - Deals (lists deals; search by title, company name, contact name or email; filter by stage, service or closed at; sort by title, value or closed at; “Mark won”; “Mark lost”)

Follow ups
  Follow ups have:
  - a due date (required)
  - a type (call, email, meeting, proposal or other, call by default)
  - notes
  - status (pending, done or skipped, pending by default)
  - a lead (a lead)
  - a deal (a deal)
  Each follow up can have an assigned to (a user).
  The assigned to owns the follow up.
  Only admins can delete follow ups.

Leads
  Leads have:
  - a company name (required)
  - a contact name (required)
  - an email
  - a phone
  - a source (referral, website, cold outreach, event or other, referral by default)
  - a service (web design, web development, seo, maintenance or other, web design by default)
  - an estimated value (an amount)
  - notes
  Each lead can have an assigned to (a user).
  The assigned to owns the lead.
  Only admins can delete leads.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead)
  - a company name (required)
  - a contact name (required)
  - an email
  - a phone
  - a service (web design, web development, seo, maintenance or other, web design by default)
  - a value (an amount, required)
  - a stage (proposal, negotiation, contract, won or lost, proposal by default)
  - closed at (a date)
  - a lost reason
  - notes
  Each deal can have an assigned to (a user).
  The assigned to owns the deal.
  Only admins can delete deals.

Complete follow up
  For a follow up that is pending; sets status to done.
  Mark a follow-up as done.

Skip follow up
  For a follow up that is pending; sets status to skipped.
  Mark a follow-up as skipped.

Qualify lead
  Asks for the notes.
  Convert a qualified lead into a deal.

Mark won
  For a deal that is proposal, negotiation or contract; sets stage to won and closed at to today.
  Mark a deal as won.

Mark lost
  For a deal that is proposal, negotiation or contract; sets stage to lost and closed at to today; asks for the lost reason.
  Mark a deal as lost and record the reason.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with leads, deals and follow-ups)
  New users get the sales role.
No pictures: none of the library's files could be fetched.
Generated 108 files (108 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
deals 16 columns 0 indexes 2 fks
follow_ups 10 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 12 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_pretty_brother_voodoo.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-2. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
StyleBook
  Online booking for a hair salon: customers pick a stylist and a free time themselves.

Pages
  - StyleBook (a landing page: hero, features, service types, faq, contact, call to action and footer)
  - Schedule (a calendar of appointments by week or month)
  - My Appointments (lists appointments; filter by stylist, service type, status or starts at; only the viewer's own records)
  - Stylists (lists stylists; only for admins)
  - Services (lists service types; only for admins; visitors see service types on the StyleBook page)
  - All Appointments (lists appointments; search by status; filter by stylist, service type, status or starts at; only for admins)
  - Messages (lists messages; only for admins)
  - Team (who has access: invite people, change roles, remove users)

Service types
  Service types have:
  - a name (required)
  - a description
  - duration minutes (a whole number, required, 60 by default)
  - a price (an amount, required)
  Only admins can add service types.
  Only admins can change service types.
  Only admins can delete service types.

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a portrait (picture)
  - an email
  Only admins can add stylists.
  Only admins can change stylists.
  Only admins can delete stylists.

Appointments
  Appointments have:
  - a stylist (a stylist, required)
  - a service type (a service type, required)
  - starts at (a date and time, required)
  - notes
  - status (pending, confirmed, cancelled or completed, pending by default)

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see messages.
  Only admins can change messages.
  Only admins can delete messages.

Confirm
  For an appointment that is pending; sets status to confirmed.
  Confirm a pending appointment.
  Only admins can use it.

Complete
  For an appointment that is confirmed; sets status to completed.
  Mark an appointment as completed.
  Only admins can use it.

Cancel
  For an appointment that is pending or confirmed; sets status to cancelled.
  Cancel an appointment.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services and appointments)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page, reading service types and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 118 files (118 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-3/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
appointments 9 columns 0 indexes 3 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
service_types 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_aromatic_bucky.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-3. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-3
  smithable run
/tmp/smithable-bench-m12-SxJQo7/app-3/smithable.yml:59:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-SxJQo7/app-3/smithable.auth.yml:6:11  warning  Visitors can't open schedule from the home hero's shortcuts: list it under public.pages, or choose another page.
/tmp/smithable-bench-m12-SxJQo7/app-3/smithable.auth.yml:6:11  warning  Visitors can't open my-appointments from the home hero's shortcuts: list it under public.pages, or choose another page.
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Manage pupils, their weekly lesson times and what each one practises.

Pages
  - Pupils (lists pupils; search by name or email)
  - Lesson slots (lists lesson slots; search by start time; filter by day of week or pupil; sort by day of week, start time or duration minutes)
  - Repertoire (lists repertoires; search by piece or composer; filter by status or pupil; sort by piece, composer or status; “Mark performance ready”; “Start polishing”)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - notes

Lesson slots
  Lesson slots have:
  - a pupil (a pupil, required)
  - a day of week (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a start time (required)
  - duration minutes (a whole number, required, 30 by default)

Repertoires
  Repertoires have:
  - a pupil (a pupil, required)
  - a piece (required)
  - a composer
  - status (learning, polishing or performance ready, learning by default)
  - notes

Mark performance ready
  For a repertoire that is polishing; sets status to performance ready.
  Mark a piece as performance-ready.

Start polishing
  For a repertoire that is learning; sets status to polishing.
  Move a piece from learning to polishing.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 94 files (94 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-4/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
lesson_slots 8 columns 0 indexes 2 fks
pupils 8 columns 0 indexes 1 fks
repertoires 9 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_flat_green_goblin.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-4. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
ShootBill
  Invoicing for photographers: manage clients, shoots and track unpaid invoices.

Pages
  - Home (a landing page: hero, features and footer)
  - Overview (a dashboard: latest)
  - Invoices (lists invoices; search by number or status; filter by status, client, shoot, issued on or due on)
  - Shoots (lists shoots; search by name or location; filter by client or shoot date)
  - Clients (lists clients; search by name or email)
  - Invoice lines (lists invoice lines)
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
  - a VAT number
  Each client lists its invoices.

Shoots
  Shoots have:
  - a name (required)
  - a client (a client, required)
  - a shoot date (required)
  - a location
  - notes
  Each shoot lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
  - issued on (a date, required, today by default)
  - due on (a date, required)
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (ShootBill staff)
  - member (A photographer using ShootBill)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: hero.webp.
Generated 112 files (112 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-5/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
shoots 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_woozy_centennial.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-5. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-5
  smithable run

/tmp/smithable-bench-m12-SxJQo7/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-SxJQo7/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-SxJQo7/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-SxJQo7/app-5/src/db/seed.ts:44:6)
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
CleanInvoice
  Simple invoicing for a small cleaning company to send monthly invoices to households.

Pages
  - Invoices (lists invoices; search by number or status; filter by status, client, issued on or due on; “Mark sent”; “Mark paid”)
  - Clients (lists clients; search by name, email or phone; sort by name)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: latest)
  - Team (who has access: invite people, change roles, remove users)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - a phone
  - address
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - notes
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
  The invoice was sent to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (A cleaner who creates and manages invoices)
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 103 files (103 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-6/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_thankful_kree.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-6. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Browse and sell second-hand items at your local town flea market.

Pages
  - Town Flea Market (a landing page: hero, items and footer)
  - My Listings (lists items; only the viewer's own records)
  - Saved Items (lists items; only the viewer's saved records)
  - Team (who has access: invite people, change roles, remove users)
  - All Items (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a price (an amount)
  - a category (clothing, furniture, electronics, bikes, sports, kids, books or other, clothing by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)
  Only the owner and admins can delete items.

Mark sold
  For an item that is available; sets available to no.
  Mark an item as sold.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the marketplace tidy)
  - member (Sells and saves items)
  New users get the member role.
  Open to anyone without signing in: the home page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, hero.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-7/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clever_doctor_spectrum.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-7. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Office Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Swap Shelf (lists items; search by title or description; filter by category, condition or available; records can be saved as favorites; contact the owner by mail)
  - My Offerings (lists items; only the viewer's own records)
  - Office Swap Shelf (a landing page: hero, items where available is yes and footer)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (stationery, books, electronics, furniture, kitchen, clothing or other, stationery by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Mark claimed
  For an item that is available; sets available to no.
  Mark an item as claimed so it no longer appears available.

Put back
  For an item that is not available; sets available to yes.
  Put an item back on the shelf so it is available again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the swap shelf tidy)
  - member (Offers and claims items)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 100 files (100 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_smiling_garia.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-8. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  Track your vinyl record collection: albums, artists, condition and what you paid.

Pages
  - Home (a landing page: hero, albums and footer)
  - Artists (lists artists; search by name, genre or country; sort by name, genre or country)
  - Overview (a dashboard: total artists, total albums, total spent and recent additions)
  - Albums (lists albums; search by title, genre or label; filter by artist, format, condition, year or purchased on; sort by title, year, condition, price paid or purchased on)

Artists
  Artists have:
  - a name (required)
  - a genre
  - a country
  - notes
  Only admins can add artists.
  Only admins can change artists.
  Only admins can delete artists.

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number)
  - a label
  - a genre
  - a format (lp, ep, single or compilation, lp by default)
  - a condition (mint, near mint, very good plus, very good, good plus, good, fair or poor, mint by default)
  - a price paid (an amount)
  - purchased on (a date)
  - notes
  - a cover image (a web address)
  Only admins can add albums.
  Only admins can change albums.
  Only admins can delete albums.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the artists page, reading artists and reading albums.
Pictures from the Smithable image library: hero.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-9/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
albums 15 columns 0 indexes 2 fks
artists 8 columns 0 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_nifty_meteorite.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-9. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Browse the museum's collection of objects and their stories.

Pages
  - Home (a landing page: hero, objects where featured is yes, call to action and footer)
  - Team (who has access: invite people, change roles, remove users)
  - The Collection (lists objects; search by name, category, period, material or origin; filter by status, featured or acquisition date; sort by name, acquisition date, category or period; “Put on display”; “Move to storage”; “Lend out”)

Objects
  Objects have:
  - a name (required)
  - a summary
  - a story
  - a category
  - a period
  - a material
  - an origin
  - an acquisition date
  - an image (a web address)
  - a featured (yes or no, false by default)
  - status (on display, in storage or on loan, on display by default)
  Only admins can add objects.
  Only admins can change objects.
  Only admins can delete objects.

Put on display
  For an object that is in storage or on loan; sets status to on display.
  Mark the object as currently on display in the museum.
  Only admins can use it.

Move to storage
  For an object that is on display or on loan; sets status to in storage.
  Move the object to storage.
  Only admins can use it.

Lend out
  For an object that is on display or in storage; sets status to on loan.
  Mark the object as on loan to another institution.
  Only admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the objects page and reading museum objects.
Pictures from the Smithable image library: hero.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-10/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
museum_objects 15 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_magical_unus.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-10. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems so staff can see what is down and when it will be back.

Pages
  - IT System Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; search by title or status; filter by status, component or detected at; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances; filter by component or starts at)
  - Components (lists components; search by name or status; filter by status; only for admins; visitors see components on the IT System Status page)
  - Overview (a dashboard: open, per month and latest)
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
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
Pictures from the Smithable image library: hero.webp.
Generated 127 files (127 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_busy_rawhide_kid.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-11. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipality Service Status
  Check the live status of our municipality's online services and report outages.

Pages
  - Municipality Service Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Municipality Service Status page)
  - Overview (a dashboard: open, per month and latest)
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
  Only writer users and admins can change incidents.

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
  Only writer users and admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only writer users and admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.
  Only writer users and admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status page and the team)
  - writer (Writes incidents and their updates)
  New users get the writer role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
Pictures from the Smithable image library: hero.webp.
Generated 125 files (125 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_short_sleeper.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-12. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

```text
My Car Log
  A personal log of fuel fill-ups, service visits and costs for my car.

Pages
  - Cars (lists cars; search by make, model or license plate)
  - Fuel (lists fuel logs; search by station; filter by car, full tank or date)
  - Service (lists service visits; search by description or workshop; filter by car, type or date; sort by date, odometer or cost)
  - Expenses (lists expenses; search by description; filter by car, category or date; sort by date or cost)
  - Overview (a dashboard: total fuel cost, total service cost, total other expenses, recent fuel and recent service)

Cars
  Cars have:
  - a make (required)
  - a model (required)
  - a year (a whole number, required)
  - a license plate
  - notes

Fuel logs
  Fuel logs have:
  - a car (a car, required)
  - a date (required, today by default)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a price per liter (an amount, required)
  - a station
  - a full tank (yes or no, required, true by default)
  - notes
  The total cost is calculated as the liters times the price per liter.

Service visits
  Service visits have:
  - a car (a car, required)
  - a date (required, today by default)
  - an odometer (a whole number, required)
  - a type (routine, repair, inspection, tires or other, routine by default)
  - a description (required)
  - a workshop
  - a cost (an amount, required)
  - a next service date
  - a next service odometer (a whole number)
  - notes

Expenses
  Expenses have:
  - a car (a car, required)
  - a date (required, today by default)
  - a category (insurance, tax, parking, toll, wash, accessories or other, insurance by default)
  - a description (required)
  - a cost (an amount, required)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-13/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
cars 9 columns 0 indexes 1 fks
expenses 10 columns 0 indexes 2 fks
fuel_logs 13 columns 0 indexes 2 fks
service_visits 14 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wide_mach_iv.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-13. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-13
  smithable run
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Our Wedding
  Guest list and seating plan for our wedding, tracking RSVPs and meal choices.

Pages
  - Guests (lists guests; search by name, email or plus one name; filter by rsvp, meal choice, table or plus one; “Confirm attendance”; “Decline invitation”)
  - Tables (lists tables; search by name)
  - Overview (a dashboard: total guests, attending, pending, declined and recent rsvps)
  - Team (who has access: invite people, change roles, remove users)

Tables
  Tables have:
  - a name (required)
  - seats (a whole number, required, 8 by default)
  - notes

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - a rsvp (pending, attending or declined, pending by default)
  - a meal choice (none, chicken, fish, vegetarian or vegan, none by default)
  - dietary notes
  - a plus one (yes or no, false by default)
  - a plus one name
  - a plus one meal (none, chicken, fish, vegetarian or vegan, none by default)
  - a table (a table)
  - a seat number (a whole number)
  - notes

Confirm attendance
  For a guest that is pending; sets rsvp to attending.
  Mark the guest as attending.

Decline invitation
  For a guest that is pending or attending; sets rsvp to declined.
  Mark the guest as not attending.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 96 files (96 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-14/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
guests 16 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tables 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_powerful_william_stryker.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-14. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-14
  smithable run
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Birdwatching Club
  Record and share bird sightings for our birdwatching club.

Pages
  - Birdwatching Club (a landing page: hero and footer)
  - Sightings (lists sightings; search by species or place; filter by seen on; sort by species, place or seen on)
  - Team (who has access: invite people, change roles, remove users)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - seen on (a date, required, today by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the sightings page and reading sightings.
Pictures from the Smithable image library: hero.webp.
Generated 87 files (87 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-15/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
sightings 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_boring_starjammers.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-15. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Our Allotment Society
  Manage allotment plots, the waiting list, and yearly membership fees.

Pages
  - Home (a landing page: hero, plots and footer)
  - Plots (lists plots; search by number or notes; filter by status)
  - Members (lists members; search by name, email or phone)
  - Tenancies (lists tenancies; filter by active, plot or member; “End tenancy”)
  - Waiting list (lists waiting list entries; search by notes; filter by status or member; “Offer plot”; “Withdraw application”)
  - Fees (lists fees; filter by status, year or member; “Mark paid”; “Waived fee”)
  - Overview (a dashboard: total plots, available plots, waiting list, unpaid fees, fees collected and recent members)
  - Team (who has access: invite people, change roles, remove users)

Plots
  Plots have:
  - a number (required, unique)
  - a size m2 (a number)
  - status (available, occupied or maintenance, available by default)
  - notes

Members
  Members have:
  - a name (required)
  - an email (required, unique)
  - a phone
  - joined on (a date, required, today by default)

Tenancies
  Tenancies have:
  - a plot (a plot, required)
  - a member (a member, required)
  - a start date (required, today by default)
  - an end date
  - an active (yes or no, required, true by default)

Waiting list entries
  Waiting list entries have:
  - a member (a member, required)
  - applied on (a date, required, today by default)
  - notes
  - status (waiting, offered or withdrawn, waiting by default)

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - a due date (required)
  - status (unpaid, paid or waived, unpaid by default)
  - paid on (a date)

Mark paid
  For a fee that is unpaid; sets status to paid and paid on to today.
  Mark a fee as paid, recording today as the payment date.

Waived fee
  For a fee that is unpaid; sets status to waived.
  Waive a fee for a member.

Offer plot
  For a waiting list entry that is waiting; sets status to offered.
  Offer a plot to someone on the waiting list.

Withdraw application
  For a waiting list entry that is waiting or offered; sets status to withdrawn.
  Mark a waiting list application as withdrawn.

End tenancy
  For a tenancy that is active; sets active to no and end date to today.
  End a tenancy, recording today as the end date.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the plots page and reading plots.
Pictures from the Smithable image library: hero.webp.
Generated 122 files (122 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-16/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
fees 10 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
members 8 columns 1 indexes 1 fks
plots 8 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
tenancies 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_list_entries 8 columns 0 indexes 2 fks

[✓] Your SQL migration file ➜ drizzle/0000_futuristic_kree.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-16. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Onlinebokning för frisörsalong – kunderna bokar tid själva på nätet.

Pages
  - Min Frisörsalong (a landing page: hero, features, tjänster, stylister, faq, contact and footer)
  - Schema (a calendar of slots by week or month)
  - Mina bokningar (lists bokningar)
  - Tider (lists tider; filter by tjänst or stylist; only for admins)
  - Tjänster (lists tjänster; only for admins; visitors see tjänster on the Min Frisörsalong page)
  - Stylister (lists stylister; only for admins; visitors see stylister on the Min Frisörsalong page)
  - Meddelanden (lists meddelanden; only for admins)
  - Team (who has access: invite people, change roles, remove users)

Tjänster
  Tjänster have:
  - a namn (required)
  - a beskrivning
  - a längd (minuter) (a whole number, required, 60 by default)
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
  - a platser (a whole number, required, 1 by default)
  Each tid lists its bokningar.
  The places left is calculated as the platser minus the number of its bookings.
  Only admins can add tider.
  Only admins can change tider.
  Only admins can delete tider.

Bokningar
  Bokningar have:
  - a tid (a tid, required, unique)
  At most the slot's capacity bokningar per slot.

Meddelanden
  Meddelanden have:
  - a namn (required)
  - an e-post (an email address, required)
  - a meddelande (required)
  Only admins can see meddelanden.
  Only admins can change meddelanden.
  Only admins can delete meddelanden.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salongens personal. Hanterar schema, tjänster och stylister)
  - customer (En kund som bokar tid)
  New users get the customer role.
  Open to anyone without signing in: the home page, the schema page, reading services, reading stylists, reading slots and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 116 files (116 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-17/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
slots 9 columns 0 indexes 3 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_fat_tana_nile.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-17. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-17
  smithable run
/tmp/smithable-bench-m12-SxJQo7/app-17/smithable.auth.yml:6:11  warning  Visitors can't open my-bookings from the home hero's shortcuts: list it under public.pages, or choose another page.
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggoffert
  Håll koll på offerter, kunder och fakturor för ett litet byggföretag.

Pages
  - Kunder (lists kunder; search by namn, e-post or telefon)
  - Offerter (lists offerter; search by nummer; filter by status or kund; “Send quote”; “Accept quote”; “Reject quote”)
  - Quote lines (lists offertrader)
  - Fakturor (lists fakturor; search by nummer; filter by status or kund; “Mark sent”; “Mark paid”)
  - Invoice lines (lists fakturarader)
  - Översikt (a dashboard: latest invoices)
  - Team (who has access: invite people, change roles, remove users)

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address)
  - a telefon (a phone number)
  - adress
  - an organisationsnummer
  Each kund lists its offerter.
  Each kund lists its fakturor.

Offerter
  Offerter have:
  - a nummer (required, unique)
  - a kund (a kund, required)
  - a datum (a date, required, today by default)
  - a giltig till (a date)
  - status (utkast, skickad, accepterad or avböjd, utkast by default)
  - a beskrivning
  Each offert lists its offertrader.
  The total is calculated as the total belopp of its lines.

Offertrader
  Offertrader have:
  - a quote (an offert, required)
  - a beskrivning (required)
  - an antal (a number, required, 1 by default)
  - à-pris (an amount, required)
  The belopp is calculated as the antal times the à-pris.

Fakturor
  Fakturor have:
  - a nummer (required, unique)
  - a kund (a kund, required)
  - an offert (an offert)
  - a fakturadatum (a date, required, today by default)
  - a förfallodatum (a date, required)
  - status (utkast, skickad, betald or förfallen, utkast by default)
  Each faktura lists its fakturarader.
  The total is calculated as the total belopp of its lines.

Fakturarader
  Fakturarader have:
  - an invoice (a faktura, required)
  - a beskrivning (required)
  - an antal (a number, required, 1 by default)
  - à-pris (an amount, required)
  The belopp is calculated as the antal times the à-pris.

Send quote
  For an offert that is utkast; sets status to skickad.
  Offerten har skickats till kunden.

Accept quote
  For an offert that is skickad; sets status to accepterad.
  Kunden har accepterat offerten.

Reject quote
  For an offert that is skickad; sets status to avböjd.
  Kunden har avböjt offerten.

Mark sent
  For a faktura that is utkast; sets status to skickad.
  Fakturan har skickats till kunden.

Mark paid
  For a faktura that is skickad or förfallen; sets status to betald.
  Kunden har betalat fakturan.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
No pictures: none of the library's files could be fetched.
Generated 121 files (121 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-18/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
customers 9 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 3 fks
quote_lines 9 columns 0 indexes 2 fks
quotes 11 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_productive_vapor.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-18. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-18
  smithable run
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Köp och sälj begagnade prylar på vår lokala loppis.

Pages
  - Annonser (lists annonser; search by titel or ort; filter by kategori, pris or skick; sort by pris; records can be saved as favorites; contact the owner by mail)
  - Välkommen (a landing page: hero, annonser and footer)
  - Team (who has access: invite people, change roles, remove users)
  - Mina annonser (lists annonser; only the viewer's own records)
  - Sparade (lists annonser; only the viewer's saved records)

Annonser
  Annonser have:
  - a titel (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount)
  - a kategori (kläder, möbler, elektronik, sport, barn, böcker or övrigt, kläder by default)
  - a skick (som ny, bra or använd, som ny by default)
  - an ort
  - a tillgänglig (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Håller loppisen i ordning)
  - member (Säljer och sparar annonser)
  New users get the member role.
  Open to anyone without signing in: the home page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 99 files (99 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-19/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_curvy_princess_powerful.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-19. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Tuntien aikataulu ja verkkovaraukset joogastudiolle.

Pages
  - Home (a landing page: hero, tuntityypit, gallery, faq, artikkelit where status is published, contact and footer)
  - Aikataulu (a calendar of sessions by week or month)
  - Omat varaukset (lists varaukset)
  - Blogi (posts as articles, newest first, each on its own page)
  - Tunnit (lists tunnit; search by tuntityyppi or ohjaaja; filter by tuntityyppi, ohjaaja or alkaa; only for admins)
  - Tuntityypit (lists tuntityypit; search by nimi; filter by taso; only for admins; visitors see tuntityypit on the Home page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Artikkelit (lists artikkelit; search by otsikko; filter by tila or julkaisupäivä; sort by otsikko, julkaisupäivä or tila; “Publish”; “Unpublish”; only for admins; visitors see artikkelit on the Home page)
  - Viestit (lists viestit; only for admins)
  - Admin (every kind of record, to find, open, change and delete)
  - Team (who has access: invite people, change roles, remove users)

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (aloittelijoille, kaikille tasoille or edistyneet, aloittelijoille by default)
  - a kesto (min) (a whole number, required, 60 by default)
  Only admins can add tuntityypit.
  Only admins can change tuntityypit.
  Only admins can delete tuntityypit.

Ohjaajat
  Ohjaajat have:
  - a nimi (required)
  - an esittely (formatted text)
  - a kuva (picture)
  Only admins can add ohjaajat.
  Only admins can change ohjaajat.
  Only admins can delete ohjaajat.

Tunnit
  Tunnit have:
  - a tuntityyppi (a tuntityyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an alkaa (a date and time, required)
  - a paikkamäärä (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The places left is calculated as the paikkamäärä minus the number of its bookings.
  Only admins can add tunnit.
  Only admins can change tunnit.
  Only admins can delete tunnit.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  At most the session's capacity varaukset per session.

Artikkelit
  Artikkelit have:
  - an otsikko (required)
  - address (unique)
  - a tiivistelmä
  - a cover (picture)
  - a sisältö (formatted text, required)
  - a julkaisupäivä (a date)
  - a tila (luonnos or julkaistu, luonnos by default)
  Only admins can add artikkelit.
  Only admins can change artikkelit.
  Only admins can delete artikkelit.

Viestit
  Viestit have:
  - a nimi (required)
  - a sähköposti (an email address, required)
  - a viesti (required)
  Only admins can see viestit.
  Only admins can change viestit.
  Only admins can delete viestit.

Publish
  For an artikkeli that is luonnos; sets tila to julkaistu and julkaisupäivä to today.
  Julkaise artikkeli.

Unpublish
  For an artikkeli that is julkaistu; sets tila to luonnos.
  Palauta artikkeli luonnokseksi.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studion henkilökunta. Hallinnoi aikataulua, tunteja ja ohjaajia)
  - member (Oppilas, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, reading class types, reading instructors, reading sessions, reading posts where status is published and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 150 files (150 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-20/drizzle.config.ts'
12 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
class_types 8 columns 0 indexes 1 fks
instructors 7 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
posts 11 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
sessions 9 columns 0 indexes 3 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_graceful_the_initiative.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-20. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-20
  smithable run
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
AutoHuolto
  Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin)
  - Autot (lists autot; search by rekisterinumero, valmistenumero (vin), merkki or malli; filter by asiakas)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Huoltotyöt (lists huoltotyöt; search by tila; filter by tila or sovittu päivä; sort by sovittu päivä or valmistumispäivä; “Start work”; “Complete job”; “Mark invoiced”)
  - Laskut (lists laskut; search by laskunumero; filter by tila, laskupäivä or eräpäivä; sort by laskunumero, laskupäivä or eräpäivä; “Send invoice”; “Mark paid”; “Cancel invoice”)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address, unique)
  - a puhelin (a phone number)
  - an osoite
  - a muistiinpanot
  Each asiakas lists its autot.
  Only admins can delete asiakkaat.

Autot
  Autot have:
  - asiakas (an asiakas, required)
  - a merkki (required)
  - a malli (required)
  - a vuosimalli (a whole number)
  - a rekisterinumero (required, unique)
  - a valmistenumero (vin) (unique)
  - a kilometrit (a whole number)
  Each auto lists its huoltotyöt.
  Only admins can delete autot.

Laskurivit
  Laskurivit have:
  - kuvaus (required)
  - a määrä (a number, required, 1 by default)
  - a yksikköhinta (an amount, required)
  - an invoice (a lasku, required)
  The yhteensä is calculated as the määrä times the yksikköhinta.

Huoltotyöt
  Huoltotyöt have:
  - an auto (an auto, required)
  - kuvaus (required)
  - a tila (avoin, työn alla, valmis or laskutettu, avoin by default)
  - a sovittu päivä (a date)
  - a valmistumispäivä (a date)
  - an asentajan muistiinpanot

Laskut
  Laskut have:
  - a laskunumero (required, unique)
  - a huoltotyö (a huoltotyö, required)
  - a tila (luonnos, lähetetty, maksettu or peruutettu, luonnos by default)
  - a laskupäivä (a date)
  - an eräpäivä (a date)
  - a lisätiedot
  Only admins can delete laskut.

Start work
  For a huoltotyö that is avoin; sets tila to työn alla.
  Merkitse huoltotyö aloitetuksi.

Complete job
  For a huoltotyö that is työn alla; sets tila to valmis and valmistumispäivä to today.
  Merkitse huoltotyö valmiiksi.

Mark invoiced
  For a huoltotyö that is valmis; sets tila to laskutettu.
  Merkitse huoltotyö laskutetuksi.

Send invoice
  For a lasku that is luonnos; sets tila to lähetetty and laskupäivä to today.
  Lähetä lasku asiakkaalle.

Mark paid
  For a lasku that is lähetetty; sets tila to maksettu.
  Merkitse lasku maksetuksi.

Cancel invoice
  For a lasku that is luonnos or lähetetty; sets tila to peruutettu.
  Peruuta lasku.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Korjaamon omistaja tai esimies. Täydet oikeudet)
  - mechanic (Asentaja. Hallinnoi autoja ja huoltotöitä)
  New users get the mechanic role.
No pictures: none of the library's files could be fetched.
Generated 114 files (114 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-21/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
cars 11 columns 2 indexes 2 fks
customers 9 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
service_jobs 10 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_classy_medusa.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-21. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Produkte, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Home (a landing page: hero, produkte where available is yes, contact and footer)
  - Produkte (lists produkte; search by name; filter by verfügbar; only for admins; visitors see produkte on the Home page)
  - Abholzeiten (lists abholzeiten; only for admins)
  - Team (who has access: invite people, change roles, remove users)
  - Vorbestellungen (lists vorbestellungen; search by name or e-mail; filter by status or abholzeit; “Confirm”; “Mark picked up”; “Cancel”)
  - Bestellpositionen (lists bestellpositionen; only for admins)

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - a picture
  - preis (an amount, required)
  - an einheit (required, Stück by default)
  - a verfügbar (yes or no, required, true by default)
  Only admins can add produkte.
  Only admins can change produkte.
  Only admins can delete produkte.

Abholzeiten
  Abholzeiten have:
  - a datum (a date, required)
  - a von (required)
  - bis (required)
  - a plätze (a whole number, required, 10 by default)
  Only admins can add abholzeiten.
  Only admins can change abholzeiten.
  Only admins can delete abholzeiten.

Vorbestellungen
  Vorbestellungen have:
  - an abholzeit (an abholzeit, required)
  - a name (required)
  - an e-mail (an email address, required)
  - a telefon (a phone number)
  - a hinweise
  - status (offen, bestätigt, abgeholt or storniert, offen by default)
  At most the pickup slot's capacity vorbestellungen per pickup slot.

Bestellpositionen
  Bestellpositionen have:
  - an order (a vorbestellung, required)
  - a produkt (a produkt, required)
  - a menge (a whole number, required, 1 by default)

Confirm
  For a vorbestellung that is offen; sets status to bestätigt.
  Bestellung bestätigen.

Mark picked up
  For a vorbestellung that is bestätigt; sets status to abgeholt.
  Bestellung als abgeholt markieren.

Cancel
  For a vorbestellung that is offen or bestätigt; sets status to storniert.
  Bestellung stornieren.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Hofladeninhaber. Verwaltet Produkte, Abholzeiten und Bestellungen)
  - customer (Kunde, der Produkte vorbestellt)
  New users get the customer role.
  Open to anyone without signing in: the home page, reading products where available is yes and reading pickup slots.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 114 files (114 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-22/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
order_lines 7 columns 0 indexes 3 fks
orders 10 columns 0 indexes 2 fks
pickup_slots 8 columns 0 indexes 1 fks
products 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_cheerful_nighthawk.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-22. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-22
  smithable run
/tmp/smithable-bench-m12-SxJQo7/app-22/smithable.yml:39:7  warning  Order has a capacity per pickupSlot, but "pickupSlot" is not unique: one person can take several places.
    hint: Write "pickupSlot: PickupSlot! unique" for one order per person and pickupslot (unique per owner with private access).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker API
  A backend for tracking habits, daily check-ins and streaks.

Pages
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete; only for member users and admins)

Habits
  Habits have:
  - a name (required)
  - a description
  - a frequency (daily or weekly, daily by default)
  - an is active (yes or no, required, true by default)
  Each habit lists its check ins.
  Only member users and admins can delete habits.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required)
  - a note
  Only member users and admins can delete check ins.
  Only member users, assistant users and admins can change check ins.

Streaks
  Streaks have:
  - a habit (a habit, required)
  - a start date (required)
  - an end date
  - a length (a whole number, required, 1 by default)
  - an is active (yes or no, required, true by default)
  Only member users and admins can delete streaks.
  Only member users, assistant users and admins can change streaks.

Archive
  For a habit that is is active; sets is active to no.
  Archive a habit so it no longer appears in active tracking.

Reactivate
  For a habit that is not is active; sets is active to yes.
  Reactivate an archived habit.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Runs the app, its keys and the data)
  - member (A user of the habit app who tracks their own habits)
  - assistant (The AI assistant's key: reads everything, adds and changes records, never deletes)
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run archive and reactivate. AI assistants can use it too.
No pictures: none of the library's files could be fetched.
Generated 117 files (117 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-23/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
api_key 10 columns 1 indexes 0 fks
audit_log 13 columns 2 indexes 0 fks
check_ins 7 columns 0 indexes 2 fks
habits 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
streaks 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_panoramic_lizard.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-23. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-23
  smithable run
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
My AI Tasks
  Tasks and notes, grouped by project, that an AI assistant keeps for you.

Pages
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete; only for member users and admins)

Projects
  Projects have:
  - a name (required)
  - a description
  Each project lists its tasks.
  Each project lists its notes.
  Only member users and admins can add projects.
  Only member users and admins can change projects.
  Only member users and admins can delete projects.

Tasks
  Tasks have:
  - a title (required)
  - a project (a project, required)
  - status (todo, doing or done, todo by default)
  - a due date
  - details
  Only member users, assistant users and admins can change tasks.
  Only member users and admins can delete tasks.

Notes
  Notes have:
  - a title (required)
  - a project (a project, required)
  - a body
  Only member users, assistant users and admins can change notes.
  Only member users and admins can delete notes.

Complete
  For a task that is todo or doing; sets status to done.
  Mark a task as done.

Reopen
  For a task that is done; sets status to todo.
  Open a finished task again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member (A person who works with their tasks and notes)
  - assistant (The AI assistant's key: reads everything, adds and changes tasks and notes, never deletes)
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
No pictures: none of the library's files could be fetched.
Generated 117 files (117 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-SxJQo7/app-24/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
api_key 10 columns 1 indexes 0 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
notes 7 columns 0 indexes 2 fks
projects 6 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
tasks 9 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_light_komodo.sql 🚀

Created /tmp/smithable-bench-m12-SxJQo7/app-24. Start it with:

  cd /tmp/smithable-bench-m12-SxJQo7/app-24
  smithable run
```
