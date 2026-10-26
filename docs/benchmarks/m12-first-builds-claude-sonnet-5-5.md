# M12 first builds: claude-sonnet-5-5 (2026-10-26)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 391,932 tokens (362,504 in, 29,428 out), €0.0000 + $0.4589; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 53,715 | 3,866 | $0.1143 | 0 | – | 57 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | – | 13 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 52,134 | 3,855 | $0.0547 | 0 | – | 70 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 25,302 | 2,468 | $0.0312 | 0 | – | 75 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 50,478 | 1,697 | $0.0298 | 0 | – | 64 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 25,302 | 2,618 | $0.0327 | 0 | – | 85 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 25,095 | 1,945 | $0.0256 | 0 | – | 79 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 27,079 | 2,787 | $0.0380 | 0 | – | 73 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 25,806 | 2,131 | $0.0289 | 0 | – | 64 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 25,101 | 1,684 | $0.0230 | 0 | – | 91 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 26,244 | 3,183 | $0.0403 | 0 | – | 85 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 26,248 | 3,194 | $0.0404 | 0 | – | 81 s |

Each created app's four spec files are in [m12-first-builds-claude-sonnet-5-5/](m12-first-builds-claude-sonnet-5-5/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 4 / 6 (has 4) | 8 / 12 (has 8) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read Instructor, Session, ClassType; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 0 | 3 / 4 (has 4) | 3 / 7 (has 4) | 3 / 3 (has 3) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 4) | 0 / 0 (has 3) | private; admin, member (member) | none | pages home, jobs; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 12 (has 7) | 0 / 1 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read Speaker, Talk; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: invoicing) | 3 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Yoga Studio
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, instructors, features, faq, call to action, class types and footer)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - My bookings (lists bookings)
  - Schedule (a calendar of sessions by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)

Instructors
  Instructors have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Each instructor lists its sessions.

Sessions
  Sessions have:
  - an instructor (an instructor, required)
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
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading instructors, reading sessions and reading class types.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,337 tokens (480 in, 1,857 out) · $0.0195
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, hero.webp, logo.webp.
Generated 159 files (159 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WU5hLw/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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

Created /tmp/smithable-bench-m12-WU5hLw/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Freelance Invoices
  Invoicing for freelancers: keep track of clients, invoices and the payments received.

Pages
  - Clients (lists clients)
  - Invoice lines (lists invoice lines)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Payments (lists payments)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - address
  - a VAT number

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
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The amount paid is calculated as the total amount of its payments.

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
  The client paid the invoice.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Overdue check
  A day after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 3,988 tokens (576 in, 3,412 out) · $0.0353
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-3
  smithable studio

or only run the app with smithable run.
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshare
  Neighbors lend each other tools and keep track of who has what.

Pages
  - Tools (lists tools; search by name, description or place; filter by category, condition or available)
  - My tools (lists tools; only the viewer's own records)
  - Loans (lists loans; filter by status or due on; “Mark returned”)
  - Home (a landing page: hero, tools, features and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tools
  Tools have:
  - a name (required)
  - photos (pictures)
  - a description
  - a category (hand, power, garden, cleaning, ladders or other, hand by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)

Loans
  Loans have:
  - a tool (a tool, required)
  - borrowed on (a date, required)
  - due on (a date, required)
  - status (out or returned, out by default)
  - returned on (a date)
  - a note

Mark returned
  For a loan that is out; sets status to returned and returned on to today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,453 tokens (459 in, 1,994 out) · $0.0209
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WU5hLw/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Pantry
  Keeps track of a small bakery's ingredients, suppliers and stock levels.

Pages
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Ingredients (lists ingredients; search by name or notes; filter by category, supplier or storage)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - a website (a web address)
  - notes

Ingredients
  Ingredients have:
  - a name (required)
  - a supplier (a supplier)
  - a category (flour and grains, dairy and eggs, sugar and sweeteners, fats and oils, yeast and leavening, fruit and nuts, flavorings, packaging or other, flour and grains by default)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - a stock level (a number, required, 0 by default)
  - a reorder level (a number, 0 by default)
  - a cost per unit (an amount)
  - a storage (dry store, fridge or freezer, dry store by default)
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
Frontier model (claude-sonnet-5-5) · 2,527 tokens (577 in, 1,950 out) · $0.0207
Pictures from the Smithable image library: logo.webp.
Generated 116 files (116 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  A job board where a local union posts openings and its members apply.

Pages
  - Jobs (lists jobs; search by title, employer, location or description; filter by type, status or deadline; “Close job”)
  - Applications (lists applications; filter by status or job; “Shortlist”; “Reject”)
  - Home (a landing page: hero, features and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a location
  - a type (full time, part time, temporary or apprenticeship, full time by default)
  - a pay
  - a description (required)
  - a deadline (a date)
  - status (open or closed, open by default)

Applications
  Applications have:
  - a job (a job, required)
  - a phone
  - a cover letter (required)
  - a resume (a document)
  - status (submitted, shortlisted or rejected, submitted by default, filled by the app)

Close job
  For a job that is open; sets status to closed.

Shortlist
  For an application that is submitted or rejected; sets status to shortlisted.

Reject
  For an application that is submitted or shortlisted; sets status to rejected.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A union member who browses jobs and applies for them): opens the jobs page and the applications page; sees everyone's jobs; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 3,033 tokens (454 in, 2,579 out) · $0.0267
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WU5hLw/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Hub
  A football club's site with its teams, players, matches and results.

Pages
  - Home (a landing page: hero, matches, teams and footer)
  - Matches (lists matches; search by opponent or venue; filter by team, status or kickoff)
  - Teams (lists teams; search by name; filter by category)
  - Players (lists players; search by name or position; filter by team, position or active)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required, unique)
  - a category (men, women, juniors or veterans, men by default)
  - a coach
  - a photo (picture)
  - about
  Each team lists its players.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a shirt number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a photo (picture)
  - a bio
  - active (yes or no, true by default)

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue
  - a side (home or away, home by default)
  - status (scheduled, played or postponed, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report (formatted text)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Follows the club and looks at the records): opens every page
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 3,164 tokens (529 in, 2,635 out) · $0.0274
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, hero.webp, logo.webp.
Generated 132 files (132 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WU5hLw/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Hub
  Event registration for a conference: browse the talks and speakers, and register for the talks you want to attend.

Pages
  - Home (a landing page: hero, features, speakers, faq, call to action and footer)
  - Talks (lists talks; only for admins)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - My registrations (lists registrations)
  - Schedule (a calendar of talks by week or month)
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
  - an abstract
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a room
  - a capacity (a whole number, required, 50 by default)
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
  - member (An attendee who registers for talks): opens the my registrations page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading speakers and reading talks.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,856 tokens (444 in, 2,412 out) · $0.0250
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 147 files (147 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WU5hLw/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets for the IT team, with priorities and who handles each one.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority, category or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required)
  - a category (hardware, software, network, access or other, hardware by default)
  - status (open, in progress, closed or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a description
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
  Give the ticket to a team member.

Start work
  For a ticket that is open or reopened; sets status to in progress.
  Someone is working on the ticket now; it needs an assignee.

Close
  For a ticket that is open, in progress or reopened; sets status to closed.
  The requester has their answer.

Reopen
  For a ticket that is closed; sets status to reopened.
  The ticket needs more work after all.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - agent (Works on tickets, takes them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 2,258 tokens (442 in, 1,816 out) · $0.0190
Pictures from the Smithable image library: logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipe Book
  A shared recipe collection for the family, with ingredients and shopping lists.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; “Complete list”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (breakfast, main, side, dessert, snack or drink, breakfast by default)
  - servings (a whole number, required, 4 by default)
  - prep minutes (a whole number)
  - cook minutes (a whole number)
  - instructions (formatted text)
  - a source (a web address)
  - a photo (picture)
  - favorite (yes or no, false by default)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity (a number)
  - a unit
  - a note

Shopping lists
  Shopping lists have:
  - a name (required)
  - status (active or done, active by default)
  - notes
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - a quantity (a number)
  - a unit
  - bought (yes or no, false by default)

Mark bought
  For a shopping item that is not bought; sets bought to yes.

Complete list
  For a shopping list that is active; sets status to done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 4,858 tokens (588 in, 4,270 out) · $0.0439
Pictures from the Smithable image library: samples/recipe-1.webp, samples/recipe-2.webp, samples/recipe-3.webp, samples/recipe-4.webp, samples/recipe-5.webp, samples/recipe-6.webp, logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-10
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
Frontier model (claude-sonnet-5-5) · 5,269 tokens (569 in, 4,700 out) · $0.0481
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WU5hLw/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shopwatch Status
  Is the shop working? The state of our services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
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
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-sonnet-5-5) · 4,176 tokens (581 in, 3,595 out) · $0.0371
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-WU5hLw/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WU5hLw/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WU5hLw/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
