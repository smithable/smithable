# M12 first builds: claude-haiku-5-5, the second set (2026-10-28)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 20 / 24 created, 19 type-check, 1,391,620 tokens (1,247,098 in, 144,522 out), $0.0912; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 51,405 | 3,735 | $0.0026 | 0 | – | 100 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 51,926 | 3,882 | $0.0027 | 0 | – | 99 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | barbers | **no** | **no** | 51,808 | 11,558 | $0.0066 | 0 | – | 56 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 52,877 | 3,276 | $0.0025 | 0 | – | 81 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 52,470 | 5,212 | $0.0034 | 0 | – | 212 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 52,198 | 6,178 | $0.0039 | 0 | – | 220 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 51,518 | 4,065 | $0.0028 | 0 | – | 228 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 50,984 | 2,869 | $0.0021 | 0 | – | 157 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 50,412 | 2,391 | $0.0018 | 0 | – | 147 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 50,696 | 4,574 | $0.0030 | 0 | – | 177 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 53,839 | 6,197 | $0.0041 | 0 | – | 183 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 53,753 | 5,894 | $0.0039 | 0 | – | 242 s |
| A log of my car's fuel, service visits and costs. | records | **no** | **no** | 50,192 | 4,805 | $0.0030 | 0 | – | 36 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 50,633 | 4,019 | $0.0027 | 0 | – | 187 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | **no** | 50,457 | 1,953 | $0.0016 | 0 | – | 181 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 51,326 | 3,323 | $0.0024 | 0 | – | 232 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | barbers | **no** | **no** | 51,912 | 9,094 | $0.0053 | 0 | – | 52 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | **no** | **no** | 53,790 | 8,343 | $0.0051 | 0 | – | 49 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 52,225 | 5,576 | $0.0036 | 0 | – | 182 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 57,049 | 11,551 | $0.0071 | 0 | – | 262 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 52,718 | 10,051 | $0.0059 | 0 | – | 205 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | yes | yes | 51,942 | 18,262 | $0.0099 | 0 | – | 228 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 50,196 | 2,889 | $0.0021 | 0 | – | 106 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 50,772 | 4,825 | $0.0031 | 0 | – | 106 s |

Each created app's four spec files are in [m12-first-builds-claude-haiku-5-5-critique-wide/](m12-first-builds-claude-haiku-5-5-critique-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

1 of 20 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: booking) | 2 | 1 / 4 (has 3) | 1 / 7 (has 3) | 0 / 3 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm (words: invoicing) | 0 | 0 / 2 (has 2) | 1 / 3 (has 3) | 0 / 1 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 4 | booking (words: status) | 1 | 0 / 6 (has 3) | 0 / 12 (has 3) | 0 / 1 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 1 | 3 / 4 (has 4) | 3 / 7 (has 4) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 2 | 4 / 4 (has 4) | 3 / 7 (has 4) | 3 / 3 (has 3); left out: addField Invoice.total | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 7 | marketplace (words: booking) | 1 | 1 / 1 (has 1) | 5 / 5 (has 7) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages catalog, home, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: booking) | 2 | 1 / 1 (has 1) | 1 / 5 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 1 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 2 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 2 (role-opens-nothing, public-page-closed-records) | **public-page-closed-records** |  | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 0 | 4 / 4 (has 4) | 5 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status (words: barbers) | 2 | 3 / 4 (has 4) | 4 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Service, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 3 / 4 | no mention; landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 19 | marketplace (words: records) | 2 (sv: yes (ska, lägga, saker)) | 1 / 1 (has 1) | 2 / 5 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | no mention; landing page | sv | no | yes (bilder, pris, till) | yes (det, till) | models 1/1, fields 8/8, pages 4/4 |
| 20 | booking (words: records) | 2 (fi: no) | 6 / 6 (has 6) | 12 / 12 (has 13) | 1 / 1 (has 1) | private; admin, member (member) | none | pages home, schedule, blog, about, privacy; read ClassType, Instructor, Session, Post; create Message | 1 (operator-unknown) | none |  | none | 4 / 6 | no mention; landing page | fi | no | yes (varaus) | yes (tunnit, ja, varaus) | models 6/6, fields 0/27, pages 9/13 |
| 21 | crm (words: records) | 2 (fi: no) | 1 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page | fi | yes (autokorjaamo) | yes (autot, laskut, huoltotyöt) | none | models 4/4, fields 24/24, pages 4/5 |
| 22 | kiosk (words: records) | 2 (de: yes (die, kunden)) | 2 / 4 (has 4) | 2 / 6 (has 6) | 6 / 6 (has 6) | shared; admin, staff (staff) | none | pages none; read Product, PickupSlot; create Order | 2 (capacity-no-unique, operator-unknown) | none |  | none | 0 / 4 | no mention; landing page | de | yes (hofladen) | none | no | models 0/4, fields 0/26, pages 0/6 |
| 23 | records (words: barbers) | 1 | 0 / 1 (has 2) | 0 / 2 (has 1) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | **no api block** | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 0 | 3 / 3 (has 3) | 0 / 2 (has 3) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Translation Ledger
  Tracks my translation clients, the quotes I sent them and what they paid.

Pages
  - Clients (lists clients; search by name)
  - Payments (lists payments)
  - Quotes (lists quotes; filter by client or status)

Clients
  Clients have:
  - a name (required)
  - an email
  - languages
  - notes
  Each client lists its quotes.

Payments
  Payments have:
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a quote (a quote, required)

Quotes
  Quotes have:
  - a title (required)
  - a client (a client, required)
  - quoted on (a date, required, today by default)
  - a word count (a whole number)
  - a quoted amount (an amount, required)
  - status (draft, sent, accepted or declined, draft by default)
  Each quote lists its payments.
  The paid is calculated as the total amount of its payments.
  The owed is calculated as the quoted amount minus the paid.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,610 tokens (489 in, 3,121 out) · $0.0016
Pictures from the Smithable image library: logo.webp.
Generated 119 files (119 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Pipeline
  Tracks the agency's leads and deals, and who follows up on each and when.

Pages
  - Leads (lists leads; search by name, company or email; filter by status or assignee)
  - Deals (lists deals; filter by stage or salesperson; “Mark won”; “Mark lost”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Leads
  Leads have:
  - a name (required)
  - a company
  - an email
  - a phone
  - a source (referral, website, outbound or event, referral by default)
  - status (new, contacted, qualified or lost, new by default)
  - follow up on (a date)
  - notes
  Each lead can have an assignee (a user).
  Each lead lists its deals.
  The assignee owns the lead.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a value (an amount)
  - a stage (proposal, negotiation, won or lost, proposal by default)
  - a close date
  Each deal can have a salesperson (a user).
  The salesperson owns the deal.

Mark won
  For a deal that is proposal or negotiation; sets stage to won and close date to today.

Mark lost
  For a deal that is proposal or negotiation; sets stage to lost and close date to today.

Lead assigned
  When a lead's assignee changes: mails assignee.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,896 tokens (478 in, 2,418 out) · $0.0013
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

Failed:

```text
Starting from the barbers starter.
Frontier model (claude-haiku-5-5) · 63,366 tokens (51,808 in, 11,558 out) · $0.0066
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 1026 (line 1 column 1027)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-gvIIVf/app-3 --starter barbers

```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Weekly lesson times for a piano teacher's pupils, and the pieces each pupil practises.

Pages
  - Pupils (lists pupils)
  - Lessons (lists lessons; filter by weekday or pupil)
  - Pieces (lists pieces; filter by status or pupil)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - started on (a date)
  - notes
  Each pupil lists its lessons.
  Each pupil lists its pieces.

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - a weekday (mon, tue, wed, thu, fri, sat or sun, mon by default)
  - a time (required)
  - minutes (a whole number, required, 30 by default)
  A lesson is named after its pupil, its weekday and its time.

Pieces
  Pieces have:
  - a pupil (a pupil, required)
  - a title (required)
  - a composer
  - status (learning, polished or ready, learning by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,203 tokens (522 in, 2,681 out) · $0.0014
Pictures from the Smithable image library: logo.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Photo Invoices
  Invoices for a photographer's work: clients, shoots and what is still unpaid.

Pages
  - Overview (a dashboard: latest)
  - Invoices (lists invoices; search by number; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Clients (lists clients)
  - Shoots (lists shoots)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - address

Shoots
  Shoots have:
  - a title (required)
  - a client (a client, required)
  - shot on (a date, required, today by default)
  - a location
  - notes

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

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,316 tokens (568 in, 3,748 out) · $0.0019
Pictures from the Smithable image library: logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Left out, since it could not be made valid:
  addField Invoice.total: addField would make smithable.yml invalid. Field "Invoice.total": Invoice has no list named "lines".

Household Invoices
  One place for the cleaning company's monthly invoices to its households.

Pages
  - Clients (lists clients)
  - Settings (lists business profiles)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - a phone
  - address

Business profiles
  Business profiles have:
  - a business name (required)
  - an IBAN
  - payment term days (a whole number, required, 30 by default)
  - an invoice footer

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
  - a service period
  - issued on (a date, required, today by default)
  - status (draft, sent, paid or overdue, draft by default)
  The due on is calculated as the issued on plus 30 days.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the household.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The household paid the invoice.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,962 tokens (559 in, 3,403 out) · $0.0018
Pictures from the Smithable image library: logo.webp.
Generated 137 files (137 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-6
  smithable studio

or only run the app with smithable run.
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Flea Market
  Post things you no longer need to sell, with photos and a price, and browse what your neighbors have for sale.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, items where available is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a price (an amount)
  - a category (furniture, bikes, electronics, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of items are reviewed before others see them; an item waits until its photos are.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the catalog page, the home page, the privacy page and reading items where available is yes.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,741 tokens (415 in, 1,326 out) · $0.0007
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, hero.webp, logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-gvIIVf/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Shelf (lists items; search by title or description; filter by status or condition)
  - My items (lists items; only the viewer's own records)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - a description
  - a condition (like new, good or worn, like new by default)
  - status (available, claimed or gone, available by default)
  Each item can have a claimed by (a user).

Claim
  For an item that is available; sets status to claimed and claimed by to whoever presses it.

Mark gone
  For an item that is claimed; sets status to gone.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; runs “Claim” and “Mark gone”
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,238 tokens (381 in, 857 out) · $0.0005
Pictures from the Smithable image library: logo.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-8
  smithable studio

or only run the app with smithable run.
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Vinyl Collection
  A personal catalogue of my vinyl records, with artists, condition and what I paid.

Pages
  - Artists (lists artists)
  - Albums (lists albums; search by title; filter by condition or artist)

Artists
  Artists have:
  - a name (required)
  - notes
  Each artist lists its albums.

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a paid (an amount)
  - acquired on (a date)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,212 tokens (442 in, 1,770 out) · $0.0009
Pictures from the Smithable image library: logo.webp.
Generated 111 files (111 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  An online collection where visitors browse the museum's objects and read their stories.

Pages
  - Home (a landing page: hero, artifacts where featured is yes and footer)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Collection (lists artifacts; search by title, origin or period; filter by category; only for admins)

Artifacts
  Artifacts have:
  - a title (required)
  - a story (formatted text)
  - a period
  - an origin
  - a category (painting, photograph, tool, textile, document or other, painting by default)
  - an inventory number (required, unique)
  - an image (picture)
  - a gallery (pictures)
  - published (yes or no)
  - featured (yes or no)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Visitors who sign in and look at the collection): only their own records
  New users get the member role.
  Open to anyone without signing in: the home page.
  Admin can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,097 tokens (416 in, 1,681 out) · $0.0009
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-gvIIVf/app-10/smithable.auth.yml:8:3  warning  member can open no page: a role opens only the pages its "pages" lists.
    hint: Add "pages: all" (or a list of pages) under roles.member in smithable.auth.yml.
/tmp/smithable-bench-m12-gvIIVf/app-10/smithable.auth.yml:13:11  warning  Visitors can open home, but may not read Artifact, so the page shows them none: add it under public.read, or remove the section of home that shows it.
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Shows which of our IT systems are down, what is being fixed, and when planned work will happen, so staff always know the state of things.

Pages
  - Overview (a dashboard: open incidents, down now, per month and latest)
  - Incidents (lists incidents; filter by status or component)
  - Components (lists components; only for admins)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required, now by default)
  - resolved at (a date and time)
  - a summary (formatted text)

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required, now by default)
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
  - staff (Writes incidents and their updates): opens the overview page, the incidents page and the maintenance page; adds incidents, incident updates and maintenances; changes everyone's incidents, incident updates and maintenances; runs every custom action
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 5,469 tokens (598 in, 4,871 out) · $0.0025
Pictures from the Smithable image library: logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Shows whether the municipality's online services are working, what is being fixed, and what maintenance is planned.

Pages
  - Home (a landing page: hero, services, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status)
  - Maintenance (lists maintenances)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Services
  Services have:
  - a name (required, unique)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its incidents.
  Each service lists its maintenances.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a service (a service)
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
  - a service (a service)
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
  The incident is over, with an update saying so. The service's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents and their updates): opens the incidents page and the maintenance page; adds every kind of record; changes everyone's records; runs “Identified”, “Monitoring” and “Resolve”
  New users get the staff role.
  Open to anyone without signing in: the home page, reading services, reading incidents, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 5,751 tokens (591 in, 5,160 out) · $0.0026
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-12
  smithable studio

or only run the app with smithable run.
```

### 13. A log of my car's fuel, service visits and costs.

Failed:

```text
Starting from the records starter.
Frontier model (claude-haiku-5-5) · 54,997 tokens (50,192 in, 4,805 out) · $0.0030
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 683 (line 1 column 684)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-gvIIVf/app-13 --starter records

```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  Keeps the wedding guest list, who has answered, their meal choices, and the seating plan.

Pages
  - Tables (lists tables)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Guests (lists guests; search by name or email; filter by answer, meal, side or table)

Tables
  Tables have:
  - a name (required)
  - seats (a whole number, required, 8 by default)
  - a note
  Each table lists its guests.

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - a side (bride, groom or both, bride by default)
  - an answer (waiting, yes or no, waiting by default)
  - plus one (yes or no)
  - a plus one name
  - a meal (pending, beef, fish, vegetarian or vegan, pending by default)
  - a dietary
  - a table (a table)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,507 tokens (484 in, 2,023 out) · $0.0011
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Bird Sightings
  Records the birds the club sees: species, place, date and who saw them.

Pages
  - Sightings (lists sightings; search by species, place or notes; filter by seen on or observer)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - seen on (a date, required, today by default)
  - notes
  Each sighting can have an observer (a user).
  A sighting is named after its species and its place.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Riverside Allotment Society
  Keeps track of who holds which plot, the waiting list and the yearly fee.

Pages
  - Plots (lists plots; search by number or notes; filter by size)
  - Members (lists members; search by name or email)
  - Waiting list (lists waiting list entries; filter by status or size)
  - Fees (lists fees; filter by status or year)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Plots
  Plots have:
  - a number (required, unique)
  - a size (small, medium or large, small by default)
  - notes
  - a member (a member)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - joined on (a date, required, today by default)

Waiting list entries
  Waiting list entries have:
  - a name (required)
  - an email (required)
  - a phone
  - requested on (a date, required, today by default)
  - a size (any, small, medium or large, any by default)
  - status (waiting, offered, allocated or withdrawn, waiting by default)

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (due or paid, due by default)
  No two fees have the same member and year in the whole app.

Mark paid
  For a fee that is due; sets status to paid.
  Mark a yearly fee as paid.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,205 tokens (566 in, 2,639 out) · $0.0014
Pictures from the Smithable image library: logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

Failed:

```text
Starting from the barbers starter.
Frontier model (claude-haiku-5-5) · 61,006 tokens (51,912 in, 9,094 out) · $0.0053
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 3957 (line 41 column 4)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-gvIIVf/app-17 --starter barbers

```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

Failed:

```text
Starting from the invoicing starter.
Frontier model (claude-haiku-5-5) · 62,133 tokens (53,790 in, 8,343 out) · $0.0051
No model drafted a valid project.
Unexpected token '<', "<invoke_ab"... is not valid JSON
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-gvIIVf/app-18 --starter invoicing

```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Grannar lägger upp saker de inte längre behöver, med bilder och pris, och andra hittar dem här.

Pages
  - Loppis (lists “Saker”; search by “Titel”, “Beskrivning” or “Plats”; filter by “Kategori”, “Pris”, “Skick” or “Till salu”; sort by “Pris” or date added; contact the owner by mail)
  - Hem (a landing page: hero and footer)
  - Mina saker (lists “Saker”; only the viewer's own records)
  - Integritetspolicy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Saker
  Saker have:
  - a field “Titel” (required)
  - a field “Bilder” (pictures, required)
  - a field “Beskrivning”
  - a field “Pris” (an amount, required)
  - a field “Kategori” (“Möbler”, “Cyklar”, “Elektronik”, “Sport”, “Barn” or “Övrigt”, “Möbler” by default)
  - a field “Skick” (“Som ny”, “Bra skick” or “Slitet”, “Som ny” by default)
  - a field “Plats”
  - a field “Till salu” (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Säljer och köper saker): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,985 tokens (500 in, 1,485 out) · $0.0008
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 122 files (122 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-19
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-gvIIVf/app-19/smithable.content.yml:36:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio Virta
  Joogatuntien aikataulu ja verkkovaraukset pienelle joogastudiolle.

Pages
  - Home (a landing page: hero, tuntilajit, jutut, faq, contact, call to action and footer)
  - Tunnit (lists tunnit; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Tuntilajit (lists tuntilajit; filter by level; only for admins; visitors see tuntilajit on the Home page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Viestit (lists viestit; only for admins)
  - Jutut (lists jutut; “Publish”; only for admins; visitors see jutut on the Home page)
  - Omat varaukset (lists varaukset)
  - Aikataulu (a calendar of sessions by week or month)
  - Blogi (posts as articles, newest first, each on its own page)
  - Tietoa meistä (a page of parts: intro)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Tuntilajit
  Tuntilajit have:
  - a name (required)
  - a summary
  - a level (kaikki tasot, aloittelija or edistynyt, kaikki tasot by default)
  - duration minutes (a whole number, required, 60 by default)
  Each tuntilaji lists its tunnit.

Ohjaajat
  Ohjaajat have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Each ohjaaja lists its tunnit.

Tunnit
  Tunnit have:
  - a class type (a tuntilaji, required)
  - an instructor (an ohjaaja, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The places left is calculated as the capacity minus the number of its bookings.
  A tunti is named after its class type and its starts at.

Varaukset
  Varaukset have:
  - a session (a tunti, required, unique)
  Each varaus can have an attendee (a user).
  The attendee owns the varaus.
  At most the session's capacity varaukset per session.
  A varaus is added until the session's starts at.
  Its owner deletes it until 2 hours before the session's starts at.
  A varaus is named after its session.

Jutut
  Jutut have:
  - a title (required)
  - address (unique)
  - a summary
  - a cover (picture)
  - a body (formatted text, required)
  - published on (a date)
  - status (luonnos or julkaistu, luonnos by default)

Viestit
  Viestit have:
  - a name (required)
  - an email (required)
  - a message (required)

Publish
  For a juttu that is luonnos; sets status to julkaistu.
  Juttu julkaistaan kaikille luettavaksi.

Reminder
  When the timer “Remind” comes for a varaus: mails its owner.

Booking made
  When a varaus is added: mails its owner.

Booking changed
  When a varaus is changed: mails its owner.

Booking cancelled
  When a varaus is deleted: mails its owner.

Remind
  A day before a varaus's session's starts at: raises its event, for outgoing to tell someone.

Publish
  When a juttu's published on comes, where status is draft: runs “Publish”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Studion henkilökunta. Hallinnoi aikataulua, tunteja ja ohjaajia): everything
  - member (Joogaaja, joka varaa tunteja): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, the about page, the privacy page, reading class types, reading instructors, reading sessions, reading posts where status is published and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 5,354 tokens (616 in, 4,738 out) · $0.0024
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 195 files (195 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-gvIIVf/app-20/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa pienelle autokorjaamolle.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi or puhelin)
  - Autot (lists autot; search by rekisterinumero or merkki)
  - Huoltotyöt (lists huoltotyöt; filter by tila; “Finish”)
  - Laskut (lists laskut; search by laskunumero; filter by tila; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a puhelin (a phone number)
  - a sähköposti (an email address)
  - a muistiinpanot
  Each asiakas lists its autot.
  Each asiakas lists its laskut.

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
  - a työ (required)
  - an auto (an auto, required)
  - kuvaus
  - a tila (avoin, käynnissä or valmis, avoin by default)
  - a hinta (an amount)
  - a päivämäärä (a date)

Laskut
  Laskut have:
  - a laskunumero (required, unique)
  - asiakas (an asiakas, required)
  - a summa (an amount, required)
  - a tila (luonnos, lähetetty or maksettu, luonnos by default)
  - an eräpäivä (a date)

Finish
  For a huoltotyö that is avoin or käynnissä; sets tila to valmis.
  Merkitsee huoltotyön valmiiksi.

Mark paid
  For a lasku that is lähetetty; sets tila to maksettu.
  Merkitsee laskun maksetuksi.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 6,253 tokens (826 in, 5,427 out) · $0.0028
Pictures from the Smithable image library: logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Ein kleiner Hofladen, in dem Kundinnen und Kunden Produkte vorbestellen und zu festen Abholzeiten abholen.

Pages
  - Home (a landing page: hero, pickup slots and footer; only for admins)
  - Orders (lists orders; filter by status or pickup; “Accept”; “Ready”; “Collected”; “Decline”)
  - Products (lists products; filter by category or available; “Sold out”; “Back on”)
  - Pickups (lists pickup slots)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Products
  Products have:
  - a name (required)
  - a description
  - a price (an amount, required)
  - a unit
  - a category (vegetables, fruit, eggs, dairy, bakery or other, vegetables by default)
  - a picture
  - organic (yes or no)
  - available (yes or no, true by default)

Pickup slots
  Pickup slots have:
  - a day (a date, required)
  - hours (required)
  - a capacity (a whole number, required, 10 by default)
  - a note

Orders
  Orders have:
  - a name (required)
  - a phone (required)
  - an email
  - a pickup (a pickup slot, required)
  - a note
  - status (new, accepted, ready, collected or declined, new by default)
  - a reason
  Each order lists its order lines.
  The total is calculated as the total amount of its lines.
  At most the pickup slot's capacity orders per pickup slot (counting those with status new or accepted or ready or collected).

Order lines
  Order lines have:
  - an order (an order, required)
  - a product (a product, required)
  - a quantity (a whole number, required, 1 by default)
  - a unit price (an amount, required)
  The amount is calculated as the quantity times the unit price.

Sold out
  For a product that is available; sets available to no.
  Nothing more of it today.

Back on
  For a product that is not available; sets available to yes.
  It can be ordered again.

Accept
  For an order that is new; sets status to accepted.
  The order is accepted.

Ready
  For an order that is accepted; sets status to ready.
  The order is ready for pickup.

Collected
  For an order that is ready; sets status to collected.
  The customer has picked it up.

Decline
  For an order that is new or accepted; sets status to declined; asks for the reason.
  The order cannot be filled: say why.

Order placed
  When a order is added: mails every admin.

Order accepted
  When “Accept” runs on a order: mails email.

Order ready
  When “Ready” runs on a order: mails email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Nimmt die Vorbestellungen an und pflegt Produkte und Abholzeiten): opens the orders page, the products page and the pickups page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: reading products, reading pickup slots and adding orders.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,772 tokens (498 in, 2,274 out) · $0.0012
Pictures from the Smithable image library: samples/product-1.webp, samples/product-2.webp, samples/product-3.webp, samples/product-4.webp, samples/product-5.webp, samples/product-6.webp, hero.webp, logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-gvIIVf/app-22/smithable.yml:38:7  warning  Order has a capacity per pickup, but "pickup" is not unique: one person can take several places.
    hint: Write "pickup: PickupSlot! unique" for one order per person and pickupslot (unique per owner with private access).
/tmp/smithable-bench-m12-gvIIVf/app-22/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker
  Track daily habits with check-ins and streaks.

Pages
  - Habits (lists habits; search by name; filter by archived; “Check in habit”)

Habits
  Habits have:
  - a name (required)
  - notes
  - started on (a date, required, today by default)
  - archived (yes or no)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required, today by default)
  - a note

Check in habit
  Asks for the check in's note; adds a check in (date today).
  Record that the habit was done today.

Longest streaks
  Habits ordered by their current streak of consecutive days checked in, longest first. (habits)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,843 tokens (404 in, 1,439 out) · $0.0008
Pictures from the Smithable image library: logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Project Desk
  Tasks and notes, grouped by project, that an AI assistant keeps for me.

Pages
  - Projects (lists projects)
  - Tasks (lists tasks; filter by status or project; “Complete”; “Reopen”)
  - Notes (lists notes; filter by project)

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

Complete
  For a task that is todo or doing; sets status to done.
  Mark a task as done.

Reopen
  For a task that is done; sets status to todo.
  Open a finished task again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,971 tokens (445 in, 2,526 out) · $0.0013
Pictures from the Smithable image library: logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-gvIIVf/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-gvIIVf/app-24
  smithable studio

or only run the app with smithable run.
```
