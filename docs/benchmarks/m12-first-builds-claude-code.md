# M12 first builds: claude-code (2026-10-14)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 12 type-check, 420,933 tokens (397,293 in, 23,640 out), €0.0000 + $0.9701 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 33,678 | 1,987 | $0.3092 | 0 | 1 | 27 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 8 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 67,680 | 3,542 | $0.1248 | 0 | 2 | 39 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 32,660 | 2,262 | $0.0628 | 0 | 1 | 32 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 32,454 | 1,136 | $0.0386 | 0 | 1 | 19 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 32,660 | 2,207 | $0.0617 | 0 | 1 | 29 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 32,442 | 2,181 | $0.0594 | 0 | 1 | 28 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 33,675 | 1,972 | $0.0651 | 0 | 1 | 29 s |
| A help desk for an IT team: tickets, priorities and who handles them. | records | yes | yes | 32,451 | 1,395 | $0.0438 | 0 | 1 | 22 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 32,451 | 1,721 | $0.0503 | 0 | 1 | 25 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 33,569 | 2,741 | $0.0796 | 0 | 1 | 34 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 33,573 | 2,496 | $0.0748 | 0 | 1 | 30 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 4 / 6 (has 4) | 7 / 11 (has 7) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 3 | 4 / 4 (has 5) | 6 / 7 (has 8) | 2 / 2 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 5 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 3 / 5 (has 7) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 4) | 0 / 0 (has 4) | private; admin, member, staff (member) | none | pages home, jobs, privacy; read Job; create none | 2 (write-without-read, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 11 (has 7) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | records (words: invoicing) | 3 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 5 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | Payments | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Room Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, instructors, call to action and footer)
  - Schedule (a calendar of sessions by week or month)
  - Sessions (lists sessions; only for admins)
  - Class types (lists class types; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - My bookings (lists bookings)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A student who books classes): opens the my bookings page and the schedule page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yVBSDF/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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

Created /tmp/smithable-bench-m12-yVBSDF/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Billable
  Invoicing for freelancers: keep your clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Overview (a dashboard: latest, outstanding, overdue and received)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark overdue”; “Mark paid”)
  - Clients (lists clients; search by name or email)
  - Invoice lines (lists invoice lines)
  - Settings (lists business profiles)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Payments (lists payments; filter by invoice, method or paid on)

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
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  - a contract (a document)
  Each invoice lists its invoice lines.
  The total is calculated as the total amount of its lines.
  Each invoice lists its payments.
  The paid is calculated as the total amount of its payments.

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
  - a note

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The due date passed without payment.

Mark paid
  For an invoice that is sent or overdue; sets status to paid; asks for the payment's amount and the payment's method; adds a payment (paid on today).
  The client paid the invoice; the payment is recorded with it.

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
Generated 149 files (149 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yVBSDF/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Shed Share
  Neighbors lend each other tools instead of buying their own.

Pages
  - Tools (lists tools; search by name, description or place; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - My loans (lists loans; only the viewer's own records; “Mark returned”)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, tools where available is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - photos (pictures, required)
  - a description (required)
  - a category (garden, power, hand, ladders, cleaning or other, garden by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Loans
  Loans have:
  - a tool (a tool, required)
  - a start date (required)
  - a due date
  - status (borrowed or returned, borrowed by default)
  - returned on (a date)
  - notes

Mark returned
  For a loan that is borrowed; sets status to returned and returned on to today.
  Record that the borrowed tool has been brought back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yVBSDF/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keep track of the bakery's ingredients, their suppliers and how much is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by category, supplier or storage; sort by name, in stock or last counted)
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
  - a name (required)
  - a category (flour, dairy, sugar, fats, eggs, fruit or other, flour by default)
  - a supplier (a supplier)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a storage (dry, chilled or frozen, dry by default)
  - a last counted (a date, today by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 112 files (112 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  A job board where the local union posts jobs and members apply.

Pages
  - Jobs (lists jobs; search by title, employer, description or location; filter by type, status or deadline; sort by deadline or date added; “Close job”)
  - Applications (lists applications; filter by job or status; “Shortlist”; “Reject”; “Hire”)
  - Home (a landing page: hero, jobs where status is open and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a type (full time, part time, temporary or contract, full time by default)
  - a pay
  - a deadline (a date)
  - status (open or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required)
  - a name (required)
  - a phone
  - a cover letter (required)
  - a cv (a document)
  - status (submitted, shortlisted, rejected or hired, submitted by default)

Close job
  For a job that is open; sets status to closed.
  Stop taking applications for a job.

Shortlist
  For an application that is submitted; sets status to shortlisted.
  Put an applicant on the shortlist.

Reject
  For an application that is submitted or shortlisted; sets status to rejected.
  Turn down an application.

Hire
  For an application that is shortlisted; sets status to hired.
  Mark the applicant as hired.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A union member who browses jobs and applies): opens the home page, the jobs page and the applications page; adds applications
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's applications; adds jobs; changes everyone's jobs and applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 128 files (128 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yVBSDF/app-6/smithable.auth.yml:16:5  warning  staff may change others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-yVBSDF/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Football
  A football club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, status or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name or position; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group
  - a coach
  - about
  - a photo (picture)
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a shirt number (a whole number)
  - a photo (picture)
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue
  - a home or away (home or away, home by default)
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
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 129 files (129 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yVBSDF/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Browse the conference programme and speakers, and register for the talks you want to attend.

Pages
  - Home (a landing page: hero, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month)
  - Talks (lists talks; search by title or room; filter by speaker or starts at; only for admins)
  - Speakers (lists speakers)
  - My registrations (lists registrations)
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
  At most the talk's capacity registrations per talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (An attendee who registers for talks): opens the my registrations page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yVBSDF/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk where the IT team tracks tickets, their priority and who handles them.

Pages
  - Tickets (lists tickets; search by title, description or requester; sort by priority, status or date added; “Take”; “Resolve”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a title (required)
  - a description
  - a priority (normal, low, high or urgent, normal by default)
  - status (open, in progress, waiting or resolved, open by default)
  - a category (other, hardware, software, network or account, other by default)
  - a requester
  - a requester email
  - resolved at (a date and time)
  - attachments (documents)
  Each ticket can have an assignee (a user).

Take
  For a ticket that is open or waiting; sets assignee to whoever presses it and status to in progress.
  Take the ticket and start working on it.

Resolve
  For a ticket that is open, in progress or waiting; sets status to resolved and resolved at to now.
  Mark the ticket as resolved.

Reopen
  For a ticket that is resolved; sets status to open; asks for the resolved at.
  Open a resolved ticket again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; changes everyone's tickets
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  The family's recipe collection, with each recipe's ingredients and the shopping lists for what to cook next.

Pages
  - Recipes (lists recipes; search by name, summary or category; filter by category or favorite)
  - Shopping lists (lists shopping lists; “Finish shopping”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, side, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - a picture
  - instructions (formatted text)
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
  - shop on (a date)
  - status (open or done, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - a quantity
  - a recipe (a recipe)
  - bought (yes or no)

Mark bought
  For a shopping item that is not bought; sets bought to yes.
  Tick an item off the shopping list once it is in the basket.

Finish shopping
  For a shopping list that is open; sets status to done.
  Mark a shopping list as done after the shopping trip.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A family member: adds and edits recipes and shopping lists): opens every page; adds every kind of record; changes everyone's records
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API: open incidents, their updates and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances, incidents where status is resolved and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Overview (a dashboard: open, per month and latest)
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
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yVBSDF/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
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
  - staff (Writes incidents and their updates): opens the incidents page and the updates page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 144 files (144 changed, 0 removed).

Created /tmp/smithable-bench-m12-yVBSDF/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-yVBSDF/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-yVBSDF/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
