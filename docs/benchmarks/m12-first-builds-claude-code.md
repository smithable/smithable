# M12 first builds: claude-code (2026-10-22)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 587,182 tokens (557,623 in, 29,559 out), €0.0000 + $1.2227 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 43,501 | 2,699 | $0.4020 | 0 | 1 | 189 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 143 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 86,679 | 4,168 | $0.1404 | 0 | 2 | 162 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 42,207 | 1,980 | $0.0590 | 0 | 1 | 158 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 42,012 | 1,573 | $0.0493 | 0 | 1 | 111 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 86,718 | 5,499 | $0.1563 | 0 | 1 | 127 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 42,000 | 2,375 | $0.0653 | 0 | 1 | 101 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 43,497 | 2,351 | $0.0768 | 0 | 1 | 80 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 42,698 | 1,895 | $0.0613 | 0 | 1 | 74 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 42,007 | 1,437 | $0.0466 | 0 | 1 | 83 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 43,150 | 2,950 | $0.0860 | 0 | 1 | 92 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 43,154 | 2,632 | $0.0797 | 0 | 1 | 81 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 5 / 6 (has 5) | 9 / 11 (has 9) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, instructors, privacy; read ClassType, Instructor, Session; create Message | 1 (operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 3 | 3 / 4 (has 4) | 5 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 3 / 5 (has 7) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 5) | private; admin, staff, member (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 11 (has 7) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, talks, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: invoicing) | 3 | 2 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 2 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Juniper Yoga Studio
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, instructors, faq, call to action, contact and footer)
  - Schedule (a calendar of sessions by week or month)
  - My bookings (lists bookings)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors)
  - Messages (lists messages; only for admins)
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

Bookings
  Bookings have:
  - a session (a session, required, unique)
  Each booking can have an attendee (a user).
  The attendee owns the booking.
  At most the session's capacity bookings per session.

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
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the instructors page, the privacy page, reading class types, reading instructors, reading sessions and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-UGXRg8/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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
Generated 138 files (137 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Ledgerly
  Invoicing for freelancers: keep your clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Overview (a dashboard: received, outstanding, overdue, invoiced and latest)
  - Clients (lists clients)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Invoice lines (lists invoice lines)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”)

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
  - an amount (an amount, required)
  - paid on (a date, required, today by default)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a reference
  - a note
  - an invoice (an invoice, required)

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - a contract (a document)
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
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-UGXRg8/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Neighbor Tools
  A tool library where neighbors lend each other tools.

Pages
  - Tools (lists tools; search by title, description or place; filter by category, condition or available; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - Loans (lists loans; filter by status or tool; “Mark returned”)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, tools where available is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a title (required)
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
  - lent on (a date, required)
  - due on (a date)
  - status (out or returned, out by default)
  - returned on (a date, filled by the app)
  - a note
  Each loan can have a borrower (a user).

Mark returned
  For a loan that is out; sets status to returned and returned on to today.
  Record that the borrowed tool has come back.

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
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-UGXRg8/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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
  - a name (required, unique)
  - a supplier (a supplier)
  - a category (flour, sugar, dairy, eggs, fats, yeast, flavorings, fruit and nuts, packaging or other, flour by default)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a cost per unit (an amount)
  - a storage (dry, chilled or frozen, dry by default)
  - a last counted (a date, today by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Works in the bakery: keeps ingredients, suppliers and stock levels up to date): opens every page; adds every kind of record; changes everyone's ingredients and suppliers
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 115 files (115 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  Job posts from our local union, and members' applications for them.

Pages
  - Jobs (lists jobs; search by title, employer, location or description; filter by trade, job type, status or closes on; sort by date added or closes on; records can be saved as favorites; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; search by name, email or member number; filter by job or status; only for staff users and admins)
  - Home (a landing page: hero, jobs where status is open and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a trade (electrical, plumbing, carpentry, construction, manufacturing, transport, healthcare or other, electrical by default)
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a location
  - a pay rate
  - a description (required)
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required)
  - a name (required)
  - an email (required)
  - a phone
  - a member number
  - a message
  - a resume (a document)
  - status (submitted, shortlisted, accepted or declined, submitted by default, filled by the app)

Mark filled
  For a job that is open; sets status to filled.
  Mark a job as filled once someone is hired.

Close job
  For a job that is open; sets status to closed.
  Close a job post to new applications.

Shortlist
  For an application that is submitted; sets status to shortlisted.
  Put an application on the shortlist.

Accept
  For an application that is submitted or shortlisted; sets status to accepted.
  Accept an application.

Decline
  For an application that is submitted or shortlisted; sets status to declined.
  Decline an application.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Union staff: post jobs and review applications): opens every page; sees everyone's jobs and applications; adds jobs; changes everyone's jobs and applications; deletes everyone's jobs; runs every custom action
  - member (Union member: browses jobs and applies): opens the home page, the jobs page, the my applications page and the privacy page; sees everyone's jobs; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-UGXRg8/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Site
  A football club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, venue or status; “Record result”; “Postpone”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group
  - a coach
  - a photo (picture)
  - about
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a photo (picture)
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a ground
  - a competition
  - status (scheduled, played, postponed or cancelled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
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
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-UGXRg8/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Hub
  Registration for a conference: browse the talks and speakers, and save your seat at the talks you want to attend.

Pages
  - Home (a landing page: hero, talks, speakers, faq, call to action and footer)
  - Talks (lists talks; filter by track, speaker or starts at; sort by starts at or title)
  - Schedule (a calendar of talks by week or month)
  - Speakers (lists speakers; search by name or company)
  - My registrations (lists registrations)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

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
  - an abstract (formatted text)
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a room
  - a track (general, technical, business or workshop, general by default)
  - a capacity (a whole number, required, 100 by default)
  Each talk lists its registrations.
  The places left is calculated as the capacity minus the number of its registrations.

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  Each registration can have an attendee (a user).
  The attendee owns the registration.
  At most the talk's capacity registrations per talk.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (An attendee who registers for talks): opens the my registrations page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the talks page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 146 files (146 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-UGXRg8/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets for the IT team: their priorities and who handles them.

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
  The issue is solved.

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
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Kitchen
  The family's recipes with their ingredients, and the shopping lists for cooking them.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Finish shopping”)
  - Family (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a photo (picture)
  - a category (main, starter, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - instructions (formatted text)
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
  - shop on (a date, today by default)
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

Finish shopping
  For a shopping list that is open; sets status to done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A family member: adds recipes and shops from the lists): opens every page; adds every kind of record; changes everyone's shopping lists and shopping items
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Is the API working? Live status, incidents and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
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
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-UGXRg8/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our web shop's services, outages and their updates, live.

Pages
  - Home (a landing page: hero, services, outages where status is investigating or identified or monitoring, outages where status is resolved and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Outages (lists outages; filter by status or service)
  - Updates (lists incident updates)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Overview (a dashboard: open, per month and latest)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its outages.

Outages
  Outages have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a service (a service)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each outage lists its incident updates.

Incident updates
  Incident updates have:
  - an outage (an outage, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Identified
  For an outage that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an outage that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an outage that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The outage is over, with an update saying so. The service's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes outages and their updates): opens the overview page, the incidents page and the updates page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Other programs can read and change services and outages with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-UGXRg8/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-UGXRg8/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-UGXRg8/app-12/smithable.content.yml:17:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
