# M12 first builds: claude-sonnet-5-5, the second set (2026-10-28)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 24 / 24 created, 24 type-check, 922,630 tokens (852,885 in, 69,745 out), $1.0056; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 51,796 | 2,417 | $0.0959 | 0 | – | 93 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 25,774 | 2,133 | $0.0288 | 0 | – | 97 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | barbers | yes | yes | 25,904 | 2,558 | $0.0333 | 0 | – | 102 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 25,107 | 1,305 | $0.0192 | 0 | – | 75 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 52,389 | 3,676 | $0.0534 | 0 | – | 102 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 52,232 | 3,505 | $0.0514 | 0 | – | 115 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 25,310 | 1,575 | $0.0223 | 0 | – | 271 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 25,314 | 1,262 | $0.0192 | 0 | – | 240 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 25,102 | 1,097 | $0.0171 | 0 | – | 238 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 25,104 | 1,601 | $0.0222 | 0 | – | 258 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 26,250 | 2,545 | $0.0339 | 0 | – | 266 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 26,245 | 3,478 | $0.0432 | 0 | – | 212 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 25,096 | 1,458 | $0.0207 | 0 | – | 177 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 25,106 | 1,154 | $0.0177 | 0 | – | 164 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 25,105 | 827 | $0.0144 | 0 | – | 172 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 25,105 | 2,038 | $0.0265 | 0 | – | 208 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | barbers | yes | yes | 52,626 | 5,198 | $0.0691 | 0 | – | 184 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 82,108 | 7,952 | $0.1116 | 0 | – | 212 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 76,503 | 7,771 | $0.0986 | 0 | – | 199 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 27,058 | 3,725 | $0.0473 | 0 | – | 203 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 25,748 | 4,334 | $0.0508 | 0 | – | 214 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | yes | yes | 25,971 | 5,099 | $0.0589 | 0 | – | 163 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 50,546 | 1,753 | $0.0305 | 0 | – | 96 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 25,386 | 1,284 | $0.0196 | 0 | – | 87 s |

Each created app's four spec files are in [m12-first-builds-claude-sonnet-5-5-wide/](m12-first-builds-claude-sonnet-5-5-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 24 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: booking) | 2 | 1 / 4 (has 3) | 1 / 7 (has 3) | 1 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm (words: invoicing) | 0 | 0 / 2 (has 3) | 1 / 3 (has 4) | 0 / 1 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | barbers | 3 | 4 / 4 (has 4) | 7 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read Service, Barber; create none | 1 (operator-unknown) | none |  | none | 2 / 4 | no mention; landing page | en | | | | |
| 4 | records (words: status) | 2 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 0 | 3 / 4 (has 4) | 4 / 7 (has 5) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 3 | 3 / 4 (has 3) | 4 / 7 (has 5) | 3 / 3 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace (words: booking) | 2 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: booking) | 2 | 1 / 1 (has 1) | 1 / 5 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 2 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 2 | 0 / 1 (has 1) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, artifacts, privacy; read Artifact; create none | 1 (operator-unknown) | none |  | Our Collection | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 2 | 3 / 4 (has 3) | 4 / 8 (has 4) | 3 / 3 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 3 | no mention; no landing page | en | | | | |
| 12 | status (words: barbers) | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: barbers) | 3 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 3 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | barbers (words: records) | 2 (sv: yes (ska, kunderna, kunna)) | 4 / 4 (has 4) | 7 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read Service, Barber; create none | 1 (operator-unknown) | none |  | none | 2 / 4 | no mention; landing page | sv | no | yes (till, bokning, tid) | no | models 4/4, fields 19/19, pages 7/7 |
| 18 | invoicing (words: records) | 3 (sv: yes (ska, en, kunder)) | 2 / 4 (has 5) | 3 / 7 (has 7) | 3 / 3 (has 6) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 5 | no mention; no landing page | sv | no | yes (till) | none | models 5/5, fields 32/32, pages 7/7 |
| 19 | marketplace (words: records) | 2 (sv: yes (lägga, saker, till)) | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | no mention; landing page | sv | no | yes (bilder, pris) | no | models 1/1, fields 8/8, pages 6/6 |
| 20 | booking (words: records) | 0 | 4 / 6 (has 4) | 8 / 12 (has 8) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page | fi | no | none | yes (ja) | models 0/4, fields 0/17, pages 0/8 |
| 21 | crm (words: records) | 3 (fi: no) | 1 / 2 (has 4) | 2 / 3 (has 5) | 0 / 1 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page | fi | no | yes (autot) | none | models 4/4, fields 31/31, pages 5/5 |
| 22 | kiosk (words: records) | 3 (de: yes (kunden, die, abholzeiten)) | 2 / 4 (has 4) | 1 / 6 (has 6) | 5 / 6 (has 6) | shared; admin, staff (staff) | none | pages hof, datenschutz; read Product, PickupSlot; create Order | 1 (operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | de | yes (hofladen) | none | yes (und, hofladen) | models 0/4, fields 0/25, pages 0/6 |
| 23 | records (words: barbers) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 2 | 3 / 3 (has 3) | 2 / 2 (has 2) | 2 / 2 (has 2) | shared; admin, member, assistant (member) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Translator Ledger
  Keep track of my translation clients, the quotes I gave them and what they have paid.

Pages
  - Clients (lists clients; search by name, email or company)
  - Quotes (lists quotes; filter by client or status; “Mark sent”; “Accept”; “Decline”)
  - Payments (lists payments)

Clients
  Clients have:
  - a name (required)
  - an email
  - a phone
  - a company
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
  The paid is calculated as the total amount of its payments.
  The balance is calculated as the amount minus the paid.

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a note

Mark sent
  For a quote that is draft; sets status to sent.
  The quote was sent to the client.

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
Frontier model (claude-sonnet-5-5) · 3,755 tokens (533 in, 3,222 out) · $0.0333
Pictures from the Smithable image library: logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Agency Pipeline
  A sales pipeline for a small web agency: leads, deals and who follows up when.

Pages
  - Leads (lists leads; search by name, company or email; filter by status, source or handler)
  - Deals (lists deals; search by title; filter by stage or salesperson; “Win”; “Lose”)
  - Follow ups (lists follow ups; filter by status or assignee; “Complete”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Leads
  Leads have:
  - a name (required)
  - a company
  - an email
  - a phone
  - a source (referral, website, event, outreach or other, referral by default)
  - status (new, contacted, qualified, converted or lost, new by default)
  - notes
  Each lead can have a handler (a user).
  Each lead lists its deals.
  The handler owns the lead.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a value (an amount)
  - a stage (prospecting, proposal, negotiation, won or lost, prospecting by default)
  - an expected close (a date)
  - closed at (a date and time)
  - notes
  Each deal can have a salesperson (a user).
  Each deal lists its follow ups.
  The salesperson owns the deal.

Follow ups
  Follow ups have:
  - a deal (a deal, required)
  - due at (a date and time, required)
  - a task (required)
  - status (open or done, open by default)
  - done at (a date and time)
  - a note
  Each follow up can have an assignee (a user).
  The assignee owns the follow up.

Win
  For a deal that is prospecting, proposal or negotiation; sets stage to won and closed at to now.

Lose
  For a deal that is prospecting, proposal or negotiation; sets stage to lost and closed at to now.

Complete
  For a follow up that is open; sets status to done and done at to now.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 3,940 tokens (570 in, 3,370 out) · $0.0348
Pictures from the Smithable image library: logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Lumen Hair Studio
  Online booking for a hair salon, where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Appointments (lists appointments; filter by status)
  - Day (a calendar of appointments by week or month; only for admins)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Barbers (lists stylists; only for admins; visitors see stylists on the Home page)
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
  Open to anyone without signing in: the home page, the privacy page, reading services and reading barbers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,278 tokens (469 in, 1,809 out) · $0.0190
Pictures from the Smithable image library: samples/barber-1.webp, samples/barber-2.webp, samples/barber-3.webp, hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-BvGBGx/app-3/smithable.content.yml:15:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's pupils, their weekly lesson times and what each one is practising.

Pages
  - Pupils (lists pupils; search by name or email; filter by lesson day or level)
  - Practice (lists practice items; search by piece or focus; filter by pupil or status; “Mark done”)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - a level (beginner, intermediate or advanced, beginner by default)
  - a lesson day (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a lesson time (required)
  - lesson minutes (a whole number, required, 30 by default)
  - notes

Practice items
  Practice items have:
  - a pupil (a pupil, required)
  - a piece (required)
  - focus
  - assigned on (a date, required, today by default)
  - status (practising, polishing or done, practising by default)

Mark done
  For a practice item that is practising or polishing; sets status to done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,713 tokens (521 in, 2,192 out) · $0.0230
Pictures from the Smithable image library: logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Shoot Invoices
  Invoices for my photography work: clients, shoots and what is still unpaid.

Pages
  - Clients (lists clients; search by name or email)
  - Shoots (lists shoots)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark overdue”; “Mark paid”)
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
  - a shoot date (required)
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
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
  - issued on (a date, required, today by default)
  - due on (a date)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 3,944 tokens (567 in, 3,377 out) · $0.0349
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Tidy Invoices
  One shared place for a small cleaning company to keep its households and send them monthly invoices.

Pages
  - Clients (lists clients)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Overview (a dashboard: outstanding, overdue, paid and latest)
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
  - due on (a date)
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,440 tokens (507 in, 1,933 out) · $0.0203
Pictures from the Smithable image library: logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-6
  smithable studio

or only run the app with smithable run.
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Flea Market
  A town flea market where anyone can post things to sell, with photos and a price.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, items and footer)
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
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 1,563 tokens (405 in, 1,158 out) · $0.0124
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-BvGBGx/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Office Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Shelf (lists items; search by title, description or pickup spot; filter by category, condition or status)
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
  - claimed at (a date and time)
  Each item can have a claimed by (a user, filled by the app).

Claim
  For an item that is available; sets status to claimed, claimed by to whoever presses it and claimed at to now.
  A colleague claims an item from the shelf.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; runs “Claim”
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 1,627 tokens (424 in, 1,203 out) · $0.0129
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-8
  smithable studio

or only run the app with smithable run.
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Vinyl Shelf
  A personal catalog of my vinyl records, with their artists, condition and what I paid.

Pages
  - Albums (lists albums; search by title or label; filter by artist, condition or year)
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
  - a paid (an amount)
  - purchased on (a date)
  - a cover (picture)
  - notes
  A album is named after its title.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,061 tokens (454 in, 1,607 out) · $0.0170
Pictures from the Smithable image library: logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection Online
  The museum's collection online, where visitors browse the objects and read their stories.

Pages
  - Home (a landing page: hero, artifacts, features and footer)
  - Artifacts (lists artifacts; search by name, summary, origin or category; filter by category or on display)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Artifacts
  Artifacts have:
  - a name (required)
  - an accession number (unique)
  - a category (painting, photograph, tool, textile, document or other, painting by default)
  - a dated
  - an origin
  - a summary
  - a story (formatted text)
  - photos (pictures)
  - on display (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Looks at the collection): opens every page
  New users get the member role.
  Open to anyone without signing in: the home page, the artifacts page, the privacy page and reading artifacts.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 1,962 tokens (418 in, 1,544 out) · $0.0163
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-BvGBGx/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  An internal board showing which IT systems are down and when they are expected back.

Pages
  - Overview (a dashboard: systems down, open incidents and latest)
  - Components (lists components; filter by status)
  - Incidents (lists incidents; search by title; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
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
  - a component (a component, required)
  - detected at (a date and time, required)
  - expected back at (a date and time)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its incident updates.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a message (required)

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (message This incident is resolved.).
  The incident is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 3,506 tokens (505 in, 3,001 out) · $0.0310
Pictures from the Smithable image library: logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  The current state of the municipality's online services, so residents can check for outages.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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
  - staff (Writes incidents, their updates and planned maintenance): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 4,592 tokens (577 in, 4,015 out) · $0.0413
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 144 files (144 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-BvGBGx/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuel ups; search by station or note; filter by fuelled on or full tank)
  - Service (lists service visits; search by garage or description; filter by kind or visited on)
  - Expenses (lists expenses; search by description; filter by category or spent on)

Fuel ups
  Fuel ups have:
  - fuelled on (a date, required, today by default)
  - an odometer (a whole number, required)
  - liters (a number, required)
  - a total cost (an amount, required)
  - full tank (yes or no, true by default)
  - a station
  - a note
  The price per liter is calculated as the total cost divided by the liters.

Service visits
  Service visits have:
  - visited on (a date, required, today by default)
  - an odometer (a whole number)
  - a kind (maintenance, repair, inspection, tires or other, maintenance by default)
  - a garage
  - a description (required)
  - a cost (an amount)
  - next due on (a date)

Expenses
  Expenses have:
  - spent on (a date, required, today by default)
  - a category (insurance, tax, parking, toll, cleaning or other, insurance by default)
  - a description (required)
  - an amount (an amount, required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,280 tokens (538 in, 1,742 out) · $0.0185
Pictures from the Smithable image library: logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guest List
  The guest list and seating plan for our wedding, with who has answered and what they will eat.

Pages
  - Guests (lists guests; search by name or email; filter by rsvp, meal or table)
  - Tables (lists tables; search by name)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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
  - a rsvp (waiting, attending or declined, waiting by default)
  - a meal (undecided, meat, fish, vegetarian or vegan, undecided by default)
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
Frontier model (claude-sonnet-5-5) · 1,586 tokens (463 in, 1,123 out) · $0.0122
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Club Bird Log
  A shared log of the birds our birdwatching club has seen, with species, place, date and who spotted them.

Pages
  - Sightings (lists sightings; search by species or place; filter by seen on or seen by)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a count (a whole number, 1 by default)
  - notes
  - a photo (picture)
  Each sighting can have a seen by (a user, who makes it, by default, filled by the app).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 1,224 tokens (388 in, 836 out) · $0.0091
Pictures from the Smithable image library: logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of who has which allotment plot, the waiting list and each member's yearly fee.

Pages
  - Plots (lists plots; search by number or location; filter by status)
  - Members (lists members; search by name, email or phone)
  - Waiting list (lists waiting entries; search by name or email; filter by status; “Offer plot”)
  - Fees (lists fees; filter by status, year or member; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - joined on (a date, required, today by default)
  - notes

Plots
  Plots have:
  - a number (required, unique)
  - a size sqm (a whole number)
  - a location
  - status (vacant, let or reserved, vacant by default)
  - a holder (a member)
  - notes

Waiting entries
  Waiting entries have:
  - a name (required)
  - an email
  - a phone
  - applied on (a date, required, today by default)
  - status (waiting, offered, allocated or withdrawn, waiting by default)
  - a note

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (unpaid or paid, unpaid by default)
  - paid on (a date)
  No two fees have the same member and year in the whole app.

Mark paid
  For a fee that is unpaid; sets status to paid and paid on to today.

Offer plot
  For a waiting entry that is waiting; sets status to offered.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 3,330 tokens (585 in, 2,745 out) · $0.0286
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Salong Klippet
  Kunderna bokar tid hos salongens frisörer på nätet, efter frisörens lediga tider.

Pages
  - Hem (a landing page: hero, “Behandlingar”, “Frisörer” and footer)
  - Bokningar (lists “Bokningar”; filter by “Status”)
  - Dagens schema (a calendar of appointments by week or month; only for admins)
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
  - a field “Status” (“Förfrågad”, “Bekräftad” or “Avbokad”, “Förfrågad” by default, filled by the app)
  A “Bokning” takes its “Frisör”'s time from its “Tid” for the number of minutes in its “Behandling”'s minutes while status is requested or confirmed; whoever made it may cancel it until 12 hours before.

Confirm
  For a “Bokning” that is “Förfrågad”; sets “Status” to “Bekräftad”.

Cancel
  For a “Bokning” that is “Förfrågad” or “Bekräftad”; sets “Status” to “Avbokad”.

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
  - admin: everything
  - member (En kund som bokar tider): opens the appointments page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading barbers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,158 tokens (567 in, 1,591 out) · $0.0170
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-17. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-17
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-BvGBGx/app-17/smithable.content.yml:68:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkoll
  Offerter, kunder och fakturor för en liten byggfirma.

Pages
  - Offerter (lists “Offerter”; “Send quote”; “Accept quote”; “Decline quote”)
  - Kunder (lists “Kunder”)
  - Offertrader (lists “Offertrader”)
  - Fakturarader (lists “Fakturarader”)
  - Översikt (a dashboard: latest quotes, outstanding and overdue)
  - Fakturor (lists “Fakturor”; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Kunder
  Kunder have:
  - a field “Namn” (required)
  - a field “E-post” (an email address)
  - a field “Telefon” (a phone number)
  - a field “Adress”
  - a field “Organisations-/personnummer”

Offerter
  Offerter have:
  - a field “Nummer” (required, unique)
  - a field “Projekt” (required)
  - a field “Kund” (a “Kund”, required)
  - a field “Offertdatum” (a date, required, today by default)
  - a field “Giltig till” (a date)
  - a field “Status” (“Utkast”, “Skickad”, “Godkänd” or “Avslagen”, “Utkast” by default)
  - a field “Anteckningar”
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
  - a field “Fakturanummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Offert” (a “Offert”)
  - a field “Fakturadatum” (a date, required, today by default)
  - a field “Förfallodatum” (a date)
  - a field “Status” (“Utkast”, “Skickad”, “Betald” or “Förfallen”, “Utkast” by default)
  Each “Faktura” lists its “Fakturarader”.
  The “Summa” is calculated as the total “Belopp” of its “Rader”.

Send quote
  For a “Offert” that is “Utkast”; sets “Status” to “Skickad”.
  Offerten har skickats till kunden.

Accept quote
  For a “Offert” that is “Skickad”; sets “Status” to “Godkänd”.
  Kunden har godkänt offerten.

Decline quote
  For a “Offert” that is “Skickad”; sets “Status” to “Avslagen”.
  Kunden har tackat nej till offerten.

Mark sent
  For a “Faktura” that is “Utkast”; sets “Status” to “Skickad”.
  Fakturan har skickats till kunden.

Mark paid
  For a “Faktura” that is “Skickad” or “Förfallen”; sets “Status” to “Betald”.
  Kunden har betalat fakturan.

Mark overdue
  For a “Faktura” that is “Skickad”; sets “Status” to “Förfallen”.
  Fakturan är försenad.

Overdue check
  When a “Faktura”'s due on comes, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 5,415 tokens (940 in, 4,475 out) · $0.0466
Pictures from the Smithable image library: logo.webp.
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-18. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-18
  smithable studio

or only run the app with smithable run.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Lägg upp saker du vill sälja på vår loppis, med bilder och pris.

Pages
  - Alla saker (lists “Saker”; search by “Rubrik”, “Beskrivning” or “Plats”; filter by “Kategori”, “Pris”, “Skick” or “Tillgänglig”; sort by “Pris” or date added; records can be saved as favorites; contact the owner by mail)
  - Mina saker (lists “Saker”; only the viewer's own records)
  - Sparade (lists “Saker”; only the viewer's saved records)
  - Granska bilder (the pictures and files waiting for review, to approve or reject; only for admins)
  - Start (a landing page: hero, “Saker” and footer)
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
  - a field “Tillgänglig” (yes or no, true by default)
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
Frontier model (claude-sonnet-5-5) · 1,431 tokens (496 in, 935 out) · $0.0103
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-19
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-BvGBGx/app-19/smithable.content.yml:36:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudio
  Joogastudion tuntikalenteri ja verkkovaraus: tunnit, ohjaajat ja varaukset.

Pages
  - Home (a landing page: hero, class types, instructors, faq and footer)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - My bookings (lists bookings)
  - Schedule (a calendar of sessions by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

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
Frontier model (claude-sonnet-5-5) · 2,668 tokens (513 in, 2,155 out) · $0.0226
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-BvGBGx/app-20/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Korjaamo
  Pienen autokorjaamon asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Asiakkaat (lists asiakkaat; search by nimi, sähköposti or puhelin)
  - Autot (lists autot; search by rekisterinumero, merkki or malli)
  - Huoltotyöt (lists huoltotyöt; filter by tila; “Start work”; “Complete work”; “Cancel work”)
  - Laskut (lists laskut; filter by tila; “Send invoice”; “Mark paid”)
  - Tiimi (who has access: invite people, change roles, remove users; only for admins)

Asiakkaat
  Asiakkaat have:
  - a nimi (required)
  - a sähköposti (an email address)
  - a puhelin (a phone number)
  - an osoite
  - a muistiinpanot
  Each asiakas lists its autot.

Autot
  Autot have:
  - a rekisterinumero (required, unique)
  - a merkki (required)
  - a malli
  - a vuosimalli (a whole number)
  - a valmistenumero
  - a mittarilukema (km) (a whole number)
  - asiakas (an asiakas, required)
  - a muistiinpanot

Huoltotyöt
  Huoltotyöt have:
  - an otsikko (required)
  - an auto (an auto, required)
  - a tila (varattu, työn alla, valmis or peruttu, varattu by default)
  - kuvaus
  - an avattu (a date and time, now by default)
  - a työtunnit (a number)
  - a tuntihinta (an amount)
  - a varaosat (an amount)
  The yhteensä is calculated as the työtunnit times the tuntihinta plus the varaosat.

Laskut
  Laskut have:
  - a laskun numero (required, unique)
  - asiakas (an asiakas, required)
  - a huoltotyö (a huoltotyö, required)
  - a tila (luonnos, lähetetty or maksettu, luonnos by default)
  - a summa (an amount, required)
  - a laskun päivä (a date, today by default)
  - an eräpäivä (a date)
  - a maksupäivä (a date)

Start work
  For a huoltotyö that is varattu; sets tila to työn alla.

Complete work
  For a huoltotyö that is työn alla; sets tila to valmis.

Cancel work
  For a huoltotyö that is varattu or työn alla; sets tila to peruttu.

Send invoice
  For a lasku that is luonnos; sets tila to lähetetty.

Mark paid
  For a lasku that is lähetetty; sets tila to maksettu and maksupäivä to today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 7,136 tokens (1,010 in, 6,126 out) · $0.0633
Pictures from the Smithable image library: logo.webp.
Generated 140 files (140 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Produkte des Hofladens, Vorbestellungen der Kunden und die Abholzeiten.

Pages
  - Bestellungen (lists orders; filter by status; “Confirm”; “Ready”; “Collected”; “Decline”)
  - Produkte (lists products; filter by category or available; “Sold out”; “Back on”)
  - Abholzeiten (lists pickup slots)
  - Hof (a landing page: hero, pickup slots, features and footer)
  - Datenschutz (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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
  - a pickup (a date and time)
  - a note
  - status (new, confirmed, ready, collected or declined, new by default)
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
  - a day (a date, required)
  - hours (required)
  - a place
  - a note

Confirm
  For an order that is new; sets status to confirmed.
  Die Bestellung wird angenommen.

Ready
  For an order that is confirmed; sets status to ready.
  Die Bestellung liegt zur Abholung bereit.

Collected
  For an order that is ready; sets status to collected.
  Der Kunde hat die Bestellung abgeholt.

Decline
  For an order that is new or confirmed; sets status to declined; asks for the reason.
  Die Bestellung kann nicht erfüllt werden: Grund angeben.

Sold out
  For a product that is available; sets available to no.
  Das Produkt ist ausverkauft.

Back on
  For a product that is not available; sets available to yes.
  Das Produkt ist wieder vorbestellbar.

Order placed
  When a order is added: mails every admin.

Order confirmed
  When “Confirm” runs on a order: mails email.

Order ready
  When “Ready” runs on a order: mails email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Nimmt Bestellungen an und pflegt Produkte und Abholzeiten): opens the bestellungen page, the produkte page and the abholzeiten page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the hof page, the datenschutz page, reading products, reading pickup slots and adding orders.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 3,921 tokens (595 in, 3,326 out) · $0.0345
Pictures from the Smithable image library: samples/product-1.webp, samples/product-2.webp, samples/product-3.webp, samples/product-4.webp, samples/product-5.webp, samples/product-6.webp, hero.webp, logo.webp.
Generated 157 files (157 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-BvGBGx/app-22/smithable.content.yml:3:3  warning  The privacy page "datenschutz" does not say who runs the app: give the operator's name under pages.datenschutz.operator (name, address, email, country, hosting).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker Backend
  Keeps habits, daily check-ins and streaks for a habit app.

Pages
  - Habits (lists habits; search by name or description; filter by frequency or active; “Check in habit”)
  - Check ins (lists check ins; filter by habit, date or completed)

Habits
  Habits have:
  - a name (required)
  - a description
  - a frequency (daily, weekdays or weekly, daily by default)
  - active (yes or no, true by default)
  - started on (a date, required, today by default)
  - a last check in (a date)
  - a current streak (a whole number, required, 0 by default)
  - a longest streak (a whole number, required, 0 by default)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required, today by default)
  - completed (yes or no, true by default)
  - a note
  No two check ins have the same habit and date for one owner.

Check in habit
  For a habit that is active; sets last check in to today; adds a check in (date today, completed yes).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change habits and check ins with a key, and run check in habit.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,744 tokens (466 in, 2,278 out) · $0.0237
Pictures from the Smithable image library: logo.webp.
Generated 115 files (115 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Assistant Memory
  Tasks and notes, grouped in projects, that an AI assistant keeps for me.

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
  - member (A person who works with the tasks and notes): opens the admin page; adds every kind of record; changes everyone's records; deletes everyone's records
  - assistant (The AI assistant's key: reads everything, adds and changes tasks and notes, never deletes): adds tasks and notes; changes everyone's tasks and notes
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,158 tokens (448 in, 1,710 out) · $0.0180
Pictures from the Smithable image library: logo.webp.
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-BvGBGx/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-BvGBGx/app-24
  smithable studio

or only run the app with smithable run.
```
