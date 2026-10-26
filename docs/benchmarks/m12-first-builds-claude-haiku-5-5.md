# M12 first builds: claude-haiku-5-5 (2026-10-26)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 560,714 tokens (490,477 in, 70,237 out), €0.0000 + $0.0424; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 27,083 | 4,570 | $0.0028 | 0 | – | 49 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | – | 14 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 26,027 | 6,168 | $0.0035 | 0 | – | 69 s |
| A tool library where neighbors lend each other tools. | records | yes | yes | 75,675 | 8,840 | $0.0054 | 0 | – | 66 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 25,106 | 2,309 | $0.0015 | 0 | – | 34 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 77,197 | 7,960 | $0.0051 | 0 | – | 70 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 50,609 | 3,477 | $0.0024 | 0 | – | 46 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 27,079 | 6,508 | $0.0038 | 0 | – | 61 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 51,612 | 7,293 | $0.0044 | 0 | – | 65 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 25,101 | 2,407 | $0.0015 | 0 | – | 43 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 26,244 | 5,827 | $0.0033 | 0 | – | 64 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 78,744 | 14,878 | $0.0087 | 0 | – | 104 s |

Each created app's four spec files are in [m12-first-builds-claude-haiku-5-5/](m12-first-builds-claude-haiku-5-5/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 4 / 6 (has 4) | 7 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 2 (no-timezone, operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 2 | 4 / 4 (has 5) | 4 / 7 (has 5) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 5 | no mention; no landing page |
| 4 | records | 2 | 0 / 1 (has 2) | 1 / 2 (has 5) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 2 (capacity-no-unique, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 2 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 0) | private; admin, staff, member (member) | none | pages home, jobs; read JobPost; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 2 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | shared; admin, member, editor (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 1 (role-opens-nothing) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 (has 3) | 2 / 12 (has 5) | 0 / 1 (has 0) | private; admin, attendee (attendee) | none | pages home, talks, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: invoicing) | 2 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 1 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 1 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Riverside Yoga
  Class schedule and online booking for a yoga studio.

Pages
  - Find your class and book your place (a landing page: hero, class types, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Schedule (a calendar of sessions by week or month)
  - Sessions (lists sessions)
  - Class types (lists class types)
  - Instructors (lists instructors)
  - My bookings (lists bookings)

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
  A session is named after its class type and its starts at.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  At most the session's capacity bookings per session.
  A booking is added until the session's starts at.
  Its owner deletes it until 2 hours before the session's starts at.

Booking made
  When a booking is added: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers): everything
  - member (A student who books classes): opens every page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,862 tokens (473 in, 2,389 out) · $0.0012
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, hero.webp, logo.webp.
Generated 144 files (144 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ei8fD0/app-1/smithable.yml:54:14  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-ei8fD0/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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

Created /tmp/smithable-bench-m12-ei8fD0/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Billable
  Invoicing for freelancers: each person keeps their own clients, invoices and payments.

Pages
  - Invoices (lists invoices; filter by client or status)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments)
  - Settings (lists business profiles)
  - Overview (a dashboard: outstanding, overdue, paid and latest)

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

Invoices
  Invoices have:
  - a number (required, unique, fixed when status is sent or paid or overdue)
  - a client (a client, required, fixed when status is sent or paid or overdue)
  - issued on (a date, required, today by default, fixed when status is sent or paid or overdue)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.

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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,952 tokens (621 in, 4,331 out) · $0.0022
Pictures from the Smithable image library: logo.webp.
Generated 144 files (144 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-3
  smithable studio

or only run the app with smithable run.
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A tool library where neighbors lend each other tools.

Pages
  - Home (a landing page: hero, tools and footer)
  - Tools (lists tools; search by name, summary or category; filter by category)
  - Loans (lists loans; filter by status; “Return loan”)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - a summary
  - a category (hand, power, garden, ladder or other, hand by default)
  - a photo (picture)

Loans
  Loans have:
  - a tool (a tool, required)
  - due on (a date, required)
  - returned on (a date)
  - status (out or returned, out by default)
  At most 1 loans per tool (counting those with status out).
  A loan is named after its tool's name.

Return loan
  For a loan that is out; sets status to returned and returned on to today.
  Mark a borrowed tool as returned.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A neighbor who borrows tools): opens every page; adds loans; runs “Return loan”
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,200 tokens (357 in, 843 out) · $0.0005
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ei8fD0/app-4/smithable.yml:20:7  warning  Loan has a capacity per tool, but "tool" is not unique: one person can take several places.
    hint: Write "tool: Tool! unique" for one loan per person and tool (unique per owner with private access).
/tmp/smithable-bench-m12-ei8fD0/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps the bakery's ingredients, their suppliers and how much of each is in stock.

Pages
  - Ingredients (lists ingredients; search by name; filter by supplier or unit)
  - Suppliers (lists suppliers)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required)
  - an email
  - a phone
  - notes

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a unit (kg, g, l, ml or pcs, kg by default)
  - a quantity (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a supplier (a supplier)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,332 tokens (459 in, 1,873 out) · $0.0010
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  Job posts from employers and applications from union members.

Pages
  - Jobs for union members (a landing page: hero, job posts where status is open and footer)
  - Applications (lists applications)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Jobs (lists job posts; search by title, employer or location; filter by work type or status)

Applications
  Applications have:
  - a name (required)
  - an email (required)
  - a phone
  - a message
  - a cv (a document)
  - status (new, shortlisted, rejected or hired, new by default)
  - a job (a job post, required)

Job posts
  Job posts have:
  - a title (required)
  - an employer (required)
  - a description (formatted text, required)
  - a location
  - a pay
  - a work type (full time, part time, temporary or seasonal, full time by default)
  - status (open, filled or closed, open by default)
  - a deadline (a date)

Application received
  When a application is added: mails email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's job posts and applications; adds job posts; changes everyone's job posts and applications
  - member (Union members who browse jobs and apply): opens every page; sees everyone's job posts; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,310 tokens (467 in, 2,843 out) · $0.0015
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ei8fD0/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Northfield Football Club
  Shows the club's teams, players, fixtures and results, and lets club staff keep them up to date.

Pages
  - Home (a landing page: hero, matches where status is played and footer)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by position or team)
  - Matches (lists matches; filter by status)
  - Team (who has access: invite people, change roles, remove users; only for editors and admins)

Teams
  Teams have:
  - a name (required, unique)
  - a ground
  - a summary

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a shirt number (a whole number)

Matches
  Matches have:
  - a home (a team, required)
  - an away (a team, required)
  - starts at (a date and time, required)
  - a venue
  - status (scheduled or played, scheduled by default)
  - a home score (a whole number)
  - an away score (a whole number)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Signed-in club members who can see the teams, players and matches): only their own records
  - editor: everything
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,172 tokens (499 in, 2,673 out) · $0.0014
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ei8fD0/app-7/smithable.auth.yml:8:3  warning  member can open no page: a role opens only the pages its "pages" lists.
    hint: Add "pages: all" (or a list of pages) under roles.member in smithable.auth.yml.
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Harbour Summit 2026
  Registration for the Harbour Summit conference: its talks, speakers and attendees.

Pages
  - Home (a landing page: hero, speakers, talks, features, call to action and footer)
  - Talks (lists talks)
  - Speakers (lists speakers)
  - My registrations (lists registrations)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Speakers
  Speakers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  - a company
  Each speaker lists its talks.

Talks
  Talks have:
  - a title (required)
  - an abstract
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
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
  A registration is named after its talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Organisers. Manage talks, speakers and registrations): everything
  - attendee (A conference attendee who registers for talks): opens the my registrations page; adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the talks page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,709 tokens (433 in, 2,276 out) · $0.0012
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-ei8fD0/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
Ticketline
  Tickets from customers, with priorities and who handles each one.

Pages
  - Tickets (lists tickets; search by subject or customer email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a customer email (required, fixed once made)
  - status (open, in progress, closed or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a body
  - attachments (documents)
  Each ticket can have an assignee (a user, required when status is in progress or closed).
  Each ticket lists its messages.

Messages
  Messages have:
  - a content (required)
  - a sender (agent or customer, agent by default)
  - a from email
  - attachments (documents)
  - a ticket (a ticket, required)
  Each message can have an agent (a user, who makes it, by default, filled by the app).

Assign to me
  For a ticket that is not me(); sets assignee to whoever presses it.
  Take the ticket: you become its assignee.

Assign to
  Asks for the assignee.
  Give the ticket to an agent, chosen from the team.

Start work
  For a ticket that is open or reopened; sets status to in progress.
  Someone is working on the ticket now; it needs an assignee.

Close
  For a ticket that is open, in progress or reopened; sets status to closed.
  The customer has their answer.

Reopen
  For a ticket that is closed; sets status to reopened.
  The ticket needs more work after all.

Ticket received
  When a ticket is added: mails customer email.

Reply sent
  When a message is added and sender is agent: mails ticket's customer email.

Support
  When support is called: a mail becomes a ticket, its attachments with it; a reply to one of them is added to it as a message, as admin.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - agent (Answers the tickets, takes them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 3,399 tokens (440 in, 2,959 out) · $0.0015
Pictures from the Smithable image library: logo.webp.
Generated 137 files (137 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A shared family collection of recipes, with their ingredients and shopping lists.

Pages
  - Recipes (lists recipes; search by name; filter by course)
  - Shopping lists (lists shopping lists)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - servings (a whole number, required, 4 by default)
  - a course (main, starter, dessert or baking, main by default)
  - a method (formatted text)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity (a number)
  - a unit
  - a recipe (a recipe, required)

Shopping lists
  Shopping lists have:
  - a name (required, Shopping by default)
  - a shop date
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a name (required)
  - a quantity
  - bought (yes or no)
  - a shopping list (a shopping list, required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,150 tokens (530 in, 3,620 out) · $0.0019
Pictures from the Smithable image library: logo.webp.
Generated 124 files (124 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
Ledger API Status
  Is the Ledger API working? The live state of our services, with incidents and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open now, per month and latest)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Components
  Components have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description

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
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records; runs “Identified”, “Monitoring” and “Resolve”
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,441 tokens (583 in, 3,858 out) · $0.0020
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Shows which services of the web shop work, and the outages and planned work with their updates.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open incidents, incidents per month and latest incidents)
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
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records; runs “Identified”, “Monitoring” and “Resolve”
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,952 tokens (581 in, 4,371 out) · $0.0022
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-ei8fD0/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-ei8fD0/app-12
  smithable studio

or only run the app with smithable run.
```
