# M12 first builds: claude-haiku-5-5, the second set (2026-10-28)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 21 / 24 created, 21 type-check, 2,122,045 tokens (1,845,687 in, 276,358 out), $0.1667; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 78,129 | 8,639 | $0.0055 | 0 | – | 124 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 77,358 | 10,309 | $0.0063 | 0 | – | 134 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | barbers | yes | yes | 77,748 | 16,253 | $0.0093 | 0 | – | 142 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 75,357 | 7,134 | $0.0045 | 0 | – | 211 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 78,126 | 15,055 | $0.0087 | 0 | – | 269 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 78,129 | 11,408 | $0.0069 | 0 | – | 291 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 75,966 | 9,541 | $0.0058 | 0 | – | 257 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 75,978 | 7,299 | $0.0046 | 0 | – | 206 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | **no** | **no** | 75,342 | 5,448 | $0.0036 | 0 | – | 47 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 75,348 | 6,776 | $0.0043 | 0 | – | 279 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 78,786 | 14,353 | $0.0084 | 0 | – | 324 s |
| Service status for our municipality's online services, for residents to check outages. | barbers | yes | yes | 77,727 | 13,968 | $0.0081 | 0 | – | 387 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 75,324 | 5,423 | $0.0065 | 0 | – | 224 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 75,354 | 7,541 | $0.0047 | 0 | – | 183 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 75,351 | 5,600 | $0.0037 | 0 | – | 148 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 75,351 | 9,425 | $0.0056 | 0 | – | 206 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | barbers | **no** | **no** | 77,904 | 19,071 | $0.0107 | 0 | – | 96 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | **no** | **no** | 78,294 | 15,167 | $0.0088 | 0 | – | 75 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 76,140 | 7,342 | $0.0047 | 0 | – | 158 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 81,210 | 29,184 | $0.0161 | 0 | – | 237 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 77,280 | 14,036 | $0.0081 | 0 | – | 152 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | yes | yes | 77,949 | 24,859 | $0.0136 | 0 | – | 179 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 75,342 | 7,277 | $0.0046 | 0 | – | 95 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 76,194 | 5,250 | $0.0036 | 0 | – | 112 s |

Each created app's four spec files are in [m12-first-builds-claude-haiku-5-5-vote3-wide/](m12-first-builds-claude-haiku-5-5-vote3-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 21 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: booking) | 2 | 1 / 4 (has 3) | 1 / 7 (has 3) | 0 / 3 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm (words: invoicing) | 0 | 0 / 2 (has 2) | 1 / 3 (has 3) | 0 / 1 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | barbers | 1 | 3 / 4 (has 4) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read Service, Stylist; create none | 2 (no-timezone, operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | en | | | | |
| 4 | records (words: status) | 1 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 2 | 3 / 4 (has 4) | 3 / 7 (has 4) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 2 | 2 / 4 (has 3) | 1 / 7 (has 3) | 2 / 3 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace (words: booking) | 1 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: booking) | 2 | 1 / 1 (has 1) | 1 / 5 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages home, collection; read Artifact; create none | 0 | none |  | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 2 | 4 / 4 (has 4) | 4 / 8 (has 4) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | barbers | 1 | 1 / 4 (has 3) | 2 / 7 (has 4) | 0 / 2 (has 1) | shared; admin, member (member) | none | pages home, services, incidents; read Service, Incident, IncidentUpdate; create none | 0 | none |  | none | 1 / 3 | no mention; landing page | en | | | | |
| 13 | records (words: barbers) | 1 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0); left out: setCapacity Guest | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 19 | marketplace (words: records) | 2 (sv: yes (ska, att, lägga)) | 1 / 1 (has 1) | 0 / 5 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | sv | yes (loppis) | yes (pris, bilder) | none | models 1/1, fields 4/4, pages 1/2 |
| 20 | booking (words: records) | 1 (fi: no) | 6 / 6 (has 6) | 12 / 12 (has 13) | 1 / 1 (has 1) | private; admin, member (member) | none | pages home, schedule, blog, about, privacy; read ClassType, Instructor, Session, Post; create Message | 1 (operator-unknown) | none |  | none | 4 / 6 | no mention; landing page | fi | no | yes (varaus) | yes (ja, ovat) | models 6/6, fields 0/27, pages 9/13 |
| 21 | crm (words: records) | 2 (fi: no) | 1 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | none | none | models 0/4, fields 0/23, pages 0/5 |
| 22 | kiosk (words: records) | 2 (de: yes (die)) | 2 / 4 (has 4) | 2 / 6 (has 6) | 2 / 6 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Product, PickupTime; create Order | 3 (capacity-no-unique, visitor-typed-recipient, operator-unknown) | none |  | none | 0 / 4 | no mention; landing page | de | yes (hofladen) | none | no | models 0/4, fields 0/23, pages 0/6 |
| 23 | records (words: barbers) | 2 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | **no api block** | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 0 | 3 / 3 (has 3) | 0 / 2 (has 3) | 1 / 2 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Translation Ledger
  Keeps track of a freelance translator's clients, the quotes sent to them, and what they have paid.

Pages
  - Clients (lists clients)
  - Quotes (lists quotes; filter by client or status)
  - Payments (lists payments)

Clients
  Clients have:
  - a name (required)
  - an email
  - a company
  - a phone
  - notes
  Each client lists its quotes.

Quotes
  Quotes have:
  - a client (a client, required)
  - a description (required)
  - an amount (an amount, required)
  - quoted on (a date, required, today by default)
  - status (quoted, accepted or declined, quoted by default)
  Each quote lists its payments.
  The paid is calculated as the total amount of its payments.
  The balance is calculated as the amount minus the total amount of its payments.

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a note

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,746 tokens (493 in, 4,253 out) · $0.0022
Pictures from the Smithable image library: logo.webp.
Generated 119 files (119 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Agency Pipeline
  Tracks the leads and deals of our six-person web agency and who follows up on each, and when.

Pages
  - Leads (lists leads; search by name or company; filter by status, source or follow up)
  - Deals (lists deals; filter by stage or follow up; “Win”)
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
  Each lead can have a follow up (a user).
  Each lead lists its deals.
  The follow up owns the lead.

Deals
  Deals have:
  - a name (required)
  - a lead (a lead, required)
  - a value (an amount)
  - a stage (proposal, negotiation, won or lost, proposal by default)
  - a close date
  Each deal can have a follow up (a user).
  The follow up owns the deal.

Win
  For a deal that is proposal or negotiation; sets stage to won.

Follow up assigned
  When a lead's follow up changes: mails follow up.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; changes everyone's leads and deals
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,958 tokens (486 in, 3,472 out) · $0.0018
Pictures from the Smithable image library: logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Hair Studio Booking
  Online booking for a hair salon, where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Appointments (lists appointments; filter by status)
  - Services (lists services)
  - Stylists (lists stylists)
  - Time off (lists time offs)
  - Day (a calendar of appointments by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Services
  Services have:
  - a name (required)
  - a summary
  - minutes (a whole number, required, 30 by default)
  - a price (an amount)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a portrait (picture)
  Each stylist lists its time offs.
  Stylists are booked by their time: Mon–Fri 09:00–17:00, Sat 10:00–14:00, a break 12:00–12:30, 10 minutes kept free after each booking, away during their time offs (by their fields from and until).

Time offs
  Time offs have:
  - a stylist (a stylist, required)
  - a date and time (from, required)
  - a date and time (until, required)
  - a note

Appointments
  Appointments have:
  - a service (a service, required)
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  - a name (required)
  - a phone
  - a note
  - status (requested, confirmed or cancelled, requested by default, filled by the app)
  An appointment takes its stylist's time from its starts at for the number of minutes in its service's minutes while status is requested or confirmed; whoever made it may cancel it until 12 hours before.

Confirm
  For an appointment that is requested; sets status to confirmed.

Cancel
  For an appointment that is requested or confirmed; sets status to cancelled.

Appointment requested
  When a appointment is added: mails every admin.

Appointment made
  When a appointment is added: mails its owner.

Appointment confirmed
  When “Confirm” runs on a appointment: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (The salon. Keeps the services, the stylists and their time off; confirms appointments): everything
  - member (A customer who books appointments): opens every page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading stylists.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,652 tokens (461 in, 2,191 out) · $0.0011
Pictures from the Smithable image library: samples/stylist-1.webp, samples/stylist-2.webp, samples/stylist-3.webp, hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-U76YjJ/app-3/smithable.yml:100:14  warning  Page "day" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-U76YjJ/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Keeps a piano teacher's pupils, their weekly lesson times and what each pupil practises.

Pages
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Pupils (lists pupils; search by name)
  - Lessons (lists lessons; filter by weekday)
  - Practice (lists assignments; filter by status)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - started on (a date)
  - notes
  Each pupil lists its lessons.
  Each pupil lists its assignments.

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - a weekday (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a start time (required)
  A lesson is named after its pupil's name, its weekday and its start time.

Assignments
  Assignments have:
  - a pupil (a pupil, required)
  - a piece (required)
  - a composer
  - assigned on (a date, required, today by default)
  - status (practising or learned, practising by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,299 tokens (533 in, 3,766 out) · $0.0019
Pictures from the Smithable image library: logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Lens Ledger
  Invoices for a photographer's work: clients, shoots, and what is still unpaid.

Pages
  - Overview (a dashboard: latest)
  - Invoices (lists invoices; filter by status or client; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Clients (lists clients)
  - Shoots (lists shoots)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - address
  Each client lists its shoots.
  Each client lists its invoices.

Shoots
  Shoots have:
  - a title (required)
  - a client (a client, required)
  - a shoot date (required)
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

Mark overdue
  A day after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; runs “Mark sent” and “Mark paid”
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 6,670 tokens (569 in, 6,101 out) · $0.0031
Pictures from the Smithable image library: logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Clean Invoices
  One place where our cleaning company of three creates and sends its monthly invoices to households and tracks which are paid.

Pages
  - Invoices (lists invoices; search by number; filter by status or household; “Mark sent”; “Mark paid”)
  - Households (lists households)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Households
  Households have:
  - a name (required)
  - an email
  - a phone
  - address
  Each household lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a household (a household, required)
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
  The invoice went to the household.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The household paid the invoice.

Invoice sent
  When “Mark sent” runs on a invoice: mails household's email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,055 tokens (513 in, 2,542 out) · $0.0013
Pictures from the Smithable image library: logo.webp.
Generated 129 files (129 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-6
  smithable studio

or only run the app with smithable run.
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Buy and sell second-hand things in your town, with photos and a price.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, items and footer)
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
  - available (yes or no, true by default)
  Photos of items are reviewed before others see them; an item waits until its photos are.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Sells and saves items): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,639 tokens (406 in, 1,233 out) · $0.0007
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-U76YjJ/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Shelf (lists items; search by title or description; filter by condition or status)
  - My items (lists items; only the viewer's own records)

Items
  Items have:
  - a title (required)
  - a description
  - a photo (picture)
  - a condition (like new, good or worn, like new by default)
  - status (offered, claimed or given, offered by default)
  Each item can have a claimed by (a user).

Claim
  For an item that is offered; sets status to claimed and claimed by to whoever presses it.
  Claim an offered item for yourself.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; runs “Claim”
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,257 tokens (381 in, 876 out) · $0.0005
Pictures from the Smithable image library: logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-8
  smithable studio

or only run the app with smithable run.
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

Failed:

```text
Starting from the records starter.
Frontier model (claude-haiku-5-5) · 80,790 tokens (75,342 in, 5,448 out) · $0.0036
No model drafted a valid project.
addModel: Choice value "near mint" must start with a lowercase letter and use only letters and digits, like "inProgress".
addPage: There is no model named "Album".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-U76YjJ/app-9 --starter records

```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  An online collection where visitors browse the museum's objects and read their stories.

Pages
  - Home (a landing page: hero, objects where on display is yes and footer)
  - Collection (lists objects; search by name or origin; filter by category)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Objects
  Objects have:
  - a name (required)
  - a period
  - an origin
  - a story (formatted text)
  - a category (painting, textile, tool, photograph or other, painting by default)
  - an image (picture)
  - on display (yes or no)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the collection page and reading artifacts.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,880 tokens (395 in, 1,485 out) · $0.0008
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  An internal status board that shows which IT systems are down, what is being done, and when they are back.

Pages
  - Components (lists components)
  - Incidents (lists incidents; filter by status or component)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each component lists its incidents.
  Each component lists its maintenances.

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
  - staff (Writes incidents and their updates, and plans maintenance): opens the components page, the incidents page and the maintenance page; adds incidents, incident updates and maintenances; changes everyone's incidents, incident updates and maintenances; runs “Identified”, “Monitoring” and “Resolve”
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 5,752 tokens (586 in, 5,166 out) · $0.0026
Pictures from the Smithable image library: logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Service status
  Shows the current status of the municipality's online services so residents can check outages.

Pages
  - Home (a landing page: hero, services, incidents where status is investigating or identified or monitoring and footer)
  - Services (lists services)
  - Incidents (lists incidents; filter by status or service; “Resolve”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Services
  Services have:
  - a name (required)
  - a description
  - status (operational, degraded, outage or maintenance, operational by default)

Incidents
  Incidents have:
  - a title (required)
  - a service (a service, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - started at (a date and time, required)
  - resolved at (a date and time)
  - a summary
  Each incident lists its incident updates.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)
  - a date and time (at, required)

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; asks for the incident update's message; adds an incident update (status resolved, at now).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the services page, the incidents page, reading services, reading incidents and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 5,598 tokens (512 in, 5,086 out) · $0.0026
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-12
  smithable studio

or only run the app with smithable run.
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuel fills; filter by car)
  - Services (lists service visits; filter by kind or car)
  - Cars (lists cars)

Cars
  Cars have:
  - a name (required)
  - a make
  - a year (a whole number)
  - a plate

Fuel fills
  Fuel fills have:
  - a car (a car, required)
  - a date (required, today by default)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a cost (an amount, required)
  - a station
  - a note
  The price per liter is calculated as the cost divided by the liters.

Service visits
  Service visits have:
  - a car (a car, required)
  - a date (required, today by default)
  - an odometer (a whole number)
  - a kind (service, repair, inspection, tyres or other, service by default)
  - a workshop
  - a cost (an amount, required)
  - a description

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,270 tokens (497 in, 3,773 out) · $0.0019
Pictures from the Smithable image library: logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Left out, since it could not be made valid:
  setCapacity Guest: setCapacity would make smithable.yml invalid. "per" in the capacity of "Guest" must be one of Guest's required references (a field like "session: Session!").

Wedding Guest List and Seating
  Keeps the wedding guest list, who has answered the invitation, their meal choices, and where each guest sits.

Pages
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Guests (lists guests; search by name or email; filter by rsvp, side, meal or table)
  - Tables (lists tables)

Tables
  Tables have:
  - a name (required)
  - a capacity (a whole number, required, 8 by default)
  - notes
  Each table lists its guests.

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - a side (bride, groom or both, bride by default)
  - a rsvp (pending, yes or no, pending by default)
  - plus one (yes or no)
  - a meal (beef, fish, vegetarian or vegan, beef by default)
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
Frontier model (claude-haiku-5-5) · 2,497 tokens (485 in, 2,012 out) · $0.0011
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Bird Sightings
  A shared log where birdwatching club members record the birds they have seen, where, and when.

Pages
  - Sightings (lists sightings; search by species or place)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - seen on (a date, required, today by default)
  - notes
  Each sighting can have a seen by (a user).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,332 tokens (378 in, 954 out) · $0.0005
Pictures from the Smithable image library: logo.webp.
Generated 111 files (111 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Shows which member holds which plot, the waiting list for plots, and each member's yearly fee.

Pages
  - Plots (lists plots; filter by status or size)
  - Members (lists members; search by name or email)
  - Waiting list (lists waiting entries; filter by status)
  - Fees (lists fees; filter by paid or year; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - joined on (a date, required, today by default)

Plots
  Plots have:
  - a number (a whole number, required, unique)
  - a size (small, medium or large, small by default)
  - status (vacant, let or reserved, vacant by default)
  - a holder (a member)

Waiting entries
  Waiting entries have:
  - a name (required)
  - an email
  - a phone
  - requested on (a date, required, today by default)
  - status (waiting, offered or declined, waiting by default)

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required, 2026 by default)
  - an amount (an amount, required)
  - paid (yes or no)

Mark paid
  For a fee that is not paid; sets paid to yes.
  Mark the yearly fee as paid.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,123 tokens (549 in, 2,574 out) · $0.0013
Pictures from the Smithable image library: logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

Failed:

```text
Starting from the barbers starter.
Frontier model (claude-haiku-5-5) · 96,975 tokens (77,904 in, 19,071 out) · $0.0107
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 941 (line 7 column 185)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-U76YjJ/app-17 --starter barbers

```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

Failed:

```text
Starting from the invoicing starter.
Frontier model (claude-haiku-5-5) · 93,461 tokens (78,294 in, 15,167 out) · $0.0088
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 1003 (line 7 column 158)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-U76YjJ/app-18 --starter invoicing

```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppis
  En sida där folk lägger upp saker de vill sälja, med bilder och pris.

Pages
  - Saker till salu (lists “Saker”; search by “Titel” or “Beskrivning”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Saker
  Saker have:
  - a field “Titel” (required)
  - a field “Beskrivning”
  - a field “Pris” (an amount)
  - a field “Bilder” (pictures, required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,289 tokens (401 in, 888 out) · $0.0005
Pictures from the Smithable image library: logo.webp.
Generated 115 files (115 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-19
  smithable studio

or only run the app with smithable run.
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Tuntien aikataulu ja verkkovaraukset pienelle joogastudiolle.

Pages
  - Home (a landing page: hero, tuntilajit, artikkelit, gallery, faq, contact and footer)
  - Aikataulu (a calendar of sessions by week or month)
  - Tunnit (lists tunnit; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Tuntilajit (lists tuntilajit; filter by level; only for admins; visitors see tuntilajit on the Home page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Viestit (lists viestit; only for admins)
  - Blogi (posts as articles, newest first, each on its own page)
  - Tietoa meistä (a page of parts: intro, story, ohjaajat and faq)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Artikkelit (lists artikkelit; filter by status; only for admins; visitors see artikkelit on the Home page)
  - Omat varaukset (lists varaukset; only the viewer's own records)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tuntilajit
  Tuntilajit have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
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

Artikkelit
  Artikkelit have:
  - a title (required)
  - address (unique)
  - a summary
  - a cover (picture)
  - a body (formatted text, required)
  - published on (a date)
  - status (draft or published, draft by default)

Viestit
  Viestit have:
  - a name (required)
  - an email (required)
  - a message (required)

Publish
  For an artikkeli that is draft; sets status to published.
  The post is out for everyone to read.

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
  When an artikkeli's published on comes, where status is draft: runs “Publish”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Studion henkilökunta. Hallinnoi aikataulua, tuntilajeja ja ohjaajia): everything
  - member (Asiakas, joka varaa tunteja): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, the about page, the privacy page, reading class types, reading instructors, reading sessions, reading posts where status is published and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 6,747 tokens (613 in, 6,134 out) · $0.0031
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 195 files (195 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-U76YjJ/app-20/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists customers; search by name, email or phone)
  - Autot (lists cars; search by registration or make)
  - Huoltotyot (lists jobs; filter by status)
  - Laskut (lists invoices; filter by status)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Customers
  Customers have:
  - a name (required)
  - a phone
  - an email
  - notes
  Each customer lists its cars.

Cars
  Cars have:
  - a registration (required, unique)
  - a make (required)
  - a model
  - a year (a whole number)
  - a mileage (a whole number)
  - a customer (a customer, required)

Jobs
  Jobs have:
  - a title (required)
  - a car (a car, required)
  - status (planned, in progress, done or invoiced, planned by default)
  - a description
  - a price (an amount)
  - scheduled on (a date)
  - an invoice (an invoice)

Invoices
  Invoices have:
  - a number (required, unique)
  - a customer (a customer, required)
  - status (draft, sent or paid, draft by default)
  - a total (an amount, required)
  - issued on (a date)

Finish job
  For a job that is in progress; sets status to done.

Mark paid
  For an invoice that is sent; sets status to paid.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 5,714 tokens (601 in, 5,113 out) · $0.0026
Pictures from the Smithable image library: logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Ein kleiner Hofladen, bei dem Kunden Produkte vorbestellen und zu einer Abholzeit abholen.

Pages
  - Home (a landing page: hero, products where available is yes and footer)
  - Orders (lists orders; filter by status or pickup)
  - Products (lists products)
  - Pickups (lists pickup times)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Products
  Products have:
  - a name (required)
  - a description
  - a price (an amount, required)
  - a unit
  - a category (vegetables, fruit, dairy, eggs or other, vegetables by default)
  - a picture
  - available (yes or no, true by default)

Pickup times
  Pickup times have:
  - starts at (a date and time, required)
  - places (a whole number, required, 10 by default)
  - a note

Orders
  Orders have:
  - a name (required)
  - a phone (required)
  - an email
  - a pickup (a pickup time, required)
  - a note
  - status (new, ready, collected or cancelled, new by default)
  Each order lists its order lines.
  The total is calculated as the total amount of its lines.
  At most the pickup time's places orders per pickup time (counting those with status new or ready or collected).

Order lines
  Order lines have:
  - an order (an order, required)
  - a product (a product, required)
  - a quantity (a whole number, required, 1 by default)
  - a unit price (an amount, required)
  The amount is calculated as the quantity times the unit price.

Ready
  For an order that is new; sets status to ready.
  Die Bestellung ist fertig zur Abholung.

Collected
  For an order that is ready; sets status to collected.
  Der Kunde hat die Bestellung abgeholt.

Cancel
  For an order that is new or ready; sets status to cancelled.
  Die Vorbestellung wird storniert.

Order confirmed
  When a order is added: mails email.

Order ready
  When “Ready” runs on a order: mails email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Nimmt Vorbestellungen an und pflegt Produkte und Abholzeiten): opens the orders page, the products page and the pickups page; adds orders, order lines, products and pickup times; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading products where available is yes, reading pickup times and adding orders.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,213 tokens (475 in, 1,738 out) · $0.0009
Pictures from the Smithable image library: samples/product-1.webp, samples/product-2.webp, samples/product-3.webp, samples/product-4.webp, samples/product-5.webp, samples/product-6.webp, hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-U76YjJ/app-22/smithable.yml:39:7  warning  Order has a capacity per pickup, but "pickup" is not unique: one person can take several places.
    hint: Write "pickup: PickupTime! unique" for one order per person and pickuptime (unique per owner with private access).
/tmp/smithable-bench-m12-U76YjJ/app-22/smithable.auth.yml:19:12  warning  Visitors may add Order records and type any address in email, so the app does not send "orderConfirmed" to it: a stranger could make the app mail anyone.
    hint: Mail the owner or a role instead, or take Order out of "create" under "public".
/tmp/smithable-bench-m12-U76YjJ/app-22/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habits
  Track your daily habits, check-ins and streaks.

Pages
  - Habits (lists habits)
  - Checkins (lists check ins)
  - Streaks (a page of your own (Streaks), written in code)

Habits
  Habits have:
  - a name (required)
  - notes
  - a frequency (daily or weekly, daily by default)
  - started on (a date, required, today by default)

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required, today by default)
  - done (yes or no, true by default)
  A check in is named after its habit and its date.
  No two check ins have the same habit and date for one owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,009 tokens (409 in, 1,600 out) · $0.0008
Pictures from the Smithable image library: logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Project Memory
  Tasks and notes, grouped by project, that my AI assistant keeps for me.

Pages
  - Projects (lists projects)
  - Tasks (lists tasks; “Complete”)
  - Notes (lists notes)

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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,195 tokens (445 in, 2,750 out) · $0.0014
Pictures from the Smithable image library: logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-U76YjJ/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-U76YjJ/app-24
  smithable studio

or only run the app with smithable run.
```
