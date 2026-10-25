# M12 first builds: mistral-large-latest (2026-10-25; 2 rerun since)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 11 / 12 created, 10 type-check, 515,674 tokens (489,723 in, 25,951 out), €0.0000 + $0.2838 (Mistral's list price); 4 model calls answered from the response cache. Rows marked *rerun* ran again on their own after the full run (`--only`). *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 37,420 | 2,637 | $0.0227 | 0 | 2 | 42 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 10 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 90,567 | 4,644 | $0.0522 | 0 | 5 | 62 s |
| A tool library where neighbors lend each other tools. *(rerun 2026-10-25)* | marketplace | yes | **no** | 52,982 | 342 | $0.0270 | 1 | 4 | 81 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 17,258 | 657 | $0.0096 | 0 | 1 | 21 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 74,267 | 5,421 | $0.0453 | 0 | 4 | 62 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 17,256 | 859 | $0.0099 | 0 | 1 | 39 s |
| Event registration for a conference: talks, speakers and attendees. | records | yes | yes | 92,158 | 3,947 | $0.0520 | 0 | 5 | 119 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 17,757 | 1,059 | $0.0105 | 0 | 1 | 35 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 17,255 | 2,222 | $0.0120 | 0 | 1 | 41 s |
| A status page for our API, with incidents and planned maintenance. *(rerun 2026-10-25)* | status | **no** | **no** | 36,659 | 2,397 | $0.0219 | 3 | 5 | 28 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 36,144 | 1,766 | $0.0207 | 0 | 2 | 50 s |

Each created app's four spec files are in [m12-first-builds-mistral-large-latest/](m12-first-builds-mistral-large-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

3 of 11 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 (has 6) | 12 / 12 (has 12) | 1 / 1 (has 1) | private; admin, member (member) | none | pages home, schedule, blog, about, privacy; read ClassType, Instructor, Session, Post; create Message | 2 (no-timezone, operator-unknown) | none |  | none | 4 / 6 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 (has 4) | 5 / 7 (has 5) | 3 / 3 (has 3); left out: addField Invoice.dueOn | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, tools; read none; create none | 3 (public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, baker (baker) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, jobs; read none; create none | 3 (public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 2 | no mention; landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | records | 3 | 0 / 1 (has 4) | 1 / 2 (has 7) | 0 / 0 (has 2) | shared; admin, organizer (organizer) | none | pages home, talks; read Talk; create none | 3 (capacity-no-unique, public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 4 | no mention; landing page |
| 9 | support (words: invoicing) | 3 | 1 / 2 (has 2) | 1 / 2 (has 2) | 4 / 5 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, recipes; read Recipe; create none | 3 (write-without-read, operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, member (member) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, estimate, gallery, faq, posts, contact, class types, call to action and footer)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for admins)
  - Instructors (lists instructors; only for admins)
  - Messages (lists messages; only for admins)
  - Posts (lists posts; filter by status; only for admins; visitors see posts on the Home page)
  - Schedule (a calendar of sessions by week or month)
  - Blog (posts as articles, newest first, each on its own page)
  - About (a page of parts: intro, story, instructors and faq)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - My bookings (lists bookings; with cancelling)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)

Instructors
  Instructors have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)

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

Class types
  Class types have:
  - a name (required)
  - a summary
  - a level (beginner, all levels or advanced, beginner by default)
  - duration minutes (a whole number, required, 60 by default)

Publish
  For a post that is draft; sets status to published.
  The post is out for everyone to read.

Reminder
  When the timer “Remind” comes for a booking: mails its owner.

Booking made
  When a booking is added: mails its owner.

Booking changed
  When a booking is changed: mails its owner.

Booking cancelled
  When a booking is deleted: mails its owner.

Remind
  A day before a booking's session's starts at: raises its event, for outgoing to tell someone.

Publish
  When a post's published on comes, where status is draft: runs “Publish”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers): everything
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, the about page, the privacy page, reading class types, reading instructors, reading sessions, reading posts where status is published and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 190 files (190 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KnEaQ1/app-1/smithable.yml:103:15  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-KnEaQ1/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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

Created /tmp/smithable-bench-m12-KnEaQ1/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Left out, since it could not be made valid:
  addField Invoice.dueOn: addField would make smithable.yml invalid. Field "Invoice.dueOn": Expected a closing ")", found ".".

Freelance Invoicing
  Manage clients, invoices and payments as a freelancer.

Pages
  - Clients (lists clients)
  - Invoice lines (lists invoice lines)
  - Settings (lists business profiles)
  - Invoices (lists invoices; filter by client or status; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Overview (a dashboard: latest, outstanding, overdue, paid and invoiced)

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
  - status (draft, sent, paid or overdue, draft by default)
  - a contract (a document)
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

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 146 files (146 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-3
  smithable studio

or only run the app with smithable run.
```

### 4. A tool library where neighbors lend each other tools.

```text
NeighborTools
  A tool library where neighbors lend each other tools.

Pages
  - Borrow tools from your neighbors (a landing page: hero, tools where available is yes and footer)
  - Tools (lists tools)
  - My tools (lists tools)
  - Borrowings (lists borrowings)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - photos (pictures, required)
  - a description (required)
  - a category (gardening, woodworking, plumbing, electrical, automotive, cleaning or other, gardening by default)
  - a condition (new, like new, good, worn or broken, new by default)
  - a location
  - available (yes or no, true by default)
  - a due back (a date)
  Each tool can have a borrower (a user, fixed when available is no).

Borrowings
  Borrowings have:
  - a tool (a tool, required)
  - borrowed on (a date, today by default)
  - a due back (a date, required)
  - returned on (a date)
  - notes
  Each borrowing can have a borrower (a user).

Borrow
  For a tool that is available; sets available to no and borrower to whoever presses it; asks for the due back and the borrowing's due back; adds a borrowing (borrower whoever pressed it).
  Mark a tool as borrowed and create a borrowing record.

Return tool
  For a tool that is not available; sets available to yes; asks for the borrower and the due back.
  Mark a tool as returned and available.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and the tools page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-cJDMuY/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-cJDMuY/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-cJDMuY/app-4/smithable.auth.yml:11:11  warning  Visitors can open home, but may not read Tool, so the page shows them none: add it under public.read, or remove the section of home that shows it.
/tmp/smithable-bench-m12-cJDMuY/app-4/smithable.auth.yml:11:17  warning  Visitors can open tools, but may not read Tool, so the page shows them none: add it under public.read, or take tools out of public.pages.
/tmp/smithable-bench-m12-cJDMuY/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
SweetStock
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients)
  - Suppliers (lists suppliers)
  - Team (who has access: invite people, change roles, remove users)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a stock (a whole number, required, 0 by default)
  - a minimum (a whole number, required, 5 by default)
  - a unit (required, kg by default)
  - a last updated (required, today by default)
  - a supplier (a supplier, required)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact (required)
  - an email
  - a phone
  - address

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - baker: everything
  New users get the baker role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 115 files (115 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Local Union Jobs
  Find and post jobs for union members in the area.

Pages
  - Find your next union job (a landing page: hero, jobs where status is open and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Jobs (lists jobs; search by job title, description or location; filter by category, hours or wage; sort by wage or date added; records can be saved as favorites)
  - My jobs (lists jobs; only the viewer's own records)
  - Applications (lists applications)

Jobs
  Jobs have:
  - a job title (required)
  - a description (formatted text, required)
  - a category (construction, healthcare, education, manufacturing, transportation or other, construction by default)
  - a wage (an amount)
  - hours (full time, part time, contract or seasonal, full time by default)
  - a location (required)
  - status (open or closed, open by default)
  Each job can have a posted by (a user).

Applications
  Applications have:
  - a job (a job, required)
  - a name (required)
  - an email (required)
  - a phone
  - a message
  - a resume (a document)
  - status (submitted, reviewed, contacted or rejected, submitted by default)

Close job
  For a job that is open; sets status to closed.
  Close the job posting so no more applications are received.

Reopen job
  For a job that is closed; sets status to open.
  Reopen the job posting to accept applications again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and the jobs page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KnEaQ1/app-6/smithable.auth.yml:11:11  warning  Visitors can open home, but may not read JobPost, so the page shows them none: add it under public.read, or remove the section of home that shows it.
/tmp/smithable-bench-m12-KnEaQ1/app-6/smithable.auth.yml:11:17  warning  Visitors can open jobs, but may not read JobPost, so the page shows them none: add it under public.read, or take jobs out of public.pages.
/tmp/smithable-bench-m12-KnEaQ1/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Greenfield FC
  The teams, players and matches of Greenfield Football Club.

Pages
  - Welcome to Greenfield FC (a landing page: hero, teams and footer)
  - Teams (lists teams)
  - Players (lists players)
  - Matches (lists matches)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group (required)
  - a coach
  - training days
  - a training time

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position
  - a number (a whole number)
  - a date of birth
  - a height (a number)
  - a weight (a number)
  - a nationality

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a date (required)
  - a time
  - a venue
  - home (yes or no, true by default)
  - a result
  - a score
  - a report (formatted text)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 122 files (122 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KnEaQ1/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Manage talks, speakers and attendees for a conference.

Pages
  - Join Us for the Conference (a landing page: hero, talks where status is scheduled, speakers and footer)
  - Talks (lists talks; “Cancel talk”)
  - Speakers (lists speakers)
  - Attendees (lists attendees)
  - Registrations (lists registrations; “Cancel registration”)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users)

Speakers
  Speakers have:
  - a name (required)
  - a bio
  - an email (required)
  - a phone
  - a website (a web address)
  - a picture

Talks
  Talks have:
  - a title (required)
  - a description
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a speaker (a speaker, required)
  - a room
  - status (draft, scheduled or canceled, draft by default)
  - a capacity (a whole number, required, 100 by default)

Attendees
  Attendees have:
  - a name (required)
  - an email (required)
  - a phone
  - a company
  - a ticket type (standard or vip, standard by default)

Registrations
  Registrations have:
  - an attendee (an attendee, required)
  - a talk (a talk, required)
  - registered at (a date and time, required, now by default)
  - status (confirmed or canceled, confirmed by default)
  At most the talk's capacity registrations per talk (counting those with status confirmed).

Cancel talk
  For a talk that is scheduled; sets status to canceled.
  Cancel a scheduled talk.

Cancel registration
  For a registration that is confirmed; sets status to canceled.
  Cancel a confirmed registration.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - organizer: everything
  New users get the organizer role.
  Open to anyone without signing in: the home page, the talks page and reading talks.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 145 files (145 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KnEaQ1/app-8/smithable.yml:39:7  warning  Registration has a capacity per talk, but "talk" is not unique: one person can take several places.
    hint: Write "talk: Talk! unique" for one registration per person and talk (unique per owner with private access).
/tmp/smithable-bench-m12-KnEaQ1/app-8/smithable.auth.yml:12:11  warning  Visitors can open home, but may not read Speaker, so the page shows them none: add it under public.read, or remove the section of home that shows it.
/tmp/smithable-bench-m12-KnEaQ1/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets from users, handled by the IT team.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Resolve”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required, fixed once made)
  - status (open, in progress, resolved or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a body
  - attachments (documents)
  Each ticket can have an assignee (a user, required when status is in progress or resolved).
  Each ticket lists its messages.

Messages
  Messages have:
  - a content (required)
  - a sender (agent or user, agent by default)
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

Resolve
  For a ticket that is open, in progress or reopened; sets status to resolved.
  The user has their answer.

Reopen
  For a ticket that is resolved; sets status to reopened.
  The ticket needs more work after all.

Ticket received
  When a ticket is added: mails requester email.

Reply sent
  When a message is added and sender is agent: mails ticket's requester email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 136 files (136 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep and share family recipes and shopping lists.

Pages
  - Family Recipes (a landing page: hero, recipes where favorite is yes, recipes, call to action and footer)
  - Recipes (lists recipes)
  - Shopping lists (lists shopping lists)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - ingredients (required)
  - instructions (formatted text, required)
  - a prep time (minutes) (a whole number, 0 by default)
  - a cook time (minutes) (a whole number, 0 by default)
  - servings (a whole number, 1 by default)
  - a category (breakfast, lunch, dinner, dessert, snack or drink, breakfast by default)
  - a difficulty (easy, medium or hard, easy by default)
  - favorite (yes or no, false by default)
  - added on (a date, required, today by default)

Shopping Lists
  Shopping Lists have:
  - a name (required)
  - items (required)
  - completed (yes or no, false by default)

Ingredients
  Ingredients have:
  - a name (required)
  - a quantity
  - a unit
  - a recipe (a recipe, required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Can view and create shopping lists): opens every page; adds shopping lists; changes everyone's shopping lists; deletes everyone's shopping lists
  New users get the member role.
  Open to anyone without signing in: the home page, the recipes page and reading recipes.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-KnEaQ1/app-10/smithable.auth.yml:11:5  warning  member may change others' ShoppingList it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-KnEaQ1/app-10/smithable.auth.yml:12:5  warning  member may delete others' ShoppingList it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-KnEaQ1/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. A status page for our API, with incidents and planned maintenance.

Failed:

```text
Starting from the status starter.
Smithable model (mistral-large-latest) · 39,056 tokens (36,659 in, 2,397 out) · $0.0219 · 3 of 5 calls from the cache
No model drafted a valid project.
Expected ':' after property name in JSON at position 934 (line 1 column 935)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-GtsCBn/app-11 --starter status

```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  The uptime of our web shop and its services, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components)
  - Maintenance (lists maintenances)
  - Overview (every kind of record, to find, open, change and delete; only for admins)
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
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 168 files (168 changed, 0 removed).

Created /tmp/smithable-bench-m12-KnEaQ1/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-KnEaQ1/app-12
  smithable studio

or only run the app with smithable run.
```
