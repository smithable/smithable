# M12 first builds: claude-haiku-5-5>claude-sonnet-5-5 (2026-10-26)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 393,573 tokens (363,436 in, 30,137 out), €0.0000 + $0.4113; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 27,083 | 2,430 | $0.0344 | 0 | – | 60 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | – | 37 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 53,102 | 4,321 | $0.0613 | 0 | – | 97 s |
| A tool library where neighbors lend each other tools. | records | yes | yes | 51,366 | 3,438 | $0.0490 | 0 | – | 61 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 25,106 | 1,018 | $0.0163 | 0 | – | 51 s |
| A job board for a local union, with job posts and applications. | records | yes | yes | 25,095 | 2,971 | $0.0358 | 0 | – | 56 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 51,206 | 2,811 | $0.0424 | 0 | – | 53 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 27,079 | 3,138 | $0.0415 | 0 | – | 55 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 25,806 | 2,268 | $0.0302 | 0 | – | 45 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 25,101 | 1,528 | $0.0214 | 0 | – | 56 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 26,244 | 3,168 | $0.0401 | 0 | – | 55 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 26,248 | 3,046 | $0.0389 | 0 | – | 60 s |

Each created app's four spec files are in [m12-first-builds-claude-haiku-5-5-claude-sonnet-5-5/](m12-first-builds-claude-haiku-5-5-claude-sonnet-5-5/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 2 | 4 / 6 (has 4) | 7 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member, staff (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 2 (no-timezone, operator-unknown) | none |  | Stillwater Yoga | 3 / 4 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 2 | 3 / 4 (has 4) | 5 / 7 (has 7) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | records | 3 | 0 / 1 (has 2) | 1 / 2 (has 5) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages home, tools; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 1 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | records (words: marketplace) | 2 | 0 / 1 (has 2) | 1 / 2 (has 4) | 0 / 0 (has 6) | private; admin, member (member) | none | pages home, jobs, privacy; read JobPost; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 2 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member, staff (member) | none | pages home, teams, matches, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 (has 3) | 4 / 12 (has 7) | 0 / 1 (has 0) | private; admin, organizer, member (member) | none | pages home, schedule, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: invoicing) | 2 | 2 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 1 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 1 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 4 / 4 (has 4) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Stillwater Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, instructors, faq and footer)
  - Sessions (lists sessions; only for staff users and admins)
  - Class types (lists class types; only for staff users and admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for staff users and admins; visitors see instructors on the Home page)
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

Booking made
  When a booking is added: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A student who books classes): opens the my bookings page; adds bookings
  - staff: everything
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,233 tokens (478 in, 2,755 out) · $0.0014
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, hero.webp, logo.webp.
Generated 147 files (147 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-VaEU4D/app-1/smithable.yml:52:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-VaEU4D/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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

Created /tmp/smithable-bench-m12-VaEU4D/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Billfold
  Invoicing for freelancers: keep track of clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Clients (lists clients)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: latest, outstanding, overdue and paid)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Payments (lists payments)

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
  The total is calculated as the total amount of its lines.
  Each invoice lists its payments.
  The amount paid is calculated as the total amount of its payments.

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
  - paid on (a date, required, today by default)
  - an amount (an amount, required)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a note

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid.
  The client paid the invoice in full.

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
Frontier model (claude-haiku-5-5) · 5,448 tokens (576 in, 4,872 out) · $0.0025
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-VaEU4D/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Neighborhood Tool Library
  A place where neighbors lend each other tools and keep track of who has borrowed what.

Pages
  - Home (a landing page: hero, tools, features, faq and footer)
  - Loans (lists loans; filter by status or tool; “Mark returned”)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Tools (lists tools; search by name or description; filter by category or condition)

Loans
  Loans have:
  - borrowed on (a date, required, today by default)
  - due on (a date, required)
  - returned on (a date)
  - status (out or returned, out by default)
  - a note
  - a tool (a tool, required)
  Each loan can have a borrower (a user, who makes it, by default, filled by the app).

Tools
  Tools have:
  - a name (required)
  - a description
  - a category (general, garden, power tools, hand tools, cleaning or other, general by default)
  - a condition (good, fair or worn, good by default)
  - a photo (picture)
  - a pickup note

Mark returned
  For a loan that is out; sets status to returned and returned on to today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; changes everyone's loans
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,096 tokens (470 in, 2,626 out) · $0.0014
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-VaEU4D/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Pantry
  Keeps track of a small bakery's ingredients, suppliers and stock levels.

Pages
  - Ingredients (lists ingredients; search by name; filter by storage or supplier)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - notes

Ingredients
  Ingredients have:
  - a name (required)
  - a storage (dry, fridge or freezer, dry by default)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - a quantity (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a cost per unit (an amount)
  - a supplier (a supplier)
  - expires on (a date)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,110 tokens (499 in, 3,611 out) · $0.0019
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board where a local union posts jobs and its members apply for them.

Pages
  - Home (a landing page: hero, job posts where status is open, features, faq and footer)
  - Jobs (lists job posts; search by title, employer, location or summary; filter by status; “Mark filled”; “Close post”)
  - Applications (lists applications; filter by status or job post; “Start review”; “Shortlist”; “Reject”; “Hire”)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Job posts
  Job posts have:
  - a title (required)
  - an employer (required)
  - a location
  - a summary
  - details (formatted text)
  - a pay
  - status (open, filled or closed, open by default)
  - posted on (a date, required, today by default)
  - a closing date

Applications
  Applications have:
  - a job post (a job post, required)
  - a full name (required)
  - a membership number
  - a phone
  - a cover letter
  - a resume (a document)
  - status (submitted, reviewing, shortlisted, rejected or hired, submitted by default)

Mark filled
  For a job post that is open; sets status to filled.

Close post
  For a job post that is open; sets status to closed.

Start review
  For an application that is submitted; sets status to reviewing.

Shortlist
  For an application that is submitted or reviewing; sets status to shortlisted.

Reject
  For an application that is submitted, reviewing or shortlisted; sets status to rejected.

Hire
  For an application that is shortlisted; sets status to hired.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A union member who browses jobs and applies for them): opens the jobs page and the applications page; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading job posts where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,887 tokens (482 in, 3,405 out) · $0.0018
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-VaEU4D/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Northside Football Club
  A football club's site with its teams, players, matches and results.

Pages
  - Home (a landing page: hero, matches where status is played, matches where status is scheduled, teams and footer)
  - Matches (lists matches; search by opponent; filter by team, status or home away)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Teams (lists teams)

Players
  Players have:
  - a name (required)
  - a shirt number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a photo (picture)
  - a bio
  - a team (a team, required)

Matches
  Matches have:
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue
  - a home away (home or away, home by default)
  - status (scheduled, played or postponed, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  - a team (a team, required)

Teams
  Teams have:
  - a name (required)
  - a category (first team, reserves, women or youth, first team by default)
  - a coach
  - a photo (picture)
  - about

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Looks at the club's records): opens every page
  - staff: everything
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the matches page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,982 tokens (527 in, 3,455 out) · $0.0018
Pictures from the Smithable image library: samples/player-1.webp, samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, hero.webp, logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-VaEU4D/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Hub
  Event registration for a conference: talks, speakers and attendees signing up for sessions.

Pages
  - Home (a landing page: hero, talks, speakers, features, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month)
  - Talks (lists talks; filter by track, speaker or starts at; only for organizers and admins; visitors see talks on the Home page)
  - Speakers (lists speakers; only for organizers and admins; visitors see speakers on the Home page)
  - My registrations (lists registrations)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for organizers and admins)

Speakers
  Speakers have:
  - a name (required)
  - a company
  - a bio (formatted text)
  - a portrait (picture)
  Each speaker lists its talks.

Talks
  Talks have:
  - a title (required)
  - a summary
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a room
  - a track (keynote, session or workshop, keynote by default)
  - a capacity (a whole number, required, 50 by default)
  Each talk lists its registrations.
  The places left is calculated as the capacity minus the number of its registrations.
  A talk is named after its title.

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
  - organizer: everything
  - member (An attendee who registers for talks): opens the my registrations page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,615 tokens (453 in, 2,162 out) · $0.0011
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 149 files (149 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-VaEU4D/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
Desk IT
  A help desk where the IT team tracks tickets, sets their priority and sees who handles them.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority, category or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required, fixed once made)
  - a category (other, hardware, software, network or access, other by default)
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
  For a ticket that is not me(); sets assignee to whoever presses it.
  Take the ticket: you become its assignee.

Assign to
  Asks for the assignee.
  Give the ticket to a member of the team, chosen from the list.

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
  - agent (Handles tickets: takes them, answers and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,626 tokens (460 in, 2,166 out) · $0.0011
Pictures from the Smithable image library: logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Cookbook
  A shared family recipe collection with ingredients and shopping lists.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Complete”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, side, dessert, breakfast, snack or drink, main by default)
  - servings (a whole number, 4 by default)
  - prep minutes (a whole number)
  - cook minutes (a whole number)
  - instructions (formatted text)
  - a photo (picture)
  - a source (a web address)
  - favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity
  - a note

Shopping lists
  Shopping lists have:
  - a name (required)
  - status (active or done, active by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a shopping list (a shopping list, required)
  - a name (required)
  - a quantity
  - bought (yes or no)

Complete
  For a shopping list that is active; sets status to done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,448 tokens (570 in, 3,878 out) · $0.0020
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API, with incidents and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Overview (a dashboard: open, per month and latest)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,478 tokens (569 in, 3,909 out) · $0.0020
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-VaEU4D/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
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
  - staff (Writes incidents and their updates): opens the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 5,755 tokens (578 in, 5,177 out) · $0.0026
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 141 files (141 changed, 0 removed).

Created /tmp/smithable-bench-m12-VaEU4D/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-VaEU4D/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-VaEU4D/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
