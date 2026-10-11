# M12 first builds: mistral-medium-latest (2026-10-11)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 12 type-check, 210,214 tokens (195,883 in, 14,331 out), €0.0000 + $0.4014 (Mistral's list price); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 23,351 | 1,482 | $0.0461 | 0 | 2 | 23 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 6 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 11,557 | 1,970 | $0.0321 | 0 | 1 | 20 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 11,171 | 646 | $0.0216 | 0 | 1 | 14 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 11,025 | 457 | $0.0200 | 0 | 1 | 12 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 33,991 | 985 | $0.0584 | 0 | 3 | 24 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 11,023 | 645 | $0.0214 | 0 | 1 | 14 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 36,758 | 2,603 | $0.0747 | 0 | 3 | 32 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 22,446 | 936 | $0.0407 | 0 | 2 | 18 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 11,022 | 981 | $0.0239 | 0 | 1 | 16 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 11,766 | 1,895 | $0.0319 | 0 | 1 | 19 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 11,773 | 1,731 | $0.0306 | 0 | 1 | 19 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

2 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 (has 6) | 7 / 11 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read ClassType, Post; create Message | 0 | none |  | none | 4 / 6 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 (has 4) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home; read none; create none | 1 (operator-unknown) | none |  | Invoicely | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 2 | 0 / 1 (has 1) | 1 / 5 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, tools; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 3) | 0 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages jobs, home, privacy; read none; create none | 2 (public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 0 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 2 | 0 / 6 (has 4) | 2 / 11 (has 7) | 0 / 0 (has 0) | private; admin, attendee (attendee) | none | pages home, talks, privacy; read Talk; create none | 2 (public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 4 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 4) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages recipes, home, privacy; read Recipe; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio Booking
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, gallery, faq, posts, contact, estimate and footer)
  - Sessions (lists sessions)
  - Class types (lists class types)
  - Instructors (lists instructors)
  - Messages (lists messages)
  - Posts (lists posts)
  - My bookings (lists bookings)
  - Estimate (a calculator: classes per month, drop in and pass give without pass and saved)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (beginner, all levels or advanced, beginner by default)
  - duration minutes (a whole number, required, 60 by default)

Instructors
  Instructors have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)

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

Posts
  Posts have:
  - a title (required)
  - address (unique)
  - a summary
  - a cover (picture)
  - a body (formatted text, required)
  - published on (a date)
  - status (draft or published, draft by default)

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
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, reading class types, reading posts and adding messages.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-1
  smithable studio

or only run the app with smithable run.
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
Generated 127 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicely
  Simple invoicing for freelancers. Each user manages their own clients and invoices.

Pages
  - Home (a landing page: hero, features, pricing, faq, call to action and footer)
  - Overview (lists invoices)
  - Invoices (lists invoices; search by number; filter by client or status)
  - Clients (lists clients; search by name or email; sort by name)
  - Invoice lines (lists invoice lines; search by description)
  - Settings (lists business profiles)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a contract (a document)
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

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A freelancer using Invoicely): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-QctZtD/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A neighborhood tool library where neighbors lend each other tools.

Pages
  - Tools (lists tools; search by name or description; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Home (a landing page: hero and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Tools
  Tools have:
  - a name (required)
  - a description (required)
  - a category (garden, power, hand, measuring or other, garden by default)
  - a condition (like new, good or worn, like new by default)
  - an available (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Lends and borrows tools): opens the tools page, the my tools page and the home page; adds tools
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page and reading tools.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 101 files (101 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-QctZtD/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name or description)
  - Suppliers (lists suppliers; search by name, contact person or email)
  - Stock (lists stocks; search by ingredient; filter by ingredient or supplier)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet, frozen or packaging, dry by default)
  - a unit (required)
  - a min stock level (a whole number, 0 by default)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact person
  - an email
  - a phone
  - address

Stocks
  Stocks have:
  - an ingredient (an ingredient, required)
  - a supplier (a supplier)
  - a quantity (a number, required)
  - a last restocked (a date)
  - an expiry date

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
Pictures from the Smithable image library: logo.webp.
Generated 104 files (104 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A local union job board for posting and applying to jobs.

Pages
  - Home (a landing page: hero and footer)
  - Jobs (lists job posts; search by title, description, company or location; filter by type or status; sort by salary or date added; contact the owner by mail)
  - Applications (lists applications)
  - My jobs (lists job posts; only the viewer's own records)
  - My applications (lists applications; only the viewer's own records)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Job posts
  Job posts have:
  - a title (required)
  - a description (required)
  - a company (required)
  - a location
  - a salary (an amount)
  - a type (full time, part time, contract or temporary, full time by default)
  - status (open or closed, open by default)
  Each job post can have a posted by (a user).

Applications
  Applications have:
  - a job post (a job post, required)
  - an applicant name (required)
  - an applicant email (required)
  - a resume (a document)
  - a cover letter
  - status (submitted, reviewed, rejected or hired, submitted by default)
  Each application can have an applied by (a user).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Posts jobs and applies to jobs): opens the jobs page, the applications page, the my jobs page and the my applications page; sees everyone's job posts and applications; adds job posts and applications
  New users get the member role.
  Open to anyone without signing in: the jobs page, the home page and the privacy page.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-QctZtD/app-6/smithable.auth.yml:14:11  warning  Visitors can open jobs, but may not read JobPost, so the page shows them none: add it under public.read, or take jobs out of public.pages.
/tmp/smithable-bench-m12-QctZtD/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Home (a landing page: hero, teams, matches where status is scheduled or played and footer)
  - Teams (lists teams)
  - Players (lists players)
  - Matches (lists matches)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Teams
  Teams have:
  - a name (required)
  - a description
  - a founded (a whole number)
  - a logo (a document)

Players
  Players have:
  - a name (required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a team (a team, required)
  - a number (a whole number)
  - a bio
  - a photo (a document)

Matches
  Matches have:
  - a home team (a team, required)
  - an away team (a team, required)
  - a date (a date and time, required)
  - a venue
  - status (scheduled, played or canceled, scheduled by default)
  - a home score (a whole number)
  - an away score (a whole number)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Manages the club's site): everything
  - member (Views the club's information): opens the home page, the teams page, the players page and the matches page; sees everyone's teams, players and matches; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-QctZtD/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration for a conference with talks, speakers and attendees.

Pages
  - Welcome to the Conference (a landing page: hero, talks, speakers, contact and footer)
  - Talks (lists talks)
  - Speakers (lists speakers; only for admins)
  - Attendees (lists attendees; only for admins)
  - My Registrations (lists registrations)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Talks
  Talks have:
  - a title (required)
  - a summary
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a room
  - a capacity (a whole number, required, 50 by default)
  - a speaker (a speaker, required)
  Each talk lists its registrations.

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - a photo (picture)
  - an email
  - a company

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)
  - a company
  - a phone

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  - an attendee (an attendee, required)
  - registered at (a date and time, required, now by default)
  At most the talk's capacity registrations per talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Conference organizers. Manage talks, speakers, and attendees): everything
  - attendee (Conference attendee. Can register for talks): opens the registrations page; adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the talks page, the privacy page and reading talks.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 127 files (127 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-QctZtD/app-8/smithable.auth.yml:14:11  warning  Visitors can open home, but may not read Speaker, so the page shows them none: add it under public.read, or remove the section of home that shows it.
/tmp/smithable-bench-m12-QctZtD/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage tickets, priorities and assignments.

Pages
  - Tickets (lists tickets; search by title or description; filter by priority or status; sort by priority, status or date added; “Resolve”; “Close”; “Reopen”; “Start work”)
  - Team (who has access: invite people, change roles, remove users)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (low, normal, high or urgent, low by default)
  - status (open, in progress, resolved or closed, open by default)
  Each ticket can have an assignee (a user).

Resolve
  For a ticket that is in progress; sets status to resolved.
  Mark the ticket as resolved.

Close
  For a ticket that is resolved; sets status to closed.
  Close the ticket.

Reopen
  For a ticket that is closed or resolved; sets status to open.
  Reopen the ticket.

Start work
  For a ticket that is open; sets status to in progress and assignee to whoever presses it.
  Start working on the ticket.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (Administrator with full access): everything
  - agent: everything
  New users get the agent role.
Pictures from the Smithable image library: logo.webp.
Generated 106 files (106 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep and share family recipes with ingredients and shopping lists.

Pages
  - Home (a landing page: hero, recipes and footer)
  - Recipes (lists recipes; search by name, description, category or difficulty; filter by category or difficulty; sort by name, servings, prep time or cook time)
  - Shopping lists (lists shopping lists; search by name; filter by completed; sort by name or date)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - servings (a whole number, required, 4 by default)
  - a prep time (a whole number)
  - a cook time (a whole number)
  - instructions (required)
  - a category (breakfast, lunch, dinner, dessert, snack or drink, breakfast by default)
  - a difficulty (easy, medium or hard, easy by default)
  - an image (a document)

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity (required)
  - a unit
  - a recipe (a recipe, required)

Shopping lists
  Shopping lists have:
  - a name (required)
  - a date (required, today by default)
  - a completed (yes or no, false by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: everything
  New users get the member role.
  Open to anyone without signing in: the recipes page, the home page, the privacy page and reading recipes.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-QctZtD/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Live status of our API services, incidents, and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; search by title or summary; filter by status or component)
  - Updates (lists incident updates; filter by status or incident)
  - Components (lists components; filter by status; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances; filter by component)
  - Overview (lists incidents)
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
  - admin (Administrator with full access): everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  The state of our web shop services, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; search by title; filter by status or component)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Overview (lists incidents)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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
  - admin (Administrator): everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 150 files (150 changed, 0 removed).

Created /tmp/smithable-bench-m12-QctZtD/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-QctZtD/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-QctZtD/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
