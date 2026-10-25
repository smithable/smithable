# M12 first builds: claude-code (2026-10-25; 1 rerun since)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 598,230 tokens (575,292 in, 22,938 out), €0.0000 + $1.1191 (as Claude Code reports it); 1 model calls answered from the response cache. Rows marked *rerun* ran again on their own after the full run (`--only`). *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 146,581 | 3,349 | $0.5229 | 0 | 3 | 57 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 13 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 48,080 | 2,405 | $0.0744 | 0 | 1 | 36 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 47,356 | 2,351 | $0.0675 | 0 | 1 | 35 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 47,159 | 1,747 | $0.0538 | 0 | 1 | 29 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 47,354 | 2,583 | $0.0721 | 0 | 1 | 34 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 47,148 | 2,103 | $0.0609 | 0 | 1 | 63 s |
| Event registration for a conference: talks, speakers and attendees. *(rerun 2026-10-25)* | booking | yes | yes | 0 | 0 | €0.0000 | 1 | 1 | 27 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 47,861 | 1,798 | $0.0605 | 0 | 1 | 41 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 47,155 | 1,281 | $0.0445 | 0 | 1 | 38 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 48,297 | 2,698 | $0.0820 | 0 | 1 | 46 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 48,301 | 2,623 | $0.0805 | 0 | 1 | 50 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 5 / 6 (has 5) | 8 / 12 (has 8) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read Instructor, Session, ClassType; create Message | 2 (no-timezone, operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 2 | 3 / 4 (has 4) | 5 / 7 (has 7) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 4 / 5 (has 7) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, catalog, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 5) | private; admin, member, staff (member) | none | pages home, jobs; read Job; create none | 3 (write-without-read, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, talks, speakers, schedule, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: invoicing) | 3 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 3 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Grove Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, teachers, call to action, contact and footer)
  - Schedule (a calendar of sessions by week or month)
  - My bookings (lists bookings)
  - Sessions (lists sessions; filter by class type, teacher or starts at; sort by starts at or capacity; only for admins)
  - Teachers (lists teachers; only for admins; visitors see teachers on the Home page)
  - Messages (lists messages; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)

Teachers
  Teachers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Each teacher lists its sessions.

Sessions
  Sessions have:
  - a teacher (a teacher, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  - a class type (a class type, required)
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

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Each class type lists its sessions.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading instructors, reading sessions, reading class types and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-qKhfmP/app-1/smithable.yml:50:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-qKhfmP/app-1/smithable.content.yml:11:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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
Generated 140 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Ledgerly
  Invoicing for freelancers: keep your clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Clients (lists clients)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: received and latest)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number
  Each client lists its invoices.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a contract (a document)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The balance is calculated as the total amount of its lines minus the total amount of its payments.
  The paid amount is calculated as the total amount of its payments.

Invoice lines
  Invoice lines have:
  - an invoice (an invoice, required)
  - a description (required)
  - a quantity (a number, required, 1 by default)
  - a unit price (an amount, required)
  The amount is calculated as the quantity times the unit price.

Payments
  Payments have:
  - an invoice (an invoice, required)
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a reference
  - a note

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Mark overdue
  7 days after an invoice's due on, where status is sent: runs “Mark overdue”.

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
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-qKhfmP/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshed
  Neighbors lend each other tools instead of each buying their own.

Pages
  - Tools (lists tools; search by name, description or place; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Lent out (lists loans; filter by status, tool or due on; “Mark returned”)
  - Saved (lists tools; only the viewer's saved records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, tools where available is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - photos (pictures, required)
  - a description (required)
  - a category (power, garden, hand, ladders, cleaning or other, power by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Loans
  Loans have:
  - a tool (a tool, required)
  - a borrower (required)
  - borrowed on (a date, required)
  - due on (a date)
  - status (out or returned, out by default)
  - returned on (a date)
  - a note

Mark returned
  For a loan that is out; sets status to returned and returned on to today.
  Record that the borrowed tool came back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Lends their tools and borrows from neighbors): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-qKhfmP/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keep track of the bakery's ingredients, their suppliers and how much is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by category, storage or supplier)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Stock changes (lists stock changes; filter by ingredient, kind or on)
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
  - a category (flour, sugar, dairy, eggs, fats, yeast, fruit, nuts, chocolate, spices, packaging or other, flour by default)
  - a unit (kg, g, l, ml, pieces or packs, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number)
  - a storage (dry, chilled or frozen, dry by default)
  - a supplier (a supplier)
  - notes
  Each ingredient lists its stock changes.

Stock changes
  Stock changes have:
  - an ingredient (an ingredient, required)
  - a kind (delivery, used, wasted or count, delivery by default)
  - a quantity (a number, required)
  - a date (on, required, today by default)
  - a note

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 123 files (123 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  A job board where the union posts openings and members apply for them.

Pages
  - Jobs (lists jobs; search by title, employer, description, location or trade; filter by employment, status or closes on; records can be saved as favorites; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; search by name, email or member number; filter by job or status; only for staff users and admins)
  - Home (a landing page: hero, jobs where status is open and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for staff users and admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a trade
  - an employment (full time, part time, temporary or apprenticeship, full time by default)
  - a pay
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique)
  - a name (required)
  - an email (required)
  - a phone
  - a member number
  - a message
  - a resume (a document)
  - status (submitted, reviewing, accepted or declined, submitted by default)

Mark filled
  For a job that is open; sets status to filled.
  Mark a job as filled.

Close job
  For a job that is open; sets status to closed.
  Close a job to new applications.

Start review
  For an application that is submitted; sets status to reviewing.

Accept
  For an application that is submitted or reviewing; sets status to accepted.

Decline
  For an application that is submitted or reviewing; sets status to declined.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Union member who browses jobs and applies): opens the jobs page and the my applications page; adds applications
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's applications; adds jobs; changes everyone's jobs and applications; deletes everyone's jobs; runs every custom action
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-qKhfmP/app-6/smithable.auth.yml:16:5  warning  staff may change others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-qKhfmP/app-6/smithable.auth.yml:17:5  warning  staff may delete others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-qKhfmP/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Football
  The club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or ground; filter by team, status, venue or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group
  - a coach
  - a photo (picture)
  - a summary
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a number (a whole number)
  - a photo (picture)
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a ground
  - status (scheduled, played or postponed, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  A match is named after its team, its opponent and its kickoff.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Enter the final score of a match.

Postpone
  For a match that is scheduled; sets status to postponed.
  Mark a match as postponed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Follows the club; only administrators add and change teams, players and matches): opens the home page, the matches page, the teams page and the players page
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-qKhfmP/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Confera
  Talks, speakers and attendee registration for a conference.

Pages
  - Home (a landing page: hero, talks, speakers, faq, call to action and footer)
  - Talks (lists talks; filter by speaker or starts at)
  - Speakers (lists speakers)
  - My registrations (lists registrations)
  - Schedule (a calendar of talks by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Speakers
  Speakers have:
  - a name (required)
  - a company
  - a bio (formatted text)
  - a photo (picture)
  Each speaker lists its talks.

Talks
  Talks have:
  - a title (required)
  - a summary
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a room
  - a capacity (a whole number, required, 100 by default)
  Each talk lists its registrations.
  The places left is calculated as the capacity minus the number of its registrations.

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  Each registration can have an attendee (a user).
  The attendee owns the registration.
  At most the talk's capacity registrations per talk.
  A registration is added until the talk's starts at.
  Its owner deletes it until the talk's starts at.
  A registration is named after its talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (An attendee who registers for talks): opens the talks page, the speakers page, the schedule page and the my registrations page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the talks page, the speakers page, the schedule page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-yzRpBQ/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yzRpBQ/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yzRpBQ/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets for the IT team: what is wrong, how urgent it is and who handles it.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email
  - status (open, in progress, closed or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a body
  - attachments (documents)
  Each ticket can have an assignee (a user, required when status is in progress or closed).
  Each ticket lists its messages.

Messages
  Messages have:
  - a content (required)
  - attachments (documents)
  - a ticket (a ticket, required)
  Each message can have an agent (a user, who makes it, by default, filled by the app).

Assign to me
  Sets assignee to whoever presses it.
  Take the ticket: you become its assignee.

Assign to
  Asks for the assignee.
  Give the ticket to someone on the team.

Start work
  For a ticket that is open or reopened; sets status to in progress.
  Someone is working on the ticket now; it needs an assignee.

Close
  For a ticket that is open, in progress or reopened; sets status to closed.
  The problem is solved.

Reopen
  For a ticket that is closed; sets status to reopened.
  The ticket needs more work after all.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - agent (Handles tickets, takes them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Kitchen
  A family's shared recipe collection, with ingredients and shopping lists.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Finish shopping”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - a picture
  - instructions (formatted text)
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
  - shop on (a date)
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
  Tick an item off the shopping list.

Finish shopping
  For a shopping list that is open; sets status to done.
  Mark a shopping list as done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Is the API working? Live status, incidents and planned maintenance.

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

Created /tmp/smithable-bench-m12-qKhfmP/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-qKhfmP/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
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
  - staff (Writes incidents and their updates): opens the overview page, the incidents page and the updates page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-qKhfmP/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-qKhfmP/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-qKhfmP/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
