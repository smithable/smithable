# M12 first builds: claude-code, the second set (2026-10-25; 5 rerun since)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 24 / 24 created, 23 type-check, 1,553,492 tokens (1,489,994 in, 63,498 out), €0.0000 + $2.4371 (as Claude Code reports it); 1 model calls answered from the response cache. Rows marked *rerun* ran again on their own after the full run (`--only`). *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 96,516 | 3,409 | $0.1236 | 0 | 2 | 59 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. *(rerun 2026-10-25)* | crm | yes | yes | 47,874 | 2,129 | $0.4256 | 0 | 1 | 46 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | barbers | yes | yes | 47,958 | 2,152 | $0.0683 | 0 | 1 | 46 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 47,161 | 1,387 | $0.0467 | 0 | 1 | 34 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 48,085 | 2,101 | $0.0683 | 0 | 1 | 37 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 96,910 | 3,905 | $0.1366 | 0 | 2 | 52 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 47,364 | 1,636 | $0.0533 | 0 | 1 | 27 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 47,368 | 1,855 | $0.0577 | 0 | 1 | 28 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 47,155 | 1,659 | $0.0520 | 0 | 1 | 51 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 47,157 | 1,154 | $0.0420 | 0 | 1 | 39 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 48,302 | 2,486 | $0.0778 | 0 | 1 | 44 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 48,299 | 2,602 | $0.0801 | 0 | 1 | 45 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 47,149 | 1,913 | $0.0571 | 0 | 1 | 51 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. *(rerun 2026-10-25)* | records | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 16 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. *(rerun 2026-10-25)* | records | yes | yes | 94,789 | 1,492 | $0.0707 | 0 | 2 | 62 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 47,160 | 2,463 | $0.0682 | 0 | 1 | 45 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | barbers | yes | yes | 48,009 | 3,276 | $0.0912 | 0 | 1 | 60 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 149,246 | 7,870 | $0.2763 | 0 | 3 | 93 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 47,422 | 2,561 | $0.0722 | 0 | 1 | 48 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 147,585 | 5,712 | $0.2198 | 0 | 3 | 77 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. *(rerun 2026-10-25)* | crm | yes | yes | 47,848 | 4,040 | $0.1049 | 0 | 1 | 62 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | yes | yes | 48,024 | 4,511 | $0.1160 | 0 | 1 | 51 s |
| A backend for my habit app: habits, daily check-ins and streaks. *(rerun 2026-10-25)* | records | yes | **no** | 95,173 | 2,200 | $0.0879 | 0 | 2 | 47 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 47,440 | 985 | $0.0408 | 0 | 1 | 20 s |

Each created app's four spec files are in [m12-first-builds-claude-code-wide/](m12-first-builds-claude-code-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 24 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: booking) | 3 | 1 / 4 (has 3) | 2 / 7 (has 4) | 1 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 3 | 0 / 2 (has 2) | 1 / 3 (has 4) | 0 / 1 (has 2) | shared; admin, sales (sales) | none | pages none; read none; create none | 1 (no-timezone) | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 3 | barbers | 3 | 3 / 4 (has 4) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read Service, Stylist; create none | 2 (no-timezone, operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | en | | | | |
| 4 | records (words: barbers) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 3 | 3 / 4 (has 4) | 3 / 7 (has 4) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 3 | 2 / 4 (has 3) | 3 / 7 (has 5) | 3 / 3 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace | 3 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: invoicing) | 3 | 1 / 1 (has 2) | 1 / 5 (has 4) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 1 (capacity-no-unique) | none |  | none | 1 / 2 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 1 / 1 (has 1) | 2 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, items, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 3 | 4 / 4 (has 4) | 5 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, it, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 4 / 4 | no mention; no landing page | en | | | | |
| 12 | status (words: barbers) | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: barbers) | 3 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 4) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 3 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | barbers (words: records) | 3 (sv: yes (kunderna, ett, för)) | 4 / 4 (has 4) | 7 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read Service, Barber; create none | 1 (operator-unknown) | none |  | none | 2 / 4 | no mention; landing page | sv | no | yes (till, bokning, tid) | yes (boka, på, nätet) | models 4/4, fields 19/19, pages 7/7 |
| 18 | invoicing (words: records) | 3 (sv: yes (ska, en)) | 2 / 4 (has 5) | 0 / 7 (has 5) | 3 / 3 (has 6) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 5 | no mention; no landing page | sv | no | yes (offerter, fakturor, till) | none | models 5/5, fields 32/32, pages 5/5 |
| 19 | marketplace (words: records) | 3 (sv: yes (ska, lägga, saker)) | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | no mention; landing page | sv | no | yes (bilder, pris, till) | yes (på, vår, loppis) | models 1/1, fields 8/8, pages 6/6 |
| 20 | booking (words: records) | 3 (fi: yes (tai)) | 4 / 6 (has 4) | 1 / 12 (has 8) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, lukujarjestys, tietosuoja; read Instructor, Session, ClassType; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page | fi | no | yes (tunnit, varaukset, varaus) | yes (ja, verkossa) | models 4/4, fields 17/17, pages 8/8 |
| 21 | crm (words: records) | 3 (fi: yes (laskut)) | 1 / 2 (has 4) | 0 / 3 (has 5) | 0 / 1 (has 4) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page | fi | no | none | none | models 0/4, fields 0/33, pages 0/5 |
| 22 | kiosk (words: records) | 3 (de: yes (die, vorbestellungen, abholzeiten)) | 2 / 4 (has 4) | 1 / 6 (has 6) | 6 / 6 (has 6) | shared; admin, staff (staff) | none | pages abholung, datenschutz; read Product, PickupTime; create Order | 1 (operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | de | yes (hofladen) | none | no | models 0/4, fields 0/24, pages 0/6 |
| 23 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 4) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 1 | 3 / 3 (has 3) | 2 / 2 (has 2) | 2 / 2 (has 2) | shared; admin, member, assistant (member) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Wordfolio
  A freelance translator's record of clients, the quotes sent to them and the payments received.

Pages
  - Clients (lists clients; search by name, company or email)
  - Quotes (lists quotes; filter by client, status or quoted on; “Mark sent”; “Mark accepted”; “Mark declined”)
  - Payments (lists payments; filter by quote, paid on or method)
  - Overview (a dashboard: quoted, accepted, received and latest payments)

Clients
  Clients have:
  - a name (required)
  - a company
  - an email
  - a phone
  - languages
  - notes
  Each client lists its quotes.

Quotes
  Quotes have:
  - a title (required)
  - a client (a client, required)
  - a source language
  - a target language
  - words (a whole number)
  - an amount (an amount, required)
  - quoted on (a date, required, today by default)
  - a deadline (a date)
  - status (draft, sent, accepted or declined, draft by default)
  - a document (a document)
  Each quote lists its payments.
  The paid is calculated as the total amount of its payments.
  The balance is calculated as the amount minus the paid.

Payments
  Payments have:
  - a quote (a quote, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, paypal, cash or other, bank transfer by default)
  - a note

Mark sent
  For a quote that is draft; sets status to sent.
  The quote went to the client.

Mark accepted
  For a quote that is draft or sent; sets status to accepted.
  The client accepted the quote.

Mark declined
  For a quote that is draft or sent; sets status to declined.
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
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Agency Pipeline
  A sales pipeline for our web agency: leads, deals and who follows up when.

Pages
  - Deals (lists deals; search by title or lead; filter by stage, assigned to, next follow up or expected close; “Mark won”; “Mark lost”)
  - Leads (lists leads; search by name, company or email; filter by status, source, assigned to or next follow up)
  - Follow ups (a calendar of deals by week or month)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Leads
  Leads have:
  - a name (required)
  - a company
  - an email
  - a phone
  - a source (referral, website, event, outreach or other, referral by default)
  - status (new, contacted, qualified or lost, new by default)
  - a next follow up (a date)
  - notes
  Each lead can have an assigned to (a user).
  Each lead lists its deals.
  The assigned to owns the lead.
  Deleted leads stay in the trash for thirty days, where they can be restored.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a stage (discovery, proposal, negotiation, won or lost, discovery by default)
  - a value (an amount)
  - an expected close (a date)
  - a next follow up (a date)
  - a follow up note
  - notes
  Each deal can have an assigned to (a user).
  The assigned to owns the deal.
  Deleted deals stay in the trash for thirty days, where they can be restored.

Mark won
  For a deal that is discovery, proposal or negotiation; sets stage to won.
  Mark the deal as won.

Mark lost
  For a deal that is discovery, proposal or negotiation; sets stage to lost.
  Mark the deal as lost.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with leads and deals): opens the deals page, the leads page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 128 files (128 changed, 0 removed).

Created /tmp/smithable-bench-m12-v3aL0o/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-v3aL0o/app-2
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-v3aL0o/app-2/smithable.yml:48:14  warning  Page "followUps" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Shear Studio
  Online booking for a hair salon: customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Appointments (lists appointments; filter by status; “Confirm”; “Cancel”)
  - Day (a calendar of appointments by week or month; only for admins)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Time off (lists time offs; only for admins)
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
  Stylists are booked by their time: Tue–Fri 09:00–18:00, Sat 09:00–15:00, a break 12:00–12:30, 10 minutes kept free after each booking, away during their time offs (by their fields from and until).

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
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-3/smithable.yml:57:14  warning  Page "day" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-GBijuV/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Lessons
  Keep track of my piano pupils, their weekly lesson times and what each one practises.

Pages
  - Pupils (lists pupils; search by name or notes; filter by weekday, level or active)
  - Practice (lists pieces; search by title or composer; filter by pupil or status; “Start polishing”; “Mark done”)

Pupils
  Pupils have:
  - a name (required)
  - a weekday (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a start time
  - minutes (a whole number, 30 by default)
  - a level (beginner, intermediate or advanced, beginner by default)
  - an email
  - a phone
  - notes
  - active (yes or no, true by default)
  Each pupil lists its pieces.

Pieces
  Pieces have:
  - a title (required)
  - a composer
  - a pupil (a pupil, required)
  - status (learning, polishing or done, learning by default)
  - focus
  - started on (a date, today by default)

Start polishing
  For a piece that is learning; sets status to polishing.

Mark done
  For a piece that is learning or polishing; sets status to done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Shutter Ledger
  Invoices for my photography work: clients, shoots and what is still unpaid.

Pages
  - Overview (a dashboard: latest)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Shoots (lists shoots; filter by client, status, kind or date)
  - Clients (lists clients)

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
  - a kind (portrait, wedding, event, product, commercial or other, portrait by default)
  - status (planned, shot or delivered, planned by default)
  - notes
  Each shoot lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - a shoot (a shoot)
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
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Mark overdue
  7 days after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Tidy Ledger
  Monthly invoicing for a small cleaning company: households, their invoices and what has been paid.

Pages
  - Households (lists households; search by name, email or phone)
  - Invoice lines (lists invoice lines)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Invoices (lists invoices; filter by household, status or issued on; “Mark sent”; “Mark paid”; “Mark overdue”; “Invoice next month”)
  - Overview (a dashboard: outstanding, overdue, paid, invoiced and latest)

Households
  Households have:
  - a name (required)
  - an email (required)
  - a phone
  - address
  - notes
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
  - a household (a household, required)
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

Invoice next month
  Makes a copy of an invoice with status draft and issued on today, asking for the number and the due on; its lines are copied too.
  Start next month's invoice for the same household from this one.

Invoice sent
  When “Mark sent” runs on a invoice: mails household's email.

Overdue check
  7 days after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; changes everyone's records; deletes everyone's records
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 141 files (141 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-6
  smithable studio

or only run the app with smithable run.
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Anyone in town can post things to sell, with photos and a price, and neighbors browse and get in touch.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Home (a landing page: hero, items where available is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)

Items
  Items have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a price (an amount)
  - a category (furniture, clothing, books, bikes, electronics, sports, kids, household or other, furniture by default)
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
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Shelf (lists items; search by title, description or pick-up spot; filter by category, condition or status; records can be saved as favorites)
  - My items (lists items; only the viewer's own records)
  - My claims (lists claims; only the viewer's own records)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description
  - a category (furniture, electronics, books, kitchen, stationery, clothing or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a pick-up spot
  - status (available or given, available by default)
  Each item lists its claims.

Claims
  Claims have:
  - an item (an item, required)
  - a note
  At most 1 claims per item.

Mark given
  For an item that is available; sets status to given.
  Mark an item as handed over to the colleague who claimed it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 129 files (129 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-8/smithable.yml:22:7  warning  Claim has a capacity per item, but "item" is not unique: one person can take several places.
    hint: Write "item: Item! unique" for one claim per person and item (unique per owner with private access).
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Crate Digger
  A personal catalogue of my vinyl records: the albums, their artists, their condition and what I paid.

Pages
  - Albums (lists albums; search by title, label, genre or notes; filter by artist, condition, year or what i paid; sort by title, year, what i paid or bought on)
  - Artists (lists artists; search by name or country)

Artists
  Artists have:
  - a name (required)
  - a country
  - notes
  Each artist lists its albums.

Albums
  Albums have:
  - a title (required)
  - an artist (an artist, required)
  - a year (a whole number)
  - a label
  - a genre
  - a cover (picture)
  - a condition (mint (m), near mint (nm), very good plus (vg+), very good (vg), good (g), fair (f) or poor (p), mint (m) by default)
  - a what i paid (an amount)
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
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Our local museum's collection online, so visitors can browse the objects and their stories.

Pages
  - Home (a landing page: hero, objects where on display is yes and footer)
  - Collection (lists objects; search by name, summary, maker, origin or period; filter by category or on display)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Objects
  Objects have:
  - a name (required)
  - a picture
  - pictures
  - a summary
  - a story (formatted text)
  - a category (tools, textiles, furniture, art, photographs, documents or other, tools by default)
  - a period
  - a maker
  - an origin
  - on display (yes or no)
  - added on (a date, required, today by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page
  New users get the member role.
  Open to anyone without signing in: the home page, the items page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 122 files (122 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-10/smithable.content.yml:7:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  The state of our IT systems: what is down, what is being fixed and when it is back.

Pages
  - Components (lists components)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open, down and latest)
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
  - it (The IT team: writes incidents, updates and planned maintenance): opens the components page, the incidents page, the maintenance page and the overview page; adds every kind of record; changes everyone's records
  - staff (Reads what is down and when it is back): opens the components page, the incidents page, the maintenance page and the overview page
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Town Services Status
  Check whether the municipality's online services are working, what is being fixed and what work is planned.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A log of my car's fuel, service visits and costs.

Pages
  - Fuel (lists fuel-ups; filter by date)
  - Service visits (lists service visits; search by workshop or work; filter by kind or date)
  - Other costs (lists expenses; filter by category or date)
  - Overview (a dashboard: fuel costs, service costs, other costs and latest fuel)

Fuel-ups
  Fuel-ups have:
  - a date (required, today by default)
  - an odometer (km) (a whole number, required)
  - liters (a number, required)
  - a total (an amount, required)
  - full tank (yes or no, true by default)
  - a station
  - a note
  The price per liter is calculated as the total divided by the liters.

Service visits
  Service visits have:
  - a date (required, today by default)
  - a kind (regular, repair, tires, inspection or other, regular by default)
  - a workshop
  - an odometer (km) (a whole number)
  - a work
  - a cost (an amount)
  - a receipt (a document)

Expenses
  Expenses have:
  - a date (required, today by default)
  - a category (insurance, tax, parking, tolls, washing or other, insurance by default)
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
Pictures from the Smithable image library: logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Wedding Guests
  The guest list and seating plan for our wedding, with who has answered and their meal choices.

Pages
  - Guests (lists guests; search by name, email or dietary notes; filter by rsvp, meal, table or side; “Mark attending”; “Mark declined”)
  - Tables (lists tables)
  - Overview (a dashboard: attending, waiting and declined)
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
  - an email
  - a phone
  - a side (both, bride or groom, both by default)
  - a rsvp (waiting, attending or declined, waiting by default)
  - a meal (undecided, meat, fish, vegetarian, vegan or child, undecided by default)
  - dietary notes
  - a table (a table)
  - notes

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
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-M59UCw/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-M59UCw/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Club Sightings
  Bird sightings logged by our birdwatching club: species, place, date and who saw it.

Pages
  - Species (lists specieses; search by name or scientific name)
  - Sightings (lists sightings; search by place or notes; filter by species, observer or seen on)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Specieses
  Specieses have:
  - a name (required, unique)
  - a scientific name
  - notes
  Each species lists its sightings.

Sightings
  Sightings have:
  - species (a species, required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a count (a whole number, 1 by default)
  - notes
  - a photo (picture)
  Each sighting can have an observer (a user, who makes it, by default).
  The observer owns the sighting.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-v3aL0o/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-v3aL0o/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of who has which plot, the waiting list for plots and each member's yearly fee.

Pages
  - Plots (lists plots; search by number, area or notes; filter by status or member)
  - Members (lists members; search by name, email or phone; filter by status)
  - Waiting list (lists waiting list; filter by status or applied on; “Offer plot”; “Mark allotted”; “Withdraw”)
  - Fees (lists fees; filter by status, year or member; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - address
  - joined on (a date, required, today by default)
  - status (active or left, active by default)
  - notes
  Each member lists its plots.
  Each member lists its fees.

Plots
  Plots have:
  - a number (required, unique)
  - an area
  - a size sqm (a whole number)
  - status (let or vacant, let by default)
  - a member (a member)
  - a date (since)
  - notes
  A plot is named after its number.

Waiting list
  Waiting list have:
  - a name (required)
  - an email
  - a phone
  - applied on (a date, required, today by default)
  - a wish
  - status (waiting, offered, allotted or withdrawn, waiting by default)

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (due or paid, due by default)
  - paid on (a date)
  A fee is named after its member and its year.

Mark paid
  For a fee that is due; sets status to paid and paid on to today.
  Record that the yearly fee has been paid.

Offer plot
  For a waiting list entry that is waiting; sets status to offered.
  Mark that a plot has been offered to this applicant.

Mark allotted
  For a waiting list entry that is waiting or offered; sets status to allotted.
  Mark that the applicant has been given a plot.

Withdraw
  For a waiting list entry that is waiting or offered; sets status to withdrawn.
  Take the applicant off the waiting list.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; changes everyone's records
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Salong Sax & Kam
  Tidsbokning hos frisörsalongens frisörer, som kunderna gör själva på nätet.

Pages
  - Hem (a landing page: hero, “Tjänster”, “Frisörer” and footer)
  - Bokningar (lists “Bokningar”; filter by “Status”; “Confirm”; “Cancel”)
  - Dagen (a calendar of appointments by week or month; only for admins)
  - Tjänster (lists “Tjänster”; only for admins; visitors see “Tjänster” on the Hem page)
  - Frisörer (lists “Frisörer”; only for admins; visitors see “Frisörer” on the Hem page)
  - Ledighet (lists “Ledigheter”; only for admins)
  - Integritet (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tjänster
  Tjänster have:
  - a field “Namn” (required)
  - a field “Beskrivning”
  - a field “Minuter” (a whole number, required, 30 by default)
  - a field “Pris” (an amount)

Frisörer
  Frisörer have:
  - a field “Namn” (required)
  - a field “Om mig”
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
  - a field “Tjänst” (a “Tjänst”, required)
  - a field “Frisör” (a “Frisör”, required)
  - a field “Tid” (a date and time, required)
  - a field “Namn” (required)
  - a field “Telefon” (a phone number)
  - a field “Meddelande”
  - a field “Status” (“Förfrågad”, “Bekräftad” or “Avbokad”, “Förfrågad” by default, filled by the app)
  A “Bokning” takes its “Frisör”'s time from its “Tid” for the number of minutes in its “Tjänst”'s minutes while status is requested or confirmed; whoever made it may cancel it until 12 hours before.

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
  - admin (Salongen. Sköter tjänsterna, frisörerna och deras ledighet; bekräftar bokningar): everything
  - member (En kund som bokar tid): opens the appointments page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading barbers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-17. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-17
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-17/smithable.content.yml:68:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkollen
  Offerter, kunder och fakturor för en liten byggfirma.

Pages
  - Kunder (lists “Kunder”; search by “Namn”, “E-post” or “Telefon”)
  - Offerter (lists “Offerter”; filter by “Kund” or “Status”; “Send quote”; “Accept quote”; “Decline quote”)
  - Fakturor (lists “Fakturor”; filter by “Kund” or “Status”; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Översikt (a dashboard: outstanding, overdue, open quotes and latest quotes)
  - Användare (who has access: invite people, change roles, remove users; only for admins)

Kunder
  Kunder have:
  - a field “Namn” (required)
  - a field “E-post” (an email address)
  - a field “Telefon” (a phone number)
  - a field “Adress”
  Each “Kund” lists its “Offerter”.
  Each “Kund” lists its “Fakturor”.

Offertrader
  Offertrader have:
  - a field “Beskrivning” (required)
  - a field “Antal” (a number, required, 1 by default)
  - a field “À-pris” (an amount, required)
  - a field “Offert” (a “Offert”, required)
  The “Belopp” is calculated as the “Antal” times the “À-pris”.

Fakturarader
  Fakturarader have:
  - a field “Beskrivning” (required)
  - a field “Antal” (a number, required, 1 by default)
  - a field “À-pris” (an amount, required)
  - a field “Faktura” (a “Faktura”, required)
  The “Belopp” is calculated as the “Antal” times the “À-pris”.

Offerter
  Offerter have:
  - a field “Offertnummer” (required, unique)
  - a field “Kund” (a “Kund”, required)
  - a field “Arbete” (required)
  - a field “Datum” (a date, required, today by default)
  - a field “Giltig till” (a date)
  - a field “Status” (“Utkast”, “Skickad”, “Godkänd” or “Avböjd”, “Utkast” by default)
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
  For a “Offert” that is “Skickad”; sets “Status” to “Godkänd”.
  Kunden har godkänt offerten.

Decline quote
  For a “Offert” that is “Skickad”; sets “Status” to “Avböjd”.
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

Mark overdue
  A day after a “Faktura”'s due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 149 files (149 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-18. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-18
  smithable studio

or only run the app with smithable run.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Lägg upp saker du vill sälja på vår loppis, med bilder och pris, och hitta fynd från andra.

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
  - a field “Kategori” (“Möbler”, “Kläder”, “Böcker”, “Barn”, “Kök”, “Elektronik” or “Övrigt”, “Möbler” by default)
  - a field “Skick” (“Som ny”, “Bra skick” or “Sliten”, “Som ny” by default)
  - a field “Plats”
  - a field “Till salu” (yes or no, true by default)
  Photos of “Saker” are reviewed before others see them; an item waits until its photos are.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Lägger upp saker att sälja och sparar andras): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-19
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-19/smithable.content.yml:37:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogavaraus
  Joogastudion tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Etusivu (a landing page: hero, ohjaajat, call to action, tuntityypit and footer)
  - Lukujärjestys (a calendar of sessions by week or month)
  - Omat varaukset (lists varaukset)
  - Tunnit (lists tunnit; filter by tuntityyppi, ohjaaja or alkaa; sort by alkaa or paikkoja; only for admins)
  - Ohjaajat (lists ohjaajat; only for admins; visitors see ohjaajat on the Etusivu page)
  - Tietosuoja (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Ylläpito (every kind of record, to find, open, change and delete; only for admins)
  - Tuntityypit (lists tuntityypit; filter by taso; only for admins; visitors see tuntityypit on the Etusivu page)

Ohjaajat
  Ohjaajat have:
  - a nimi (required)
  - an esittely (formatted text)
  - a kuva (picture)
  Each ohjaaja lists its tunnit.

Tunnit
  Tunnit have:
  - an ohjaaja (an ohjaaja, required)
  - an alkaa (a date and time, required)
  - a paikkoja (a whole number, required, 12 by default)
  - a tuntityyppi (a tuntityyppi, required)
  Each tunti lists its varaukset.
  The vapaita paikkoja is calculated as the paikkoja minus the number of its varaukset.
  A tunti is named after its tuntityyppi and its alkaa.

Varaukset
  Varaukset have:
  - a tunti (a tunti, required, unique)
  Each varaus can have an osallistuja (a user).
  The osallistuja owns the varaus.
  At most the session's capacity varaukset per session.
  A varaus is added until the session's alkaa.
  Its owner deletes it until the session's alkaa.
  A varaus is named after its tunti.

Tuntityypit
  Tuntityypit have:
  - a nimi (required)
  - kuvaus
  - a taso (kaikki tasot, aloittelijat or edistyneet, kaikki tasot by default)
  - a kesto (min) (a whole number, required, 60 by default)
  Each tuntityyppi lists its tunnit.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens the omat varaukset page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the lukujarjestys page, the tietosuoja page, reading instructors, reading sessions and reading class types.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 159 files (159 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-20/smithable.content.yml:58:3  warning  The privacy page "tietosuoja" does not say who runs the app: give the operator's name under pages.tietosuoja.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Korjaamo
  Pienen autokorjaamon asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Tyot (lists jobs; search by title; filter by status, car, mechanic or date; “Start job”; “Complete job”)
  - Asiakkaat (lists customers; search by name, email or phone)
  - Autot (lists cars; search by registration, make or car model; filter by customer)
  - Laskut (lists invoices; search by number; filter by status, customer or due date; “Send invoice”; “Mark paid”)
  - Tiimi (who has access: invite people, change roles, remove users; only for admins)

Customers
  Customers have:
  - a name (required)
  - an email
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
  - a vin
  - a mileage (a whole number)
  - a customer (a customer, required)
  Each car lists its jobs.

Jobs
  Jobs have:
  - a title (required)
  - a car (a car, required)
  - status (booked, in progress or done, booked by default)
  - a date (today by default)
  - a description
  - hours (a number)
  - a labor cost (an amount)
  - a parts cost (an amount)
  Each job can have a mechanic (a user).
  The total is calculated as the labor cost plus the parts cost.

Invoices
  Invoices have:
  - a number (required, unique)
  - a customer (a customer, required)
  - a job (a job)
  - status (draft, sent or paid, draft by default)
  - an amount (an amount, required)
  - issued on (a date, today by default)
  - a due date
  - paid on (a date, filled by the app)
  Deleted invoices stay in the trash for thirty days, where they can be restored.

Start job
  For a job that is booked; sets status to in progress and mechanic to whoever presses it.
  Aloita työ ja ota se itsellesi.

Complete job
  For a job that is booked or in progress; sets status to done.
  Merkitse työ valmiiksi.

Send invoice
  For an invoice that is draft; sets status to sent.
  Merkitse lasku lähetetyksi.

Mark paid
  For an invoice that is sent; sets status to paid and paid on to today.
  Merkitse lasku maksetuksi.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Korjaamon työntekijä: hoitaa asiakkaat, autot, työt ja laskut): opens the tyot page, the asiakkaat page, the autot page and the laskut page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 144 files (144 changed, 0 removed).

Created /tmp/smithable-bench-m12-v3aL0o/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-v3aL0o/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Unser kleiner Hofladen: Produkte vorbestellen und zur passenden Abholzeit am Hof abholen.

Pages
  - Bestellungen (lists orders; filter by status or pickup; sort by date added; “Accept”; “Ready”; “Collected”; “Decline”)
  - Produkte (lists products; filter by category or available; “Sold out”; “Back on”)
  - Abholzeiten (lists pickup times)
  - Abholung (a landing page: hero, pickup times and footer)
  - Datenschutz (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Products
  Products have:
  - a name (required)
  - a description
  - a price (an amount, required)
  - a unit
  - a category (vegetables, fruit, eggs, dairy, meat, bakery or other, vegetables by default)
  - a picture
  - available (yes or no, true by default)

Pickup times
  Pickup times have:
  - a day (a date, required)
  - hours (required)
  - a note

Orders
  Orders have:
  - a name (required)
  - a phone (required)
  - an email
  - a pickup (a pickup time)
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
  Heute nicht mehr vorrätig.

Back on
  For a product that is not available; sets available to yes.
  Kann wieder bestellt werden.

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
  Die Bestellung kann nicht erfüllt werden: Grund angeben.

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
  - staff (Nimmt die Vorbestellungen an und pflegt Produkte und Abholzeiten): opens the bestellungen page, the produkte page and the abholzeiten page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the abholung page, the datenschutz page, reading products, reading pickup times and adding orders.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 157 files (157 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-GBijuV/app-22/smithable.content.yml:3:3  warning  The privacy page "datenschutz" does not say who runs the app: give the operator's name under pages.datenschutz.operator (name, address, email, country, hosting).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker
  Keep track of your habits with daily check-ins and streaks.

Pages
  - Habits (lists habits; search by name or description; filter by status or frequency; “Reset streak”; “Pause”; “Resume”; “Check in”)
  - Check ins (lists check ins; filter by habit or date)

Habits
  Habits have:
  - a name (required)
  - a description
  - a frequency (daily, weekdays or weekly, daily by default)
  - status (active, paused or archived, active by default)
  - started on (a date, required, today by default)
  - a current streak (a whole number, 0 by default, filled by the app)
  - a last check in (a date, filled by the app)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required, today by default)
  - a note
  No two check ins have the same habit and date for one owner.

Reset streak
  Sets current streak to 0.
  Start the habit's streak over after a missed day.

Pause
  For a habit that is active; sets status to paused.

Resume
  For a habit that is paused; sets status to active.

Check in
  For a habit that is active; sets last check in to today; asks for the check in's note; adds a check in (date today).
  Check in on a habit for today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change habits and check ins with a key, and run check in, reset streak, pause and resume.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-v3aL0o/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-v3aL0o/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Project Memory
  My tasks and notes, grouped by project, kept by my AI assistant.

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
  - member (Works with the tasks and notes): opens the admin page; adds every kind of record; changes everyone's records; deletes everyone's records
  - assistant (The AI assistant's key: reads everything, adds and changes tasks and notes, never deletes): adds tasks and notes; changes everyone's tasks and notes
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-GBijuV/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-GBijuV/app-24
  smithable studio

or only run the app with smithable run.
```
