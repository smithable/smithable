# M12 first builds: mistral-medium-latest, the second set (2026-10-11)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 23 / 24 created, 23 type-check, 489,115 tokens (448,882 in, 40,233 out), $0.9751 (Mistral's list price); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 11,562 | 537 | $0.0214 | 0 | 1 | 13 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 11,474 | 1,210 | $0.0263 | 0 | 1 | 16 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 11,891 | 792 | $0.0238 | 0 | 1 | 14 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 11,892 | 501 | $0.0216 | 0 | 1 | 13 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 23,291 | 2,182 | $0.0513 | 0 | 2 | 24 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | **no** | **no** | 46,917 | 2,285 | $0.0875 | 0 | 4 | 28 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 11,181 | 788 | $0.0227 | 0 | 1 | 14 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 11,180 | 675 | $0.0218 | 0 | 1 | 10 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 11,024 | 754 | $0.0222 | 0 | 1 | 14 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 11,026 | 537 | $0.0206 | 0 | 1 | 13 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 11,774 | 1,522 | $0.0291 | 0 | 1 | 14 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 11,769 | 1,584 | $0.0295 | 0 | 1 | 18 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 11,022 | 372 | $0.0193 | 0 | 1 | 12 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 11,028 | 732 | $0.0220 | 0 | 1 | 10 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 11,029 | 356 | $0.0192 | 0 | 1 | 9 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 33,571 | 681 | $0.0555 | 0 | 3 | 23 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 24,423 | 2,836 | $0.0579 | 0 | 2 | 30 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 25,191 | 4,010 | $0.0679 | 0 | 2 | 33 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 37,366 | 4,196 | $0.0875 | 0 | 3 | 37 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 11,868 | 2,844 | $0.0391 | 0 | 1 | 26 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | invoicing | yes | yes | 26,057 | 5,176 | $0.0779 | 0 | 2 | 38 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | records | yes | yes | 50,098 | 4,467 | $0.1086 | 0 | 4 | 45 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 11,025 | 442 | $0.0199 | 0 | 1 | 9 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 11,223 | 754 | $0.0225 | 0 | 1 | 14 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest-wide/](m12-first-builds-mistral-medium-latest-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

1 of 23 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 1 / 4 (has 2) | 1 / 7 (has 2) | 2 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 2 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 (has 2) | 1 / 3 (has 3) | 0 / 1 (has 5) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | booking | 0 | 1 / 6 (has 4) | 2 / 11 (has 6) | 0 / 0 (has 0) | private; admin, customer (customer) | none | pages home; read Stylist, Service, TimeSlot; create none | 1 (operator-unknown) | none |  | none | 0 / 4 | no mention; landing page | en | | | | |
| 4 | booking | 2 | 0 / 6 (has 3) | 0 / 11 (has 3) | 0 / 0 (has 0) | private; admin, teacher (teacher) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 0 | 2 / 4 (has 2) | 2 / 7 (has 2) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 2 (write-without-read) | none |  | none | 2 / 2 | no mention; no landing page | en | | | | |
| 7 | marketplace | 0 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | no mention; landing page | en | | | | |
| 9 | records (words: crm) | 0 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, albums; read Album; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | no mention; landing page | en | | | | |
| 10 | records (words: marketplace) | 0 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, artifacts; read Artifact; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 (has 4) | 6 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 0 | 4 / 4 (has 4) | 8 / 8 (has 9) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, history, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 0 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page | en | | | | |
| 15 | records (words: api) | 0 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, sightings; read Sighting; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | no mention; landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, plots; read none; create none | 3 (public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 3 | no mention; landing page | en | | | | |
| 17 | booking (words: records) | 0 | 1 / 6 (has 4) | 0 / 11 (has 7) | 0 / 0 (has 0) | private; admin, kund (kund) | none | pages hem, schema, integritetspolicy; read Service, Stylist, TimeSlot; create none | 2 (no-timezone, operator-unknown) | none |  | none | 0 / 4 | no mention; landing page | sv | yes (min, frisörsalong) | yes (bokning) | no | models 4/4, fields 18/18, pages 7/7 |
| 18 | crm (words: records) | 3 (sv: yes (av, kunder, offerter)) | 1 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 0) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | sv | yes (byggfirma) | yes (till) | none | models 3/3, fields 20/20, pages 4/4 |
| 19 | marketplace (words: records) | 0 | 1 / 1 (has 1) | 0 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages hem, integritetspolicy; read Item; create none | 3 (write-without-read, operator-unknown) | none |  | none | 0 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris) | yes (till, vår, loppis) | models 1/1, fields 8/8, pages 6/6 |
| 20 | booking (words: records) | 0 | 5 / 6 (has 5) | 9 / 11 (has 9) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create Message | 1 (operator-unknown) | none |  | none | 3 / 5 | no mention; landing page | fi | no | yes (varaus) | yes (varausjärjestelmä, ja, verkossa) | models 5/5, fields 15/17, pages 7/9 |
| 21 | invoicing (words: records) | 2 (fi: no) | 2 / 4 (has 5) | 2 / 7 (has 5) | 2 / 2 (has 4) | private; admin, member (member) | none | pages none; read none; create none | 2 (write-without-read) | none |  | none | 0 / 5 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | yes (autot, huoltotyöt) | none | models 5/5, fields 32/32, pages 5/5 |
| 22 | records | 3 (de: yes (die, produkte, und)) | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0); left out: setCapacity PreOrder | private; admin, kunde (kunde) | none | pages home, produkte; read Product; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page | de | yes (hofladen) | no | yes (hofladen, produkte, den) | models 3/3, fields 18/18, pages 4/5 |
| 23 | records (words: api) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | **no api block** | none | 0 / 3 | no mention; no landing page | en | | | | |
| 24 | api | 0 | 3 / 3 (has 3) | 2 / 2 (has 2) | 2 / 2 (has 2) | shared; admin, member, assistant (member) | none | pages none; read none; create none | 1 (read-with-shared) | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Freelance Translator Clients
  Track clients, quotes, and payments for a freelance translator.

Pages
  - Clients (lists clients)
  - Quotes (lists quotes; search by number or description; filter by client or status; “Mark sent”; “Mark accepted”; “Mark paid”)

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
  - status (draft, sent, accepted or paid, draft by default)
  - a description

Mark sent
  For a quote that is draft; sets status to sent.
  The quote was sent to the client.

Mark accepted
  For a quote that is sent; sets status to accepted.
  The client accepted the quote.

Mark paid
  For a quote that is accepted; sets status to paid.
  The client paid the quoted amount.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: everything
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 105 files (105 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-1
  smithable studio

or only run the app with smithable run.

/tmp/smithable-bench-m12-0Dwr8A/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-0Dwr8A/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-0Dwr8A/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-0Dwr8A/app-1/src/db/seed.ts:29:6)
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
  - Leads (lists leads; search by name, email or company; sort by follow up date or date added; “Mark as contacted”; “Mark as qualified”; “Mark as lost”)
  - Deals (lists deals; search by name or customer; sort by close date, value or date added; “Mark as won”; “Mark as lost deal”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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
  The assignee owns the lead.

Deals
  Deals have:
  - a name (required)
  - a customer (required)
  - a value (an amount)
  - status (proposal, negotiation, won or lost, proposal by default)
  - a close date
  - notes
  - a lead (a lead)
  Each deal can have an assignee (a user).
  The assignee owns the deal.

Mark as contacted
  For a lead that is new; sets status to contacted; asks for the follow up date.
  Mark a lead as contacted and set a follow-up date.

Mark as qualified
  For a lead that is contacted; sets status to qualified.
  Mark a lead as qualified.

Mark as lost
  For a lead that is new, contacted or qualified; sets status to lost.
  Mark a lead as lost.

Mark as won
  For a deal that is proposal or negotiation; sets status to won.
  Mark a deal as won.

Mark as lost deal
  For a deal that is proposal or negotiation; sets status to lost.
  Mark a deal as lost.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Handles leads and deals): opens the leads page and the deals page; adds leads and deals; changes everyone's leads and deals; deletes everyone's leads and deals
  New users get the sales role.
Pictures from the Smithable image library: logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Hair Salon Booking
  Online booking for a hair salon where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, stylists, services and footer)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Time slots (lists time slots; only for admins)
  - Bookings (lists bookings)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a portrait (picture)

Services
  Services have:
  - a name (required)
  - a description
  - duration minutes (a whole number, required, 60 by default)
  - a price (an amount)

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
  At most the time slot's capacity bookings per time slot.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services, and time slots): everything
  - customer (A customer who books appointments): opens the bookings page; adds bookings
  New users get the customer role.
  Open to anyone without signing in: the home page, reading stylists, reading services and reading time slots.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 122 files (122 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - a day of week (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a start time (required)
  - duration minutes (a whole number, required, 30 by default)
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
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - teacher: everything
  New users get the teacher role.
Pictures from the Smithable image library: logo.webp.
Generated 102 files (102 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Pages
  - Clients (lists clients)
  - Invoices (lists invoices; search by number or client; filter by client or status; sort by number, issued on, due on or total; “Mark sent”; “Mark paid”)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required)
  - due on (a date)
  - status (draft, sent, paid or overdue, draft by default)
  - a total (an amount)
  - a contract (a document)
  - lines

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A photographer managing their invoices): opens the invoices page and the clients page; adds invoices and clients; changes everyone's invoices and clients; deletes everyone's invoices and clients
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 109 files (109 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-5
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-5/smithable.auth.yml:11:5  warning  member may change others' Invoice, Client it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-0Dwr8A/app-5/smithable.auth.yml:12:5  warning  member may delete others' Invoice, Client it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "delete".
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-medium-latest) · 49,202 tokens (46,917 in, 2,285 out) · $0.0875
No model drafted a valid project.
addField: addField would make smithable.ux.yml invalid. Invoice has no field named "lines" to show.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-0Dwr8A/app-6 --starter invoicing

```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A local marketplace where anyone can post things to sell with photos and a price.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, items where available is yes and footer)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Items
  Items have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a price (an amount)
  - a category (furniture, bikes, electronics, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)
  Photos of items are reviewed before others see them; an item waits until its photos is.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Sells and saves items): opens the catalog page, the my items page and the saved page; adds items
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)

Items
  Items have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a category (furniture, electronics, books, kitchen, office or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)
  Photos of items are reviewed before others see them; an item waits until its photos is.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Offers and claims items): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl Collection
  A place to keep and show my vinyl record collection with albums, artists, condition and purchase price.

Pages
  - Home (a landing page: hero, albums and footer)
  - Albums (lists albums; search by title, artist or notes; filter by condition or release year; sort by title, artist, release year or price paid)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Albums
  Albums have:
  - a title (required)
  - an artist (required)
  - a release year (a whole number)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a price paid (an amount)
  - notes
  - a cover image (a document)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Views the collection): opens every page; sees everyone's albums; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the albums page and reading albums.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 104 files (104 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-9
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-9/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  Browse the museum's objects and their stories online.

Pages
  - Home (a landing page: hero, artifacts and footer)
  - Artifacts (lists artifacts; search by name, description, story, period or origin; sort by name, added on or period)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Artifacts
  Artifacts have:
  - a name (required)
  - a description
  - a category (artifact, document, photograph, textile or other, artifact by default)
  - a period
  - an origin
  - an image (a document)
  - a story
  - added on (a date, required, today by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Manages the collection): everything
  - member (Browses the collection): opens the home page and the artifacts page; sees everyone's artifacts; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the artifacts page and reading artifacts.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 105 files (105 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems so staff see what is down and when it is back.

Pages
  - Incidents (lists incidents; search by title or summary; filter by status or component)
  - Updates (lists incident updates)
  - Components (lists components)
  - Maintenance (lists maintenances)
  - Overview (lists incidents)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so. The component's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page, the maintenance page and the components page; adds every kind of record; changes everyone's records
  New users get the staff role.
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipality Service Status
  Check the status of our municipality's online services and outages.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - History (lists incidents)
  - Incidents (lists incidents)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Overview (lists incidents)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so. The component's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the history page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 102 files (102 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Manage the guest list and seating plan for our wedding, with RSVPs and meal choices.

Pages
  - Guests (lists guests; search by name, email or group; sort by name, table number or attending)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - an attending (yes, no or maybe, yes by default)
  - a meal choice (vegetarian, meat, vegan or gluten free, vegetarian by default)
  - a table number (a whole number)
  - notes
  - a group

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Manages the guest list and seating plan): everything
  - member (Views the guest list): opens the guests page; sees everyone's guests; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 97 files (97 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Bird Sightings
  A place for our birdwatching club to record and share bird sightings.

Pages
  - Home (a landing page: hero, sightings and footer)
  - Sightings (lists sightings)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - a date (required)
  - an observer (required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Records and views bird sightings): opens the sightings page and the home page; sees everyone's sightings; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the sightings page and reading sightings.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 95 files (95 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-15
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-15/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Our Allotment Society
  Track who has which plot, the waiting list and the yearly fee.

Pages
  - Home (a landing page: hero, plots and footer)
  - Plots (lists plots)
  - Waiting list (lists waiting lists)
  - Fees (lists fees)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Plots
  Plots have:
  - a number (required, unique)
  - a size (a whole number)
  - status (available, assigned or reserved, available by default)
  - notes
  Each plot can have a holder (a user).
  The holder owns the plot.

Waiting lists
  Waiting lists have:
  - a name (required)
  - an email (required)
  - a phone
  - a date added (required, today by default)
  - status (active, assigned or withdrawn, active by default)
  - notes

Fees
  Fees have:
  - a year (a whole number, required, unique)
  - an amount (an amount, required)
  - a due date (required)
  - status (pending, paid or overdue, pending by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Manages the society): everything
  - member (Member of the society): opens the plots page, the waiting list page and the fees page; sees everyone's plots, waiting lists and fees; adds waiting lists; changes everyone's waiting lists
  New users get the member role.
  Open to anyone without signing in: the home page and the plots page.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 109 files (109 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-16
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-16/smithable.auth.yml:15:11  warning  Visitors can open home, but may not read Plot, so the page shows them none: add it under public.read, or remove the section of home that shows it.
/tmp/smithable-bench-m12-0Dwr8A/app-16/smithable.auth.yml:15:17  warning  Visitors can open plots, but may not read Plot, so the page shows them none: add it under public.read, or take plots out of public.pages.
/tmp/smithable-bench-m12-0Dwr8A/app-16/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Bokningssystem för min frisörsalong där kunder kan boka tid själva på nätet.

Pages
  - Hem (a landing page: hero, “Tjänster”, “Stylister” and footer)
  - Tjänster (lists “Tjänster”; only for admins; visitors see “Tjänster” on the Hem page)
  - Stylister (lists “Stylister”; only for admins; visitors see “Stylister” on the Hem page)
  - Tidsluckor (lists “Tidsluckor”)
  - Mina bokningar (lists “Bokningar”; only the viewer's own records)
  - Integritetspolicy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Schema (a calendar of time slots by week or month)

Tjänster
  Tjänster have:
  - a field “Namn” (required)
  - a field “Beskrivning”
  - a field “Varaktighet (minuter)” (a whole number, required, 30 by default)
  - a field “Pris” (an amount, required)

Stylister
  Stylister have:
  - a field “Namn” (required)
  - a field “Biografi”
  - a field “Porträtt” (picture)

Tidsluckor
  Tidsluckor have:
  - a field “Tjänst” (a “Tjänst”, required)
  - a field “Stylist” (a “Stylist”, required)
  - a field “Starttid” (a date and time, required)
  - a field “Kapacitet” (a whole number, required, 1 by default)
  Each “Tidslucka” lists its “Bokningar”.
  The “Lediga platser” is calculated as the “Kapacitet” minus the number of its “Bokningar”.

Bokningar
  Bokningar have:
  - a field “Tidslucka” (a “Tidslucka”, required, unique)
  - a field “Namn” (required)
  - a field “E-post” (an email address, required)
  - a field “Telefon” (a phone number)
  - a field “Anteckningar”
  At most the time slot's capacity “Bokningar” per time slot.

Bokning gjord
  When a “Bokning” is added: mails its owner.

Bokning andrad
  When a “Bokning” is changed: mails its owner.

Bokning avbokad
  When a “Bokning” is deleted: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Salongsägare eller personal som hanterar schema och bokningar): everything
  - kund (Kunder som bokar tider): opens the mina bokningar page and the tider page; adds bookings
  New users get the kund role.
  Open to anyone without signing in: the hem page, the schema page, the integritetspolicy page, reading services, reading stylists and reading time slots.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 127 files (127 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-17. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-17
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-17/smithable.yml:61:14  warning  Page "schema" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-0Dwr8A/app-17/smithable.content.yml:57:3  warning  The privacy page "integritetspolicy" does not say who runs the app: give the operator's name under pages.integritetspolicy.operator (name, address, email, country, hosting).
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirma CRM
  Ett enkelt CRM-system för en liten byggfirma för att hantera offerter, kunder och fakturor.

Pages
  - Offerter (lists “Offerter”; search by “Offertnummer” or “Kund”)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Kunder (lists “Kunder”; search by “Namn” or “E-post”)
  - Fakturor (lists “Fakturor”; search by “Fakturanummer” or “Kund”)

Offerter
  Offerter have:
  - a field “Offertnummer” (required, unique)
  - a field “Status” (“Utkast”, “Skickad”, “Accepterad” or “Avvisad”, “Utkast” by default)
  - a field “Totalt belopp” (an amount, required)
  - a field “Giltig till” (a date)
  - a field “Anteckningar”
  - a field “Kund” (a “Kund”, required)

Kunder
  Kunder have:
  - a field “Namn” (required)
  - a field “E-post” (an email address, unique)
  - a field “Telefon” (a phone number)
  - a field “Segment” (“Privat”, “Företag” or “Kommun”, “Privat” by default)
  - a field “Anteckningar”
  Each “Kund” can have a “Kontaktperson” (a user).
  The “Kontaktperson” owns the “Kund”.

Fakturor
  Fakturor have:
  - a field “Fakturanummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Offert” (a “Offert”)
  - a field “Status” (“Utkast”, “Skickad”, “Betald” or “Förfallen”, “Utkast” by default)
  - a field “Totalt belopp” (an amount, required)
  - a field “Förfallodatum” (a date)
  - a field “Betaldatum” (a date)
  - a field “Anteckningar”

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Arbetar med kunder, offerter och fakturor): opens the kunder page, the offerter page and the fakturor page; adds customers, quotes and invoices; changes everyone's customers, quotes and invoices
  New users get the sales role.
Pictures from the Smithable image library: logo.webp.
Generated 108 files (108 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-18. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-18
  smithable studio

or only run the app with smithable run.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår Loppis
  En plats där folk kan lägga upp saker de vill sälja, med bilder och pris.

Pages
  - Välkommen till Vår Loppis (a landing page: hero, “Annonser” where available is yes and footer)
  - Granska (the pictures and files waiting for review, to approve or reject; only for admins)
  - Integritetspolicy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Katalog (lists “Annonser”; search by “Titel”, “Beskrivning” or “Plats”; filter by “Kategori”, “Pris”, “Skick” or “Tillgänglig”; sort by “Pris” or date added; records can be saved as favorites; contact the owner by mail)
  - Mina annonser (lists “Annonser”; only the viewer's own records)
  - Sparade annonser (lists “Annonser”; only the viewer's saved records)

Annonser
  Annonser have:
  - a field “Titel” (required)
  - a field “Bilder” (pictures, required)
  - a field “Beskrivning” (required)
  - a field “Pris” (an amount)
  - a field “Kategori” (“Kläder”, “Möbler”, “Elektronik”, “Leksaker”, “Böcker”, “Sport” or “Övrigt”, “Kläder” by default)
  - a field “Skick” (“Ny”, “Nästan ny”, “Bra” or “Sliten”, “Ny” by default)
  - a field “Plats”
  - a field “Tillgänglig” (yes or no, true by default)
  Photos of “Annonser” are reviewed before others see them; an item waits until its photos is.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Administratör med fullständig åtkomst): everything
  - member (Användare som kan lägga upp och spara annonser): opens the hem page, the katalog page, the mina annonser page and the sparade page; adds items; changes everyone's items; deletes everyone's items
  New users get the member role.
  Open to anyone without signing in: the hem page, the integritetspolicy page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-19
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-19/smithable.auth.yml:12:5  warning  member may change others' Item it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-0Dwr8A/app-19/smithable.auth.yml:13:5  warning  member may delete others' Item it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-0Dwr8A/app-19/smithable.content.yml:4:3  warning  The privacy page "integritetspolicy" does not say who runs the app: give the operator's name under pages.integritetspolicy.operator (name, address, email, country, hosting).
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Joogastudio (a landing page: hero, tuntityypit, contact and footer)
  - Tunnit (lists tunnit; only for admins)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Joogastudio page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Viestit (lists viestit; only for admins)
  - Varaukseni (lists varaukset; only the viewer's own records)
  - Aikataulu (a calendar of sessions by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (aloittelija, kaikki tasot or edistynyt, aloittelija by default)
  - a kesto (minuuttia) (a whole number, required, 60 by default)

Ohjaajat
  Ohjaajat have:
  - a nimi (required)
  - an esittely (formatted text)
  - a kuva (picture)

Tunnit
  Tunnit have:
  - a tuntityyppi (a tuntityyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an aloitusaika (a date and time, required)
  - a kapasiteetti (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The places left is calculated as the kapasiteetti minus the number of its bookings.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  At most the session's capacity varaukset per session.

Viestit
  Viestit have:
  - a nimi (required)
  - a sähköposti (an email address, required)
  - a viesti (required)

Booking made
  When a varaus is added: mails its owner.

Booking changed
  When a varaus is changed: mails its owner.

Booking cancelled
  When a varaus is deleted: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Studiomme työntekijä. Hallinnoi aikataulua, tunteja ja opettajia): everything
  - member (Opiskelija, joka varaa tunteja): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors, reading sessions and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-20/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni Autokorjaamo
  Small car repair shop: customers, cars, maintenance jobs and invoices in one place.

Pages
  - Asiakkaat (lists asiakkaat)
  - Autot (lists autot)
  - Laskut (lists laskut; “Mark sent”; “Mark paid”)
  - Laskurivit (lists laskurivit)
  - Huoltotyöt (lists huoltotyöt; “Start job”; “Complete job”)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address, required)
  - a puhelin (a phone number)
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

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - asiakas (an asiakas, required)
  - a laskutuspäivä (a date, required, today by default)
  - an eräpäivä (a date, required, the laskutuspäivä plus 14 days by default)
  - a tila (luonnos, lähetetty, maksettu or myöhässä, luonnos by default)
  - a huoltotö (a huoltotö)
  Each lasku lists its laskurivit.
  The yhteensä is calculated as the total summa of its rivit.

Laskurivit
  Laskurivit have:
  - a lasku (a lasku, required)
  - kuvaus (required)
  - a määrä (a number, required, 1 by default)
  - a yksikköhinta (an amount, required)
  The summa is calculated as the määrä times the yksikköhinta.

Huoltotyöt
  Huoltotyöt have:
  - an auto (an auto, required)
  - kuvaus (required)
  - a tila (odottaa, käynnissä, valmis or peruutettu, odottaa by default)
  - an aloituspäivä (a date)
  - a päätöspäivä (a date)
  - a lasku (a lasku)
  - an arvioitu hinta (an amount)
  - a toteutunut hinta (an amount)

Mark sent
  For a lasku that is luonnos; sets tila to lähetetty.
  The invoice was sent to the customer.

Mark paid
  For a lasku that is lähetetty or myöhässä; sets tila to maksettu.
  The customer paid the invoice.

Start job
  For a huoltotö that is odottaa; sets tila to käynnissä and aloituspäivä to today.
  Start the maintenance job.

Complete job
  For a huoltotö that is käynnissä; sets tila to valmis and päätöspäivä to today.
  Complete the maintenance job.

Invoice sent
  When “Mark sent” runs on a lasku: mails customer's email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Works at the car repair shop): opens the customers page, the cars page, the maintenance jobs page, the invoices page and the invoice lines page; adds customers, cars, maintenance jobs, invoices and invoice lines; changes everyone's customers, cars, maintenance jobs, invoices and invoice lines; deletes everyone's customers, cars, maintenance jobs, invoices and invoice lines
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 127 files (127 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-21
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-21/smithable.auth.yml:11:5  warning  member may change others' Customer, Car, MaintenanceJob, Invoice, InvoiceLine it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-0Dwr8A/app-21/smithable.auth.yml:12:5  warning  member may delete others' Customer, Car, MaintenanceJob, Invoice, InvoiceLine it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "delete".

/tmp/smithable-bench-m12-0Dwr8A/app-21/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-0Dwr8A/app-21/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-0Dwr8A/app-21/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-0Dwr8A/app-21/src/db/seed.ts:48:6)
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
Left out, since it could not be made valid:
  setCapacity PreOrder: setCapacity would make smithable.yml invalid. "per" in the capacity of "PreOrder" must be one of PreOrder's required references (a field like "session: Session!").

Mein Hofladen
  Produkte, Vorbestellungen der Kunden und Abholzeiten verwalten.

Pages
  - Mein Hofladen (a landing page: hero, produkte and footer)
  - Abholzeiten (lists abholzeiten)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
  - Produkte (lists produkte)
  - Vorbestellungen (lists vorbestellungen)

Abholzeiten
  Abholzeiten have:
  - a datum (a date, required)
  - a beginn (required)
  - an ende (required)
  - a maximale plätze (a whole number, required, 10 by default)
  - a notizen

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - preis (an amount)
  - a kategorie (obst, gemüse, backwaren, milchprodukte, fleisch or sonstiges, obst by default)
  - a verfügbar (yes or no, true by default)
  - a bild (a document)

Vorbestellungen
  Vorbestellungen have:
  - a produkt (a produkt, required)
  - a menge (a whole number, required)
  - a kundenname (required)
  - a kundentelefon (a phone number)
  - a bestelldatum (a date, required, today by default)
  - status (offen, bestätigt, abgeholt or storniert, offen by default)
  - an abholzeit (an abholzeit)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Verwaltet den Hofladen): everything
  - kunde (Kann Vorbestellungen aufgeben): opens the vorbestellungen page and the abholzeiten page; sees everyone's pre orders, pickup times and products; adds pre orders
  New users get the kunde role.
  Open to anyone without signing in: the home page, the produkte page and reading products.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 115 files (115 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-22/smithable.content.yml:64:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker
  A backend for tracking habits, daily check-ins and streaks.

Pages
  - Habits (lists habits)
  - Check ins (lists check ins)
  - Streaks (lists streaks)
  - Team (who has access: invite people, change roles, remove users)

Habits
  Habits have:
  - a name (required)
  - a description
  - a category (health, productivity or personal, health by default)
  - a frequency (daily, weekly or monthly, daily by default)
  - a target (a whole number, 1 by default)
  - an active (yes or no, true by default)

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required, today by default)
  - a completed (yes or no, false by default)
  - notes

Streaks
  Streaks have:
  - a habit (a habit, required)
  - a start date (required)
  - an end date
  - a length (a whole number)
  - an active (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: everything
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 108 files (108 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
My AI Assistant
  Tasks and notes kept by my AI assistant, grouped by project.

Pages
  - Admin (lists projects; only for members and admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Projects
  Projects have:
  - a name (required)
  - a description
  Each project lists its tasks.
  Each project lists its notes.

Tasks
  Tasks have:
  - a title (required)
  - a project (a project, required)
  - status (todo, doing or done, todo by default)
  - a due date
  - details
  Each task can have an assignee (a user).

Notes
  Notes have:
  - a title (required)
  - a project (a project, required)
  - a body
  - an attachment (a document)

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
  - admin: everything
  - member (A user who manages tasks and notes): opens the admin page; adds every kind of record; changes everyone's records; deletes everyone's records
  - assistant (The AI assistant's role: reads everything, adds and changes tasks and notes, never deletes): sees everyone's records; adds tasks and notes; changes everyone's tasks and notes
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
Pictures from the Smithable image library: logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-0Dwr8A/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-0Dwr8A/app-24
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-0Dwr8A/app-24/smithable.auth.yml:16:5  warning  Everyone who signs in reads every record under shared access, so "read" of assistant says nothing.
    hint: Remove it, or use "defaultAccess: private" and grant reading to the roles that read everyone's records.
```
