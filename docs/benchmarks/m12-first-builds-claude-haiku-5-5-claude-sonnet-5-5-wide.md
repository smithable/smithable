# M12 first builds: claude-haiku-5-5>claude-sonnet-5-5, the second set (2026-10-28)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 24 / 24 created, 24 type-check, 830,014 tokens (771,490 in, 58,524 out), $1.1442; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 51,617 | 1,721 | $0.0323 | 0 | – | 104 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 25,774 | 2,132 | $0.0288 | 0 | – | 91 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | barbers | yes | yes | 25,904 | 3,132 | $0.0391 | 0 | – | 91 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 25,107 | 1,315 | $0.0193 | 0 | – | 68 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 52,316 | 3,917 | $0.0557 | 0 | – | 108 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 52,242 | 3,435 | $0.0507 | 0 | – | 86 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 25,310 | 2,155 | $0.0281 | 0 | – | 86 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 25,314 | 1,098 | $0.0176 | 0 | – | 78 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 25,102 | 957 | $0.0157 | 0 | – | 65 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 25,104 | 657 | $0.0127 | 0 | – | 65 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 26,250 | 2,455 | $0.0330 | 0 | – | 90 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 26,245 | 3,438 | $0.0428 | 0 | – | 240 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 25,096 | 1,351 | $0.0196 | 0 | – | 184 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 25,106 | 1,109 | $0.0172 | 0 | – | 208 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 25,105 | 797 | $0.0141 | 0 | – | 198 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 25,105 | 2,044 | $0.0266 | 0 | – | 222 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | barbers | yes | yes | 25,956 | 3,783 | $0.0457 | 0 | – | 232 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 79,436 | 4,469 | $0.0714 | 0 | – | 496 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 25,368 | 2,573 | $0.0887 | 0 | – | 451 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 27,058 | 4,644 | $0.1128 | 0 | – | 395 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | records | yes | yes | 25,081 | 3,238 | $0.0948 | 0 | – | 414 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | yes | yes | 25,971 | 4,969 | $0.1139 | 0 | – | 360 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 50,537 | 1,792 | $0.0872 | 0 | – | 355 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 25,386 | 1,343 | $0.0764 | 0 | – | 247 s |

Each created app's four spec files are in [m12-first-builds-claude-haiku-5-5-claude-sonnet-5-5-wide/](m12-first-builds-claude-haiku-5-5-claude-sonnet-5-5-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 24 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: booking) | 2 | 1 / 4 (has 3) | 1 / 7 (has 3) | 1 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm (words: invoicing) | 0 | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | barbers | 3 | 3 / 4 (has 4) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read Service, Stylist; create none | 2 (no-timezone, operator-unknown) | none |  | Haircut | 1 / 4 | no mention; landing page | en | | | | |
| 4 | records (words: status) | 1 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 1 | 3 / 4 (has 4) | 4 / 7 (has 5) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 1 | 3 / 4 (has 3) | 3 / 7 (has 4) | 3 / 3 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace (words: booking) | 1 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: booking) | 2 | 1 / 1 (has 1) | 1 / 5 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 1 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 1 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, objects, privacy; read Object; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 2 | 4 / 4 (has 4) | 6 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status (words: barbers) | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: barbers) | 0 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: invoicing) | 1 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | barbers (words: records) | 2 (sv: yes (ska, kunderna, ett)) | 4 / 4 (has 4) | 7 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read Service, Barber; create none | 1 (operator-unknown) | none |  | none | 2 / 4 | no mention; landing page | sv | no | yes (till, bokning, tid) | yes (boka, tid, och) | models 4/4, fields 19/19, pages 7/7 |
| 18 | invoicing (words: records) | 2 (sv: yes (ska, det, att)) | 1 / 4 (has 3) | 1 / 7 (has 4) | 2 / 3 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | sv | no | yes (offerter, fakturor, till) | none | models 3/3, fields 21/21, pages 4/4 |
| 19 | marketplace (words: records) | 2 (sv: yes (ska, lägga, saker)) | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | no mention; landing page | sv | no | yes (bilder, pris) | yes (till, det, med) | models 1/1, fields 8/8, pages 6/6 |
| 20 | booking (words: records) | 2 (fi: yes (ja)) | 4 / 6 (has 4) | 7 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page | fi | yes (varaukset) | none | no | models 0/4, fields 0/17, pages 0/7 |
| 21 | records | 1 (fi: no) | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | fi | no | none | none | models 0/4, fields 0/28, pages 0/5 |
| 22 | kiosk (words: records) | 2 (de: yes (die)) | 2 / 4 (has 4) | 2 / 6 (has 6) | 6 / 6 (has 6) | shared; admin, staff (staff) | none | pages abholung, privacy; read Product, PickupSlot; create Order | 1 (operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | de | yes (hofladen) | none | no | models 0/4, fields 0/25, pages 0/6 |
| 23 | records (words: barbers) | 2 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 0 | 3 / 3 (has 3) | 2 / 2 (has 2) | 2 / 2 (has 2) | shared; admin, member, assistant (member) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Client Ledger
  Keep track of my translation clients, the quotes I gave them and what they have paid.

Pages
  - Clients (lists clients; search by name or email)
  - Quotes (lists quotes; filter by client or status; “Mark sent”; “Accept”; “Decline”)
  - Payments (lists payments)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - a country
  - notes
  Each client lists its quotes.

Quotes
  Quotes have:
  - a title (required)
  - a client (a client, required)
  - a source language
  - a target language
  - a word count (a whole number)
  - an amount (an amount, required)
  - quoted on (a date, required, today by default)
  - status (draft, sent, accepted or declined, draft by default)
  Each quote lists its payments.

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, cash or other, bank transfer by default)

Mark sent
  For a quote that is draft; sets status to sent.
  The quote went to the client.

Accept
  For a quote that is sent; sets status to accepted.
  The client accepted the quote.

Decline
  For a quote that is sent; sets status to declined.
  The client declined the quote.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,732 tokens (528 in, 3,204 out) · $0.0017
Pictures from the Smithable image library: logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Pipeline
  A sales pipeline for a small web agency: leads, deals and who follows up when.

Pages
  - Leads (lists leads; search by name, company or email; filter by status or source)
  - Deals (lists deals; search by title; filter by stage; “Win”; “Lose”)
  - Follow ups (lists follow ups; filter by status, assignee or due at; “Complete”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Leads
  Leads have:
  - a name (required)
  - a company
  - an email
  - a phone
  - a source (referral, website, outreach or event, referral by default)
  - status (new, contacted, qualified or lost, new by default)
  - notes
  Each lead lists its deals.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a stage (qualifying, proposal, negotiation, won or lost, qualifying by default)
  - a value (an amount)
  - an expected close (a date)
  - notes

Follow ups
  Follow ups have:
  - a lead (a lead, required)
  - a deal (a deal)
  - due at (a date, required)
  - status (open or done, open by default)
  - a note
  Each follow up can have an assignee (a user).
  The assignee owns the follow up.

Win
  For a deal that is qualifying, proposal or negotiation; sets stage to won.

Lose
  For a deal that is qualifying, proposal or negotiation; sets stage to lost.

Complete
  For a follow up that is open; sets status to done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,848 tokens (483 in, 2,365 out) · $0.0012
Pictures from the Smithable image library: logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Salon Booking
  Online booking for a hair salon, where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Appointments (lists appointments; filter by status)
  - Day (a calendar of appointments by week or month; only for admins)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Time off (lists time offs; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Services
  Services have:
  - a name (required)
  - a summary
  - minutes (a whole number, required, 45 by default)
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
  - admin: everything
  - member (A customer who books appointments): opens the appointments page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading stylists.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,672 tokens (458 in, 2,214 out) · $0.0012
Pictures from the Smithable image library: samples/stylist-1.webp, hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ZV1xxA/app-3/smithable.yml:79:14  warning  Page "day" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-ZV1xxA/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's pupils, their weekly lesson times and what each one is practising.

Pages
  - Pupils (lists pupils; search by name or email; filter by weekday or active)
  - Practice (lists practice items; search by piece or composer; filter by pupil or status)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - a weekday (monday, tuesday, wednesday, thursday, friday or saturday, monday by default)
  - a lesson time
  - a lesson length (minutes) (a whole number, 30 by default)
  - started on (a date, today by default)
  - active (yes or no, true by default)
  - notes
  Each pupil lists its practice items.

Practice items
  Practice items have:
  - a pupil (a pupil, required)
  - a piece (required)
  - a composer
  - focus
  - status (learning, polishing or performed, learning by default)
  - started on (a date, today by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,565 tokens (529 in, 3,036 out) · $0.0016
Pictures from the Smithable image library: logo.webp.
Generated 113 files (113 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Shutter Invoices
  Invoicing for a photography business: clients, shoots and what is still unpaid.

Pages
  - Clients (lists clients)
  - Shoots (lists shoots)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Overview (a dashboard: unpaid, overdue, paid and latest)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - a phone
  - address

Shoots
  Shoots have:
  - a title (required)
  - a client (a client, required)
  - shot on (a date, required, today by default)
  - a location
  - a kind (wedding, portrait, family, event, commercial or other, wedding by default)
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
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
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

Late
  A day after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 6,470 tokens (593 in, 5,877 out) · $0.0030
Pictures from the Smithable image library: logo.webp.
Generated 137 files (137 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Tidy Books
  Monthly invoicing for a small cleaning company, with its household clients and invoices in one shared place.

Pages
  - Clients (lists clients)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - a phone
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
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

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

Overdue check
  When an invoice's due on comes, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,214 tokens (512 in, 2,702 out) · $0.0014
Pictures from the Smithable image library: logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-6
  smithable studio

or only run the app with smithable run.
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Post things you want to sell, with photos and a price, and browse what your neighbors are selling.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, items, features and footer)
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
  - member (Sells and saves items): opens the catalog page, the my items page and the saved page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,650 tokens (413 in, 1,237 out) · $0.0007
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ZV1xxA/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  A shelf for our office where colleagues offer things they no longer need and others claim them.

Pages
  - Shelf (lists items; search by title or description; filter by category, condition or status)
  - My items (lists items; only the viewer's own records)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - a description
  - a photo (picture)
  - a category (furniture, books, electronics, kitchen, clothing or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a pickup spot
  - status (available or claimed, available by default)
  Each item can have a claimed by (a user, filled by the app).

Claim
  For an item that is available; sets status to claimed and claimed by to whoever presses it.
  A colleague claims an offered item.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; runs “Claim”
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,507 tokens (419 in, 1,088 out) · $0.0006
Pictures from the Smithable image library: logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-8
  smithable studio

or only run the app with smithable run.
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Vinyl Shelf
  A personal catalogue of my vinyl records: albums, artists, condition and what I paid.

Pages
  - Albums (lists albums; search by title or label; filter by artist or condition)
  - Artists (lists artists; search by name or country)

Artists
  Artists have:
  - a name (required, unique)
  - a country
  - notes

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number)
  - a label
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
Frontier model (claude-haiku-5-5) · 2,844 tokens (459 in, 2,385 out) · $0.0012
Pictures from the Smithable image library: logo.webp.
Generated 119 files (119 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  The local museum's collection online, where visitors can browse the objects and read their stories.

Pages
  - Home (a landing page: hero, objects, features and footer)
  - Objects (lists objects; search by name, summary, period or origin; filter by category or on display)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Objects
  Objects have:
  - a name (required)
  - an inventory number (unique)
  - a summary
  - a story (formatted text)
  - a category (art, tool, clothing, photograph, document or other, art by default)
  - a period
  - an origin
  - a donated by
  - photos (pictures)
  - on display (yes or no, true by default)
  - acquired on (a date)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Looks at the collection): only their own records
  New users get the member role.
  Open to anyone without signing in: the home page, the objects page, the privacy page and reading objects.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,767 tokens (431 in, 2,336 out) · $0.0012
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ZV1xxA/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  What is down in our IT systems right now, and when it will be back.

Pages
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components)
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
  - expected back at (a date and time)
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
  The incident is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents, their updates and planned maintenance): opens the overview page, the components page, the incidents page, the updates page and the maintenance page; adds incidents, incident updates and maintenances; changes everyone's incidents, incident updates and maintenances
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,592 tokens (590 in, 4,002 out) · $0.0021
Pictures from the Smithable image library: logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  The current state of the municipality's online services, so residents can check for outages.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Overview (a dashboard: open, per month and latest)
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
  The incident is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 6,379 tokens (577 in, 5,802 out) · $0.0030
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 144 files (144 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ZV1xxA/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuel ups)
  - Service (lists service visits; search by workshop or description; filter by kind)
  - Expenses (lists expenses; filter by category)

Fuel ups
  Fuel ups have:
  - filled on (a date, required, today by default)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a price per liter (an amount, required)
  - full tank (yes or no, true by default)
  - a station
  - a note
  The total cost is calculated as the liters times the price per liter.

Service visits
  Service visits have:
  - visited on (a date, required, today by default)
  - an odometer (a whole number)
  - a kind (maintenance, repair, inspection, tires or other, maintenance by default)
  - a workshop
  - a description
  - a cost (an amount)

Expenses
  Expenses have:
  - spent on (a date, required, today by default)
  - a category (insurance, tax, parking, tolls, cleaning or other, insurance by default)
  - an amount (an amount, required)
  - a note

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,606 tokens (528 in, 2,078 out) · $0.0011
Pictures from the Smithable image library: logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  The guest list and seating plan for our wedding, with who has replied and what they will eat.

Pages
  - Guests (lists guests; search by name, email or dietary notes; filter by rsvp, meal, side or table)
  - Tables (lists tables; search by name or location)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tables
  Tables have:
  - a name (required)
  - seats (a whole number, required, 8 by default)
  - a location
  Each table lists its guests.

Guests
  Guests have:
  - a name (required)
  - an email
  - a phone
  - a side (both, bride or groom, both by default)
  - a rsvp (pending, attending or declined, pending by default)
  - a meal (undecided, beef, fish, vegetarian or vegan, undecided by default)
  - dietary notes
  - a table (a table)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,265 tokens (472 in, 1,793 out) · $0.0009
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Club Sightings
  A shared log of the birds our birdwatching club has spotted, with species, place, date and who saw them.

Pages
  - Sightings (lists sightings; search by species or place; filter by seen on or observer)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a count (a whole number, 1 by default)
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
Frontier model (claude-haiku-5-5) · 1,433 tokens (387 in, 1,046 out) · $0.0006
Pictures from the Smithable image library: logo.webp.
Generated 113 files (113 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of who holds which plot, the waiting list and each year's membership fee.

Pages
  - Plots (lists plots; search by number or location)
  - Members (lists members; search by name, email or phone; filter by status)
  - Waiting list (lists waiting list entries; search by name or email; filter by status; “Offer plot”; “Mark allocated”)
  - Fees (lists fees; filter by status, year or member; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - address
  - joined on (a date, required, today by default)
  - status (active or resigned, active by default)
  - notes

Plots
  Plots have:
  - a number (required, unique)
  - a size sqm (a whole number)
  - a location
  - a holder (a member)
  - a holder since (a date)
  - has water (yes or no)
  - notes

Waiting list entries
  Waiting list entries have:
  - a name (required)
  - an email
  - a phone
  - applied on (a date, required, today by default)
  - status (waiting, offered, allocated or withdrawn, waiting by default)
  - preferences

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - due on (a date)
  - status (unpaid or paid, unpaid by default)
  - paid on (a date)
  No two fees have the same member and year in the whole app.

Mark paid
  For a fee that is unpaid; sets status to paid and paid on to today.

Offer plot
  For a waiting list entry that is waiting; sets status to offered.

Mark allocated
  For a waiting list entry that is offered; sets status to allocated.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 6,668 tokens (608 in, 6,060 out) · $0.0031
Pictures from the Smithable image library: logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Frisörsalongen
  Kunderna bokar tid hos salongens frisörer på nätet, efter frisörens lediga tid.

Pages
  - Hem (a landing page: hero, “Behandlingar”, “Frisörer” and footer)
  - Bokningar (lists “Bokningar”; filter by “Status”)
  - Dagen (a calendar of appointments by week or month; only for admins)
  - Behandlingar (lists “Behandlingar”; only for admins; visitors see “Behandlingar” on the Hem page)
  - Frisörer (lists “Frisörer”; only for admins; visitors see “Frisörer” on the Hem page)
  - Ledigheter (lists “Ledigheter”; only for admins)
  - Integritet (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Behandlingar
  Behandlingar have:
  - a field “Namn” (required)
  - a field “Beskrivning”
  - a field “Minuter” (a whole number, required, 30 by default)
  - a field “Pris” (an amount)

Frisörer
  Frisörer have:
  - a field “Namn” (required)
  - a field “Presentation”
  - a field “Porträtt” (picture)
  Each “Frisör” lists its “Ledigheter”.
  “Frisörer” are booked by their time: Mon–Fri 09:00–17:00, Sat 10:00–14:00, a break 12:00–12:30, 10 minutes kept free after each booking, away during their “Ledigheter” (by their fields from and until).

Ledigheter
  Ledigheter have:
  - a field “Frisör” (a “Frisör”, required)
  - a field “Från” (a date and time, required)
  - a field “Till” (a date and time, required)
  - a field “Anteckning”

Bokningar
  Bokningar have:
  - a field “Behandling” (a “Behandling”, required)
  - a field “Frisör” (a “Frisör”, required)
  - a field “Tid” (a date and time, required)
  - a field “Namn” (required)
  - a field “Telefon” (a phone number)
  - a field “Meddelande”
  - a field “Status” (“Förfrågan”, “Bekräftad” or “Avbokad”, “Förfrågan” by default, filled by the app)
  A “Bokning” takes its “Frisör”'s time from its “Tid” for the number of minutes in its “Behandling”'s minutes while status is requested or confirmed; whoever made it may cancel it until 12 hours before.

Confirm
  For a “Bokning” that is “Förfrågan”; sets “Status” to “Bekräftad”.

Cancel
  For a “Bokning” that is “Förfrågan” or “Bekräftad”; sets “Status” to “Avbokad”.

Appointment requested
  When a “Bokning” is added: mails every admin.

Appointment made
  When a “Bokning” is added: mails its owner.

Appointment confirmed
  When “Confirm” runs on a “Bokning”: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Salongen. Sköter behandlingar, frisörer och ledigheter samt bekräftar bokningar): everything
  - member (En kund som bokar tid): opens the appointments page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading barbers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,037 tokens (568 in, 2,469 out) · $0.0013
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-17. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-17
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ZV1xxA/app-17/smithable.content.yml:68:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkoll
  Offerter, kunder och fakturor för en liten byggfirma.

Pages
  - Offerter (lists “Offerter”; filter by “Kund” or “Status”; “Send quote”; “Accept quote”; “Decline quote”)
  - Kunder (lists “Kunder”; search by “Namn”, “E-post” or “Telefon”)
  - Fakturor (lists “Fakturor”; filter by “Kund” or “Status”; “Mark sent”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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
  - a field “Rubrik” (required)
  - a field “Beskrivning”
  - a field “Belopp” (an amount, required)
  - a field “Utfärdad” (a date, required, today by default)
  - a field “Giltig till” (a date)
  - a field “Status” (“Utkast”, “Skickad”, “Accepterad” or “Avböjd”, “Utkast” by default)

Fakturor
  Fakturor have:
  - a field “Fakturanummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Offert” (a “Offert”)
  - a field “Belopp” (an amount, required)
  - a field “Fakturadatum” (a date, required, today by default)
  - a field “Förfallodatum” (a date)
  - a field “Status” (“Utkast”, “Skickad”, “Betald” or “Förfallen”, “Utkast” by default)

Send quote
  For a “Offert” that is “Utkast”; sets “Status” to “Skickad”.
  Offerten har skickats till kunden.

Accept quote
  For a “Offert” that is “Skickad”; sets “Status” to “Accepterad”.
  Kunden har tackat ja till offerten.

Decline quote
  For a “Offert” that is “Skickad”; sets “Status” to “Avböjd”.
  Kunden har tackat nej till offerten.

Mark sent
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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 5,711 tokens (747 in, 4,964 out) · $0.0026
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-18. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-18
  smithable studio

or only run the app with smithable run.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Här lägger folk upp saker de vill sälja på loppisen, med bilder och pris.

Pages
  - Saker till salu (lists “Saker”; search by “Rubrik”, “Beskrivning” or “Plats”; filter by “Kategori”, “Pris”, “Skick” or “Finns kvar”; sort by “Pris” or date added; records can be saved as favorites; contact the owner by mail)
  - Mina saker (lists “Saker”; only the viewer's own records)
  - Sparade (lists “Saker”; only the viewer's saved records)
  - Granskning (the pictures and files waiting for review, to approve or reject; only for admins)
  - Hem (a landing page: hero, “Saker” and footer)
  - Integritet (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Saker
  Saker have:
  - a field “Rubrik” (required)
  - a field “Bilder” (pictures, required)
  - a field “Beskrivning” (required)
  - a field “Pris” (an amount)
  - a field “Kategori” (“Möbler”, “Cyklar”, “Elektronik”, “Sport”, “Barn” or “Övrigt”, “Möbler” by default)
  - a field “Skick” (“Som ny”, “Bra” or “Sliten”, “Som ny” by default)
  - a field “Plats”
  - a field “Finns kvar” (yes or no, true by default)
  Photos of “Saker” are reviewed before others see them; an item waits until its photos are.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,817 tokens (497 in, 1,320 out) · $0.0007
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-19
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ZV1xxA/app-19/smithable.content.yml:36:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudion varaukset
  Joogastudion tuntien, ohjaajien ja verkkovarausten hallinta.

Pages
  - Home (a landing page: hero, class types, instructors, call to action and footer)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - My bookings (lists bookings)
  - Schedule (a calendar of sessions by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Each class type lists its sessions.

Instructors
  Instructors have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Each instructor lists its sessions.

Sessions
  Sessions have:
  - a class type (a class type, required)
  - an instructor (an instructor, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each session lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  A session is named after its class type and its starts at.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  Each booking can have an attendee (a user).
  The attendee owns the booking.
  At most the session's capacity bookings per session.
  A booking is added until the session's starts at.
  Its owner deletes it until the session's starts at.
  A booking is named after its session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Opiskelija, joka varaa joogatunteja): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,120 tokens (506 in, 2,614 out) · $0.0014
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 146 files (146 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ZV1xxA/app-20/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Pikku-Korjaamo
  Pienen autokorjaamon asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Customers (lists customers; search by name, email or phone)
  - Cars (lists cars; search by registration, make or car model)
  - Jobs (lists service jobs; search by description; filter by status or car; “Start job”; “Complete job”)
  - Invoices (lists invoices; search by number; filter by status or customer; “Send invoice”; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Customers
  Customers have:
  - a name (required)
  - a phone
  - an email
  - address
  - notes
  Each customer lists its cars.

Cars
  Cars have:
  - a registration (required, unique)
  - a make (required)
  - a car model
  - a year (a whole number)
  - a customer (a customer, required)
  - notes
  Each car lists its service jobs.

Service jobs
  Service jobs have:
  - a car (a car, required)
  - a description (required)
  - status (booked, in progress, done or invoiced, booked by default)
  - received on (a date, required, today by default)
  - completed on (a date)
  - a mileage (a whole number)
  - labor hours (a number)
  - a parts cost (an amount)

Invoices
  Invoices have:
  - a number (required, unique)
  - a customer (a customer, required)
  - a job (a service job, required)
  - issued on (a date, required, today by default)
  - due on (a date)
  - an amount (an amount, required)
  - status (draft, sent or paid, draft by default)

Start job
  For a service job that is booked; sets status to in progress.

Complete job
  For a service job that is in progress; sets status to done and completed on to today.

Send invoice
  For an invoice that is draft; sets status to sent.

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
Frontier model (claude-haiku-5-5) · 7,569 tokens (655 in, 6,914 out) · $0.0035
Pictures from the Smithable image library: logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Ein kleiner Hofladen, bei dem Kunden Produkte vorbestellen und zu festen Zeiten abholen.

Pages
  - Abholung (a landing page: hero, pickup slots and footer)
  - Orders (lists orders; filter by status; sort by date added or wanted; “Accept”; “Ready”; “Collected”; “Decline”)
  - Products (lists products; filter by category or available; “Sold out”; “Back on”)
  - Pickups (lists pickup slots)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Products
  Products have:
  - a name (required)
  - a description
  - a price (an amount, required)
  - a unit
  - a category (vegetables, fruit, dairy, meat, bakery or other, vegetables by default)
  - a picture
  - available (yes or no, true by default)

Orders
  Orders have:
  - a name (required)
  - a phone (required)
  - an email
  - the date and time wanted
  - a note
  - status (new, accepted, ready, collected or declined, new by default)
  - a reason
  Each order lists its order lines.
  The total is calculated as the total amount of its lines.

Order lines
  Order lines have:
  - an order (an order, required)
  - a product (a product, required)
  - a quantity (a whole number, required, 1 by default)
  - a unit price (an amount, required)
  The amount is calculated as the quantity times the unit price.

Pickup slots
  Pickup slots have:
  - a place (required)
  - a day (a date, required)
  - hours (required)
  - a note

Sold out
  For a product that is available; sets available to no.
  Heute nichts mehr davon.

Back on
  For a product that is not available; sets available to yes.
  Wieder vorbestellbar.

Accept
  For an order that is new; sets status to accepted.
  Die Vorbestellung wird angenommen.

Ready
  For an order that is accepted; sets status to ready.
  Die Bestellung liegt zur Abholung bereit.

Collected
  For an order that is ready; sets status to collected.
  Der Kunde hat die Bestellung abgeholt.

Decline
  For an order that is new or accepted; sets status to declined; asks for the reason.
  Die Bestellung ist nicht möglich: Grund angeben.

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
  - staff (Nimmt Vorbestellungen an und pflegt Produkte und Abholzeiten): opens the orders page, the products page and the pickups page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the abholung page, the privacy page, reading products, reading pickup slots and adding orders.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,780 tokens (607 in, 4,173 out) · $0.0021
Pictures from the Smithable image library: samples/product-1.webp, samples/product-2.webp, samples/product-3.webp, samples/product-4.webp, samples/product-5.webp, samples/product-6.webp, hero.webp, logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ZV1xxA/app-22/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker Backend
  A backend for a habit app that stores habits, daily check-ins and streaks.

Pages
  - Habits (lists habits; search by name or description; filter by status or cadence; “Check in habit”)
  - Check ins (lists check ins; filter by habit or done on)

Habits
  Habits have:
  - a name (required)
  - a description
  - a cadence (daily or weekly, daily by default)
  - status (active, paused or archived, active by default)
  - started on (a date, required, today by default)
  - last check in on (a date)
  - a current streak (a whole number, required, 0 by default)
  - a longest streak (a whole number, required, 0 by default)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - done on (a date, required, today by default)
  - a note
  No two check ins have the same habit and done on for one owner.

Check in habit
  For a habit that is active; sets last check in on to today; asks for the check in's note; adds a check in (done on today).
  Record today's check-in for a habit.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run check in habit.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,243 tokens (468 in, 2,775 out) · $0.0014
Pictures from the Smithable image library: logo.webp.
Generated 115 files (115 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Assistant Memory
  Tasks and notes, grouped in projects, that my AI assistant keeps for me.

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
  - member (A person who works with the tasks and notes): opens the admin page; adds every kind of record; changes everyone's records; deletes everyone's records
  - assistant (The AI assistant's key: reads everything, adds and changes tasks and notes, never deletes): adds tasks and notes; changes everyone's tasks and notes
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,856 tokens (448 in, 2,408 out) · $0.0012
Pictures from the Smithable image library: logo.webp.
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-ZV1xxA/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ZV1xxA/app-24
  smithable studio

or only run the app with smithable run.
```
