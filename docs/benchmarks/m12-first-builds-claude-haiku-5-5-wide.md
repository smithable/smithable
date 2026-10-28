# M12 first builds: claude-haiku-5-5, the second set (2026-10-28)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 23 / 24 created, 22 type-check, 1,361,193 tokens (1,193,675 in, 167,518 out), $0.1015; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 52,062 | 7,476 | $0.0045 | 0 | – | 143 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 25,774 | 2,663 | $0.0017 | 0 | – | 88 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | barbers | yes | yes | 103,616 | 22,502 | $0.0128 | 0 | – | 186 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | yes | yes | 52,423 | 3,588 | $0.0026 | 0 | – | 86 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 52,871 | 9,652 | $0.0057 | 0 | – | 118 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 51,726 | 4,571 | $0.0031 | 0 | – | 229 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 25,310 | 2,945 | $0.0018 | 0 | – | 178 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 25,314 | 2,242 | $0.0014 | 0 | – | 181 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 50,546 | 2,598 | $0.0019 | 0 | – | 169 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 25,104 | 1,982 | $0.0013 | 0 | – | 158 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 26,250 | 4,421 | $0.0026 | 0 | – | 173 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 26,245 | 6,249 | $0.0035 | 0 | – | 178 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 25,096 | 2,541 | $0.0016 | 0 | – | 208 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 101,452 | 5,645 | $0.0042 | 0 | – | 205 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 25,105 | 1,708 | $0.0012 | 0 | – | 205 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 25,105 | 2,661 | $0.0016 | 0 | – | 243 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | barbers | yes | **no** | 130,269 | 22,622 | $0.0133 | 0 | – | 250 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 81,587 | 10,578 | $0.0068 | 0 | – | 212 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 51,045 | 4,073 | $0.0027 | 0 | – | 185 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 27,058 | 7,229 | $0.0041 | 0 | – | 199 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 25,748 | 5,084 | $0.0029 | 0 | – | 198 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | **no** | **no** | 133,481 | 31,104 | $0.0179 | 0 | – | 143 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 25,102 | 1,632 | $0.0011 | 0 | – | 86 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 25,386 | 1,752 | $0.0012 | 0 | – | 89 s |

Each created app's four spec files are in [m12-first-builds-claude-haiku-5-5-wide/](m12-first-builds-claude-haiku-5-5-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 23 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: booking) | 2 | 1 / 4 (has 3) | 2 / 7 (has 4) | 0 / 3 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm (words: invoicing) | 1 | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | barbers | 1 | 2 / 4 (has 4) | 4 / 7 (has 7) | 1 / 2 (has 1) | private; admin, customer (customer) | none | pages home, privacy; read Service, Stylist; create none | 3 (no-timezone, role-opens-nothing, operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | en | | | | |
| 4 | booking (words: status) | 0 | 0 / 6 (has 3) | 0 / 12 (has 3) | 0 / 1 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 5 | invoicing | 2 | 3 / 4 (has 4) | 3 / 7 (has 4) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 2 / 4 (has 3) | 1 / 7 (has 3) | 2 / 3 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace (words: booking) | 1 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: booking) | 1 | 1 / 1 (has 1) | 0 / 5 (has 2) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 1 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 1 | 0 / 1 (has 1) | 1 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages home, collection; read Artifact; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 1 | 2 / 4 (has 3) | 3 / 8 (has 4) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 12 | status (words: barbers) | 2 | 3 / 4 (has 3) | 5 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate; create none | 0 | none |  | none | 3 / 3 | no mention; landing page | en | | | | |
| 13 | records (words: barbers) | 0 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 2 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: invoicing) | 1 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | barbers (words: records) | 2 (sv: yes (kunderna, ett, för)) | 2 / 4 (has 3) | 2 / 7 (has 6) | 1 / 2 (has 1) | private; admin, member (member) | none | pages home, privacy; read Service, Stylist; create none | 1 (operator-unknown) | none |  | none | 1 / 3 | no mention; landing page | sv | no | yes (bokning, tid) | yes (boka, tid) | models 3/3, fields 13/13, pages 6/6 |
| 18 | invoicing (words: records) | 2 (sv: yes (ska, att, till)) | 2 / 4 (has 5) | 1 / 7 (has 4) | 0 / 3 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 5 | no mention; no landing page | sv | no | yes (fakturor, offerter, till) | none | models 5/5, fields 31/31, pages 4/4 |
| 19 | marketplace (words: records) | 2 (sv: yes (ska, lägga, saker)) | 1 / 1 (has 1) | 3 / 5 (has 4) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages home, catalog; read Item; create none | 0 | none |  | none | 1 / 1 | no mention; landing page | sv | yes (loppis) | yes (bilder, pris, till) | yes (loppis, och) | models 1/1, fields 6/6, pages 4/4 |
| 20 | booking (words: records) | 2 (fi: no) | 4 / 6 (has 4) | 7 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page | fi | no | yes (varaus) | no | models 4/4, fields 10/16, pages 6/7 |
| 21 | crm (words: records) | 2 (fi: no) | 1 / 2 (has 4) | 1 / 3 (has 5) | 0 / 1 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page | fi | yes (pieni, autokorjaamo) | none | none | models 0/4, fields 0/22, pages 0/5 |
| 23 | records (words: barbers) | 2 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | **no api block** | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 0 | 3 / 3 (has 3) | 0 / 2 (has 3) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Lingo Ledger
  Tracks a freelance translator's clients, the quotes sent to them and the payments received.

Pages
  - Jobs (lists jobs; filter by client or status)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments)
  - Overview (a dashboard: quoted, received and latest)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - notes
  Each client lists its jobs.

Jobs
  Jobs have:
  - a client (a client, required)
  - a title (required)
  - a source language (required)
  - a target language (required)
  - a quoted (an amount, required)
  - quoted on (a date, required, today by default)
  - status (quoted, accepted or delivered, quoted by default)
  Each job lists its payments.
  The paid is calculated as the total amount of its payments.
  The balance is calculated as the quoted minus the total amount of its payments.
  A job is named after its title.

Payments
  Payments have:
  - a job (a job, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a note

Accept
  For a job that is quoted; sets status to accepted.
  The client accepted the quote.

Deliver
  For a job that is accepted; sets status to delivered.
  The translation was delivered to the client.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,157 tokens (507 in, 2,650 out) · $0.0014
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Agency Pipeline
  Tracks the agency's leads, deals and who follows up with each lead, and when.

Pages
  - Leads (lists leads; search by name or company; filter by status or source)
  - Deals (lists deals; filter by stage or lead)
  - Follow ups (lists follow ups; filter by assignee or done)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Leads
  Leads have:
  - a name (required)
  - a company
  - an email
  - a phone
  - a source (referral, website, event or cold, referral by default)
  - status (new, contacted, qualified or lost, new by default)
  - notes
  Each lead can have an account manager (a user).
  Each lead lists its deals.
  Each lead lists its follow ups.
  The account manager owns the lead.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a value (an amount)
  - a stage (proposal, negotiation, won or lost, proposal by default)
  - a close date

Follow ups
  Follow ups have:
  - a lead (a lead, required)
  - due at (a date and time, required)
  - a note (required)
  - done (yes or no)
  Each follow up can have an assignee (a user).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,802 tokens (474 in, 2,328 out) · $0.0012
Pictures from the Smithable image library: logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Corner Salon
  Online booking for a hair salon, where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Bookings (lists bookings; only for admins)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Time off (lists time offs; only for admins)
  - Schedule (a calendar of bookings by week or month; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Services
  Services have:
  - a name (required)
  - minutes (a whole number, required, 30 by default)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  Each stylist lists its time offs.
  Stylists are booked by their time: Tue–Sat 09:00–18:00, a break 12:00–12:30, 10 minutes kept free after each booking, away during their time offs (by their fields from and until).

Time offs
  Time offs have:
  - a stylist (a stylist, required)
  - a date and time (from, required)
  - a date and time (until, required)
  - a note

Bookings
  Bookings have:
  - a service (a service, required)
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  - a name (required)
  - a phone
  - a note
  - status (booked or cancelled, booked by default, filled by the app)
  A booking takes its stylist's time from its starts at for the number of minutes in its service's minutes while status is booked; whoever made it may cancel it until 12 hours before.

Cancel
  For a booking that is booked; sets status to cancelled.
  Cancel a booking.

Booking made
  When a booking is added: mails its owner.

Booking received
  When a booking is added: mails every admin.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - customer (Books appointments with a stylist): adds bookings; runs “Cancel”
  New users get the customer role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading stylists.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,076 tokens (449 in, 1,627 out) · $0.0009
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KMclTb/app-3/smithable.yml:83:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-KMclTb/app-3/smithable.auth.yml:7:3  warning  customer can open no page: a role opens only the pages its "pages" lists.
    hint: Add "pages: all" (or a list of pages) under roles.customer in smithable.auth.yml.
/tmp/smithable-bench-m12-KMclTb/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's record of pupils, their weekly lesson times and the pieces each one practises.

Pages
  - Pupils (lists pupils)
  - Lessons (lists lessons; filter by day or pupil)
  - Pieces (lists pieces; filter by status or pupil)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - notes
  Each pupil lists its lessons.
  Each pupil lists its pieces.

Lessons
  Lessons have:
  - a pupil (a pupil, required)
  - a day (mon, tue, wed, thu, fri, sat or sun, mon by default)
  - a time (required)
  - minutes (a whole number, required, 30 by default)
  A lesson is named after its pupil, its day and its time.

Pieces
  Pieces have:
  - a title (required)
  - a composer
  - status (to learn, practising or learned, to learn by default)
  - a pupil (a pupil, required)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,775 tokens (514 in, 2,261 out) · $0.0012
Pictures from the Smithable image library: logo.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Shutter Ledger
  Invoices for a photographer's clients and shoots, with a view of what is still unpaid.

Pages
  - Clients (lists clients)
  - Shoots (lists shoots)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Overview (a dashboard: unpaid, overdue and latest)

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
  - shot on (a date, required, today by default)
  - a location
  - notes

Invoice lines
  Invoice lines have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an invoice (an invoice, required)
  The amount is calculated as the quantity times the unit price.

Invoices
  Invoices have:
  - a number (required, unique, fixed when status is sent or paid or overdue)
  - a client (a client, required, fixed when status is sent or paid or overdue)
  - a shoot (a shoot)
  - issued on (a date, required, today by default, fixed when status is sent or paid or overdue)
  - status (draft, sent, paid or overdue, draft by default)
  The due on is calculated as the issued on plus 30 days.
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

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
Frontier model (claude-haiku-5-5) · 6,423 tokens (562 in, 5,861 out) · $0.0030
Pictures from the Smithable image library: logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Clean Invoices
  One place for the cleaning company's monthly invoices to its household clients.

Pages
  - Invoices (lists invoices; search by number; filter by status or household; “Duplicate”)
  - Households (lists households)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Households
  Households have:
  - a name (required)
  - an email (required)
  - address
  Each household lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a household (a household, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent or paid, draft by default)
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
  The invoice was sent to the household.

Mark paid
  For an invoice that is sent; sets status to paid.
  The household paid the invoice.

Duplicate
  Makes a copy of an invoice with status draft and issued on today, asking for the number.
  Make next month's invoice from this one.

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
Frontier model (claude-haiku-5-5) · 4,222 tokens (493 in, 3,729 out) · $0.0019
Pictures from the Smithable image library: logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-6
  smithable studio

or only run the app with smithable run.
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  A town flea market where anyone can post things to sell, with photos and a price.

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
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items where available is yes.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,703 tokens (407 in, 1,296 out) · $0.0007
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KMclTb/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need on the office shelf, and others claim them.

Pages
  - Shelf (lists items; search by title or description; filter by status or condition; “Claim”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - a description
  - a photo (picture)
  - a condition (like new, good or worn, like new by default)
  - status (offered or claimed, offered by default)
  Each item can have a claimed by (a user).

Claim
  For an item that is offered; sets status to claimed and claimed by to whoever presses it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,242 tokens (386 in, 856 out) · $0.0005
Pictures from the Smithable image library: logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-8
  smithable studio

or only run the app with smithable run.
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Vinyl Collection
  A personal catalogue of my vinyl records, with artists, condition and what I paid for each.

Pages
  - Artists (lists artists)
  - Albums (lists albums; search by title; filter by condition or artist; sort by title, year, price paid or purchased on)

Artists
  Artists have:
  - a name (required)
  - a country

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number, required)
  - a condition (mint, near mint, very good, good, fair or poor, mint by default)
  - a price paid (an amount)
  - purchased on (a date)
  - a cover (picture)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,216 tokens (448 in, 1,768 out) · $0.0009
Pictures from the Smithable image library: logo.webp.
Generated 119 files (119 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  An online collection where visitors browse the museum's objects and read their stories.

Pages
  - Home (a landing page: hero, artifacts where featured is yes and footer)
  - Collection (lists artifacts; search by name or period)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Artifacts
  Artifacts have:
  - a name (required)
  - a period
  - an origin
  - a story (formatted text)
  - a photo (picture)
  - featured (yes or no)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Looks at the collection): opens every page
  New users get the member role.
  Open to anyone without signing in: the home page, the collection page and reading artifacts.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,823 tokens (375 in, 1,448 out) · $0.0008
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KMclTb/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
Status Board
  A live board of our IT systems: what is down, what is being fixed, and when it is back.

Pages
  - Services (lists services)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Overview (a dashboard: open incidents)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Services
  Services have:
  - a name (required, unique)
  - status (operational, degraded or down, operational by default)
  - a description
  Each service lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a service (a service, required)
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
  - staff (Works the incidents: opens them, posts updates and moves them on): opens the services page, the incidents page and the overview page; adds every kind of record; changes everyone's records; runs “Identified”, “Monitoring” and “Resolve”
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,322 tokens (523 in, 3,799 out) · $0.0020
Pictures from the Smithable image library: logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Service Status
  Shows which of the municipality's online services work right now, what is being fixed, and what happened before.

Pages
  - Service status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status)
  - Components (lists components; only for admins; visitors see components on the Service status page)
  - Overview (a dashboard: open, per month and latest)
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
  - admin: everything
  - staff (Writes incidents and their updates): opens the overview page and the incidents page; adds incidents and incident updates; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,847 tokens (520 in, 4,327 out) · $0.0022
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-12
  smithable studio

or only run the app with smithable run.
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuel fills; filter by car)
  - Services (lists service visits; filter by car or kind)
  - Cars (lists cars)

Cars
  Cars have:
  - a name (required)
  - a make
  - a model
  - a year (a whole number)
  - a plate

Fuel fills
  Fuel fills have:
  - a car (a car, required)
  - a date (required, today by default)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a price per liter (a number, required)
  - full tank (yes or no, true by default)
  - a station
  The total is calculated as the liters times the price per liter.
  A fuel fill is named after its car's name and its date.

Service visits
  Service visits have:
  - a car (a car, required)
  - a date (required, today by default)
  - an odometer (a whole number)
  - a kind (service, repair, inspection or tyres, service by default)
  - a garage
  - a cost (an amount, required)
  - notes
  A service visit is named after its car's name and its date.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,299 tokens (510 in, 3,789 out) · $0.0019
Pictures from the Smithable image library: logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Our Wedding
  The guest list and seating plan for our wedding, with who has answered and their meal choices.

Pages
  - Tables (lists tables)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Guests (lists guests; search by name or email; filter by status, meal, side or table)

Tables
  Tables have:
  - a name (required)
  - seats (a whole number, required, 8 by default)

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - a side (bride, groom or both, bride by default)
  - status (invited, attending or declined, invited by default)
  - a meal (pending, beef, fish, vegetarian or vegan, pending by default)
  - plus one (yes or no)
  - dietary notes
  - a table (a table, required when status is invited or attending or declined)

Accept
  For a guest that is invited or declined; sets status to attending.

Decline
  For a guest that is invited or attending; sets status to declined.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,040 tokens (470 in, 1,570 out) · $0.0008
Pictures from the Smithable image library: logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Birdwatching Club Sightings
  A shared log of the birds the club sees: species, place, date and who saw them.

Pages
  - Sightings (lists sightings; search by place or notes; filter by species or seen on)
  - Species (lists specieses)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Specieses
  Specieses have:
  - a name (required, unique)
  - a latin name

Sightings
  Sightings have:
  - species (a species, required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a count (a whole number, required, 1 by default)
  - notes
  Each sighting can have an observer (a user, who makes it, by default, filled by the app).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,046 tokens (421 in, 1,625 out) · $0.0009
Pictures from the Smithable image library: logo.webp.
Generated 119 files (119 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of which member holds which plot, the waiting list and each year's fee.

Pages
  - Plots (lists plots)
  - Members (lists members; search by name or email)
  - Fees (lists fees; filter by status)
  - Waiting (lists waiting entries)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - joined on (a date, required, today by default)

Plots
  Plots have:
  - a number (required, unique)
  - a holder (a member)
  - notes

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (unpaid or paid, unpaid by default)

Waiting entries
  Waiting entries have:
  - a name (required)
  - an email
  - a phone
  - requested on (a date, required, today by default)
  - status (waiting, allocated or withdrawn, waiting by default)
  - notes

Mark paid
  For a fee that is unpaid; sets status to paid.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,947 tokens (540 in, 3,407 out) · $0.0018
Pictures from the Smithable image library: logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Frisörbokning
  Kunderna bokar tid hos frisörerna i salongen själva på nätet.

Pages
  - Boka tid (a landing page: hero, “Tjänster”, “Frisörer” and footer)
  - Bokningar (lists “Bokningar”; “Confirm”)
  - Tjänster (lists “Tjänster”; only for admins; visitors see “Tjänster” on the Boka tid page)
  - Frisörer (lists “Frisörer”; only for admins; visitors see “Frisörer” on the Boka tid page)
  - Schema (a calendar of appointments by week or month; only for admins)
  - Integritetspolicy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tjänster
  Tjänster have:
  - a field “Namn” (required)
  - a field “Beskrivning”
  - a field “Minuter” (a whole number, required, 30 by default)
  - a field “Pris” (an amount)

Frisörer
  Frisörer have:
  - a field “Namn” (required)
  - a field “Presentation”
  “Frisörer” are booked by their time: Mon–Fri 09:00–17:00, Sat 10:00–14:00, 10 minutes kept free after each booking.

Bokningar
  Bokningar have:
  - a field “Tjänst” (a “Tjänst”, required)
  - a field “Frisör” (a “Frisör”, required)
  - a field “Tid” (a date and time, required)
  - a field “Ditt namn” (required)
  - a field “Telefon” (a phone number, required)
  - a field “Meddelande”
  - a field “Status” (“Väntar”, “Bekräftad” or “Avbokad”, “Väntar” by default, filled by the app)
  A “Bokning” takes its “Frisör”'s time from its “Tid” for the number of minutes in its “Tjänst”'s minutes while status is requested or confirmed; whoever made it may cancel it until 12 hours before.

Confirm
  For a “Bokning” that is “Väntar”; sets “Status” to “Bekräftad”.

Appointment made
  When a “Bokning” is added: mails its owner.

Appointment requested
  When a “Bokning” is added: mails every admin.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Salongen. Har tjänsterna, frisörerna och schemat och bekräftar bokningar): everything
  - member (Kund som bokar tid): opens the bokningar page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading stylists.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,037 tokens (472 in, 1,565 out) · $0.0008
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-17. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-17
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KMclTb/app-17/smithable.content.yml:50:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkoll
  Håller koll på offerter, kunder och fakturor för en liten byggfirma.

Pages
  - Offerter (lists “Offerter”; filter by “Status” or “Kund”; “Mark quote sent”; “Mark quote accepted”)
  - Kunder (lists “Kunder”; search by “Namn”)
  - Fakturor (lists “Fakturor”; filter by “Status” or “Kund”; “Mark invoice sent”; “Mark invoice paid”)
  - Medarbetare (who has access: invite people, change roles, remove users; only for admins)

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
  - a field “Nummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Datum” (a date, required, today by default)
  - a field “Giltig till” (a date)
  - a field “Status” (“Utkast”, “Skickad”, “Accepterad” or “Avvisad”, “Utkast” by default)
  - a field “Arbete”
  Each “Offert” lists its “Offertrader”.
  The “Summa” is calculated as the total “Belopp” of its “Rader”.

Offertrader
  Offertrader have:
  - a field “Offert” (a “Offert”, required)
  - a field “Beskrivning” (required)
  - a field “Antal” (a number, required, 1 by default)
  - a field “Á-pris” (an amount, required)
  The “Belopp” is calculated as the “Antal” times the “Á-pris”.

Fakturarader
  Fakturarader have:
  - a field “Beskrivning” (required)
  - a field “Antal” (a number, required, 1 by default)
  - a field “Á-pris” (an amount, required)
  - a field “Faktura” (a “Faktura”, required)
  The “Belopp” is calculated as the “Antal” times the “Á-pris”.

Fakturor
  Fakturor have:
  - a field “Nummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Fakturadatum” (a date, required, today by default)
  - a field “Status” (“Utkast”, “Skickad”, “Betald” or “Förfallen”, “Utkast” by default)
  The “Förfallodatum” is calculated as the “Fakturadatum” plus 30 days.
  Each “Faktura” lists its “Fakturarader”.
  The “Summa” is calculated as the total “Belopp” of its “Rader”.

Mark quote sent
  For a “Offert” that is “Utkast”; sets “Status” to “Skickad”.
  Offerten har skickats till kunden.

Mark quote accepted
  For a “Offert” that is “Skickad”; sets “Status” to “Accepterad”.
  Kunden har accepterat offerten.

Mark invoice sent
  For a “Faktura” that is “Utkast”; sets “Status” to “Skickad”.
  Fakturan har skickats till kunden.

Mark invoice paid
  For a “Faktura” that is “Skickad” or “Förfallen”; sets “Status” to “Betald”.
  Kunden har betalat fakturan.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; runs “Mark quote sent”, “Mark quote accepted”, “Mark invoice sent” and “Mark invoice paid”
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,996 tokens (863 in, 4,133 out) · $0.0022
Pictures from the Smithable image library: logo.webp.
Generated 140 files (140 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-18. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-18
  smithable studio

or only run the app with smithable run.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppis
  En loppis där folk lägger upp saker de vill sälja, med bilder och pris.

Pages
  - Loppis (lists “Saker”; search by “Titel” or “Beskrivning”; filter by “Skick”, “Pris” or “Till salu”; sort by “Pris” or date added; contact the owner by mail)
  - Mina saker (lists “Saker”; only the viewer's own records)
  - Loppis (a landing page: hero and footer)
  - Medlemmar (who has access: invite people, change roles, remove users; only for admins)

Saker
  Saker have:
  - a field “Titel” (required)
  - a field “Bilder” (pictures, required)
  - a field “Beskrivning”
  - a field “Pris” (an amount)
  - a field “Skick” (“Som ny”, “Bra” or “Sliten”, “Som ny” by default)
  - a field “Till salu” (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,542 tokens (441 in, 1,101 out) · $0.0006
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-19
  smithable studio

or only run the app with smithable run.
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Joogastudion tuntien selaus ja varaus verkossa.

Pages
  - Home (a landing page: hero, tuntityypit and footer)
  - Tuntikalenteri (a calendar of sessions by week or month)
  - Tunnit (lists tunnit; filter by tuntityyppi, ohjaaja or alkaa; only for admins)
  - Tuntityypit (lists tuntityypit; only for admins; visitors see tuntityypit on the Home page)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Omat varaukset (lists varaukset)
  - Tietosuoja (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (kaikki tasot, aloittelija or edistynyt, kaikki tasot by default)
  - a kesto minuutteina (a whole number, required, 60 by default)
  Each tuntityyppi lists its tunnit.

Ohjaajat
  Ohjaajat have:
  - a name (required)
  - a bio (formatted text)
  Each ohjaaja lists its tunnit.

Tunnit
  Tunnit have:
  - a tuntityyppi (a tuntityyppi, required)
  - an ohjaaja (an ohjaaja, required)
  - an alkaa (a date and time, required)
  - a paikkoja (a whole number, required, 12 by default)
  Each tunti lists its varaukset.
  The places left is calculated as the paikkoja minus the number of its bookings.
  A tunti is named after its tuntityyppi and its alkaa.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  Each varaus can have an osallistuja (a user).
  The osallistuja owns the varaus.
  At most the session's capacity varaukset per session.
  A varaus is added until the session's alkaa.
  Its owner deletes it until 2 hours before the session's alkaa.
  A varaus is named after its tunti.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Joogaaja, joka varaa tunteja): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,364 tokens (598 in, 2,766 out) · $0.0014
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KMclTb/app-20/smithable.content.yml:43:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pieni autokorjaamo
  Asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa pienelle autokorjaamolle.

Pages
  - Asiakkaat (lists customers)
  - Autot (lists cars)
  - Huoltotyot (lists jobs; “Finish job”)
  - Laskut (lists invoices; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Customers
  Customers have:
  - a name (required)
  - an email
  - a phone
  - notes
  Each customer lists its cars.

Cars
  Cars have:
  - a registration (required, unique)
  - a make
  - a model
  - a year (a whole number)
  - a mileage (a whole number)
  - a customer (a customer, required)

Jobs
  Jobs have:
  - a car (a car, required)
  - a description (required)
  - status (planned, in progress or done, planned by default)
  - a price (an amount)
  - started at (a date)
  - an invoice (an invoice)

Invoices
  Invoices have:
  - a number (required, unique)
  - a customer (a customer, required)
  - status (draft, sent or paid, draft by default)
  - a total (an amount, required)
  - a due date

Finish job
  For a job that is planned or in progress; sets status to done.

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
Frontier model (claude-haiku-5-5) · 6,431 tokens (599 in, 5,832 out) · $0.0030
Pictures from the Smithable image library: logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

Failed:

```text
Starting from the kiosk starter.
Frontier model (claude-haiku-5-5) · 164,585 tokens (133,481 in, 31,104 out) · $0.0179
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 1305 (line 9 column 205)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-KMclTb/app-22 --starter kiosk

```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker
  A backend for tracking daily habits, with check-ins and streaks.

Pages
  - Habits (lists habits; search by name or goal; filter by frequency)
  - Checkins (lists check ins; filter by habit, done or day)

Habits
  Habits have:
  - a name (required)
  - a goal
  - a frequency (daily, weekdays or weekly, daily by default)
  - started on (a date, required, today by default)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a day (a date, required, today by default)
  - done (yes or no, true by default)
  - a note
  A check in is named after its habit and its day.
  No two check ins have the same habit and day for one owner.

Streaks
  Habits ordered by their current streak of consecutive check-ins, longest first. (habits)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,829 tokens (427 in, 1,402 out) · $0.0007
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Tasks and Notes
  Tasks and notes, grouped by project, that my AI assistant keeps for me.

Pages
  - Projects (lists projects)
  - Tasks (lists tasks; “Complete”; “Reopen”)
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
Frontier model (claude-haiku-5-5) · 3,144 tokens (448 in, 2,696 out) · $0.0014
Pictures from the Smithable image library: logo.webp.
Generated 127 files (127 changed, 0 removed).

Created /tmp/smithable-bench-m12-KMclTb/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KMclTb/app-24
  smithable studio

or only run the app with smithable run.
```
