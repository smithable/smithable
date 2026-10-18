# M12 first builds: claude-code, the second set (2026-10-18)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 24 / 24 created, 22 type-check, 1,294,476 tokens (1,231,814 in, 62,662 out), $2.2790 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 79,969 | 2,729 | $0.4000 | 0 | 2 | 35 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 39,613 | 2,450 | $0.0716 | 0 | 1 | 34 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | booking | yes | yes | 40,224 | 2,055 | $0.0686 | 0 | 1 | 30 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 38,945 | 1,220 | $0.0417 | 0 | 1 | 24 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 80,303 | 3,374 | $0.1213 | 0 | 2 | 44 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 79,875 | 2,803 | $0.1065 | 0 | 2 | 38 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 39,148 | 1,600 | $0.0509 | 0 | 1 | 29 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | **no** | 39,152 | 1,644 | $0.0518 | 0 | 1 | 29 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 38,939 | 1,959 | $0.0564 | 0 | 1 | 51 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 38,942 | 1,525 | $0.0477 | 0 | 1 | 46 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 40,088 | 2,626 | $0.0789 | 0 | 1 | 40 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 40,083 | 2,688 | $0.0801 | 0 | 1 | 47 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 38,935 | 1,671 | $0.0506 | 0 | 1 | 34 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 38,945 | 1,563 | $0.0485 | 0 | 1 | 33 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | **no** | 78,266 | 1,720 | $0.0720 | 0 | 2 | 34 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 38,943 | 2,652 | $0.0703 | 0 | 1 | 39 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | booking | yes | yes | 80,327 | 4,143 | $0.1369 | 0 | 2 | 57 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 124,157 | 7,955 | $0.2695 | 0 | 3 | 86 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 39,205 | 2,315 | $0.0657 | 0 | 1 | 37 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 40,196 | 3,664 | $0.1006 | 0 | 1 | 51 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 39,587 | 3,565 | $0.0937 | 0 | 1 | 45 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | yes | yes | 39,809 | 4,392 | $0.1120 | 0 | 1 | 59 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 38,938 | 1,330 | $0.0438 | 0 | 1 | 27 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 39,225 | 1,019 | $0.0399 | 0 | 1 | 25 s |

Each created app's four spec files are in [m12-first-builds-claude-code-wide/](m12-first-builds-claude-code-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 24 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: booking) | 3 | 1 / 4 (has 3) | 2 / 7 (has 4) | 1 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 2 | 0 / 2 (has 3) | 1 / 3 (has 5) | 0 / 1 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 1 (no-timezone) | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | booking | 3 | 2 / 6 (has 5) | 6 / 11 (has 9) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, stylists, privacy; read Service, Stylist, Slot; create Message | 1 (operator-unknown) | none |  | none | 0 / 5 | no mention; landing page | en | | | | |
| 4 | records (words: booking) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 3 | 3 / 4 (has 4) | 4 / 7 (has 5) | 2 / 2 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 3 | 3 / 4 (has 3) | 2 / 7 (has 4) | 2 / 2 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 3 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 2 | 1 / 1 (has 1) | 1 / 5 (has 3) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 2 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 1 / 1 (has 1) | 2 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, items, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 3 | 4 / 4 (has 4) | 5 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, it, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: status) | 3 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 3 | 0 / 1 (has 4) | 0 / 2 (has 6) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | booking (words: records) | 3 (sv: yes (ska, ett, för)) | 1 / 6 (has 4) | 1 / 11 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | none | pages hem, boka, integritet; read Service, Stylist, Slot; create none | 1 (operator-unknown) | none |  | none | 0 / 4 | no mention; landing page | sv | no | yes (tid, bokning) | no | models 4/4, fields 17/17, pages 8/8 |
| 18 | invoicing (words: records) | 3 (sv: yes (ska, att, en)) | 2 / 4 (has 5) | 0 / 7 (has 5) | 1 / 2 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 5 | no mention; no landing page | sv | no | yes (offerter, fakturor, till) | none | models 5/5, fields 36/36, pages 5/5 |
| 19 | marketplace (words: records) | 3 (sv: yes (ska, lägga, saker)) | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | no mention; landing page | sv | no | yes (bilder, pris, till) | yes (på, vår, loppis) | models 1/1, fields 8/8, pages 6/6 |
| 20 | booking (words: records) | 3 (fi: yes (tai)) | 4 / 6 (has 4) | 0 / 11 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | none | pages etusivu, lukujarjestys, ohjaajat, tietosuoja; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page | fi | yes (varaukset) | none | no | models 0/4, fields 0/16, pages 0/8 |
| 21 | crm (words: records) | 3 (fi: yes (asiakkaat, ja)) | 1 / 2 (has 4) | 0 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page | fi | no | none | none | models 0/4, fields 0/31, pages 0/5 |
| 22 | kiosk (words: records) | 3 (de: yes (die, vorbestellungen, abholzeiten)) | 2 / 4 (has 4) | 1 / 6 (has 6) | 6 / 6 (has 6) | shared; admin, staff (staff) | none | pages abholung, datenschutz; read Product, PickupSlot; create Order | 1 (operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | de | yes (hofladen) | none | no | models 0/4, fields 0/24, pages 0/6 |
| 23 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 2 | 3 / 3 (has 3) | 2 / 2 (has 2) | 2 / 2 (has 2) | shared; admin, assistant (assistant) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Translator's Ledger
  Keep track of my translation clients, the quotes I send them and the payments they make.

Pages
  - Clients (lists clients; search by name, company or email)
  - Quotes (lists quotes; filter by client or status; “Mark sent”; “Accept”; “Decline”)
  - Overview (a dashboard: quoted open, accepted, latest quotes and received)
  - Payments (lists payments; filter by client, method or paid on)

Clients
  Clients have:
  - a name (required)
  - a company
  - an email
  - a phone
  - address
  - notes
  Each client lists its quotes.
  Each client lists its payments.

Quotes
  Quotes have:
  - a number (required, unique)
  - a client (a client, required)
  - a title (required)
  - a source language
  - a target language
  - a word count (a whole number)
  - quoted on (a date, required, today by default)
  - a deadline (a date)
  - an amount (an amount, required)
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
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a note

Mark sent
  For a quote that is draft; sets status to sent.
  The quote went to the client.

Accept
  For a quote that is sent; sets status to accepted.
  The client accepted the quote.

Decline
  For a quote that is sent; sets status to declined.
  The client turned the quote down.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Agency Pipeline
  A sales pipeline for a small web agency: leads, deals and who follows up when.

Pages
  - Deals (lists deals; search by title; filter by stage, lead or account manager; “Mark won”; “Mark lost”)
  - Leads (lists leads; search by company, contact name or email; filter by status, source or account manager)
  - Follow ups (lists follow ups; filter by status, assignee or due; “Mark done”)
  - Schedule (a calendar of follow ups by week or month)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Leads
  Leads have:
  - a company (required)
  - a contact name
  - an email
  - a phone
  - a website (a web address)
  - a source (referral, website, outreach, event or other, referral by default)
  - status (new, contacted, qualified or disqualified, new by default)
  - notes
  Each lead can have an account manager (a user).
  Each lead lists its deals.
  Each lead lists its follow ups.
  The account manager owns the lead.
  Deleted leads stay in the trash for thirty days, where they can be restored.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a stage (proposal, negotiation, won or lost, proposal by default)
  - a value (an amount)
  - an expected close (a date)
  - closed on (a date, filled by the app)
  - notes
  Each deal can have an account manager (a user).
  The account manager owns the deal.
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a lead (a lead, required)
  - a deal (a deal)
  - the date due (required)
  - a note
  - status (open or done, open by default)
  - done on (a date, filled by the app)
  Each follow up can have an assignee (a user).
  The assignee owns the follow up.

Mark won
  For a deal that is proposal or negotiation; sets stage to won and closed on to today.

Mark lost
  For a deal that is proposal or negotiation; sets stage to lost and closed on to today.

Mark done
  For a follow up that is open; sets status to done and done on to today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with leads, deals and follow-ups): opens the deals page, the leads page, the follow ups page and the schedule page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-2
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-2/smithable.yml:66:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Shear Studio
  Online booking for a hair salon: customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, stylists, services, faq, call to action, contact and footer)
  - Free times (a calendar of slots by week or month)
  - My bookings (lists bookings)
  - Slots (lists slots; filter by stylist or starts at; only for admins)
  - Stylists (lists stylists)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Messages (lists messages; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

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
  Each stylist lists its slots.

Slots
  Slots have:
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  Each slot lists its bookings.
  The places left is calculated as 1 minus the number of its bookings.

Bookings
  Bookings have:
  - a slot (a slot, required, unique)
  - a service (a service, required)
  - a phone
  - a note
  At most 1 bookings per slot.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A customer who books appointments): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the stylists page, the privacy page, reading services, reading stylists, reading slots and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 163 files (163 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  A piano teacher's pupils, their weekly lesson times and what each one practises.

Pages
  - Pupils (lists pupils; search by name or email; filter by lesson day, level or active)
  - Pieces (lists pieces; search by title or composer; filter by pupil or status; “Mark learned”)

Pupils
  Pupils have:
  - a name (required)
  - an email
  - a phone
  - a level (beginner, intermediate or advanced, beginner by default)
  - a lesson day (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a lesson time
  - minutes (a whole number, required, 30 by default)
  - active (yes or no, true by default)
  - notes
  Each pupil lists its pieces.

Pieces
  Pieces have:
  - a pupil (a pupil, required)
  - a title (required)
  - a composer
  - status (learning, polishing or learned, learning by default)
  - focus
  - started on (a date, today by default)

Mark learned
  For a piece that is learning or polishing; sets status to learned.
  Mark a piece as learned.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 112 files (112 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Shutter Ledger
  Invoices for photography work: clients, shoots and what is still unpaid.

Pages
  - Overview (a dashboard: upcoming shoots, outstanding, overdue, paid, invoiced and unpaid)
  - Shoots (lists shoots; filter by client, status, kind or date; “Mark done”)
  - Clients (lists clients)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”)

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
  - status (booked, done or canceled, booked by default)
  - a fee (an amount)
  - notes
  Each shoot lists its invoices.

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

Mark done
  For a shoot that is booked; sets status to done.
  The shoot has taken place.

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
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Tidy Ledger
  Monthly invoicing for a small cleaning company: households, their invoices and what is paid.

Pages
  - Households (lists households; search by name or email)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”)
  - Overview (a dashboard: outstanding, overdue, paid, invoiced and latest)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Households
  Households have:
  - a name (required)
  - an email (required)
  - a phone
  - address
  Each household lists its invoices.

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
  - a client (a household, required)
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
Pictures from the Smithable image library: logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-6
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
  - a category (furniture, clothing, books, electronics, sports, kids, household or other, furniture by default)
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
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 129 files (129 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Shelf (lists items; search by title, description or place; filter by category, condition or status; sort by title or date added)
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
  Each item can have a claimed by (a user, filled by the app).

Claim
  For an item that is available; sets status to claimed and claimed by to whoever presses it.
  Claim an available item for yourself.

Mark gone
  For an item that is claimed; sets status to gone.
  Mark a claimed item as handed over.

Release
  For an item that is claimed; sets status to available; asks for the claimed by.
  Put a claimed item back on the shelf.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Offers and claims items): opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-8
  smithable studio

or only run the app with smithable run.
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Vinyl Shelf
  A private catalogue of my vinyl records: albums, artists, condition and what I paid.

Pages
  - Albums (lists albums; search by title, record label, genre or notes; filter by artist, record condition or year; sort by title, year, price paid or bought on)
  - Artists (lists artists; search by name or country)

Artists
  Artists have:
  - a name (required, unique)
  - a country
  - notes
  Each artist lists its albums.

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number)
  - a record label
  - a genre
  - a cover (picture)
  - a record condition (mint (m), near mint (nm), very good plus (vg+), very good (vg), good (g), fair (f) or poor (p), mint (m) by default)
  - a sleeve condition (mint (m), near mint (nm), very good plus (vg+), very good (vg), good (g), fair (f) or poor (p), mint (m) by default)
  - a price paid (an amount)
  - bought on (a date)
  - a bought from
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Our local museum's collection online, where visitors browse the objects and their stories.

Pages
  - Home (a landing page: hero, objects where on display is yes and footer)
  - Items (lists objects; search by name, summary, period, origin or material; filter by category or on display)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Objects
  Objects have:
  - a name (required)
  - an accession number (unique)
  - a summary
  - a story (formatted text)
  - pictures
  - a category (history, art, archaeology, natural history, textiles, tools or other, history by default)
  - a period
  - an origin
  - a material
  - on display (yes or no)
  - added on (a date, required, today by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Looks at the collection; only administrators add to it): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the items page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 119 files (119 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-10/smithable.content.yml:7:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  What is down in our IT systems, what is being fixed, and when it is back.

Pages
  - Components (lists components; filter by status)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: down, open, latest and per month)
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
  - expected back at (a date and time)
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
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved. The system is back.).
  The incident is over and the system is back, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - it (The IT team: writes incidents, their updates and planned maintenance, and keeps the systems' status): opens the components page, the incidents page, the maintenance page and the overview page; adds every kind of record; changes everyone's records
  - staff (Sees what is down and when it is back): opens the components page, the incidents page, the maintenance page and the overview page
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Town Services Status
  Check whether the municipality's online services are working, what is being fixed and what maintenance is planned.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
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
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause has been found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is in place. We are keeping an eye on it before closing this.).
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
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuel entries; filter by date)
  - Services (lists service visits; search by workshop or work; filter by kind or date)
  - Expenses (lists expenses; filter by category or date)
  - Overview (a dashboard: fuel costs, service costs, other costs and latest fill ups)

Fuel entries
  Fuel entries have:
  - a date (required, today by default)
  - an odometer (a whole number)
  - liters (a number, required)
  - a cost (an amount, required)
  - full tank (yes or no, true by default)
  - a station
  - a note
  The price per liter is calculated as the cost divided by the liters.

Service visits
  Service visits have:
  - a date (required, today by default)
  - an odometer (a whole number)
  - a workshop
  - a kind (regular, repair, tires, inspection or other, regular by default)
  - a work
  - a cost (an amount)
  - a receipt (a document)
  - a next service due (a date)

Expenses
  Expenses have:
  - a date (required, today by default)
  - a category (insurance, tax, parking, toll, washing, accessories or other, insurance by default)
  - an amount (an amount, required)
  - a note
  - a receipt (a document)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 129 files (129 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Our Wedding
  The guest list and seating plan for our wedding, with who has answered and their meal choices.

Pages
  - Guests (lists guests; search by name, household or email; filter by rsvp, meal or table; “Mark attending”; “Mark declined”)
  - Tables (lists tables)
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
  - a household
  - an email
  - a phone
  - a rsvp (waiting, attending or declined, waiting by default)
  - a meal (undecided, meat, fish, vegetarian, vegan or kids, undecided by default)
  - dietary notes
  - a table (a table)

Mark attending
  For a guest that is waiting or declined; sets rsvp to attending; asks for the meal.
  Record that the guest is coming, with their meal choice.

Mark declined
  For a guest that is waiting or attending; sets rsvp to declined.
  Record that the guest cannot come.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; changes everyone's guests and tables; deletes everyone's guests and tables
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Club Sightings
  The bird sightings of our birdwatching club: species, place, date and who saw it.

Pages
  - Species (lists specieses; search by name or scientific name)
  - Sightings (lists sightings; search by place or notes; filter by species, observer or seen on)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Specieses
  Specieses have:
  - a name (required, unique)
  - a scientific name
  Each species lists its sightings.

Sightings
  Sightings have:
  - species (a species, required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a count (a whole number, 1 by default)
  - notes
  Each sighting can have an observer (a user, who makes it, by default).
  The observer owns the sighting.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A club member who logs sightings and species): opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of who has which plot, the waiting list and the yearly fees of our allotment society.

Pages
  - Plots (lists plots; search by number or notes; filter by status or holder)
  - Members (lists members; search by name, email or phone)
  - Waiting list (lists waiting list; search by name or email; filter by status; “Offer plot”; “Allocate”; “Withdraw”)
  - Fees (lists fees; filter by status, year or member; “Mark paid”)
  - Overview (a dashboard: vacant plots, waiting and unpaid fees)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - address
  - joined on (a date, today by default)
  - notes
  Each member lists its plots.
  Each member lists its fees.

Plots
  Plots have:
  - a number (required, unique)
  - a size (a number)
  - status (vacant, let or reserved, vacant by default)
  - a holder (a member)
  - a date (since)
  - notes

Waiting list
  Waiting list have:
  - a name (required)
  - an email
  - a phone
  - added on (a date, required, today by default)
  - wishes
  - status (waiting, offered, allocated or withdrawn, waiting by default)

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (unpaid or paid, unpaid by default)
  - paid on (a date)

Mark paid
  For a fee that is unpaid; sets status to paid and paid on to today.
  Record that a member has paid the yearly fee.

Offer plot
  For a waiting list entry that is waiting; sets status to offered.
  Mark that a plot has been offered to this person.

Allocate
  For a waiting list entry that is offered; sets status to allocated.
  Mark that the person accepted a plot.

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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Frisörsalongen
  Onlinebokning för en frisörsalong där kunderna själva bokar tid hos sin frisör.

Pages
  - Hem (a landing page: hero, “Behandlingar”, “Frisörer”, call to action and footer)
  - Boka tid (a calendar of slots by week or month)
  - Tider (lists “Tider”; only for admins)
  - Behandlingar (lists “Behandlingar”; only for admins; visitors see “Behandlingar” on the Hem page)
  - Frisörer (lists “Frisörer”; only for admins; visitors see “Frisörer” on the Hem page)
  - Mina bokningar (lists “Bokningar”)
  - Integritet (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Administration (every kind of record, to find, open, change and delete; only for admins)

Behandlingar
  Behandlingar have:
  - a field “Namn” (required)
  - a field “Beskrivning”
  - a field “Tid (minuter)” (a whole number, required, 45 by default)
  - a field “Pris” (an amount)

Frisörer
  Frisörer have:
  - a field “Namn” (required)
  - a field “Om mig” (formatted text)
  - a field “Porträtt” (picture)
  Each “Frisör” lists its “Tider”.

Tider
  Tider have:
  - a field “Frisör” (a “Frisör”, required)
  - a field “Börjar” (a date and time, required)
  - a field “Platser” (a whole number, required, 1 by default)
  Each “Tid” lists its “Bokningar”.
  The “Platser kvar” is calculated as the “Platser” minus the number of its “Bokningar”.

Bokningar
  Bokningar have:
  - a field “Tid” (a “Tid”, required, unique)
  - a field “Behandling” (a “Behandling”, required)
  - a field “Telefon” (a phone number)
  - a field “Meddelande”
  At most the slot's capacity “Bokningar” per slot.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (En kund som bokar tid i salongen): opens the mina bokningar page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the hem page, the boka page, the integritet page, reading services, reading stylists and reading slots.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-17. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-17
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-17/smithable.content.yml:55:3  warning  The privacy page "integritet" does not say who runs the app: give the operator's name under pages.integritet.operator (name, address, email, country, hosting).
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkoll
  Offerter, kunder och fakturor för en liten byggfirma.

Pages
  - Kunder (lists “Kunder”; search by “Namn”, “E-post” or “Telefon”)
  - Offerter (lists “Offerter”; filter by “Kund” or “Status”; “Send quote”; “Accept quote”; “Decline quote”)
  - Fakturor (lists “Fakturor”; filter by “Kund” or “Status”; “Send invoice”; “Mark paid”)
  - Översikt (a dashboard: open quotes, outstanding, overdue and invoiced)
  - Användare (who has access: invite people, change roles, remove users; only for admins)

Kunder
  Kunder have:
  - a field “Namn” (required)
  - a field “E-post” (an email address)
  - a field “Telefon” (a phone number)
  - a field “Adress”
  - a field “Organisationsnummer”
  Each “Kund” lists its “Offerter”.
  Each “Kund” lists its “Fakturor”.

Offertrader
  Offertrader have:
  - a field “Beskrivning” (required)
  - a field “Antal” (a number, required, 1 by default)
  - a field “Enhet”
  - a field “À-pris” (an amount, required)
  - a field “Offert” (a “Offert”, required)
  The “Belopp” is calculated as the “Antal” times the “À-pris”.

Fakturarader
  Fakturarader have:
  - a field “Beskrivning” (required)
  - a field “Antal” (a number, required, 1 by default)
  - a field “Enhet”
  - a field “À-pris” (an amount, required)
  - a field “Faktura” (a “Faktura”, required)
  The “Belopp” is calculated as the “Antal” times the “À-pris”.

Offerter
  Offerter have:
  - a field “Offertnummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Rubrik” (required)
  - a field “Datum” (a date, required, today by default)
  - a field “Giltig till” (a date)
  - a field “Status” (“Utkast”, “Skickad”, “Accepterad” or “Avböjd”, “Utkast” by default)
  - a field “Anteckningar”
  Each “Offert” lists its “Offertrader”.
  The “Summa” is calculated as the total “Belopp” of its “Rader”.

Fakturor
  Fakturor have:
  - a field “Fakturanummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Offert” (a “Offert”)
  - a field “Fakturadatum” (a date, required, today by default)
  - a field “Förfallodatum” (a date, required)
  - a field “Status” (“Utkast”, “Skickad”, “Betald” or “Förfallen”, “Utkast” by default)
  Each “Faktura” lists its “Fakturarader”.
  The “Summa” is calculated as the total “Belopp” of its “Rader”.

Send quote
  For a “Offert” that is “Utkast”; sets “Status” to “Skickad”.
  Offerten har skickats till kunden.

Accept quote
  For a “Offert” that is “Skickad”; sets “Status” to “Accepterad”.
  Kunden har accepterat offerten.

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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 143 files (143 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-18. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-18
  smithable studio

or only run the app with smithable run.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Vår loppis på nätet: lägg upp saker du vill sälja, med bilder och pris.

Pages
  - Alla saker (lists “Saker”; search by “Rubrik”, “Beskrivning” or “Plats”; filter by “Kategori”, “Pris”, “Skick” or “Till salu”; sort by “Pris” or date added; records can be saved as favorites; contact the owner by mail)
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
  - a field “Kategori” (“Möbler”, “Kläder”, “Böcker”, “Elektronik”, “Barn”, “Kök” or “Övrigt”, “Möbler” by default)
  - a field “Skick” (“Som ny”, “Bra” or “Sliten”, “Som ny” by default)
  - a field “Plats”
  - a field “Till salu” (yes or no, true by default)
  Photos of “Saker” are reviewed before others see them; an item waits until its photos are.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Säljer och sparar saker): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 129 files (129 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-19
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-19/smithable.content.yml:37:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudion varaukset
  Joogastudion tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Etusivu (a landing page: hero, class types, call to action and footer)
  - Tunnit (lists sessions; only for admins)
  - Tuntityypit (lists class types; filter by level; only for admins; visitors see class types on the Etusivu page)
  - Ohjaajat (lists instructors)
  - Omat varaukset (lists bookings)
  - Lukujarjestys (a calendar of sessions by week or month)
  - Tietosuoja (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Hallinta (every kind of record, to find, open, change and delete; only for admins)

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

Bookings
  Bookings have:
  - a session (a session, required, unique)
  At most the session's capacity bookings per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Joogaaja, joka varaa paikkoja tunneille): opens the omat varaukset page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the etusivu page, the lukujarjestys page, the ohjaajat page, the tietosuoja page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-20/smithable.content.yml:3:3  warning  The privacy page "tietosuoja" does not say who runs the app: give the operator's name under pages.tietosuoja.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Korjaamo
  Pienen autokorjaamon asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Huoltotyot (lists service jobs; filter by status, mechanic or date; “Start job”; “Complete job”)
  - Asiakkaat (lists customers; search by name, email or phone)
  - Autot (lists cars; search by registration, make or car model)
  - Laskut (lists invoices; search by number; filter by status, customer or due date; “Send invoice”; “Mark paid”)
  - Tiimi (who has access: invite people, change roles, remove users; only for admins)

Customers
  Customers have:
  - a name (required)
  - an email (unique)
  - a phone
  - address
  - notes
  Each customer lists its cars.
  Each customer lists its invoices.
  Deleted customers stay in the trash for thirty days, where they can be restored.

Cars
  Cars have:
  - a registration (required, unique)
  - a make (required)
  - a car model
  - a year (a whole number)
  - a mileage (a whole number)
  - a customer (a customer, required)
  Each car lists its service jobs.

Service jobs
  Service jobs have:
  - a car (a car, required)
  - a description (required)
  - status (booked, in progress, done or canceled, booked by default)
  - a date (required)
  - hours (a number)
  - a labor cost (an amount)
  - a parts cost (an amount)
  Each service job can have a mechanic (a user).
  The total is calculated as the labor cost plus the parts cost.

Invoices
  Invoices have:
  - a number (required, unique)
  - a customer (a customer, required)
  - a job (a service job)
  - status (draft, sent or paid, draft by default)
  - an amount (an amount, required)
  - issued on (a date, today by default)
  - a due date
  - paid on (a date)
  Deleted invoices stay in the trash for thirty days, where they can be restored.

Start job
  For a service job that is booked; sets status to in progress and mechanic to whoever presses it.

Complete job
  For a service job that is in progress; sets status to done.

Send invoice
  For an invoice that is draft; sets status to sent.

Mark paid
  For an invoice that is sent; sets status to paid and paid on to today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Korjaamon työntekijä: asiakkaat, autot, huoltotyöt ja laskut): opens the huoltotyot page, the asiakkaat page, the autot page and the laskut page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Unsere Produkte, Vorbestellungen der Kunden und die Abholzeiten des Hofladens.

Pages
  - Bestellungen (lists orders; filter by status or pickup; sort by date added; “Accept”; “Ready”; “Collected”; “Decline”)
  - Produkte (lists products; filter by category or available; “Sold out”; “Back on”)
  - Abholzeiten (lists pickup slots)
  - Abholung (a landing page: hero, pickup slots and footer)
  - Datenschutz (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Products
  Products have:
  - a name (required)
  - a description
  - a price (an amount, required)
  - a unit
  - a category (vegetables, fruit, eggs, dairy, meat, bakery or preserves, vegetables by default)
  - a picture
  - available (yes or no, true by default)

Pickup slots
  Pickup slots have:
  - a day (a date, required)
  - hours (required)
  - a note

Orders
  Orders have:
  - a name (required)
  - a phone (required)
  - an email
  - a pickup (a pickup slot)
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

Sold out
  For a product that is available; sets available to no.
  Heute nichts mehr davon.

Back on
  For a product that is not available; sets available to yes.
  Kann wieder bestellt werden.

Accept
  For an order that is new; sets status to accepted.
  Wir nehmen die Bestellung an.

Ready
  For an order that is accepted; sets status to ready.
  Die Bestellung liegt zur Abholung bereit.

Collected
  For an order that is ready; sets status to collected.
  Der Kunde hat sie abgeholt.

Decline
  For an order that is new or accepted; sets status to declined; asks for the reason.
  Die Bestellung geht nicht: sag warum.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Nimmt Bestellungen an und pflegt Produkte und Abholzeiten): opens the bestellungen page, the produkte page and the abholzeiten page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the abholung page, the datenschutz page, reading products, reading pickup slots and adding orders.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7gSKvi/app-22/smithable.content.yml:3:3  warning  The privacy page "datenschutz" does not say who runs the app: give the operator's name under pages.datenschutz.operator (name, address, email, country, hosting).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker
  Keep track of your habits with daily check-ins and streaks.

Pages
  - Habits (lists habits; search by name or description; filter by frequency or active)
  - Check ins (lists check ins; filter by habit or date)
  - Calendar (a calendar of check ins by week or month)

Habits
  Habits have:
  - a name (required)
  - a description
  - a frequency (daily, weekdays or weekly, daily by default)
  - active (yes or no, true by default)
  - started on (a date, required, today by default)
  - a current streak (a whole number, 0 by default, filled by the app)
  - a longest streak (a whole number, 0 by default, filled by the app)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required, today by default)
  - a note

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change habits and check ins with a key.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 113 files (113 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Project Memory
  Tasks and notes, grouped by project, that my AI assistant keeps for me.

Pages
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

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
  - assistant (The AI assistant's key: reads everything, adds and changes tasks and notes, never deletes): adds tasks and notes; changes everyone's tasks and notes
  New users get the assistant role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-7gSKvi/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7gSKvi/app-24
  smithable studio

or only run the app with smithable run.
```
