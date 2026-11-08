# M12 first builds: claude-code, the second set (2026-11-08)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 24 / 24 created, 24 type-check, 1,299,634 tokens (1,244,235 in, 55,399 out), €0.0000 + $1.7043 (as Claude Code reports it); 13 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | yes | yes | 0 | 0 | €0.0000 | 2 | 2 | 26 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 27 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | barbers | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 27 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | records | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 22 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | yes | yes | 0 | 0 | €0.0000 | 2 | 2 | 24 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | yes | yes | 0 | 0 | €0.0000 | 2 | 2 | 24 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 23 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 22 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | yes | yes | 0 | 0 | €0.0000 | 2 | 2 | 21 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 64,379 | 2,542 | $0.0734 | 0 | 2 | 77 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 65,748 | 3,488 | $0.1032 | 0 | 2 | 87 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 65,741 | 2,927 | $0.0920 | 0 | 2 | 77 s |
| A log of my car's fuel, service visits and costs. | records | yes | yes | 64,371 | 2,575 | $0.0740 | 0 | 2 | 67 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | yes | yes | 64,383 | 1,998 | $0.0625 | 0 | 2 | 54 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 129,336 | 2,168 | $0.0930 | 0 | 3 | 58 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 64,381 | 3,153 | $0.0856 | 0 | 2 | 77 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | barbers | yes | yes | 65,363 | 4,478 | $0.1200 | 0 | 2 | 67 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | yes | yes | 202,176 | 8,808 | $0.3160 | 0 | 4 | 106 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 64,695 | 3,112 | $0.0873 | 0 | 2 | 52 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | yes | yes | 133,857 | 6,433 | $0.2145 | 0 | 3 | 87 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | yes | yes | 65,404 | 3,773 | $0.1062 | 0 | 2 | 80 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | yes | yes | 65,321 | 6,142 | $0.1529 | 0 | 2 | 82 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 64,377 | 2,215 | $0.0668 | 0 | 2 | 40 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 64,703 | 1,587 | $0.0569 | 0 | 2 | 65 s |

Each created app's four spec files are in [m12-first-builds-claude-code-wide/](m12-first-builds-claude-code-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 24 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | invoicing (words: booking) | 2 | 1 / 4 (has 3) | 2 / 7 (has 4) | 1 / 3 (has 4) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 2 | crm | 3 | 1 / 3 (has 3) | 3 / 5 (has 5) | 0 / 2 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 3 | barbers | 3 | 3 / 4 (has 4) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, staff, member (member) | none | pages home, privacy; read Service, Stylist; create none | 1 (operator-unknown) | none |  | Haircut | 1 / 4 | no mention; landing page | en | | | | |
| 4 | records (words: status) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 1) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 5 | invoicing | 3 | 3 / 4 (has 4) | 3 / 7 (has 4) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page | en | | | | |
| 6 | invoicing (words: booking) | 3 | 3 / 4 (has 3) | 2 / 7 (has 4) | 3 / 3 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 3 | no mention; no landing page | en | | | | |
| 7 | marketplace (words: booking) | 3 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: booking) | 3 | 1 / 1 (has 2) | 1 / 5 (has 4) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 1 (capacity-no-unique) | none |  | none | 1 / 2 | no mention; no landing page | en | | | | |
| 9 | records (words: crm) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 1 / 1 (has 2) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, curator, member (member) | none | pages home, objects, categories, privacy; read Item, Category; create none | 3 (write-without-read, operator-unknown) | none |  | none | 1 / 2 | mentions visitors; landing page | en | | | | |
| 11 | status | 3 | 4 / 4 (has 4) | 5 / 8 (has 5) | 3 / 3 (has 3) | shared; admin, it, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 12 | status (words: barbers) | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 13 | records (words: barbers) | 3 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page | en | | | | |
| 14 | records (words: barbers) | 3 | 0 / 1 (has 2) | 0 / 2 (has 4) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 15 | records (words: invoicing) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 3 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 17 | barbers (words: records) | 3 (sv: yes (kunderna, för, att)) | 4 / 4 (has 4) | 7 / 7 (has 7) | 2 / 2 (has 2) | private; admin, staff, member (member) | none | pages home, privacy; read Service, Barber; create none | 1 (operator-unknown) | none |  | none | 2 / 4 | no mention; landing page | sv | no | yes (till, bokning, tid) | yes (boka, det, och) | models 4/4, fields 19/19, pages 7/7 |
| 18 | invoicing (words: records) | 3 (sv: yes (ska, att, offerter)) | 2 / 4 (has 5) | 0 / 7 (has 5) | 3 / 3 (has 6) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 5 | no mention; no landing page | sv | no | yes (offerter, fakturor, till) | none | models 5/5, fields 34/34, pages 5/5 |
| 19 | marketplace (words: records) | 3 (sv: yes (ska, lägga, saker)) | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | no mention; landing page | sv | no | yes (bilder, pris, till) | yes (och, bilder, det) | models 1/1, fields 8/8, pages 6/6 |
| 20 | booking (words: records) | 3 (fi: no) | 4 / 6 (has 4) | 2 / 13 (has 8) | 0 / 1 (has 0) | private; admin, staff, member (member) | none | pages home, lukujarjestys, privacy; read Instructor, Session, ClassType; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page | fi | yes (varaukset) | yes (tunnit, varaukset, varaus) | yes (tunnit, ja, tai) | models 4/4, fields 17/17, pages 8/8 |
| 21 | crm (words: records) | 3 (fi: yes (asiakkaat, verkossa, ja)) | 1 / 3 (has 4) | 0 / 5 (has 5) | 0 / 2 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page | fi | no | none | none | models 0/4, fields 0/31, pages 0/5 |
| 22 | kiosk (words: records) | 3 (de: yes (die, vorbestellungen, abholzeiten)) | 2 / 4 (has 4) | 1 / 6 (has 6) | 6 / 6 (has 6) | shared; admin, staff (staff) | none | pages hofladen, abholzeiten, privacy; read Product, PickupTime; create Order | 1 (operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | de | yes (hofladen) | none | yes (und) | models 0/4, fields 0/24, pages 0/6 |
| 23 | records (words: barbers) | 3 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 2 | 3 / 3 (has 3) | 2 / 2 (has 2) | 2 / 2 (has 2) | shared; admin, assistant (assistant) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

```text
Wordwise Clients
  A freelance translator's clients, the quotes sent to them and the payments received.

Pages
  - Clients (lists clients; search by name, company or email)
  - Quotes (lists quotes; search by title or language pair; filter by client, status or quoted on; sort by quoted on, due on or amount; “Mark sent”; “Mark accepted”; “Mark declined”; “Mark done”)
  - Overview (a dashboard: quoted, accepted, received and latest payments)
  - Payments (lists payments; filter by client, method or paid on)

Clients
  Clients have:
  - a name (required)
  - a company
  - an email
  - a phone
  - languages
  - notes
  Each client lists its quotes.
  Each client lists its payments.

Quotes
  Quotes have:
  - a title (required)
  - a client (a client, required)
  - a language pair
  - words (a whole number)
  - an amount (an amount, required)
  - quoted on (a date, required, today by default)
  - due on (a date)
  - status (draft, sent, accepted, declined or done, draft by default)
  - notes
  Each quote lists its payments.
  The paid is calculated as the total amount of its payments.

Payments
  Payments have:
  - a client (a client, required)
  - a quote (a quote)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, paypal or other, bank transfer by default)
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

Mark done
  For a quote that is accepted; sets status to done.
  The translation was delivered.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency do you quote and get paid in? Euros (EUR) (or: Swedish kronor (SEK), US dollars (USD), British pounds (GBP))
  How is a quote's price set? An amount you type in, with the word count kept alongside (or: Worked out as word count × rate per word, Quote lines, each with its own price)
  How do payments relate to quotes? Each payment belongs to a client and can be linked to a quote, which then shows how much has been paid (or: Payments are only recorded against a client, Full invoices with numbers and due dates)
  Is there anything for visitors to see? No, it is a private app just for you, with no public pages (or: A public page presenting your translation services, A contact form where new clients can ask for a quote)
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: logo.webp.
Generated 149 files (149 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

```text
Pipeline
  A sales pipeline for a six-person web agency: leads, deals and who follows up when.

Pages
  - Start (a dashboard: follow ups due, open deals, pipeline value and deals by stage)
  - Leads (lists leads; search by name, company or email; filter by status, source or assignee; sort by name, company or date added)
  - Deals (lists deals; search by title; filter by stage, assignee or expected close; sort by expected close, value or title; “Win deal”; “Lose deal”)
  - Follow ups (lists follow ups; search by note; filter by done, assignee, due on or kind; sort by due on; “Mark done”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Leads
  Leads have:
  - a name (required)
  - a company
  - an email
  - a phone
  - a website (a web address)
  - a source (referral, website, event, outbound or other, referral by default)
  - status (new, contacted, qualified or lost, new by default)
  - notes
  Each lead can have an assignee (a user).
  Each lead lists its deals.
  Each lead lists its follow ups.
  The assignee owns the lead.
  Deleted leads stay in the trash for thirty days, where they can be restored.

Deals
  Deals have:
  - a title (required)
  - a lead (a lead, required)
  - a stage (discovery, proposal, negotiation, won or lost, discovery by default)
  - a value (an amount)
  - an expected close (a date)
  - closed on (a date, filled by the app)
  - notes
  Each deal can have an assignee (a user).
  The assignee owns the deal.
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a lead (a lead, required)
  - due on (a date, required, today by default)
  - a kind (call, email, meeting or other, call by default)
  - a note
  - done (yes or no)
  Each follow up can have an assignee (a user).
  The assignee owns the follow up.
  Deleted follow ups stay in the trash for thirty days, where they can be restored.

Win deal
  For a deal that is discovery, proposal or negotiation; sets stage to won and closed on to today.

Lose deal
  For a deal that is discovery, proposal or negotiation; sets stage to lost and closed on to today.

Mark done
  For a follow up that is not done; sets done to yes.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works leads and deals and follows up with prospects): opens the start page, the leads page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency and time zone does the agency work in? Euros, Central European time (or: US dollars, US Eastern time, Pounds, UK time, Swedish kronor, Stockholm time)
  Who may change whose records? Everyone on the team can change any lead, deal or follow-up; the person assigned owns it, and only they or an admin can delete it (or: Everyone can only change their own, Everyone can change and delete everything)
  What does a deal hold? A title, the lead, a stage (discovery to won or lost), a value, an expected close date and who handles it (or: Also a probability and a weighted value, Also the services sold (website, SEO, hosting))
  What does the start page show? Open follow-ups, the number and value of open deals, and deals by stage (or: Only my own follow-ups due this week, A calendar of follow-ups)
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: logo.webp.
Generated 159 files (159 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Salon Booking
  Customers book a hair salon appointment online, choosing a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Appointments (lists appointments; filter by status or stylist)
  - Day (a calendar of appointments by week or month; only for staff users and admins)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Time off (lists time offs; only for staff users and admins)
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
  Stylists are booked by their time: Mon–Fri 09:00–18:00, Sat 10:00–15:00, a break 12:00–12:30, 10 minutes kept free after each booking, away during their time offs (by their fields from and until).

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
  - staff (A stylist. Runs the day, confirms and cancels appointments, and enters time off): opens the day page, the appointments page and the time off page; sees everyone's appointments and time offs; adds appointments and time offs; changes everyone's appointments and time offs; deletes everyone's time offs; runs “Confirm” and “Cancel”
  - member (A customer who books appointments): opens the appointments page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading stylists.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Do customers need an account to book? Customers sign in with a code sent by email, then book and see their own appointments (or: Customers book as guests without signing in, Customers sign in with Google)
  Is a booking final straight away? A booking starts as requested and the salon confirms it (or: Bookings are confirmed automatically, Only the salon can book; customers send a request)
  What are the salon's opening hours? Mon–Fri 09:00–18:00, Sat 10:00–15:00, lunch break 12:00–12:30, 10 minutes between appointments (or: Mon–Fri 10:00–19:00, Every day 09:00–17:00)
  What can visitors see before signing in? The services with prices and the stylists (or: Only the home page, Services, stylists and their free times)
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: samples/stylist-1.webp, hero.webp, logo.webp.
Generated 168 files (168 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

```text
Piano Studio
  A piano teacher's record of pupils, their weekly lesson times and what each one practises.

Pages
  - Pupils (lists pupils; search by name or notes; filter by lesson day, level or active)
  - Pieces (lists pieces; search by title or composer; filter by pupil or status; “Mark done”)

Pupils
  Pupils have:
  - a name (required)
  - a lesson day (monday, tuesday, wednesday, thursday, friday, saturday or sunday, monday by default)
  - a lesson time
  - minutes (a whole number, 45 by default)
  - a level (beginner, intermediate or advanced, beginner by default)
  - a phone
  - an email
  - active (yes or no, true by default)
  - notes
  Each pupil lists its pieces.

Pieces
  Pieces have:
  - a pupil (a pupil, required)
  - a title (required)
  - a composer
  - status (learning, polishing or done, learning by default)
  - started on (a date, today by default)
  - notes

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
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-4
  smithable studio

or only run the app with smithable run.
```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

```text
Shutter Ledger
  Invoices for photography work: clients, shoots and what is still unpaid.

Pages
  - Shoots (lists shoots; search by title or location; filter by client, kind, status or shot on)
  - Clients (lists clients; search by name or email)
  - Invoices (lists invoices; search by number; filter by client or status; sort by issued on, due on or number; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Overview (a dashboard: unpaid, overdue, paid, invoiced and unpaid invoices)

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
  - shot on (a date, required)
  - a location
  - a kind (portrait, wedding, event, product, commercial or other, portrait by default)
  - status (planned, shot or delivered, planned by default)
  - a fee (an amount)
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

Mark overdue
  A day after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency do you invoice in? Euro (EUR) (or: Swedish kronor (SEK), US dollars (USD), British pounds (GBP))
  Should the app have a public page for visitors? No, it is a private tool and everything needs sign-in (or: A public landing page showing your photography services, A public contact form for booking requests)
  When does an unpaid invoice count as overdue? Automatically, the day after its due date (or: A week after its due date, Only when you mark it overdue yourself)
  What should a shoot record hold? Client, date, location, kind of shoot, status and fee (or: Add the number of edited photos delivered, Add a link to the online gallery)
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

```text
Sparkle Ledger
  Monthly invoicing for a small cleaning company: its households, their invoices and what has been paid.

Pages
  - Households (lists households; search by name, email or phone; sort by name)
  - Invoices (lists invoices; search by number; filter by client, status or issued on; sort by issued on, due on or number; “Mark sent”; “Mark paid”; “Mark overdue”; “Next month”)
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

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Next month
  Makes a copy of an invoice with status draft and issued on today, asking for the number and the due on; its lines are copied too.
  Start next month's invoice for the same household from this one.

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Overdue check
  7 days after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency do you invoice in? Euro (EUR) (or: Swedish kronor (SEK), Pounds (GBP), US dollars (USD))
  Does each of the three see every household and invoice? Yes, everyone on the team works on the same records (or: Each person sees only the invoices they made)
  Should households be able to see anything without signing in? No, the app is only for the team; households get their invoices by email (or: A public page about the company, Households sign in to see their own invoices)
  How do you make the monthly invoices? Copy last month's invoice for the household, with its lines (or: Write each invoice from scratch, Create every household's invoice automatically each month)
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-6
  smithable studio

or only run the app with smithable run.
```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Post the things you want to sell, with photos and a price, and browse what your neighbors are selling.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, items where available is yes, features and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Items
  Items have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a price (an amount)
  - a category (furniture, clothing, books, toys, electronics, kitchen, garden or other, furniture by default)
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

Assumed:
  Can people browse the items without signing in? Yes, anyone can browse the catalog; signing in is needed to post, save or contact a seller (or: Everything needs sign-in, Visitors can also contact sellers without signing in)
  Should photos be checked before an item is shown? Yes, an administrator approves the photos before the item appears (or: No, items appear right away)
  Which currency are prices in? Euro (EUR) (or: US dollar (USD), Swedish krona (SEK), British pound (GBP))
  How do buyers and sellers get in touch? A contact form on each item that mails the seller (or: The seller's phone number shown on the item, Messages kept in the app)
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, hero.webp, logo.webp.
Generated 150 files (150 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Swap Shelf
  Colleagues offer things they no longer need and others claim them.

Pages
  - Shelf (lists items; search by title, description or pickup spot; filter by category, condition or status; records can be saved as favorites; contact the owner by mail)
  - My items (lists items; only the viewer's own records)
  - My claims (lists claims; only the viewer's own records)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - photos (pictures)
  - a description
  - a category (furniture, electronics, books, kitchen, office, clothing or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a pickup spot
  - status (available or given, available by default)
  Each item lists its claims.

Claims
  Claims have:
  - an item (an item, required)
  - a note
  At most 1 claims per item.

Mark given
  For an item that is available; sets status to given.
  The giver marks the item as handed over to the colleague who claimed it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Can people outside the office see the shelf? No, only invited colleagues sign in and see the items (or: Anyone with a company email address may sign up, The shelf is public, claiming needs sign-in)
  How does someone claim an item? They press Claim on the item, and each item can be claimed once (or: Several colleagues can ask and the giver picks one, Claiming just messages the giver)
  Do items have a price? No, everything is free to take (or: An optional symbolic price, A swap: offer something in return)
  What happens once an item is handed over? The giver marks it as given and it leaves the shelf (or: The giver deletes it, It is marked given automatically when claimed)
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: logo.webp.
Generated 149 files (149 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-8/smithable.yml:22:7  warning  Claim has a capacity per item, but "item" is not unique: one person can take several places.
    hint: Write "item: Item! unique" for one claim per person and item (unique per owner with private access).
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

```text
Crate
  A private catalogue of my vinyl records: albums, artists, condition and what I paid.

Pages
  - Artists (lists artists; search by name or country)
  - Albums (lists albums; search by title, label or notes; filter by artist, format, condition or year; sort by title, year, price paid or bought on)

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
  - a format (lp, double lp, ep or single, lp by default)
  - a condition (very good plus (vg+), mint (m), near mint (nm), very good (vg), good (g) or poor (p), very good plus (vg+) by default)
  - a price paid (an amount)
  - bought on (a date)
  - a cover (picture)
  - notes
  A album is named after its title and its artist.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the collection be shown publicly? No, it's private: only you sign in and see it, including what you paid (or: A public page showing the albums, with prices hidden, Shared with invited friends)
  Which currency are prices in? Euro (EUR) (or: Swedish krona (SEK), US dollar (USD), British pound (GBP))
  How is condition graded? The standard vinyl grades: Mint, Near Mint, VG+, VG, Good, Poor (or: Separate grades for the record and the sleeve, Free text)
  What does each album hold beyond artist, condition and price? Year, label, format, purchase date, cover picture and notes (or: Only title, artist, condition and price, Also tracklist and genre)
Frontier model (claude-opus-5-5) · 0 tokens (0 in, 0 out) · €0.0000 · 1 of 1 calls from the cache
Pictures from the Smithable image library: logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Museum Collection
  Our local museum's collection online, where visitors browse the objects and the stories behind them.

Pages
  - Home (a landing page: hero, objects where on display is yes, categories and footer)
  - Objects (lists objects; search by name, summary, maker, origin or accession number; filter by category or on display; sort by name, period or added on)
  - Categories (lists categories)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Categories
  Categories have:
  - a name (required)
  - a description
  Each category lists its objects.

Objects
  Objects have:
  - a name (required)
  - pictures
  - a summary
  - a story (formatted text)
  - a category (a category)
  - a period
  - a maker
  - a material
  - an origin
  - an accession number (unique)
  - on display (yes or no)
  - added on (a date, required, today by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - curator (Catalogues the objects and writes their stories): opens every page; adds items and categories; changes everyone's items and categories; deletes everyone's items and categories
  - member (Looks at the collection): opens the home page, the objects page and the categories page
  New users get the member role.
  Open to anyone without signing in: the home page, the objects page, the categories page, the privacy page, reading items and reading categories.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who adds objects and writes their stories? Curators invited by an administrator; visitors only browse (or: Only administrators, Any volunteer who signs up, Curators, with volunteers suggesting objects)
  What does each object record hold? Pictures, a short summary, the full story, theme, period, maker, material, origin, accession number and whether it is on display (or: Just a name, a picture and the story, The same plus loan and condition details for staff)
  How are objects grouped for browsing? By themes (categories) the curators define (or: By gallery or room in the museum, By period, No grouping, search only)
  What does the home page show? A welcome, the objects on display now and the themes to explore (or: The newest additions to the collection, Visiting hours and directions too)
Frontier model (claude-opus-5-5) · 4,035 tokens (1,829 in, 2,206 out) · $0.0587
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-10/smithable.auth.yml:11:5  warning  curator may change others' Item, Category it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant curator "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-yfq9jZ/app-10/smithable.auth.yml:12:5  warning  curator may delete others' Item, Category it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant curator "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-yfq9jZ/app-10/smithable.content.yml:7:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status
  An internal board showing which of our IT systems are down, what is being fixed, and when they are back.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Maintenance (lists maintenances)
  - Components (lists components; filter by status; only for it users and admins)
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
  The cause is found; the incident moves to identified with an update.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out and being watched, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This is resolved and the system is back.).
  The incident is over and the system is back, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - it (The IT team: keeps the systems and writes incidents, updates and planned maintenance): opens the home page, the incidents page, the maintenance page and the components page; adds every kind of record; changes everyone's records
  - staff (Everyone else: sees what is down and when it is back): opens the home page, the incidents page and the maintenance page
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can write incidents and change a system's status? Only the IT team; other staff can only read (or: All staff can report incidents, Only administrators)
  Can people see the board without signing in? No, staff sign in to see it (or: Anyone on the office network or internet can read the board)
  Should an incident say when the system is expected back? Yes, an optional expected-back time on each incident (or: Only in the updates' text, Not at all)
  What should staff see first? A board of all systems, open incidents and planned maintenance (or: The list of open incidents, A dashboard with counts)
Frontier model (claude-opus-5-5) · 5,497 tokens (2,431 in, 3,066 out) · $0.0808
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Town Online Services Status
  Residents check whether the municipality's online services are working, what is being fixed and what maintenance is planned.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
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
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message We have found the cause and are working on a fix.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is in place. We are keeping an eye on the service before closing this.).
  A fix is out; the incident is watched before it is closed.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message The service is working normally again.).
  The incident is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Municipal staff who post incidents, updates and planned maintenance): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 5,055 tokens (2,382 in, 2,673 out) · $0.0617
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 163 files (163 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 13. A log of my car's fuel, service visits and costs.

```text
Car Log
  A personal log of a car's fuel fill-ups, service visits and other running costs.

Pages
  - Fuel (lists fill-ups; filter by filled on)
  - Service visits (lists service visits; search by workshop or work; filter by kind or visited on)
  - Other costs (lists other costs; search by description; filter by category or paid on)
  - Overview (a dashboard: fuel spent, service spent, other spent and recent services)

Fill-ups
  Fill-ups have:
  - filled on (a date, required, today by default)
  - a station
  - an odometer (a whole number)
  - liters (a number, required)
  - a total (an amount, required)
  - full tank (yes or no, true by default)
  - a note
  A fill-up is named after its filled on and its station.

Service visits
  Service visits have:
  - visited on (a date, required, today by default)
  - a workshop (required)
  - a kind (service, repair, inspection, tires or other, service by default)
  - an odometer (a whole number)
  - a work
  - a cost (an amount, required)
  - a receipt (a document)
  A service visit is named after its visited on and its workshop.

Other costs
  Other costs have:
  - paid on (a date, required, today by default)
  - a description (required)
  - a category (insurance, tax, parking, toll, washing, accessories or other, insurance by default)
  - an amount (an amount, required)
  - a receipt (a document)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Is the log for one car or for several? One car, so entries don't name a car (or: Several cars, each entry linked to its car, A household's cars shared by family members)
  Which currency are the costs in? Euro (EUR) (or: Swedish kronor (SEK), US dollars (USD), British pounds (GBP))
  Who can see the log? Only you: each person who signs in sees only their own entries (or: Shared with invited family members, Public, so anyone can see it)
  How are costs other than fuel and service recorded? A separate Other costs list (insurance, tax, parking and more), plus an overview of totals (or: Fuel and service visits only, One combined list of all costs)
Frontier model (claude-opus-5-5) · 4,150 tokens (2,150 in, 2,000 out) · $0.0572
Pictures from the Smithable image library: logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-13. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-13
  smithable studio

or only run the app with smithable run.
```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

```text
Our Wedding
  The guest list and seating plan for our wedding, with who has answered and what each guest will eat.

Pages
  - Guests (lists guests; search by name, party or email; filter by answer, meal, table or side; “Mark attending”; “Mark declined”)
  - Tables (lists tables)
  - Overview (a dashboard: answers and meals)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tables
  Tables have:
  - a name (required)
  - seats (a whole number, required, 8 by default)
  - a note
  Each table lists its guests.

Guests
  Guests have:
  - a name (required)
  - a party
  - an email
  - a phone
  - a side (both, bride or groom, both by default)
  - an answer (waiting, attending or declined, waiting by default)
  - a meal (undecided, meat, fish, vegetarian, vegan or child, undecided by default)
  - dietary notes
  - a table (a table)
  - a note

Mark attending
  For a guest that is waiting or declined; sets answer to attending; asks for the meal.
  Record that the guest is coming and which meal they chose.

Mark declined
  For a guest that is waiting or attending; sets answer to declined.
  Record that the guest cannot come.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Do guests answer the invitation themselves in the app? No, the couple records the answers; nothing is public (or: Guests answer on a public RSVP page, Guests sign in to answer and pick their meal)
  Who signs in? The couple and anyone they invite (e.g. a planner), all seeing the same list (or: Only the couple, Each helper sees only the guests they added)
  Which meals can guests choose? Meat, fish, vegetarian, vegan or child's meal, plus a note for allergies (or: Free-text meal choice, Just meat or vegetarian)
  How is the seating plan shown? A tables page, each table listing its guests; guests are seated by picking a table (or: A visual floor plan, Seat numbers at each table)
Frontier model (claude-opus-5-5) · 3,044 tokens (1,906 in, 1,138 out) · $0.0380
Pictures from the Smithable image library: logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-14. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-14
  smithable studio

or only run the app with smithable run.
```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Club Sightings
  The birdwatching club's shared log of bird sightings: which species, where, when and who saw it.

Pages
  - Species (lists specieses; search by name, scientific name or family)
  - Sightings (lists sightings; search by place or notes; filter by species, observer or seen on)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Specieses
  Specieses have:
  - a name (required, unique)
  - a scientific name
  - a family
  - notes
  Each species lists its sightings.

Sightings
  Sightings have:
  - species (a species, required)
  - a place (required)
  - seen on (a date, required, today by default)
  - a count (a whole number, required, 1 by default)
  - notes
  - a photo (picture)
  Each sighting can have an observer (a user, who makes it, by default).
  A sighting is named after its species and its seen on.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A club member who logs sightings and adds species): opens every page; adds sightings and specieses
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Can people outside the club see the sightings? No, only invited club members sign in and see them (or: A public page listing the species seen, without names of members, Everything public, including who saw what)
  Who can edit a sighting? Every member sees all sightings, but only changes their own; admins change any (or: Every member can change any sighting, Members only see their own sightings)
  What does a sighting hold besides species, place, date and observer? Number of birds, notes and an optional photo (or: Only species, place, date and observer, Also exact coordinates and time of day)
  How are species kept? A shared species list members pick from and add to (or: Species typed freely on each sighting, A fixed species list only admins maintain)
Frontier model (claude-opus-5-5) · 2,254 tokens (1,540 in, 714 out) · $0.0266
Pictures from the Smithable image library: logo.webp.
Generated 147 files (147 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of who has which plot, the waiting list for a plot and each member's yearly fee.

Pages
  - Plots (lists plots; search by number or location; filter by status or member)
  - Members (lists members; search by name, email or phone; filter by status)
  - Waiting list (lists waiting list; search by name or email; filter by status; “Offer plot”; “Accept”; “Withdraw”)
  - Fees (lists fees; filter by year, status or member; “Mark paid”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - address
  - joined on (a date, required, today by default)
  - status (active or former, active by default)
  - notes
  Each member lists its plots.
  Each member lists its fees.

Plots
  Plots have:
  - a number (required, unique)
  - a size (a whole number)
  - a location
  - status (vacant, let or reserved, vacant by default)
  - a member (a member, required when status is let)
  - a let since (a date)
  - notes
  A plot is named after its number.

Waiting list
  Waiting list have:
  - a name (required)
  - an email
  - a phone
  - applied on (a date, required, today by default)
  - a wish
  - status (waiting, offered, accepted or withdrawn, waiting by default)

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required)
  - an amount (an amount, required)
  - status (unpaid or paid, unpaid by default)
  - paid on (a date)
  A fee is named after its member and its year.
  No two fees have the same member and year in the whole app.

Mark paid
  For a fee that is unpaid; sets status to paid and paid on to today.

Offer plot
  For a waiting list entry that is waiting; sets status to offered.

Accept
  For a waiting list entry that is offered; sets status to accepted.

Withdraw
  For a waiting list entry that is waiting or offered; sets status to withdrawn.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Is anything public, such as the plots or a form to join the waiting list? Nothing is public: only the committee signs in (or: Show the plots on a public site, A public form to join the waiting list)
  Who uses the app? The committee, invited and working on the same records (or: Every plot holder signs in and sees their own plot and fees, Only one administrator)
  Which currency are the fees in? Euro (or: Swedish krona, Pound sterling, US dollar)
  How is the yearly fee kept? One fee record per member per year, marked paid when it comes in (or: One fee per plot per year, A fee amount set on each plot)
Frontier model (claude-opus-5-5) · 5,005 tokens (2,411 in, 2,594 out) · $0.0712
Pictures from the Smithable image library: logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

```text
Klippt & Klart
  Tidsbokning för en frisörsalong, där kunderna själva bokar tid hos en frisör på nätet.

Pages
  - Hem (a landing page: hero, “Tjänster”, “Frisörer” and footer)
  - Bokningar (lists “Bokningar”; filter by “Status”)
  - Dagen (a calendar of appointments by week or month; only for staff users and admins)
  - Tjänster (lists “Tjänster”; only for admins; visitors see “Tjänster” on the Hem page)
  - Frisörer (lists “Frisörer”; only for admins; visitors see “Frisörer” on the Hem page)
  - Ledighet (lists “Ledigheter”; only for staff users and admins)
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
  - a field “Om frisören”
  - a field “Porträtt” (picture)
  Each “Frisör” lists its “Ledigheter”.
  “Frisörer” are booked by their time: Mon–Fri 09:00–18:00, Sat 10:00–15:00, a break 12:00–12:30, 10 minutes kept free after each booking, away during their “Ledigheter” (by their fields from and until).

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
  - admin: everything
  - staff (En frisör. Sköter dagen, bekräftar och avbokar tider och lägger in sin ledighet): opens the day page, the appointments page and the time off page; sees everyone's appointments and time offs; adds appointments and time offs; changes everyone's appointments and time offs; deletes everyone's time offs; runs “Confirm” and “Cancel”
  - member (En kund som bokar tid): opens the appointments page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading barbers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Behöver kunderna logga in för att boka? Ja, med en kod via e-post, så att de ser och kan avboka sina egna tider (or: Nej, bokning utan inloggning med namn och telefon, Inloggning med Google)
  Ska frisörerna ha egna inloggningar? Ja, frisörerna ser dagens bokningar, bekräftar och lägger in ledighet (or: Bara ägaren sköter allt, Varje frisör ser bara sina egna bokningar)
  Vilka öppettider har salongen? Mån–fre 09–18, lör 10–15, lunch 12–12.30 (or: Mån–fre 10–19, Mån–lör 09–17)
  Vad ser besökare utan att logga in? Behandlingar med pris och tid samt frisörerna (or: Bara startsidan, Även lediga tider)
Frontier model (claude-opus-5-5) · 3,381 tokens (2,012 in, 1,369 out) · $0.0435
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 168 files (168 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-17. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-17
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-17/smithable.content.yml:68:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

```text
Byggkollen
  Håll ordning på kunder, offerter och fakturor i en liten byggfirma.

Pages
  - Kunder (lists “Kunder”; search by “Namn”, “E-post” or “Telefon”; sort by “Namn” or date added)
  - Översikt (a dashboard: open quotes, outstanding, overdue, invoiced and latest)
  - Offerter (lists “Offerter”; search by “Offertnummer” or “Arbete”; filter by “Kund” or “Status”; sort by “Datum”, “Giltig till” or “Offertnummer”; “Send quote”; “Accept quote”; “Decline quote”)
  - Fakturor (lists “Fakturor”; search by “Fakturanummer”; filter by “Kund” or “Status”; sort by “Fakturadatum”, “Förfallodatum” or “Fakturanummer”; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Användare (who has access: invite people, change roles, remove users; only for admins)

Kunder
  Kunder have:
  - a field “Namn” (required)
  - a field “E-post” (an email address)
  - a field “Telefon” (a phone number)
  - a field “Adress”
  - a field “Org.nr / personnr”
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
  Fakturan är förfallen.

Mark overdue
  When a “Faktura”'s due on comes, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Ska alla i firman se samma kunder, offerter och fakturor? Ja, alla inbjudna i firman delar allt (or: Var och en ser bara sina egna, Bara ägaren använder appen)
  Ska en faktura kunna kopplas till offerten den bygger på? Ja, en faktura kan valfritt peka på en offert (or: Nej, offerter och fakturor hålls helt åtskilda, Fakturan skapas alltid från en godkänd offert)
  När räknas en skickad faktura som förfallen? Automatiskt dagen efter förfallodatum (or: En vecka efter förfallodatum, Bara när någon markerar den själv)
  Vad ska visas först när man öppnar appen? En översikt med öppna offerter, obetalda och förfallna fakturor (or: Listan med offerter, Listan med fakturor)
Frontier model (claude-opus-5-5) · 5,827 tokens (2,934 in, 2,893 out) · $0.0813
Pictures from the Smithable image library: logo.webp.
Generated 168 files (168 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-18. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-18
  smithable studio

or only run the app with smithable run.
```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Lägg upp saker du vill sälja på vår loppis, med bilder och pris, och hitta fynd från andra.

Pages
  - Till salu (lists “Saker”; search by “Rubrik”, “Beskrivning” or “Plats”; filter by “Kategori”, “Pris”, “Skick” or “Till salu”; sort by “Pris” or date added; records can be saved as favorites; contact the owner by mail)
  - Mina saker (lists “Saker”; only the viewer's own records)
  - Sparade (lists “Saker”; only the viewer's saved records)
  - Granska bilder (the pictures and files waiting for review, to approve or reject; only for admins)
  - Välkommen (a landing page: hero, features and footer)
  - Integritet (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Saker
  Saker have:
  - a field “Rubrik” (required)
  - a field “Bilder” (pictures, required)
  - a field “Beskrivning” (required)
  - a field “Pris” (an amount)
  - a field “Kategori” (“Möbler”, “Kläder”, “Böcker”, “Kök”, “Leksaker”, “Elektronik” or “Övrigt”, “Möbler” by default)
  - a field “Skick” (“Som ny”, “Bra” or “Sliten”, “Som ny” by default)
  - a field “Plats”
  - a field “Till salu” (yes or no, true by default)
  Photos of “Saker” are reviewed before others see them; an item waits until its photos are.

Mark sold
  For a “Sak” that is “Till salu”; sets “Till salu” to no.
  Säljaren markerar att saken är såld så att den inte längre visas som till salu.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Får vem som helst se sakerna utan att logga in? Ja, alla kan bläddra bland sakerna; man loggar in för att sälja, spara och kontakta säljare (or: Bara inloggade ser sakerna, Bara loppisens medlemmar ser sakerna)
  Vem får lägga upp saker att sälja? Vem som helst som skapar ett konto (or: Bara inbjudna personer, Bara loppisens arrangörer)
  Ska bilderna granskas innan de visas? Ja, en administratör godkänner bilderna innan saken syns (or: Nej, saker syns direkt, Granskning bara vid anmälan)
  Vad händer när något är sålt? Säljaren trycker på Markera som såld och saken döljs från listan (or: Säljaren tar bort saken, Saken ligger kvar men märkt som såld)
Frontier model (claude-opus-5-5) · 2,633 tokens (1,759 in, 874 out) · $0.0315
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-19
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-19/smithable.content.yml:4:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

```text
Joogastudion varaukset
  Joogastudion tunnit, ohjaajat ja varaukset verkossa.

Pages
  - Etusivu (a landing page: hero, features, tuntityypit and footer)
  - Lukujärjestys (a calendar of sessions by week or month)
  - Omat varaukset (lists varaukset; only for members and admins)
  - Tunnit (lists tunnit; filter by tuntityyppi, ohjaaja or alkaa; sort by alkaa or paikkoja; only for staff users and admins)
  - Varaukset (lists varaukset; filter by tunti; only for staff users and admins)
  - Ohjaajat (lists ohjaajat; only for admins)
  - Tietosuoja (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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
  The paikkoja jäljellä is calculated as the paikkoja minus the number of its varaukset.
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
  - staff (Vastaanotto: hoitaa tunnit ja niiden varaukset): opens the tunnit page and the varaukset page; sees everyone's sessions and bookings; adds sessions and bookings; changes everyone's sessions and bookings; deletes everyone's bookings
  - member (Asiakas, joka varaa joogatunteja): opens the omat varaukset page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the lukujarjestys page, the privacy page, reading instructors, reading sessions and reading class types.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Mitä kirjautumaton kävijä näkee? Etusivun, lukujärjestyksen, tuntityypit ja ohjaajat; varaaminen vaatii kirjautumisen. (or: Vain etusivun, Kaiken vain kirjautuneille)
  Kuka voi luoda tilin ja varata? Kuka tahansa voi rekisteröityä sähköpostilla ja varata tunteja. (or: Vain studion kutsumat asiakkaat)
  Millaisia käyttäjiä sovelluksessa on? Ylläpitäjä (omistaja), vastaanotto, joka hoitaa tunnit ja varaukset, sekä asiakkaat, jotka näkevät vain omat varauksensa. (or: Vain ylläpitäjä ja asiakkaat, Ohjaajat kirjautuvat myös omana roolinaan)
  Kuinka kauan varauksen voi perua? Tunnin alkuun asti. (or: 24 tuntia ennen tuntia, 2 tuntia ennen tuntia)
Frontier model (claude-opus-5-5) · 3,847 tokens (2,106 in, 1,741 out) · $0.0517
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 168 files (168 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-20. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-20
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-20/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

```text
Korjaamo
  Pienen autokorjaamon asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Pages
  - Tyot (lists jobs; search by description; filter by status, mechanic or scheduled on; “Start job”; “Complete job”)
  - Asiakkaat (lists customers; search by name, email or phone)
  - Autot (lists cars; search by registration, make or car model)
  - Laskut (lists invoices; search by number; filter by status or customer; “Send invoice”; “Mark paid”)
  - Tiimi (who has access: invite people, change roles, remove users; only for admins)

Customers
  Customers have:
  - a name (required)
  - an email
  - a phone
  - notes
  Each customer lists its cars.
  Each customer lists its invoices.
  Deleted customers stay in the trash for thirty days, where they can be restored.

Cars
  Cars have:
  - a registration (required, unique)
  - a make
  - a car model
  - a year (a whole number)
  - a mileage (a whole number)
  - a customer (a customer, required)
  - notes
  Each car lists its jobs.

Jobs
  Jobs have:
  - a car (a car, required)
  - a description (required)
  - status (booked, in progress, done or canceled, booked by default)
  - scheduled on (a date, today by default)
  - a labour cost (an amount)
  - a parts cost (an amount)
  - completed on (a date)
  Each job can have a mechanic (a user).
  The total is calculated as the labour cost plus the parts cost.

Invoices
  Invoices have:
  - a number (required, unique)
  - a customer (a customer, required)
  - a job (a job)
  - status (draft, sent or paid, draft by default)
  - issued on (a date, today by default)
  - due on (a date)
  - an amount (an amount, required)
  - paid on (a date)
  Deleted invoices stay in the trash for thirty days, where they can be restored.

Start job
  For a job that is booked; sets status to in progress and mechanic to whoever presses it.

Complete job
  For a job that is booked or in progress; sets status to done and completed on to today.

Send invoice
  For an invoice that is draft; sets status to sent and issued on to today.

Mark paid
  For an invoice that is sent; sets status to paid and paid on to today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Kuka sovellusta käyttää? Vain korjaamon oma väki, kutsusta; kaikki näkevät samat tiedot eikä mitään ole julkista (or: Asiakkaat voivat myös kirjautua ja nähdä omat autonsa ja laskunsa, Julkinen sivu, jolta asiakas voi varata huoltoajan)
  Mikä sivu avautuu ensimmäisenä? Huoltotyöt, järjestettynä päivän mukaan (or: Asiakkaat, Kojelauta, jossa avoimet työt ja maksamattomat laskut)
  Mitä laskulla on? Yksi summa, asiakas ja vapaaehtoisesti huoltotyö; ei erillisiä laskurivejä (or: Laskurivit (työ ja osat) omina riveinään, Lasku syntyy suoraan valmiista huoltotyöstä)
  Tarvitaanko eri rooleja? Ei: ylläpitäjä ja muut työntekijät, joilla samat oikeudet (or: Mekaanikot näkevät vain työt, toimisto myös laskut)
Frontier model (claude-opus-5-5) · 6,262 tokens (2,485 in, 3,777 out) · $0.0954
Pictures from the Smithable image library: logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-21. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-21
  smithable studio

or only run the app with smithable run.
```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

```text
Hofladen
  Der Hofladen zeigt sein Sortiment und seine Abholzeiten, Kunden bestellen vor und holen ab.

Pages
  - Bestellungen (lists orders; filter by status; sort by date added or wanted; “Accept”; “Ready”; “Collected”; “Decline”)
  - Produkte (lists products; filter by category or available; “Sold out”; “Back on”)
  - Abholzeiten (lists pickup times)
  - Hofladen (a landing page: hero, features, pickup times and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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

Pickup times
  Pickup times have:
  - a day (a date, required)
  - hours (required)
  - a note

Sold out
  For a product that is available; sets available to no.
  Heute ist nichts mehr davon da.

Back on
  For a product that is not available; sets available to yes.
  Das Produkt kann wieder bestellt werden.

Accept
  For an order that is new; sets status to accepted.
  Der Hofladen nimmt die Vorbestellung an.

Ready
  For an order that is accepted; sets status to ready.
  Die Bestellung ist gepackt und liegt zur Abholung bereit.

Collected
  For an order that is ready; sets status to collected.
  Der Kunde hat die Bestellung abgeholt.

Decline
  For an order that is new or accepted; sets status to declined; asks for the reason.
  Die Bestellung kann nicht erfüllt werden: Grund angeben.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Hilft im Hofladen: nimmt Vorbestellungen an, pflegt Sortiment und Abholzeiten): opens the bestellungen page, the produkte page and the abholzeiten page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the hofladen page, the abholzeiten page, the privacy page, reading products, reading pickup times and adding orders.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Müssen Kunden ein Konto anlegen, um vorzubestellen? Nein, Kunden bestellen ohne Anmeldung mit Name und Telefonnummer; nur der Hof meldet sich an. (or: Kunden legen ein Konto an und sehen ihre Bestellungen, Bestellung nur per Kontaktformular)
  Wie werden die Abholzeiten festgelegt? Der Hof trägt Abholtage mit Uhrzeiten ein, die öffentlich sichtbar sind; der Kunde gibt seinen Wunschtermin an. (or: Feste Zeitfenster mit begrenzter Anzahl Bestellungen, Feste Wochenöffnungszeiten ohne einzelne Termine)
  Wer arbeitet in der App mit? Sie als Admin und eingeladene Helfer, die Bestellungen, Produkte und Abholzeiten pflegen. (or: Nur Sie allein, Helfer sehen nur die Bestellungen)
  Werden Kunden per E-Mail benachrichtigt? Vorerst nicht; der Status der Bestellung wird nur im Hofladen gepflegt. (or: E-Mail, wenn die Bestellung abholbereit ist, E-Mail an Sie bei jeder neuen Bestellung)
Frontier model (claude-opus-5-5) · 4,477 tokens (2,321 in, 2,156 out) · $0.0617
Pictures from the Smithable image library: samples/product-1.webp, samples/product-2.webp, samples/product-3.webp, samples/product-4.webp, samples/product-5.webp, samples/product-6.webp, hero.webp, logo.webp.
Generated 172 files (172 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-22. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-22
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yfq9jZ/app-22/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker
  Keeps each person's habits, their daily check-ins and their streaks, for the habit app and its users.

Pages
  - Habits (lists habits; search by name or description; filter by status or frequency; “Pause”; “Resume”; “Archive”)
  - Check ins (lists check ins; filter by habit or day)

Habits
  Habits have:
  - a name (required)
  - a description
  - a frequency (daily, weekdays or weekly, daily by default)
  - a target per day (a whole number, required, 1 by default)
  - started on (a date, required, today by default)
  - status (active, paused or archived, active by default)
  - a current streak (a whole number, 0 by default, filled by the app)
  - a longest streak (a whole number, 0 by default, filled by the app)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a day (a date, required, today by default)
  - a count (a whole number, required, 1 by default)
  - a note
  No two check ins have the same habit and day for one owner.

Pause
  For a habit that is active; sets status to paused.

Resume
  For a habit that is paused or archived; sets status to active.

Archive
  For a habit that is active or paused; sets status to archived.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change habits and check ins with a key, and run pause, resume and archive.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who uses the backend, and who sees which habits? Anyone may sign up, and each person sees only their own habits and check-ins (or: Only invited people sign in, A shared team space where everyone sees all habits)
  How are streaks kept? As current and longest streak numbers on each habit, filled in by the app from the check-ins (or: Shown only as the list of check-ins, Entered by hand)
  How does the habit app reach this backend? Through the API with a key: habits, check-ins and their actions (or: Only through this web app, API that AI assistants can use too)
  How often can a habit be checked in? Once per habit per day, with a count for habits done several times a day (or: Any number of check-ins a day, Once per week for weekly habits)
Frontier model (claude-opus-5-5) · 3,026 tokens (1,928 in, 1,098 out) · $0.0374
Pictures from the Smithable image library: logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Second Memory
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
  - assistant (The AI assistant's key: reads everything, adds and changes projects, tasks and notes, never deletes): adds projects, tasks and notes; changes everyone's projects, tasks and notes
  New users get the assistant role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Where do you look at your tasks and notes yourself? On a data page, while the assistant works through the API (or: Separate pages for projects, tasks and notes, A dashboard of open tasks, A calendar of tasks by due date)
  Who else uses the app besides you? Only you and your assistant's key; no other people (or: A small team sharing the projects, Family or a partner who can read only)
  May the assistant delete things? No: it adds and changes projects, tasks and notes but never deletes (or: It may also delete tasks and notes, It may only read)
Frontier model (claude-opus-5-5) · 3,548 tokens (1,873 in, 1,675 out) · $0.0485
Pictures from the Smithable image library: logo.webp.
Generated 172 files (172 changed, 0 removed).

Created /tmp/smithable-bench-m12-yfq9jZ/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yfq9jZ/app-24
  smithable studio

or only run the app with smithable run.
```
