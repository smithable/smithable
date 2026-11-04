# M12 first builds: mistral-medium-latest (2026-11-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 10 type-check, 592,793 tokens (574,341 in, 18,452 out), $0.9999 (Mistral's list price); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | **no** | 73,377 | 1,865 | $0.1241 | 0 | – | 75 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 120,321 | 1,755 | $0.1936 | 0 | – | 85 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | **no** | 94,004 | 705 | $0.1463 | 0 | – | 57 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 23,486 | 700 | $0.0405 | 0 | – | 27 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 23,309 | 563 | $0.0392 | 0 | – | 33 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 72,336 | 2,109 | $0.1243 | 0 | – | 62 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 23,307 | 662 | $0.0399 | 0 | – | 30 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 48,620 | 877 | $0.0795 | 0 | – | 46 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 23,826 | 1,554 | $0.0474 | 0 | – | 34 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 23,306 | 867 | $0.0415 | 0 | – | 41 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 24,221 | 4,981 | $0.0737 | 0 | – | 57 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 24,228 | 1,814 | $0.0499 | 0 | – | 42 s |

Each created app's four spec files are in [m12-first-builds-mistral-medium-latest/](m12-first-builds-mistral-medium-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

1 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 (has 6) | 2 / 13 (has 3) | 1 / 1 (has 1) | private; admin, member (member) | none | pages home; read ClassType, Post; create Message | 0 | none |  | none | 4 / 6 | mentions visitors; landing page |
| 2 | crm | 0 | 1 / 3 (has 4) | 2 / 5 (has 5) | 0 / 2 (has 2); left out: mergeCompanies | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 0 | 4 / 4 (has 4) | 0 / 7 (has 0) | 0 / 3 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 3 / 4 | no mention; no landing page |
| 4 | marketplace (words: records) | 2 | 0 / 1 (has 1) | 1 / 5 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 1 | no mention; landing page |
| 5 | records (words: api) | 2 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, baker (baker) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 4) | 0 / 0 (has 0) | private; admin, member, employer (member) | none | pages home, jobs; read none; create none | 3 (role-opens-nothing, public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 0 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 4) | 2 / 13 (has 6) | 0 / 1 (has 0) | private; admin, attendee (attendee) | none | pages home, talks; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 4 | no mention; landing page |
| 9 | support (words: booking) | 2 | 1 / 2 (has 2) | 1 / 2 (has 2) | 4 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 (has 4) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, recipes; read Recipe; create none | 1 (operator-unknown) | none |  | none | 0 / 4 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio Booking
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, estimate, gallery, faq, posts, contact, class types, call to action and footer)
  - Estimate (a calculator: classes per month, drop in and pass give without pass and saved)
  - Schedule (lists sessions)

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

Todays bookings
  Every day at 06:30: the day's bookings (session, attendee) to the administrators by mail; nothing to send is skipped.

Session moved
  When a session's starts at changes: mails every booking's owner with its class type, starts at, instructor and what the changed fields were.

Morning
  Every day at 06:30: raises its event, for outgoing to tell someone.

Remind
  A day before a booking's session's starts at: raises its event, for outgoing to tell someone.

Publish
  When a post's published on comes, where status is draft: runs “Publish”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, reading class types, reading posts and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What currency should the app use? EUR (or: USD, GBP, SEK)
  Should the calculator for estimating savings be included on the landing page? Yes (or: No)
Smithable model (mistral-medium-latest) · 3,704 tokens (418 in, 3,286 out) · $0.0253
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, samples/post-1.webp, samples/post-2.webp, samples/post-3.webp, hero.webp, logo.webp.
Generated 168 files (168 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-1
  smithable studio

or only run the app with smithable run.
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Left out, since it could not be made valid:
  addAction mergeCompanies: addAction would make smithable.yml invalid. "fields" of action "mergeCompanies": accountManager takes no rule, the owner stays the kept record's.

Small Sales CRM
  A CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or email; filter by segment or account manager; sort by name or date added)
  - Contacts (lists contacts; search by name or email; filter by role or company; sort by name or date added)
  - Deals (lists deals; search by name or company; filter by status, company or contact; sort by close date, value or name; “Close deal won”; “Close deal lost”)
  - Follow ups (lists follow ups; search by note or company; filter by done, company or contact; sort by due on)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Companies
  Companies have:
  - a name (required)
  - an email
  - a phone
  - a segment (smb, enterprise or government, smb by default)
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  Each company lists its follow ups.
  The account manager owns the company.

Contacts
  Contacts have:
  - a name (required)
  - an email
  - a phone
  - a role (decision maker, influencer, user or other, decision maker by default)
  - a company (a company, required)
  - notes

Deals
  Deals have:
  - a name (required)
  - a company (a company, required)
  - a contact (a contact)
  - a value (an amount)
  - status (prospect, qualified, proposal, negotiation, closed won or closed lost, prospect by default)
  - a close date
  - notes

Follow ups
  Follow ups have:
  - a company (a company, required)
  - a contact (a contact)
  - due on (a date, required, today by default)
  - done (yes or no)
  - a note

Close deal won
  For a deal that is negotiation; sets status to closed won and close date to today.

Close deal lost
  For a deal that is negotiation; sets status to closed lost and close date to today.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records; deletes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 2,469 tokens (437 in, 2,032 out) · $0.0159
Pictures from the Smithable image library: logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Freelance Invoicing
  Invoicing for freelancers, with clients, invoices and payments.

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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What currency should the app use? EUR (or: USD, GBP, SEK)
Smithable model (mistral-medium-latest) · 2,518 tokens (408 in, 2,110 out) · $0.0164
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-3
  smithable studio

or only run the app with smithable run.
```

### 4. A tool library where neighbors lend each other tools.

```text
Tool Library
  A tool library where neighbors lend each other tools.

Pages
  - Tools (lists tools; search by name, description or category; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Home (a landing page: hero, story and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a name (required)
  - a description (required)
  - a category (garden, power, hand, measuring or other, garden by default)
  - a condition (like new, good or worn, like new by default)
  - available (yes or no, true by default)
  - a photo (picture)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Lends and borrows tools): opens the tools page, the my tools page and the home page; adds tools
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 795 tokens (280 in, 515 out) · $0.0043
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 139 files (139 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-SSZk3z/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers, and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name, description or category)
  - Suppliers (lists suppliers)
  - Stock (lists stocks)
  - Team (who has access: invite people, change roles, remove users)

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a category (dry, wet or frozen, dry by default)
  - a unit (required)
  - a unit cost (an amount)
  - a supplier (a supplier)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact name
  - an email
  - a phone
  - address

Stocks
  Stocks have:
  - an ingredient (an ingredient, required)
  - a quantity (a number, required)
  - a last updated (required, today by default)
  - an expiry date
  - a location

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - baker: everything
  New users get the baker role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 2,123 tokens (362 in, 1,761 out) · $0.0138
Pictures from the Smithable image library: logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for a local union to post jobs and receive applications.

Pages
  - Union Job Board (a landing page: hero and footer)
  - Job Postings (lists job posts; search by job title, job description or company)
  - My Applications (lists applications; only for members and admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for members and admins)

Job Posts
  Job Posts have:
  - a job title (required)
  - a job description (required)
  - a company (required)
  - a location
  - a salary (an amount)
  - a job type (full time, part time, contract or temporary, full time by default)
  - status (open or closed, open by default)
  Each job post can have a posted by (a user).
  The posted by owns the job post.

Applications
  Applications have:
  - a job post (a job post, required)
  - a your name (required)
  - a your email (required)
  - a resume (a document)
  - a cover letter
  - status (submitted, reviewed, rejected or hired, submitted by default)
  - applied at (a date and time, now by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Applies to jobs and manages own applications): opens every page; adds every kind of record
  - employer (Posts jobs and reviews applications): sees everyone's applications; adds job posts; changes everyone's applications
  New users get the member role.
  Open to anyone without signing in: the home page and the jobs page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 2,002 tokens (421 in, 1,581 out) · $0.0125
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-SSZk3z/app-6/smithable.auth.yml:11:3  warning  employer can open no page: a role opens only the pages its "pages" lists.
    hint: Add "pages: all" (or a list of pages) under roles.employer in smithable.auth.yml.
/tmp/smithable-bench-m12-SSZk3z/app-6/smithable.auth.yml:19:17  warning  Visitors can open jobs, but may not read JobPost, so the page shows them none: add it under public.read, or take jobs out of public.pages.
/tmp/smithable-bench-m12-SSZk3z/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  A football club's site with teams, players, matches and results.

Pages
  - Home (a landing page: hero, teams, matches where status is scheduled or in progress and footer)
  - Teams (lists teams)
  - Players (lists players)
  - Matches (lists matches)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Teams
  Teams have:
  - a name (required)
  - a description
  - a sport (football, futsal or beach, football by default)
  - a founded (a whole number)
  - a logo (picture)

Players
  Players have:
  - a name (required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a number (a whole number)
  - a team (a team, required)
  - a birth date
  - a photo (picture)

Matches
  Matches have:
  - a home team (a team, required)
  - an away team (a team, required)
  - starts at (a date and time, required)
  - a location
  - status (scheduled, in progress, completed or canceled, scheduled by default)
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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 1,676 tokens (381 in, 1,295 out) · $0.0103
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 145 files (145 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-SSZk3z/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  Event registration for a conference with talks, speakers and attendees.

Pages
  - Home (a landing page: hero, talks, speakers, faq and footer)
  - Talks (lists talks)
  - Speakers (lists speakers; only for admins; visitors see speakers on the Home page)
  - Attendees (lists attendees; only for admins)
  - Registrations (lists registrations)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)

Talks
  Talks have:
  - a title (required)
  - a summary
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a capacity (a whole number, required, 100 by default)
  - a speaker (a speaker, required)

Speakers
  Speakers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)

Attendees
  Attendees have:
  - a name (required)
  - an email (required, unique)

Registrations
  Registrations have:
  - a talk (a talk, required, unique)
  - status (registered or cancelled, registered by default)
  Each registration can have an attendee (a user).
  The attendee owns the registration.
  At most the talk's capacity registrations per talk.
  A registration is added until the talk's starts at.
  Its owner deletes it until the talk's starts at.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Conference organizer. Manages talks, speakers, and registrations): everything
  - attendee (Conference participant. Can register for talks): opens the talks page and the registrations page; adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the talks page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 1,850 tokens (331 in, 1,519 out) · $0.0119
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-SSZk3z/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  A help desk for an IT team to manage tickets, priorities and assignments.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Resolve”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required)
  - status (open, in progress, resolved or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a description
  - attachments (documents)
  Each ticket can have an assignee (a user).
  Each ticket lists its messages.

Messages
  Messages have:
  - a content (required)
  - a sender (agent or requester, agent by default)
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
  Start working on the ticket; it needs an assignee.

Resolve
  For a ticket that is open, in progress or reopened; sets status to resolved.
  The requester has their answer.

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
  - admin (The owner. Runs the team and the settings, and sees everything the agents do): everything
  - agent (Handles tickets, takes them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 1,479 tokens (326 in, 1,153 out) · $0.0091
Pictures from the Smithable image library: logo.webp.
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep and share family recipes with ingredients and shopping lists.

Pages
  - Home (a landing page: hero, recipes where favorite is yes, features and footer)
  - Recipes (lists recipes; search by name, description or instructions; filter by category, difficulty or favorite)
  - Shopping lists (lists shopping lists)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - servings (a whole number, required, 4 by default)
  - a prep time (a whole number)
  - a cook time (a whole number)
  - instructions (formatted text, required)
  - a category (breakfast, lunch, dinner, dessert, snack or drink, breakfast by default)
  - a difficulty (easy, medium or hard, easy by default)
  - favorite (yes or no, false by default)

Ingredients
  Ingredients have:
  - a name (required)
  - an amount (a number)
  - a unit
  - a recipe (a recipe, required)

Shopping lists
  Shopping lists have:
  - a name (required)
  - a recipe (a recipe)
  - completed (yes or no, false by default)

Shopping items
  Shopping items have:
  - a name (required)
  - an amount (a number)
  - a unit
  - purchased (yes or no, false by default)
  - a shopping list (a shopping list, required)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: everything
  New users get the member role.
  Open to anyone without signing in: the home page, the recipes page and reading recipes.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 3,589 tokens (413 in, 3,176 out) · $0.0244
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 141 files (141 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-SSZk3z/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  A status page for our API, with incidents and planned maintenance.

Pages
  - API Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; filter by status)
  - Updates (lists updates)
  - Components (lists components; only for admins; visitors see components on the API Status page)
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
  Each component lists its maintenances.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a component (a component)
  - detected at (a date and time, required)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its updates.

Updates
  Updates have:
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
  For an incident that is investigating; sets status to identified; adds an update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an update (at now, status resolved, message This incident is resolved.).
  The incident is over, with an update saying so. The component's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (The owner. Runs the team and the settings, and keeps the components): everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 2,951 tokens (508 in, 2,443 out) · $0.0191
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 181 files (181 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-SSZk3z/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  A public uptime page for a web shop: which services work, outages and their updates.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; filter by status)
  - Updates (lists incident updates)
  - Components (lists components; only for admins; visitors see components on the Home page)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Overview (every kind of record, to find, open, change and delete)
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
  The incident is over, with an update saying so. The component's state stays what the team sets.

Chat command
  When chat command is called: adds an incident, as staff; the call is signed with its time.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin (The owner. Runs the team and the settings, and keeps the components): everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Smithable model (mistral-medium-latest) · 2,726 tokens (425 in, 2,301 out) · $0.0179
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 190 files (190 changed, 0 removed).

Created /tmp/smithable-bench-m12-SSZk3z/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-SSZk3z/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-SSZk3z/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
