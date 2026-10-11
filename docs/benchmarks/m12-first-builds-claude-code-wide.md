# M12 first builds: claude-code, the second set (2026-10-11)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 24 / 24 created, 23 type-check, 1,022,501 tokens (960,892 in, 61,609 out), $1.8947 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 62,644 | 2,880 | $0.1056 | 0 | 2 | 34 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | **no** | 30,885 | 2,378 | $0.0680 | 0 | 1 | 30 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 31,443 | 2,127 | $0.0675 | 0 | 1 | 28 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 30,215 | 1,230 | $0.0397 | 0 | 1 | 19 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 31,019 | 2,103 | $0.0636 | 0 | 1 | 24 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 62,387 | 2,326 | $0.0924 | 0 | 2 | 30 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 30,428 | 1,715 | $0.0511 | 0 | 1 | 25 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 61,188 | 1,677 | $0.0698 | 0 | 2 | 26 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 30,210 | 1,633 | $0.0477 | 0 | 1 | 22 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 61,176 | 2,352 | $0.0833 | 0 | 2 | 32 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 31,335 | 2,605 | $0.0762 | 0 | 1 | 28 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 31,330 | 2,832 | $0.0807 | 0 | 1 | 29 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 30,205 | 1,646 | $0.0480 | 0 | 1 | 21 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 30,214 | 1,870 | $0.0525 | 0 | 1 | 22 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 30,214 | 966 | $0.0344 | 0 | 1 | 16 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 30,214 | 2,722 | $0.0696 | 0 | 1 | 31 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 64,232 | 4,537 | $0.1514 | 0 | 2 | 47 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 65,104 | 5,867 | $0.1850 | 0 | 2 | 53 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 62,606 | 2,889 | $0.1054 | 0 | 2 | 33 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 31,414 | 4,055 | $0.1058 | 0 | 1 | 40 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 30,858 | 4,179 | $0.1038 | 0 | 1 | 39 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | crm | yes | yes | 30,857 | 4,527 | $0.1108 | 0 | 1 | 40 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 30,210 | 1,339 | $0.0419 | 0 | 1 | 18 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 30,504 | 1,154 | $0.0405 | 0 | 1 | 17 s |

Each created app's four spec files are in [m12-first-builds-claude-code-wide/](m12-first-builds-claude-code-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 24 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 3 | 1 / 4 (has 3) | 2 / 7 (has 4) | 1 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 3 | 0 / 2 (has 3) | 1 / 3 (has 5) | 0 / 1 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 1 (no-timezone) | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | booking | 3 | 1 / 6 (has 4) | 5 / 11 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read Service, Stylist, Slot; create none | 2 (no-timezone, operator-unknown) | none |  | none | 0 / 4 | no mention; landing page | en | | | | |
| 4 | records (words: booking) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 3 | 3 / 4 (has 4) | 4 / 7 (has 6) | 2 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 1 (no-timezone) | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 3 | 3 / 4 (has 3) | 4 / 7 (has 5) | 2 / 2 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 3 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 3 | 1 / 1 (has 1) | 1 / 5 (has 3) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 1 / 1 (has 1) | 2 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, privacy, items; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 3 | 4 / 4 (has 4) | 6 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff, it (staff) | none | pages none; read none; create none | 0 | none |  | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 3 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 4) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: api) | 3 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 3 | 0 / 1 (has 4) | 1 / 2 (has 8) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages home, plots, privacy; read Plot; create WaitingListEntry | 1 (operator-unknown) | none |  | none | 0 / 4 | no mention; landing page | en | | | | |
| 17 | booking (words: records) | 3 (sv: yes (för, att, boka)) | 2 / 6 (has 5) | 2 / 11 (has 9) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, tider, integritet; read Service, Stylist, Slot; create Message | 1 (operator-unknown) | none |  | none | 0 / 5 | no mention; landing page | sv | no | yes (tid, bokning, till) | yes (boka, tid, och) | models 5/5, fields 19/19, pages 9/9 |
| 18 | invoicing (words: records) | 3 (sv: yes (ska, en)) | 2 / 4 (has 5) | 0 / 7 (has 6) | 1 / 2 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 5 | no mention; no landing page | sv | no | yes (offerter, fakturor, till) | none | models 5/5, fields 32/32, pages 6/6 |
| 19 | marketplace (words: records) | 3 (sv: yes (ska, lägga, saker)) | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | no mention; landing page | sv | yes (vår, loppis) | yes (bilder, pris, till) | yes (och, på, vår) | models 1/1, fields 8/8, pages 6/6 |
| 20 | booking (words: records) | 3 (fi: yes (tai)) | 4 / 6 (has 4) | 3 / 11 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, aikataulu, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page | fi | no | yes (varaus) | yes (ja, verkossa) | models 4/4, fields 12/14, pages 8/8 |
| 21 | crm (words: records) | 3 (fi: no) | 1 / 2 (has 4) | 0 / 3 (has 5) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page | fi | no | no | none | models 4/4, fields 24/26, pages 5/5 |
| 22 | crm (words: records) | 3 (de: yes (die, vorbestellungen, abholzeiten)) | 1 / 2 (has 5) | 1 / 3 (has 5) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 1 (capacity-no-unique) | none |  | none | 1 / 5 | no mention; no landing page | de | yes (hofladen) | no | none | models 5/5, fields 22/25, pages 5/5 |
| 23 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 1 | 3 / 3 (has 3) | 2 / 2 (has 2) | 2 / 2 (has 2) | shared; admin, member, assistant (member) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Lingua Ledger
  A freelance translator's record of clients, the quotes sent to them and the payments received.

Pages
  - Clients (lists clients; search by name, email or company)
  - Quotes (lists quotes; filter by client, status or quoted on; “Mark sent”; “Mark accepted”; “Mark declined”)
  - Overview (a dashboard: awaiting answer, accepted, latest quotes and received)
  - Payments (lists payments; filter by client, quote or paid on)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - a company
  - address
  - notes
  Each client lists its quotes.
  Each client lists its payments.

Quotes
  Quotes have:
  - a title (required)
  - a client (a client, required)
  - a source language
  - a target language
  - a word count (a whole number)
  - an amount (an amount, required)
  - quoted on (a date, required, today by default)
  - a deadline (a date)
  - status (draft, sent, accepted or declined, draft by default)
  - notes
  Each quote lists its payments.
  The paid is calculated as the total amount of its payments.

Payments
  Payments have:
  - a client (a client, required)
  - a quote (a quote)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, paypal, cash or other, bank transfer by default)
  - a note

Mark sent
  For a quote that is draft; sets status to sent.
  The quote went to the client.

Mark accepted
  For a quote that is sent; sets status to accepted.
  The client accepted the quote.

Mark declined
  For a quote that is sent; sets status to declined.
  The client turned the quote down.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 115 files (115 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-1
  smithable studio

or only run the app with smithable run.

/tmp/smithable-bench-m12-G0aRVT/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-G0aRVT/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-G0aRVT/app-1/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-G0aRVT/app-1/src/db/seed.ts:29:6)
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
  A sales pipeline for a small web agency: leads, deals and who follows up when.

Pages
  - Leads (lists leads; search by company, contact name or email)
  - Deals (lists deals; search by title; “Mark won”; “Mark lost”)
  - Follow-ups (lists follow-ups; “Mark done”)
  - Schedule (a calendar of follow ups by week or month)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Leads
  Leads have:
  - a company (required)
  - a contact name
  - an email
  - a phone
  - a website (a web address)
  - a source (referral, website, event, outreach or other, referral by default)
  - status (new, contacted, qualified or disqualified, new by default)
  - notes
  Each lead can have an account manager (a user).
  Each lead lists its deals.
  Each lead lists its follow-ups.
  The account manager owns the lead.
  Deleted leads stay in the trash for thirty days, where they can be restored.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a stage (proposal, negotiation, won or lost, proposal by default)
  - a value (an amount)
  - an expected close (a date)
  - notes
  Each deal can have an account manager (a user).
  The account manager owns the deal.
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow-ups
  Follow-ups have:
  - a lead (a lead, required)
  - due on (a date, required)
  - a note (required)
  - status (open or done, open by default)
  Each follow-up can have an assignee (a user).
  The assignee owns the follow-up.

Mark won
  For a deal that is proposal or negotiation; sets stage to won.
  Mark a deal as won.

Mark lost
  For a deal that is proposal or negotiation; sets stage to lost.
  Mark a deal as lost.

Mark done
  For a follow-up that is open; sets status to done.
  Mark a follow-up as done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with leads, deals and follow-ups): opens the leads page, the deals page, the follow ups page and the schedule page; adds every kind of record; changes everyone's records
  New users get the sales role.
Pictures from the Smithable image library: logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-2
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-2/smithable.yml:53:15  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Cut & Comb
  Online booking for a hair salon, where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists, faq, call to action and footer)
  - Schedule (a calendar of slots by week or month)
  - My bookings (lists bookings)
  - Slots (lists slots; filter by stylist or starts at; only for admins)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Services
  Services have:
  - a name (required)
  - a summary
  - duration minutes (a whole number, required, 45 by default)
  - a price (an amount)

Stylists
  Stylists have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)

Slots
  Slots have:
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a capacity (a whole number, required, 1 by default)
  Each slot lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.

Bookings
  Bookings have:
  - a slot (a slot, required, unique)
  - a service (a service)
  - a note
  At most the slot's capacity bookings per slot.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A customer who books appointments): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading services, reading stylists and reading slots.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-3/smithable.yml:52:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-G0aRVT/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Keep track of my piano pupils, their weekly lesson times and the pieces each one practises.

Pages
  - Pupils (lists pupils; search by name or notes; filter by lesson day or level)
  - Pieces (lists pieces; search by title or composer; filter by pupil or status; “Mark learned”)

Pupils
  Pupils have:
  - a name (required)
  - a lesson day (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a lesson time
  - minutes (a whole number, 30 by default)
  - a level (beginner, intermediate or advanced, beginner by default)
  - an email
  - a phone
  - notes
  Each pupil lists its pieces.

Pieces
  Pieces have:
  - a pupil (a pupil, required)
  - a title (required)
  - a composer
  - status (learning, polishing or learned, learning by default)
  - started on (a date, today by default)
  - practice notes

Mark learned
  For a piece that is learning or polishing; sets status to learned.
  Mark a piece the pupil has learned.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 101 files (101 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Shutter Ledger
  Invoicing for a photographer: clients, shoots and what is still unpaid.

Pages
  - Overview (a dashboard: latest)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”)
  - Shoots (lists shoots; filter by client, kind, status or date; “Mark done”)
  - Clients (lists clients; search by name or email)
  - Invoice lines (lists invoice lines)
  - Calendar (a calendar of shoots by week or month)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - a phone
  - address
  - a VAT number
  Each client lists its shoots.
  Each client lists its invoices.

Shoots
  Shoots have:
  - a title (required)
  - a client (a client, required)
  - a date (required)
  - a location
  - a kind (portrait, wedding, event, commercial, product or other, portrait by default)
  - status (planned, done, invoiced or canceled, planned by default)
  - a fee (an amount)
  - notes

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
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
  The client paid the invoice.

Mark done
  For a shoot that is planned; sets status to done.
  The shoot took place.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 123 files (123 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-5
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-5/smithable.yml:69:14  warning  Page "calendar" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".

/tmp/smithable-bench-m12-G0aRVT/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-G0aRVT/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-G0aRVT/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-G0aRVT/app-5/src/db/seed.ts:43:6)
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
Tidy Ledger
  One place for our cleaning company to send monthly invoices to the households we clean for.

Pages
  - Invoices (lists invoices; filter by household or status; “Mark sent”; “Mark paid”; “Next month”)
  - Households (lists households; search by name, email or phone)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: latest, outstanding, overdue and invoiced)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Households
  Households have:
  - a name (required)
  - an email (required)
  - a phone
  - address
  Each household lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a household (a household, required)
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
  The invoice went to the household.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The household paid the invoice.

Next month
  Makes a copy of an invoice with status draft, issued on today and due on today plus 30 days, asking for the number; its lines are copied too.
  Start next month's invoice for the same household from this one.

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 123 files (123 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-6
  smithable studio

or only run the app with smithable run.
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A town flea market where anyone can post things to sell, with photos and a price.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, items where available is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Items
  Items have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a price (an amount)
  - a category (furniture, clothing, books, electronics, kids, sports, household or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)
  Photos of items are reviewed before others see them; an item waits until its photos is.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Posts things to sell and saves items they like): opens the catalog page, the my items page and the saved page; adds items
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Shelf (lists items; search by title, description or place; filter by category, condition or status; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description
  - a category (furniture, electronics, books, kitchen, stationery, clothing or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - status (available, claimed or gone, available by default)
  Each item can have a claimed by (a user).

Claim
  For an item that is available; sets status to claimed and claimed by to whoever presses it.
  Claim an available item for yourself.

Hand over
  For an item that is claimed; sets status to gone.
  Mark a claimed item as picked up.

Release
  For an item that is claimed; sets status to available.
  Put a claimed item back on the shelf.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-8
  smithable studio

or only run the app with smithable run.
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Vinyl Shelf
  A personal catalogue of my vinyl records: the albums, their artists, their condition and what I paid.

Pages
  - Albums (lists albums; search by title, label, genre or notes; filter by artist, format, condition or year; sort by title, year, price paid or purchased on)
  - Artists (lists artists; search by name, country or genre)

Artists
  Artists have:
  - a name (required, unique)
  - a country
  - a genre
  - notes
  Each artist lists its albums.

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number)
  - a label
  - a genre
  - a format (lp, ep, single, double lp or box set, lp by default)
  - a condition (near mint, mint, very good plus (vg+), very good, good, fair or poor, near mint by default)
  - a price paid (an amount)
  - purchased on (a date)
  - a purchased from
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 98 files (98 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Our local museum's collection online, where visitors browse the objects and the stories behind them.

Pages
  - Home (a landing page: hero, objects where on display is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Items (lists objects; search by name, summary, story or origin; filter by category or on display)

Objects
  Objects have:
  - a name (required)
  - a summary
  - a story
  - a category (everyday life, tools and crafts, art, maritime, documents and photographs or other, everyday life by default)
  - a date made
  - an origin
  - an on display (yes or no)
  - added on (a date, required, today by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Looks at the collection; only administrators add to it): opens the home page and the items page
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, the items page and reading items.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 98 files (98 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  See which of our IT systems are down, what is being fixed and when they are back.

Pages
  - System status (lists components)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Maintenance (lists maintenances)
  - Updates (lists incident updates)
  - Overview (a dashboard: open, down, per month and latest)
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
  - expected back at (a date and time)
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
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This system is back. The incident is resolved.).
  The system is back; the incident is resolved, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Sees which systems are down and when they are back): opens the components page, the incidents page, the maintenance page, the updates page and the overview page
  - it (The IT team: writes incidents, their updates and planned maintenance): opens the components page, the incidents page, the maintenance page, the updates page and the overview page; adds every kind of record; changes everyone's records
  New users get the staff role.
Pictures from the Smithable image library: logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Services Status
  The live status of the municipality's online services, so residents can check for outages and planned maintenance.

Pages
  - Home (a landing page: hero, services, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Overview (a dashboard: open, per month and latest)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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
  - a service (a service)
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
  - a service (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause has been found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix has been applied. We are monitoring the service before closing this incident.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved and the service is working normally.).
  The incident is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents, their updates and planned maintenance): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change services and incidents with a key, and run resolve. AI assistants can use it too.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 146 files (146 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-12/smithable.content.yml:15:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel fill-ups, service visits and other costs.

Pages
  - Fuel (lists fuel fills; filter by date)
  - Services (lists service visits; filter by kind or date)
  - Costs (lists costs; filter by category or date)
  - Overview (a dashboard: fuel spend, service spend, other costs and latest services)

Fuel fills
  Fuel fills have:
  - a date (required, today by default)
  - an odometer (a whole number)
  - liters (a number, required)
  - a price per liter (an amount, required)
  - a full tank (yes or no, true by default)
  - a station
  - notes
  The total is calculated as the liters times the price per liter.

Service visits
  Service visits have:
  - a date (required, today by default)
  - an odometer (a whole number)
  - a kind (maintenance, repair, inspection, tires or other, maintenance by default)
  - a workshop
  - a work
  - a cost (an amount)

Costs
  Costs have:
  - a date (required, today by default)
  - a category (insurance, tax, parking, tolls, washing, parts or other, insurance by default)
  - a description
  - an amount (an amount, required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 110 files (110 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guests
  The guest list and seating plan for our wedding, with who has answered and their meal choices.

Pages
  - Guests (lists guests; search by name, email or phone; filter by rsvp, meal, group or table; “Attending”; “Declined”)
  - Tables (lists tables)
  - Overview (a dashboard: attending, waiting, declined and vegetarian meals)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tables
  Tables have:
  - a name (required)
  - seats (a whole number, required, 8 by default)
  - notes
  Each table lists its guests.

Guests
  Guests have:
  - a name (required)
  - a group (family, friends, colleagues or other, family by default)
  - an email
  - a phone
  - a rsvp (waiting, attending or declined, waiting by default)
  - a meal (undecided, meat, fish, vegetarian, vegan or children, undecided by default)
  - dietary notes
  - a table (a table)
  - notes

Attending
  For a guest that is waiting or declined; sets rsvp to attending; asks for the meal.
  Record that the guest is coming and their meal choice.

Declined
  For a guest that is waiting or attending; sets rsvp to declined.
  Record that the guest cannot come.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 110 files (110 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Club Sightings
  Bird sightings logged by the members of our birdwatching club: species, place, date and who saw it.

Pages
  - Sightings (lists sightings; search by species or place)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a count (a whole number)
  - notes
  Each sighting can have an observer (a user).
  The observer owns the sighting.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A club member: logs sightings and sees everyone's): opens the sightings page; adds sightings
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 97 files (97 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of who has which plot, the waiting list and the yearly fees of our allotment society.

Pages
  - Home (a landing page: hero, plots where status is available, contact and footer)
  - Plots (lists plots; search by number or description; filter by status)
  - Members (lists members; search by name, email or phone)
  - Fees (lists fees; filter by year or status; “Mark paid”)
  - Waiting list (lists waiting list; filter by status; “Offer plot”; “Allocate”; “Withdraw”)
  - Overview (a dashboard: available plots, waiting and unpaid fees)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Plots
  Plots have:
  - a number (required, unique)
  - a size (a number)
  - status (available, let or reserved, available by default)
  - a description

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - address
  - a plot (a plot)
  - a member since (a date, today by default)
  Each member lists its fees.

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (unpaid or paid, unpaid by default)
  - paid on (a date)

Waiting list
  Waiting list have:
  - a name (required)
  - an email (required)
  - a phone
  - a message
  - added on (a date, today by default)
  - status (waiting, offered, allocated or withdrawn, waiting by default)

Mark paid
  For a fee that is unpaid; sets status to paid and paid on to today.
  Record that the yearly fee has been paid.

Offer plot
  For a waiting list entry that is waiting; sets status to offered.
  Mark that a plot has been offered to this person.

Allocate
  For a waiting list entry that is offered; sets status to allocated.
  Mark that the person accepted a plot and leaves the waiting list.

Withdraw
  For a waiting list entry that is waiting or offered; sets status to withdrawn.
  Take the person off the waiting list.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the plots page, the privacy page, reading plots and adding waiting list entries.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-16
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-16/smithable.content.yml:7:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Salongen
  Tidsbokning på nätet för en frisörsalong, där kunderna själva bokar sin tid.

Pages
  - Startsida (a landing page: hero, “Behandlingar”, call to action, contact and footer)
  - Lediga tider (a calendar of slots by week or month)
  - Mina bokningar (lists “Bokningar”)
  - Tider (lists “Tider”; only for admins)
  - Behandlingar (lists “Behandlingar”; only for admins; visitors see “Behandlingar” on the Startsida page)
  - Frisörer (lists “Frisörer”; only for admins)
  - Meddelanden (lists “Meddelanden”; only for admins)
  - Integritet (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Administration (every kind of record, to find, open, change and delete; only for admins)

Behandlingar
  Behandlingar have:
  - a field “Namn” (required)
  - a field “Beskrivning”
  - a field “Längd (minuter)” (a whole number, required, 45 by default)
  - a field “Pris” (an amount)

Frisörer
  Frisörer have:
  - a field “Namn” (required)
  - a field “Om frisören” (formatted text)
  - a field “Porträtt” (picture)

Tider
  Tider have:
  - a field “Frisör” (a “Frisör”, required)
  - a field “Starttid” (a date and time, required)
  - a field “Platser” (a whole number, required, 1 by default)
  Each “Tid” lists its “Bokningar”.
  The “Platser kvar” is calculated as the “Platser” minus the number of its “Bokningar”.

Bokningar
  Bokningar have:
  - a field “Tid” (a “Tid”, required, unique)
  - a field “Behandling” (a “Behandling”, required)
  - a field “Telefon” (a phone number)
  - a field “Meddelande till frisören”
  At most the slot's capacity “Bokningar” per slot.

Meddelanden
  Meddelanden have:
  - a field “Namn” (required)
  - a field “E-post” (an email address, required)
  - a field “Meddelande” (required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (En kund som bokar tid i salongen): opens the mina bokningar page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the tider page, the integritet page, reading services, reading stylists, reading slots and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 149 files (149 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-17. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-17
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-17/smithable.content.yml:4:3  warning  The privacy page "integritet" does not say who runs the app: give the operator's name under pages.integritet.operator (name, address, email, country, hosting).
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkoll
  Håll koll på kunder, offerter och fakturor i en liten byggfirma.

Pages
  - Offerter (lists “Offerter”; filter by “Kund” or “Status”; “Send quote”; “Accept quote”; “Decline quote”)
  - Fakturor (lists “Fakturor”; filter by “Kund” or “Status”; “Send invoice”; “Mark paid”)
  - Kunder (lists “Kunder”; search by “Namn”, “E-post” or “Telefon”)
  - Offertrader (lists “Offertrader”)
  - Fakturarader (lists “Fakturarader”)
  - Användare (who has access: invite people, change roles, remove users; only for admins)

Kunder
  Kunder have:
  - a field “Namn” (required)
  - a field “E-post” (an email address)
  - a field “Telefon” (a phone number)
  - a field “Adress”
  Each “Kund” lists its “Offerter”.
  Each “Kund” lists its “Fakturor”.

Offerter
  Offerter have:
  - a field “Offertnummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Uppdrag” (required)
  - a field “Datum” (a date, required, today by default)
  - a field “Giltig till” (a date, the “Datum” plus 30 days by default)
  - a field “Status” (“Utkast”, “Skickad”, “Accepterad” or “Avböjd”, “Utkast” by default)
  Each “Offert” lists its “Offertrader”.
  The “Summa” is calculated as the total “Belopp” of its “Rader”.

Offertrader
  Offertrader have:
  - a field “Offert” (a “Offert”, required)
  - a field “Beskrivning” (required)
  - a field “Antal” (a number, required, 1 by default)
  - a field “À-pris” (an amount, required)
  The “Belopp” is calculated as the “Antal” times the “À-pris”.

Fakturor
  Fakturor have:
  - a field “Fakturanummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Offert” (a “Offert”)
  - a field “Fakturadatum” (a date, required, today by default)
  - a field “Förfallodatum” (a date, required, the “Fakturadatum” plus 30 days by default)
  - a field “Status” (“Utkast”, “Skickad”, “Betald” or “Förfallen”, “Utkast” by default)
  Each “Faktura” lists its “Fakturarader”.
  The “Summa” is calculated as the total “Belopp” of its “Rader”.

Fakturarader
  Fakturarader have:
  - a field “Faktura” (a “Faktura”, required)
  - a field “Beskrivning” (required)
  - a field “Antal” (a number, required, 1 by default)
  - a field “À-pris” (an amount, required)
  The “Belopp” is calculated as the “Antal” times the “À-pris”.

Send quote
  For a “Offert” that is “Utkast”; sets “Status” to “Skickad”.
  Offerten har skickats till kunden.

Accept quote
  For a “Offert” that is “Skickad”; sets “Status” to “Accepterad”.
  Kunden har tackat ja till offerten.

Decline quote
  For a “Offert” that is “Skickad”; sets “Status” to “Avböjd”.
  Kunden har tackat nej till offerten.

Send invoice
  For a “Faktura” that is “Utkast”; sets “Status” to “Skickad”.
  Fakturan har skickats till kunden.

Mark paid
  For a “Faktura” that is “Skickad” or “Förfallen”; sets “Status” to “Betald”.
  Kunden har betalat fakturan.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-18. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-18
  smithable studio

or only run the app with smithable run.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Vår loppis
  Lägg upp saker du vill sälja med bilder och pris, och fynda bland grannarnas saker.

Pages
  - Loppisen (lists “Saker”; search by “Rubrik”, “Beskrivning” or “Plats”; filter by “Kategori”, “Pris”, “Skick” or “Till salu”; sort by “Pris” or date added; records can be saved as favorites; contact the owner by mail)
  - Mina saker (lists “Saker”; only the viewer's own records)
  - Sparade (lists “Saker”; only the viewer's saved records)
  - Granska bilder (the pictures and files waiting for review, to approve or reject; only for admins)
  - Välkommen (a landing page: hero, “Saker” where available is yes and footer)
  - Integritet (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Saker
  Saker have:
  - a field “Rubrik” (required)
  - a field “Bilder” (pictures, required)
  - a field “Beskrivning” (required)
  - a field “Pris” (an amount)
  - a field “Kategori” (“Möbler”, “Kläder”, “Böcker”, “Kök”, “Elektronik”, “Barn” or “Övrigt”, “Möbler” by default)
  - a field “Skick” (“Som ny”, “Bra” or “Sliten”, “Som ny” by default)
  - a field “Plats”
  - a field “Till salu” (yes or no, true by default)
  Photos of “Saker” are reviewed before others see them; an item waits until its photos is.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Lägger upp saker till försäljning och sparar favoriter): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-19
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-19/smithable.content.yml:37:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogavaraus
  Joogastudion tuntien aikataulu, ohjaajat ja varaukset verkossa.

Pages
  - Etusivu (a landing page: hero, tuntityypit, ohjaajat, call to action and footer)
  - Tunnit (lists tunnit; only for admins)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Etusivu page)
  - Ohjaajat (lists ohjaajat; only for admins; visitors see ohjaajat on the Etusivu page)
  - Omat varaukset (lists varaukset)
  - Aikataulu (a calendar of sessions by week or month)
  - Tietosuoja (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Ylläpito (every kind of record, to find, open, change and delete; only for admins)

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (kaikki tasot, aloittelijat or edistyneet, kaikki tasot by default)
  - a kesto (min) (a whole number, required, 60 by default)

Ohjaajat
  Ohjaajat have:
  - a nimi (required)
  - an esittely
  - a kuva (picture)

Tunnit
  Tunnit have:
  - a tuntityyppi (a tuntityyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an alkaa (a date and time, required)
  - a paikkoja (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The places left is calculated as the paikkoja minus the number of its bookings.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  At most the session's capacity varaukset per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Oppilas, joka varaa paikkoja tunneille): opens the omat varaukset page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the aikataulu page, the privacy page, reading class types, reading instructors and reading sessions.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-20/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Korjaamo
  Pienen autokorjaamon asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Huoltotyöt (lists huoltotyöt; filter by tila or päivä; “Start job”; “Complete job”)
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin)
  - Autot (lists autot; search by rekisterinumero, merkki or malli)
  - Laskut (lists laskut; search by laskun numero; filter by tila or eräpäivä; “Mark paid”)
  - Käyttäjät (who has access: invite people, change roles, remove users; only for admins)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address)
  - a puhelin (a phone number)
  - a muistiinpanot
  Each asiakas lists its autot.
  Deleted asiakkaat stay in the trash for thirty days, where they can be restored.

Autot
  Autot have:
  - a rekisterinumero (required, unique)
  - a merkki
  - a malli
  - a vuosimalli (a whole number)
  - a mittarilukema (km) (a whole number)
  - asiakas (an asiakas, required)
  Each auto lists its huoltotyöt.

Huoltotyöt
  Huoltotyöt have:
  - an auto (an auto, required)
  - kuvaus (required)
  - a tila (varattu, työn alla or valmis, varattu by default)
  - a päivä (a date)
  - a työ (an amount)
  - an osat (an amount)
  The yhteensä is calculated as the työ plus the osat.

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - asiakas (an asiakas, required)
  - a huoltotyö (a huoltotyö)
  - a summa (an amount, required)
  - an eräpäivä (a date)
  - a tila (avoin or maksettu, avoin by default)
  - a maksupäivä (a date)

Start job
  For a huoltotyö that is varattu; sets tila to työn alla.
  Aloita varattu huoltotyö.

Complete job
  For a huoltotyö that is varattu or työn alla; sets tila to valmis.
  Merkitse huoltotyö valmiiksi.

Mark paid
  For a lasku that is avoin; sets tila to maksettu and maksupäivä to today.
  Merkitse lasku maksetuksi.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Produkte, Vorbestellungen der Kunden und Abholzeiten für einen kleinen Hofladen.

Pages
  - Vorbestellungen (lists vorbestellungen; filter by status, abholzeit or kunde; “Mark ready”; “Mark collected”; “Cancel”)
  - Abholzeiten (lists abholzeiten)
  - Produkte (lists produkte; search by name)
  - Kunden (lists kunden; search by name, e-mail or telefon)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Produkte
  Produkte have:
  - a name (required)
  - a beschreibung
  - an einheit (stück, kg, bund or liter, stück by default)
  - preis (an amount, required)
  - a verfügbar (yes or no, true by default)

Kunden
  Kunden have:
  - a name (required)
  - an e-mail (an email address)
  - a telefon (a phone number)
  - a notizen
  Each kunde lists its vorbestellungen.

Abholzeiten
  Abholzeiten have:
  - a beginn (a date and time, required)
  - an ende (a date and time)
  - a plätze (a whole number, required, 10 by default)
  - a notizen
  Each abholzeit lists its vorbestellungen.

Vorbestellungen
  Vorbestellungen have:
  - a kunde (a kunde, required)
  - an abholzeit (an abholzeit, required)
  - status (offen, abholbereit, abgeholt or storniert, offen by default)
  - a notizen
  Each vorbestellung lists its positionen.
  At most the pickup slot's capacity vorbestellungen per pickup slot (counting those with status open or ready or collected).

Positionen
  Positionen have:
  - a vorbestellung (a vorbestellung, required)
  - a produkt (a produkt, required)
  - a menge (a number, required, 1 by default)
  - einzelpreis (an amount, required)
  The betrag is calculated as the menge times the einzelpreis.

Mark ready
  For a vorbestellung that is offen; sets status to abholbereit.
  Die Vorbestellung ist gepackt und liegt zur Abholung bereit.

Mark collected
  For a vorbestellung that is offen or abholbereit; sets status to abgeholt.
  Der Kunde hat die Vorbestellung abgeholt.

Cancel
  For a vorbestellung that is offen or abholbereit; sets status to storniert.
  Die Vorbestellung wird storniert.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-G0aRVT/app-22/smithable.yml:37:7  warning  Preorder has a capacity per pickupSlot, but "pickupSlot" is not unique: one person can take several places.
    hint: Write "pickupSlot: PickupSlot! unique" for one preorder per person and pickupslot (unique per owner with private access).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker
  Keep track of habits, daily check-ins and streaks.

Pages
  - Habits (lists habits; search by name or description; filter by status or frequency; “Pause”; “Resume”; “Check in today”)
  - Check ins (lists check ins; filter by habit or date)

Habits
  Habits have:
  - a name (required)
  - a description
  - a frequency (daily, weekdays or weekly, daily by default)
  - status (active, paused or archived, active by default)
  - started on (a date, required, today by default)
  - a current streak (a whole number, 0 by default)
  - a longest streak (a whole number, 0 by default)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required, today by default)
  - a note

Pause
  For a habit that is active; sets status to paused.
  Pause a habit for a while.

Resume
  For a habit that is paused or archived; sets status to active.
  Start tracking a habit again.

Check in today
  For a habit that is active; asks for the check in's note; adds a check in (date today).
  Record today's check-in for a habit.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change habits and check ins with a key, and run pause, resume and check in today.
Pictures from the Smithable image library: logo.webp.
Generated 106 files (106 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Project Memory
  Tasks and notes, grouped by project, that my AI assistant keeps for me.

Pages
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Admin (every kind of record, to find, open, change and delete; only for members and admins)

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
  - member (Someone who works with the tasks and notes): opens the admin page; adds every kind of record; changes everyone's records; deletes everyone's records
  - assistant (The AI assistant's key: reads everything, adds and changes tasks and notes, never deletes): adds tasks and notes; changes everyone's tasks and notes
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
Pictures from the Smithable image library: logo.webp.
Generated 145 files (145 changed, 0 removed).

Created /tmp/smithable-bench-m12-G0aRVT/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-G0aRVT/app-24
  smithable studio

or only run the app with smithable run.
```
