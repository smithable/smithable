# M12 first builds: eu.anthropic.claude-sonnet-4-6, the second set (2026-10-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 21 / 22 created, 18 type-check, 742,461 tokens (664,613 in, 77,848 out), $1.7085; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

Prompt caching: of the input of the 58 calls the model answered (the response cache's are not counted), 595,764 tokens were read from the cache (the fixed system text, at a tenth of the price), 0 written to it (a quarter more than the price) and 97,963 were new.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 17,964 | 1,785 | $0.0396 | 0 | 4 | 25 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 37,099 | 4,039 | $0.0908 | 0 | 6 | 43 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 37,616 | 3,733 | $0.0874 | 0 | 7 | 38 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 36,203 | 1,952 | $0.0534 | 0 | 4 | 28 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 17,962 | 3,280 | $0.0642 | 0 | 4 | 39 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 17,964 | 2,238 | $0.0471 | 0 | 4 | 39 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | **no** | 35,656 | 1,966 | $0.0518 | 0 | 4 | 58 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | **no** | 17,531 | 1,617 | $0.0354 | 0 | 3 | 66 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 55,295 | 5,310 | $0.1226 | 0 | 6 | 73 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 35,824 | 3,108 | $0.0712 | 0 | 5 | 53 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 37,206 | 3,207 | $0.0774 | 0 | 4 | 49 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 18,255 | 2,810 | $0.0575 | 0 | 3 | 42 s |
| A log of my car's fuel, service visits and costs. | records | **no** | **no** | 17,431 | 2,056 | $0.0423 | 0 | 2 | 27 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 17,438 | 1,860 | $0.0391 | 0 | 4 | 31 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 17,441 | 940 | $0.0239 | 0 | 1 | 23 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 17,437 | 2,423 | $0.0484 | 0 | 1 | 33 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 18,284 | 3,958 | $0.0765 | 0 | 1 | 42 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | crm | yes | yes | 38,434 | 6,071 | $0.1287 | 0 | 2 | 48 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 36,878 | 4,519 | $0.0980 | 0 | 2 | 38 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 38,526 | 5,718 | $0.1232 | 0 | 2 | 46 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 58,977 | 7,757 | $0.1752 | 0 | 3 | 80 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | booking | yes | **no** | 39,192 | 7,501 | $0.1548 | 0 | 2 | 88 s |

Each created app's four spec files are in [m12-first-builds-eu.anthropic.claude-sonnet-4-6-wide/](m12-first-builds-eu.anthropic.claude-sonnet-4-6-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: crm) | 0 | 3 / 4 (has 3) | 4 / 7 (has 4) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 3 | 0 / 2 (has 3) | 1 / 3 (has 5) | 0 / 1 (has 5) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | booking | 3 | 2 / 6 (has 5) | 5 / 10 (has 9) | 0 / 0 (has 1) | private; admin, customer (customer) | slots: admin, stylists: admin, services: admin, messages: admin | pages home, schedule; read Stylist, Service, Slot; create Message | 2 (no-timezone, shortcut-closed) | none | 0 / 5 | no mention; landing page | en | | | | |
| 4 | booking (words: crm) | 2 | 0 / 6 (has 3) | 0 / 10 (has 3) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 1 | 4 / 4 (has 5) | 5 / 7 (has 7) | 2 / 2 (has 4) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 3 / 5 | no mention; landing page | en | | | | |
| 6 | invoicing (words: booking) | 2 | 4 / 4 (has 4) | 4 / 7 (has 5) | 2 / 2 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 3 / 4 | no mention; no landing page | en | | | | |
| 7 | marketplace | 2 | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home; read Item; create none | 0 | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 4 / 4 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none | 1 / 1 | no mention; landing page | en | | | | |
| 9 | records (words: crm) | 2 | 0 / 1 (has 2) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, artists; read Artist; create none | 0 | none | 0 / 2 | no mention; landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 0 | Our Collection | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 1 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 12 | status | 1 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | components: admin | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 4) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: booking) | 3 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, sightings; read Sighting; create none | 0 | none | 0 / 1 | no mention; landing page | en | | | | |
| 16 | records (words: booking) | 3 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 5) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 3 (sv: yes (ska, kunderna, kunna)) | 2 / 6 (has 5) | 4 / 10 (has 9) | 0 / 0 (has 0) | private; admin, customer (customer) | appointments: admin, services: admin, stylists: admin, messages: admin | pages home, schema; read Service, Stylist, Appointment; create Message | 1 (shortcut-closed) | none | 0 / 5 | no mention; landing page | sv | yes (min, frisörsalong) | yes (tid, bokning) | yes (min, frisörsalong) | models 5/5, fields 15/16, pages 3/9 |
| 18 | crm (words: records) | 3 (sv: yes (av, behöver, hålla)) | 1 / 2 (has 4) | 2 / 3 (has 4) | 0 / 1 (has 6) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none | 1 / 4 | no mention; no landing page | sv | no | yes (till) | none | models 4/4, fields 26/28, pages 3/4 |
| 19 | marketplace (words: records) | 2 (sv: yes (lägga, saker, till)) | 1 / 1 (has 1) | 4 / 4 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 0 | none | 0 / 1 | no mention; landing page | sv | no | yes (bilder, pris) | yes (till, saker) | models 1/1, fields 8/8, pages 4/4 |
| 20 | booking (words: records) | 2 (fi: no) | 6 / 6 (has 6) | 10 / 10 (has 11) | 0 / 0 (has 2) | private; admin, member (member) | sessions: admin, class-types: admin, instructors: admin, posts: admin, messages: admin | pages home, schedule, blog; read ClassType, Instructor, Session, Post; create Message | 0 | none | 1 / 6 | no mention; landing page | fi | yes (varaukset) | yes (varaus) | no | models 6/6, fields 20/24, pages 10/11 |
| 21 | crm (words: records) | 2 (fi: yes (ovat)) | 1 / 2 (has 4) | 2 / 3 (has 5) | 0 / 1 (has 6) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none | 1 / 4 | no mention; no landing page | fi | no | no | none | models 4/4, fields 28/30, pages 4/5 |
| 22 | booking (words: records) | 3 (de: yes (vorbestellungen)) | 1 / 6 (has 5) | 2 / 10 (has 8) | 0 / 0 (has 3) | private; admin, customer (customer) | products: admin, pickup-slots: admin, messages: admin, order-lines: admin | pages home, abholzeiten; read Product, PickupSlot; create Message | 1 (capacity-no-unique) | none | 0 / 5 | no mention; landing page | de | yes (hofladen) | yes (bestellungen) | yes (hofladen, produkte, und) | models 5/5, fields 22/23, pages 7/8 |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
My Translation Clients
  Track your freelance translation clients, quotes, and payments in one place.

Pages
  - Clients (lists clients; search by name or email)
  - Invoices (lists invoices; search by number or status; filter by status, client, issued on or due on; “Mark sent”; “Mark paid”)
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
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 97 files (97 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-1/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
clients 9 columns 0 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 10 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_wandering_loki.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-1. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-1
  smithable run
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Agency Pipeline
  Sales pipeline for a six-person web agency to track leads, deals and follow-ups.

Pages
  - Deals (lists deals; search by title, company name or contact name; filter by stage or expected close date; sort by title, value, expected close date or stage; “Mark won”; “Mark lost”)
  - Team (who has access: invite people, change roles, remove users)
  - Overview (a dashboard: active deals, pipeline value, deals won, open leads and recent activities)
  - Leads (lists leads; search by company name, contact name or email; filter by status, source or follow up at; sort by company name, follow up at or status; “Qualify”; “Disqualify”; “Mark contacted”)
  - Activities (lists activities; search by summary; filter by type or deal)

Deals
  Deals have:
  - a title (required)
  - a company name (required)
  - a contact name (required)
  - an email
  - a phone
  - a stage (proposal, negotiation, won or lost, proposal by default)
  - a value (an amount, required)
  - a probability (a whole number)
  - an expected close date
  - notes
  - follow up at (a date)
  - a lost reason
  - a lead (a lead)
  Each deal can have an assigned to (a user).
  Only admins can delete deals.

Leads
  Leads have:
  - a company name (required)
  - a contact name (required)
  - an email
  - a phone
  - a website (a web address)
  - a source (referral, website, cold outreach, event or other, referral by default)
  - status (new, contacted, qualified or disqualified, new by default)
  - notes
  - follow up at (a date)
  Each lead can have an assigned to (a user).
  Only admins can delete leads.

Activities
  Activities have:
  - a deal (a deal, required)
  - a type (call, email, meeting, proposal sent or other, call by default)
  - a summary (required)
  - notes
  - occurred at (a date and time)
  Only admins can delete activities.

Mark won
  For a deal that is proposal or negotiation; sets stage to won.
  Mark a deal as won.

Mark lost
  For a deal that is proposal or negotiation; sets stage to lost; asks for the lost reason.
  Mark a deal as lost and record the reason.

Qualify
  For a lead that is new or contacted; sets status to qualified.
  Mark a lead as qualified and ready to become a deal.

Disqualify
  For a lead that is new, contacted or qualified; sets status to disqualified.
  Mark a lead as disqualified.

Mark contacted
  For a lead that is new; sets status to contacted; asks for the follow up at.
  Record that the lead has been contacted and set a follow-up date.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Sales management. Full access)
  - sales (Works with leads and deals)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 106 files (106 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-2/drizzle.config.ts'
9 tables
account 13 columns 1 indexes 1 fks
activities 9 columns 0 indexes 2 fks
audit_log 13 columns 2 indexes 0 fks
deals 18 columns 0 indexes 3 fks
invitation 7 columns 2 indexes 1 fks
leads 14 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_silent_red_hulk.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-2. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-2
  smithable run
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
StyleBook
  Online booking for a hair salon: customers pick a stylist and a free time themselves.

Pages
  - StyleBook (a landing page: hero, features, stylists, services, contact and footer)
  - Schedule (a calendar of slots by week or month)
  - My Bookings (lists bookings; filter by status; only the viewer's own records; “Cancel”)
  - Slots (lists slots; search by stylist or service; filter by stylist or service; only for admins)
  - Stylists (lists stylists; search by name or specialties; only for admins; visitors see stylists on the StyleBook page)
  - Services (lists services; search by name; only for admins; visitors see services on the StyleBook page)
  - Messages (lists messages; only for admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a portrait (picture)
  - specialties
  Only admins can add stylists.
  Only admins can change stylists.
  Only admins can delete stylists.

Services
  Services have:
  - a name (required)
  - a description
  - duration minutes (a whole number, required, 60 by default)
  - a price (an amount)
  Only admins can add services.
  Only admins can change services.
  Only admins can delete services.

Slots
  Slots have:
  - a stylist (a stylist, required)
  - a service (a service, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 1 by default)
  Each slot lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  Only admins can add slots.
  Only admins can change slots.
  Only admins can delete slots.

Bookings
  Bookings have:
  - a slot (a slot, required, unique)
  - notes
  - status (confirmed or canceled, confirmed by default)
  At most the slot's capacity bookings per slot.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)
  Only admins can see messages.
  Only admins can change messages.
  Only admins can delete messages.

Cancel
  For a booking that is confirmed; sets status to canceled.
  Cancel a confirmed booking.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Salon staff. Manage stylists, services and the schedule)
  - customer (A customer who books appointments)
  New users get the customer role.
  Open to anyone without signing in: the home page, the schedule page, reading stylists, reading services, reading slots and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 133 files (133 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-3/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
bookings 7 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
slots 9 columns 0 indexes 3 fks
stylists 8 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_clever_sway.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-3. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-3
  smithable run
/tmp/smithable-bench-m12-WCvFbN/app-3/smithable.yml:73:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-WCvFbN/app-3/smithable.auth.yml:6:11  warning  Visitors can't open my-bookings from the home hero's shortcuts: list it under public.pages, or choose another page.
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Manage pupils, their weekly lesson times and what each one practises.

Pages
  - Pupils (lists pupils; search by name or email)
  - Pieces (lists pieces; search by title or composer; filter by pupil or status; “Mark complete”)
  - Lesson slots (lists lesson slots; filter by pupil, day of week or active)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - notes

Pieces
  Pieces have:
  - a pupil (a pupil, required)
  - a title (required)
  - a composer
  - status (learning, polishing or complete, learning by default)
  - notes

Lesson slots
  Lesson slots have:
  - a pupil (a pupil, required)
  - a day of week (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a start time (required)
  - duration minutes (a whole number, required, 30 by default)
  - an active (yes or no, required, true by default)

Mark complete
  For a piece that is learning or polishing; sets status to complete.
  Mark a piece as complete.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 90 files (90 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-4/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
lesson_slots 9 columns 0 indexes 2 fks
pieces 9 columns 0 indexes 2 fks
pupils 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_certain_spirit.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-4. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-4
  smithable run
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
ShootBill
  Invoicing for photographers: manage clients, shoots and track what is still unpaid.

Pages
  - ShootBill (a landing page: hero, features and footer)
  - Overview (a dashboard: latest invoices)
  - Invoices (lists invoices; search by number or status; filter by status, client, issued on or due on)
  - Clients (lists clients; search by name or email)
  - Shoots (lists shoots; search by name or location; filter by status, client or shoot date)
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
  - status (scheduled, completed or canceled, scheduled by default)

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
  The invoice was sent to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Mark completed
  For a shoot that is scheduled; sets status to completed.
  The shoot has been completed.

Cancel shoot
  For a shoot that is scheduled; sets status to canceled.
  The shoot has been canceled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (ShootBill staff)
  - member (A photographer using ShootBill)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 114 files (114 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-5/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 9 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 3 fks
session 8 columns 2 indexes 1 fks
shoots 10 columns 0 indexes 2 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_gifted_hitman.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-5. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-5
  smithable run

/tmp/smithable-bench-m12-WCvFbN/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-WCvFbN/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-WCvFbN/app-5/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-WCvFbN/app-5/src/db/seed.ts:44:6)
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
CleanBill
  Simple monthly invoicing for a small cleaning company to manage clients and invoices.

Pages
  - Invoices (lists invoices; search by number or status; filter by status, client, issued on or due on; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Clients (lists clients; search by name, email or phone)
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

Business profiles
  Business profiles have:
  - a business name (required)
  - a phone
  - an email
  - address
  - a bank account
  - payment term days (a whole number, required, 30 by default)
  - an invoice footer

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice was sent to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is past its due date and has not been paid.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 105 files (105 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-6/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
business_profiles 11 columns 0 indexes 1 fks
clients 8 columns 0 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoice_lines 9 columns 0 indexes 2 fks
invoices 11 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_aberrant_starjammers.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-6. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-6
  smithable run
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Buy and sell second-hand things at your local town flea market.

Pages
  - Town Flea Market (a landing page: hero, items and footer)
  - My Listings (lists items; only the viewer's own records)
  - Saved Items (lists items; only the viewer's saved records)
  - Browse Listings (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a price (an amount)
  - a category (furniture, bikes, electronics, clothing, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - an available (yes or no, true by default)

Mark sold
  For an item that is available; sets available to no.
  Mark an item as sold and no longer available.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the marketplace tidy)
  - member (Posts and saves items)
  New users get the member role.
  Open to anyone without signing in: the home page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 95 files (95 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-7/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_broad_wallop.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-7. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-7
  smithable run
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Office Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Browse the Shelf (lists items; search by title or description; filter by category, condition or available; records can be saved as favorites; contact the owner by mail)
  - My Offerings (lists items; only the viewer's own records)
  - Saved Items (lists items; only the viewer's saved records)
  - The Office Swap Shelf (a landing page: hero, items where available is yes and footer)
  - Team (who has access: invite people, change roles, remove users)

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
  Mark an item as claimed so colleagues know it is no longer available.

Put back
  For an item that is not available; sets available to yes.
  Put an item back on the shelf if it was not actually taken.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Keeps the swap shelf tidy)
  - member (Offers and claims items)
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 101 files (101 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-8/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
items 10 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lame_firelord.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-8. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-8
  smithable run
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
My Vinyl
  Track your vinyl record collection: albums, artists, condition and what you paid.

Pages
  - My Vinyl Collection (a landing page: hero and footer)
  - Artists (lists artists; search by name, genre or country; sort by name, genre or country)
  - Overview (a dashboard: total artists, total albums, total spent and recent additions)
  - Team (who has access: invite people, change roles, remove users)
  - Albums (lists albums; search by title, genre or label; filter by artist, format, condition, year or purchase date; sort by title, year, condition, price paid or purchase date)

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
  - a condition (mint, near mint, very good plus, very good, good, fair or poor, mint by default)
  - a price paid (an amount)
  - a purchase date
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
  Open to anyone without signing in: the home page, the artists page and reading artists.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 92 files (92 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-9/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
albums 15 columns 0 indexes 2 fks
artists 8 columns 0 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_petite_doctor_doom.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-9. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-9
  smithable run
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Browse the museum's collection of objects and their stories.

Pages
  - Explore Our Collection (a landing page: hero, features, museum objects where status is on display and footer)
  - Team (who has access: invite people, change roles, remove users)
  - Collection (lists museum objects; search by name, summary, story, category, period, material or origin; sort by name, acquisition date or period)

Museum objects
  Museum objects have:
  - a name (required)
  - a summary
  - a story
  - a category
  - a period
  - a material
  - an origin
  - an acquisition date
  - an image (a web address)
  - status (on display, in storage, on loan or archived, on display by default)
  Only admins can add museum objects.
  Only admins can change museum objects.
  Only admins can delete museum objects.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Manages and curates the museum collection)
  - member (Browses the collection)
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 84 files (84 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-10/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
museum_objects 14 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_remarkable_puppet_master.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-10. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-10
  smithable run
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Internal status board for IT systems so staff can see what is down and when it will be back.

Pages
  - IT System Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the IT System Status page)
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
  Only admins can use it.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.
  Only admins can use it.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so.
  Only admins can use it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Runs the status board and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 108 files (108 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-11/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_thankful_lyja.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-11. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-11
  smithable run
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipality Service Status
  Check the live status of our municipality's online services and report outages.

Pages
  - Municipality Service Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances and footer)
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
  - admin (Runs the status page and the team)
  - staff (Writes incidents and their updates)
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 119 files (119 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-12/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_productive_kree.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-12. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-12
  smithable run
```

### 13. A log of my car's fuel, service visits and costs.

Failed:

```text
x.tsx: SyntaxError: Unexpected token, expected "," (21:9)
    at /tmp/smithable-bench-m12-WCvFbN/app-13/node_modules/.pnpm/@tanstack+router-generator@1.167.38/node_modules/@tanstack/router-generator/dist/cjs/generator.cjs:147:13
    at async Object.generate (/tmp/smithable-bench-m12-WCvFbN/app-13/node_modules/.pnpm/@tanstack+router-cli@1.167.38/node_modules/@tanstack/router-cli/dist/cjs/generate.cjs:5:3)
    at async /tmp/smithable-bench-m12-WCvFbN/app-13/node_modules/.pnpm/@tanstack+router-cli@1.167.38/node_modules/@tanstack/router-cli/dist/cjs/index.cjs:13:3
`pnpm exec tsr generate` failed.

```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Our Wedding
  Guest list and seating plan for our wedding, tracking RSVPs and meal choices.

Pages
  - Guests (lists guests; search by name or email; filter by rsvp, meal choice, table or plus one; “Confirm attendance”; “Decline invitation”)
  - Tables (lists tables)
  - Overview (a dashboard: total guests, attending, pending, declined and recent rsv ps)
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
  - a meal choice (none, meat, fish, vegetarian or vegan, none by default)
  - dietary notes
  - a plus one (yes or no)
  - a plus one name
  - a plus one meal (none, meat, fish, vegetarian or vegan, none by default)
  - a table (a table)
  - a seat number (a whole number)
  - notes

Confirm attendance
  For a guest that is pending; sets rsvp to attending; asks for the meal choice.
  Mark a guest as attending and record their meal choice.

Decline invitation
  For a guest that is pending or attending; sets rsvp to declined.
  Mark a guest as declined.

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
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-14/drizzle.config.ts'
8 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
guests 16 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
session 8 columns 2 indexes 1 fks
tables 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_careless_christian_walker.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-14. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-14
  smithable run
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
BirdWatch Club
  A place for our birdwatching club to record and share bird sightings.

Pages
  - BirdWatch Club (a landing page: hero and footer)
  - Sightings (lists sightings; search by species, place or seen by; sort by species, place, seen on or seen by)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a seen by (required)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
  Open to anyone without signing in: the home page, the sightings page and reading sightings.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 81 files (81 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-15/drizzle.config.ts'
6 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
session 8 columns 2 indexes 1 fks
sightings 9 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_confused_gateway.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-15. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-15
  smithable run
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Manage allotment plots, the waiting list and yearly membership fees.

Pages
  - Plots (lists plots; search by number or status; filter by status)
  - Members (lists members; search by name, email or phone)
  - Waiting list (lists waiting list entries; search by name, email or phone; filter by status; “Assign plot”; “Mark offered”; “Withdraw”)
  - Fee payments (lists fee payments; filter by status, year or member; “Mark paid”; “Waive fee”)
  - Team (who has access: invite people, change roles, remove users)

Plots
  Plots have:
  - a number (required, unique)
  - a size m2 (a number)
  - status (available or occupied, available by default)
  - notes

Members
  Members have:
  - a name (required)
  - an email (required, unique)
  - a phone
  - joined on (a date, required, today by default)
  - a plot (a plot)

Waiting list entries
  Waiting list entries have:
  - a name (required)
  - an email (required)
  - a phone
  - applied on (a date, required, today by default)
  - status (waiting, offered, accepted or withdrawn, waiting by default)
  - notes

Fee payments
  Fee payments have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - status (pending, paid or waived, pending by default)

Assign plot
  For a waiting list entry that is waiting or offered; sets status to accepted.
  Offer a plot to someone on the waiting list and mark them as accepted.

Mark offered
  For a waiting list entry that is waiting; sets status to offered.
  Mark a waiting list entry as having been offered a plot.

Withdraw
  For a waiting list entry that is waiting or offered; sets status to withdrawn.
  Mark a waiting list applicant as withdrawn.

Mark paid
  For a fee payment that is pending; sets status to paid and paid on to today.
  Mark a fee payment as paid.

Waive fee
  For a fee payment that is pending; sets status to waived.
  Waive a member's yearly fee.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 110 files (110 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-16/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
fee_payments 9 columns 0 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
members 9 columns 1 indexes 2 fks
plots 8 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
waiting_list_entries 10 columns 0 indexes 1 fks

[✓] Your SQL migration file ➜ drizzle/0000_brown_sersi.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-16. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-16
  smithable run
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Min Frisörsalong
  Onlinebokning för frisörsalong där kunder kan boka tid själva.

Pages
  - Min Frisörsalong (a landing page: hero, features, tjänster, stylister, faq, contact and footer)
  - Lediga tider (a calendar of appointments by week or month)
  - Appointments (lists tider; only for admins)
  - Services (lists tjänster; only for admins; visitors see tjänster on the Min Frisörsalong page)
  - Stylists (lists stylister; only for admins; visitors see stylister on the Min Frisörsalong page)
  - Mina bokningar (lists bokningar)
  - Messages (lists meddelanden; only for admins)
  - Team (who has access: invite people, change roles, remove users)
  - Admin (every kind of record, to find, open, change and delete)

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
  Only admins can add tider.

Bokningar
  Bokningar have:
  - a tid (a tid, required, unique)
  At most the appointment's capacity bokningar per appointment.

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
  - admin (Salongens personal. Hanterar tider, tjänster och stylister)
  - customer (En kund som bokar tid)
  New users get the customer role.
  Open to anyone without signing in: the home page, the schema page, reading services, reading stylists, reading appointments and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 128 files (128 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-17/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
appointments 8 columns 0 indexes 3 fks
audit_log 13 columns 2 indexes 0 fks
bookings 5 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
services 8 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
stylists 7 columns 0 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_plain_forge.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-17. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-17
  smithable run
/tmp/smithable-bench-m12-WCvFbN/app-17/smithable.auth.yml:6:11  warning  Visitors can't open my-bookings from the home hero's shortcuts: list it under public.pages, or choose another page.
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggfirman
  Håll koll på kunder, offerter och fakturor för ett litet byggföretag.

Pages
  - Kunder (lists kunder; search by namn, e-post or telefon)
  - Offerter (lists offerter; search by nummer; filter by status or kund; “Skicka offert”; “Acceptera offert”; “Avvisa offert”)
  - Team (who has access: invite people, change roles, remove users)
  - Fakturor (lists fakturor; search by nummer; filter by status, kund or förfallodatum; “Skicka faktura”; “Registrera betald”; “Mark forfallen faktura”)

Kunder
  Kunder have:
  - a namn (required)
  - an e-post (an email address, unique)
  - a telefon (a phone number)
  - adress
  - an anteckningar
  Each kund can have an ansvarig (a user).
  Only admins can delete kunder.

Offerter
  Offerter have:
  - a nummer (required, unique)
  - a kund (a kund, required)
  - status (utkast, skickad, accepterad or avvisad, utkast by default)
  - a beskrivning
  - a totalt (an amount, required)
  - a giltig till (a date)
  - a skickad datum (a date and time)
  Each offert lists its offertrader.
  Only admins can delete offerter.

Offertrader
  Offertrader have:
  - a quote (an offert, required)
  - a beskrivning (required)
  - an antal (a number, required, 1 by default)
  - à-pris (an amount, required)
  The summa is calculated as the antal times the à-pris.

Fakturor
  Fakturor have:
  - a nummer (required, unique)
  - a kund (a kund, required)
  - an offert (an offert)
  - status (utkast, skickad, betald or förfallen, utkast by default)
  - a beskrivning
  - a totalt (an amount, required)
  - a förfallodatum (a date)
  - a skickad datum (a date and time)
  - a betald datum (a date and time)
  Only admins can delete fakturor.

Skicka offert
  For an offert that is utkast; sets status to skickad and skickad datum to now.
  Markera offerten som skickad till kunden.

Acceptera offert
  For an offert that is skickad; sets status to accepterad.
  Markera offerten som accepterad av kunden.

Avvisa offert
  For an offert that is skickad; sets status to avvisad.
  Markera offerten som avvisad av kunden.

Skicka faktura
  For a faktura that is utkast; sets status to skickad and skickad datum to now.
  Markera fakturan som skickad till kunden.

Registrera betald
  For a faktura that is skickad or förfallen; sets status to betald and betald datum to now.
  Registrera att fakturan är betald.

Mark forfallen faktura
  For a faktura that is skickad; sets status to förfallen.
  Markera fakturan som förfallen.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Företagsledning. Full åtkomst)
  - sales (Arbetar med kunder, offerter och fakturor)
  New users get the sales role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 108 files (108 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-18/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
customers 10 columns 1 indexes 2 fks
invitation 7 columns 2 indexes 1 fks
invoices 13 columns 1 indexes 3 fks
quote_lines 9 columns 0 indexes 2 fks
quotes 11 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_daily_alex_wilder.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-18. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-18
  smithable run
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Lägg upp saker du vill sälja och hitta fynd från andra i närheten.

Pages
  - Annonser (lists annonser; search by titel or ort; filter by kategori, pris, skick or tillgänglig; sort by pris or date added; records can be saved as favorites; contact the owner by mail)
  - Välkommen till Loppisen (a landing page: hero, annonser, call to action and footer)
  - Mina annonser (lists annonser; only the viewer's own records)
  - Sparade (lists annonser; only the viewer's saved records)

Annonser
  Annonser have:
  - a titel (required)
  - a bilder (pictures)
  - a beskrivning (required)
  - pris (an amount)
  - a kategori (kläder, möbler, böcker, elektronik, sport, barn or övrigt, kläder by default)
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
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 93 files (93 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-19/drizzle.config.ts'
7 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
items 12 columns 0 indexes 1 fks
items_favorites 4 columns 1 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_daffy_maelstrom.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-19. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-19
  smithable run
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio Varaukset
  Tuntiaikataulu ja verkkovaraukset joogastudiolle.

Pages
  - Etusivu (a landing page: hero, tuntityypit, gallery, faq, artikkelit where status is julkaistu, contact, call to action and footer)
  - Aikataulu (a calendar of sessions by week or month)
  - Omat varaukset (lists varaukset)
  - Blogi (posts as articles, newest first, each on its own page)
  - Tunnit (lists tunnit; only for admins)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Etusivu page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Artikkelit (lists artikkelit; “Unpublish”; “Publish”; only for admins; visitors see artikkelit on the Etusivu page)
  - Viestit (lists viestit; only for admins)
  - Admin (every kind of record, to find, open, change and delete)
  - Tiimi (who has access: invite people, change roles, remove users)

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (aloittelija, kaikki tasot or edistynyt, aloittelija by default)
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
  - a kapasiteetti (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The places left is calculated as the kapasiteetti minus the number of its bookings.
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
  - a julkaistu (a date)
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

Unpublish
  For an artikkeli that is julkaistu; sets tila to luonnos.
  Palauta artikkeli luonnokseksi.

Publish
  For an artikkeli that is luonnos; sets tila to julkaistu and julkaistu to today.
  Julkaise artikkeli.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Studion henkilökunta. Hallinnoi aikatauluja, tunteja ja ohjaajia)
  - member (Oppilas, joka varaa tunteja)
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, reading class types, reading instructors, reading sessions, reading posts where status is julkaistu and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 146 files (146 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-20/drizzle.config.ts'
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

[✓] Your SQL migration file ➜ drizzle/0000_pink_sleepwalker.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-20. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-20
  smithable run

/tmp/smithable-bench-m12-WCvFbN/app-20/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132
		return this.stmt.run(...params);
		                 ^
SqliteError: FOREIGN KEY constraint failed
    at PreparedQuery.run (/tmp/smithable-bench-m12-WCvFbN/app-20/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/better-sqlite3/session.ts:132:20)
    at QueryPromise.run (/tmp/smithable-bench-m12-WCvFbN/app-20/node_modules/.pnpm/drizzle-orm@0.45.3_@types+better-sqlite3@9.6.0_better-sqlite3@12.11.1_kysely@0.29.6/node_modules/src/sqlite-core/query-builders/insert.ts:398:26)
    at <anonymous> (/tmp/smithable-bench-m12-WCvFbN/app-20/src/db/seed.ts:58:6)
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  code: 'SQLITE_CONSTRAINT_FOREIGNKEY'
}

Node.js v24.21.0
Could not add sample data; the app works without it.
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
AutoHuolto
  Pieni autokorjaamo hallitsee asiakkaita, autoja, huoltotöitä ja laskuja yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin)
  - Autot (lists autot; search by rekisterinumero, valmistenumero (vin), merkki or malli; filter by asiakas)
  - Team (who has access: invite people, change roles, remove users)
  - Huoltotyöt (lists huoltotyöt; search by kuvaus; filter by tila or ajoitettu; sort by ajoitettu or valmistui; “Start work”; “Mark invoiced”; “Complete job”)
  - Laskut (lists laskut; search by laskunumero; filter by tila, laskupäivä or eräpäivä; sort by laskupäivä, eräpäivä or summa; “Mark paid”; “Cancel invoice”; “Send invoice”)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address, unique)
  - a puhelin (a phone number)
  - an osoite
  - a muistiinpanot
  Each asiakas lists its autot.

Autot
  Autot have:
  - asiakas (an asiakas, required)
  - a merkki (required)
  - a malli (required)
  - a vuosimalli (a whole number)
  - a rekisterinumero (required, unique)
  - a valmistenumero (vin) (unique)
  - a muistiinpanot
  Each auto lists its huoltotyöt.

Huoltotyöt
  Huoltotyöt have:
  - an auto (an auto, required)
  - kuvaus (required)
  - a tila (avoin, työn alla, valmis or laskutettu, avoin by default)
  - an ajoitettu (a date)
  - a valmistui (a date)
  - a muistiinpanot
  - työkustannus (an amount)
  - a varaosien hinta (an amount)
  The yhteensä is calculated as the työkustannus plus the varaosien hinta.

Laskut
  Laskut have:
  - a laskunumero (required, unique)
  - a huoltotyö (a huoltotyö, required)
  - a tila (luonnos, lähetetty, maksettu or peruutettu, luonnos by default)
  - a laskupäivä (a date)
  - an eräpäivä (a date)
  - a summa (an amount, required)
  - a muistiinpanot

Start work
  For a huoltotyö that is avoin; sets tila to työn alla.
  Merkitse huoltotyö työn alle.

Mark invoiced
  For a huoltotyö that is valmis; sets tila to laskutettu.
  Merkitse huoltotyö laskutetuksi.

Mark paid
  For a lasku that is lähetetty; sets tila to maksettu.
  Merkitse lasku maksetuksi.

Cancel invoice
  For a lasku that is luonnos or lähetetty; sets tila to peruutettu.
  Peruuta lasku.

Complete job
  For a huoltotyö that is työn alla; sets tila to valmis and valmistui to today.
  Merkitse huoltotyö valmiiksi.

Send invoice
  For a lasku that is luonnos; sets tila to lähetetty and laskupäivä to today.
  Lähetä lasku asiakkaalle.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin
  - member
  New users get the member role.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp.
Generated 110 files (110 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-21/drizzle.config.ts'
10 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
cars 11 columns 2 indexes 2 fks
customers 9 columns 1 indexes 1 fks
invitation 7 columns 2 indexes 1 fks
invoices 11 columns 1 indexes 2 fks
service_jobs 13 columns 0 indexes 2 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_sleepy_random.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-21. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-21
  smithable run
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Produkte, Vorbestellungen und Abholzeiten für einen kleinen Hofladen.

Pages
  - Willkommen im Hofladen (a landing page: hero, features, produkte where available is yes, contact and footer)
  - Produkte (lists produkte; only for admins; visitors see produkte on the Willkommen im Hofladen page)
  - Abholzeiten (lists abholzeiten; only for admins)
  - Nachrichten (lists nachrichten; only for admins)
  - Abholzeiten (a calendar of pickup slots by week or month)
  - Team (who has access: invite people, change roles, remove users)
  - Vorbestellungen (lists vorbestellungen; search by name or e-mail; filter by status or abholzeit; “Bestaetigen”; “Abgeholt”; “Stornieren”)
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
  - a max. bestellungen (a whole number, required, 10 by default)
  Only admins can add abholzeiten.
  Only admins can change abholzeiten.
  Only admins can delete abholzeiten.

Nachrichten
  Nachrichten have:
  - a name (required)
  - an e-mail (an email address, required)
  - a nachricht (required)
  Only admins can see nachrichten.
  Only admins can change nachrichten.
  Only admins can delete nachrichten.

Vorbestellungen
  Vorbestellungen have:
  - an abholzeit (an abholzeit, required)
  - a name (required)
  - an e-mail (an email address, required)
  - a telefon (a phone number)
  - an anmerkungen
  - status (offen, bestätigt, abgeholt or storniert, offen by default)
  At most the pickup slot's capacity vorbestellungen per pickup slot.

Bestellpositionen
  Bestellpositionen have:
  - a vorbestellung (a vorbestellung, required)
  - a produkt (a produkt, required)
  - a menge (a whole number, required, 1 by default)
  - einzelpreis (an amount, required)

Bestaetigen
  For a vorbestellung that is offen; sets status to bestätigt.
  Bestellung als bestätigt markieren.

Abgeholt
  For a vorbestellung that is bestätigt; sets status to abgeholt.
  Bestellung als abgeholt markieren.

Stornieren
  For a vorbestellung that is offen or bestätigt; sets status to storniert.
  Bestellung stornieren.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees and changes only their own records.
  Roles:
  - admin (Hofladenbesitzer. Verwaltet Produkte, Abholzeiten und Bestellungen)
  - customer (Kunde. Kann Produkte ansehen und Vorbestellungen aufgeben)
  New users get the customer role.
  Open to anyone without signing in: the home page, the abholzeiten page, reading products where available is yes, reading pickup slots and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp.
Generated 119 files (119 changed, 0 removed).
No config path provided, using default 'drizzle.config.ts'
Reading config file '/tmp/smithable-bench-m12-WCvFbN/app-22/drizzle.config.ts'
11 tables
account 13 columns 1 indexes 1 fks
audit_log 13 columns 2 indexes 0 fks
invitation 7 columns 2 indexes 1 fks
messages 7 columns 0 indexes 1 fks
order_lines 8 columns 0 indexes 3 fks
orders 10 columns 0 indexes 2 fks
pickup_slots 8 columns 0 indexes 1 fks
products 10 columns 0 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 8 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_quiet_daimon_hellstrom.sql 🚀

Created /tmp/smithable-bench-m12-WCvFbN/app-22. Start it with:

  cd /tmp/smithable-bench-m12-WCvFbN/app-22
  smithable run
/tmp/smithable-bench-m12-WCvFbN/app-22/smithable.yml:48:7  warning  Order has a capacity per pickupSlot, but "pickupSlot" is not unique: one person can take several places.
    hint: Write "pickupSlot: PickupSlot! unique" for one order per person and pickupslot (unique per owner with private access).
```
