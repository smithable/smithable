# M12 first builds: claude-code (2026-10-15)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to twice). Totals: 12 / 12 created, 12 type-check, 475,385 tokens (451,369 in, 24,016 out), €0.0000 + $1.0269 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 38,205 | 1,785 | $0.3413 | 0 | 1 | 39 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 14 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 76,181 | 2,960 | $0.1115 | 0 | 2 | 53 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 37,127 | 1,852 | $0.0555 | 0 | 1 | 51 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 36,929 | 1,083 | $0.0385 | 0 | 1 | 36 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 37,126 | 2,962 | $0.0777 | 0 | 1 | 44 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 36,920 | 2,412 | $0.0650 | 0 | 1 | 44 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 38,203 | 2,031 | $0.0677 | 0 | 1 | 42 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 37,615 | 1,877 | $0.0599 | 0 | 1 | 27 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 36,925 | 1,340 | $0.0436 | 0 | 1 | 23 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 38,068 | 2,948 | $0.0849 | 0 | 1 | 51 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 38,070 | 2,766 | $0.0813 | 0 | 1 | 42 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 4 / 6 (has 4) | 7 / 11 (has 8) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 3 | 3 / 4 (has 4) | 5 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 1) | 4 / 5 (has 6) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, catalog, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 5) | private; admin, staff, member (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 3 / 11 (has 6) | 0 / 0 (has 0) | private; admin, attendee (attendee) | none | pages home, schedule, speakers, privacy; read Speaker, Talk; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: invoicing) | 3 | 2 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 2 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | Payments | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Room Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, instructors, faq, call to action and footer)
  - Sessions (lists sessions; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)
  - Teachers (lists instructors; only for admins; visitors see instructors on the Home page)
  - My bookings (lists bookings)
  - Schedule (a calendar of sessions by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

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
  At most the session's capacity bookings per session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 143 files (143 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-3S0pDz/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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
Generated 136 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Ledgerly
  Invoicing for freelancers: keep track of clients, send invoices and record payments.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”)
  - Clients (lists clients; search by name or email)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Invoice lines (lists invoice lines)
  - Overview (a dashboard: received, latest, outstanding and overdue)
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
  The paid amount is calculated as the total amount of its payments.
  The total is calculated as the total amount of its lines.
  The balance is calculated as the total amount of its lines minus the total amount of its payments.

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
Generated 146 files (146 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-3S0pDz/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshed
  Neighbors lend each other tools instead of each buying their own.

Pages
  - Catalog (lists tools; search by title, description or place; filter by category, condition or available; sort by title or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Saved (lists tools; only the viewer's saved records)
  - Home (a landing page: hero, tools where available is yes and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)

Tools
  Tools have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a category (power tools, hand tools, garden, ladders, cleaning, painting or other, power tools by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Lend out
  For a tool that is available; sets available to no.
  Mark the tool as lent to a neighbor.

Mark returned
  For a tool that is not available; sets available to yes.
  Mark the tool as back and available to borrow.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Lends out tools and borrows from neighbors): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-3S0pDz/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of the bakery's ingredients, their suppliers and how much of each is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by supplier or unit)
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
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number)
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

Created /tmp/smithable-bench-m12-3S0pDz/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  A job board where the local union posts jobs and members apply for them.

Pages
  - Jobs (lists jobs; search by title, employer, description, location or trade; filter by job type, status or deadline; sort by deadline or date added; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records; only for members and admins)
  - Applications (lists applications; search by name, email or member number; filter by job or status; only for staff users and admins)
  - Home (a landing page: hero, jobs where status is open, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a trade
  - a pay
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a deadline (a date)
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
  - status (submitted, shortlisted, hired or declined, submitted by default)

Mark filled
  For a job that is open; sets status to filled.
  Mark a job as filled once someone is hired.

Close job
  For a job that is open; sets status to closed.
  Close a job to new applications.

Shortlist
  For an application that is submitted; sets status to shortlisted.
  Put an application on the shortlist.

Hire
  For an application that is submitted or shortlisted; sets status to hired.
  Mark the applicant as hired.

Decline
  For an application that is submitted or shortlisted; sets status to declined.
  Decline an application.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Union staff who post jobs and handle applications): opens the jobs page and the applications page; sees everyone's jobs and applications; adds jobs; changes everyone's jobs and applications; deletes everyone's jobs
  - member (Union members who browse jobs and apply): opens the jobs page and the my applications page; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-3S0pDz/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Football
  The club's site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, status or venue; “Record result”; “Postpone”)
  - Teams (lists teams; filter by category)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - a category (senior, youth, women or veterans, senior by default)
  - a coach
  - a photo (picture)
  - about
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
  - a competition
  - status (scheduled, played, postponed or canceled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report

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
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-3S0pDz/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Hub
  The conference programme of talks and speakers, where attendees register for the talks they want to attend.

Pages
  - Home (a landing page: hero, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month)
  - Talks (lists talks; filter by track or speaker; only for admins)
  - Speakers (lists speakers)
  - My registrations (lists registrations)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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
  - a track (general, technical, business or workshop, general by default)
  - a capacity (a whole number, required, 100 by default)
  Each talk lists its registrations.
  The places left is calculated as the capacity minus the number of its registrations.

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  At most the talk's capacity registrations per talk.

Registration made
  When a registration is added: mails its owner.

Registration cancelled
  When a registration is deleted: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - attendee (A conference attendee who registers for talks): opens the my registrations page; adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the schedule page, the speakers page, the privacy page, reading speakers and reading talks.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-3S0pDz/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets for the IT team: their priorities and who handles them.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required, fixed once made)
  - status (open, in progress, closed or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a body
  - attachments (documents)
  Each ticket can have an assignee (a user, required when status is in progress or closed).
  Each ticket lists its notes.

Notes
  Notes have:
  - a content (required)
  - attachments (documents)
  - a ticket (a ticket, required)
  Each note can have an agent (a user, who makes it, by default, filled by the app).

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
Generated 128 files (128 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A family's shared recipe collection, with each recipe's ingredients and the shopping lists for the week.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Mark done”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, dessert, baking, breakfast, side or drink, main by default)
  - servings (a whole number, 4 by default)
  - prep minutes (a whole number)
  - a photo (picture)
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
  - shop on (a date, today by default)
  - status (open or done, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - a quantity
  - bought (yes or no)

Mark done
  For a shopping list that is open; sets status to done.
  Mark a shopping list as done once the shopping is finished.

Mark bought
  For a shopping item that is not bought; sets bought to yes.
  Tick off an item once it is in the basket.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API: incidents being fixed and maintenance that is planned.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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
  - staff (Writes incidents, their updates and planned maintenance): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-3S0pDz/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our web shop's services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Maintenance (lists maintenances)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-3S0pDz/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-3S0pDz/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-3S0pDz/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
