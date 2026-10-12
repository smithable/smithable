# M12 first builds: claude-code (2026-10-12)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 12 type-check, 410,102 tokens (383,630 in, 26,472 out), €0.0000 + $1.0194 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 32,487 | 2,203 | $0.3039 | 0 | 1 | 31 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 10 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 65,938 | 4,596 | $0.1505 | 0 | 2 | 47 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 31,468 | 2,227 | $0.0618 | 0 | 1 | 31 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 31,262 | 1,737 | $0.0504 | 0 | 1 | 26 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 31,469 | 2,483 | $0.0670 | 0 | 1 | 33 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 31,250 | 2,077 | $0.0571 | 0 | 1 | 28 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 32,483 | 2,271 | $0.0708 | 0 | 1 | 33 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 31,259 | 2,025 | $0.0561 | 0 | 1 | 27 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 31,257 | 1,552 | $0.0467 | 0 | 1 | 25 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 32,376 | 2,579 | $0.0761 | 0 | 1 | 31 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 32,381 | 2,722 | $0.0790 | 0 | 1 | 31 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 5 / 6 (has 5) | 8 / 11 (has 9) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create Message | 2 (no-timezone, operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 3 | 4 / 4 (has 5) | 6 / 7 (has 8) | 2 / 2 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 5 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 2 / 5 (has 6) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 4) | private; admin, member, staff (member) | none | pages home, jobs, privacy; read Job; create none | 3 (write-without-read, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 3 / 11 (has 7) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, program, privacy; read Talk, Speaker; create none | 2 (no-timezone, operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 (has 1) | 0 / 2 (has 3) | 0 / 0 (has 4) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Flow Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, classes, teachers, faq, call to action, contact and footer)
  - Sessions (lists sessions; only for admins)
  - Schedule (a calendar of sessions by week or month)
  - Classes (lists classes; only for admins; visitors see classes on the Home page)
  - Teachers (lists teachers; only for admins; visitors see teachers on the Home page)
  - My bookings (lists bookings)
  - Messages (lists messages; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Classes
  Classes have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)

Teachers
  Teachers have:
  - a name (required)
  - a bio
  - a portrait (picture)

Sessions
  Sessions have:
  - class (a class, required)
  - a teacher (a teacher, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each session lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  At most the session's capacity bookings per session.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)

Booking made
  When a booking is added: mails its owner.

Booking cancelled
  When a booking is deleted: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors, reading sessions and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-dz7Tr7/app-1/smithable.yml:43:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-dz7Tr7/app-1/smithable.content.yml:16:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
addModel Company {"name":"string!","notes":"text"}
  addPage companies Company
  addModel Contact {"name":"string!","notes":"text"}
  addPage contacts Contact
  addModel Deal {"name":"string!","notes":"text"}
  addPage deals Deal
  addModel FollowUp {"name":"string!","notes":"text"}
  addPage follow-ups FollowUp
  removePage customers
  removePage orders
Added companies with a name and notes: say what else they hold.
Added contacts with a name and notes: say what else they hold.
Added deals with a name and notes: say what else they hold.
Added follow-ups with a name and notes: say what else they hold.
The starter let only acme.example addresses sign in (a sample domain no one has); that limit is gone.
Generated 135 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Paydesk
  Simple invoicing for freelancers: keep your clients, send invoices and record the payments you receive.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Overview (a dashboard: received, outstanding, overdue, invoiced and latest)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Invoice lines (lists invoice lines)
  - Settings (lists business profiles)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)

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

Invoice lines
  Invoice lines have:
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  - an invoice (an invoice, required)
  The amount is calculated as the quantity times the unit price.

Payments
  Payments have:
  - paid on (a date, required, today by default)
  - an amount (an amount, required)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a reference
  - a note
  - an invoice (an invoice, required)

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The paid amount is calculated as the total amount of its payments.
  The balance is calculated as the total minus the paid amount.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid; asks for the payment's amount and the payment's method; adds a payment (paid on today).
  The client paid the invoice; the payment is recorded with it.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The due date passed without payment.

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and the privacy page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 144 files (144 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-dz7Tr7/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshare
  Neighbors lend each other tools instead of everyone buying their own.

Pages
  - Tools (lists tools; search by name, description or place; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Loans (lists loans; filter by status or tool; “Mark returned”)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, tools and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - photos (pictures, required)
  - a description (required)
  - a category (power tools, hand tools, garden, ladders, cleaning, camping or other, power tools by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Loans
  Loans have:
  - a tool (a tool, required)
  - a borrower (required)
  - a borrower contact
  - lent on (a date, required)
  - due on (a date)
  - status (out or returned, out by default)
  - returned on (a date)
  - notes

Mark returned
  For a loan that is out; sets status to returned and returned on to today.
  Record that the borrowed tool came back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Lends tools to neighbors and borrows theirs): opens the home page, the tools page, the my tools page and the loans page; adds tools and loans
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-dz7Tr7/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of the bakery's ingredients, their suppliers and how much is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; sort by name, quantity in stock or last counted on)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - a website (a web address)
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a category (flour, sugar, dairy, eggs, fats, yeast, flavorings, fruit and nuts, packaging or other, flour by default)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - a supplier (a supplier)
  - a quantity in stock (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a cost per unit (an amount)
  - last counted on (a date, today by default)
  - notes
  The needs reorder is calculated as the quantity in stock is at most the reorder level.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Works in the bakery and keeps the ingredients, suppliers and stock levels up to date): opens every page; adds every kind of record; changes everyone's ingredients and suppliers
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 112 files (112 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  Job posts for members of the local union, and the applications they send.

Pages
  - Home (a landing page: hero, jobs where open is yes and footer)
  - Jobs (lists jobs; search by title, employer, description, location or trade; filter by job type, open or deadline; sort by deadline or date added; records can be saved as favorites; “Close job”)
  - Applications (lists applications; filter by job or status; “Start review”; “Accept”; “Decline”)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a trade
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a pay
  - a deadline (a date)
  - open (yes or no, true by default)

Applications
  Applications have:
  - a job (a job, required, unique)
  - a full name (required)
  - an email (required)
  - a phone
  - a cover letter
  - status (submitted, reviewing, accepted or declined, submitted by default)

Close job
  For a job that is open; sets open to no.
  Close a job post so it no longer takes applications.

Start review
  For an application that is submitted; sets status to reviewing.
  Mark an application as being reviewed.

Accept
  For an application that is submitted or reviewing; sets status to accepted.
  Accept an application.

Decline
  For an application that is submitted or reviewing; sets status to declined.
  Decline an application.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A union member who browses jobs and applies): opens the jobs page and the applications page; adds applications
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's applications; adds every kind of record; changes everyone's jobs and applications; deletes everyone's jobs
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where open is yes.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-dz7Tr7/app-6/smithable.auth.yml:16:5  warning  staff may change others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-dz7Tr7/app-6/smithable.auth.yml:17:5  warning  staff may delete others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-dz7Tr7/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Riverside FC
  The club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, status or venue; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group (senior, youth, junior or veterans, senior by default)
  - a coach
  - about
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a shirt number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a competition
  - status (scheduled, played, postponed or canceled, scheduled by default)
  - an our score (a whole number)
  - a their score (a whole number)
  - a report

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the our score and the their score.
  Enter the final score of a match that has been played.

Postpone
  For a match that is scheduled; sets status to postponed.
  Mark a scheduled match as postponed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Follows the club; only administrators add teams, players and matches): opens every page
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-dz7Tr7/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Confluence Conference
  Programme, speakers and attendee registration for a conference.

Pages
  - Home (a landing page: hero, speakers, faq, call to action and footer)
  - My registration (lists registrations; “Cancel registration”)
  - Program (a calendar of talks by week or month)
  - Talks (lists talks; only for admins)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Speakers
  Speakers have:
  - a name (required)
  - a company
  - a bio (formatted text)
  - a portrait (picture)

Talks
  Talks have:
  - a title (required)
  - an abstract
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 30 by default)
  - a room
  - a level (introductory, intermediate or advanced, introductory by default)

Registrations
  Registrations have:
  - a name (required)
  - an email (required)
  - a company
  - a ticket type (full conference, single day or student, full conference by default)
  - dietary needs
  - status (confirmed or cancelled, confirmed by default)

Cancel registration
  For a registration that is confirmed; sets status to cancelled.
  Cancel a registration for the conference.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (An attendee who registers for the conference): opens the my registration page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the program page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-dz7Tr7/app-8/smithable.yml:34:15  warning  Page "program" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-dz7Tr7/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk where the IT team tracks tickets, their priority and who handles them.

Pages
  - Tickets (lists tickets; search by title, description, requester or requester email; sort by priority, status or date added; “Take ticket”; “Resolve”; “Close”; “Reopen”)
  - Overview (a dashboard: open tickets, urgent tickets and latest tickets)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (normal, low, high or urgent, normal by default)
  - status (open, in progress, resolved or closed, open by default)
  - a category (other, hardware, software, network or access, other by default)
  - a requester
  - a requester email
  - a resolution
  - resolved at (a date and time)
  Each ticket can have an assignee (a user).

Take ticket
  For a ticket that is open or in progress; sets assignee to whoever presses it and status to in progress.
  Make yourself the one who handles the ticket.

Resolve
  For a ticket that is open or in progress; sets status to resolved and resolved at to now; asks for the resolution.
  Mark the ticket resolved and note how.

Close
  For a ticket that is resolved; sets status to closed.
  Close a resolved ticket.

Reopen
  For a ticket that is resolved or closed; sets status to open.
  Open the ticket again when the problem comes back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Works on the team's tickets): opens every page; adds every kind of record; changes everyone's tickets
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Kitchen
  The family's recipes with their ingredients, and the shopping lists for cooking them.

Pages
  - Recipes (lists recipes; search by name, summary or category; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Finish list”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - prep minutes (a whole number)
  - instructions
  - a link (a web address)
  - favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity

Shopping lists
  Shopping lists have:
  - a name (required)
  - a for date
  - status (open or done, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - a quantity
  - bought (yes or no)

Mark bought
  For a shopping item that is not bought; sets bought to yes.
  Tick an item off the shopping list once it is in the basket.

Finish list
  For a shopping list that is open; sets status to done.
  Mark a shopping list as done after the shopping trip.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A family member who adds and edits recipes and shopping lists): opens every page; adds every kind of record; changes everyone's records
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 121 files (121 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Is our API working? Its current state, incidents and planned maintenance, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
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

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
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
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-dz7Tr7/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Overview (a dashboard: open, per month and latest)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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
  - a summary
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
  - staff (Writes incidents and their updates): opens the overview page, the incidents page and the updates page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 129 files (129 changed, 0 removed).

Created /tmp/smithable-bench-m12-dz7Tr7/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-dz7Tr7/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-dz7Tr7/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
