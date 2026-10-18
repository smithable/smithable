# M12 first builds: mistral-large-latest (2026-10-18)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 10 / 12 created, 9 type-check, 504,425 tokens (476,373 in, 28,052 out), €0.0000 + $0.2803 (Mistral's list price); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 30,231 | 1,820 | $0.0178 | 0 | 2 | 31 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | ? | yes | yes | 0 | 0 | €0.0000 | 0 | 0 | 11 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | **no** | **no** | 74,717 | 4,640 | $0.0443 | 0 | 5 | 48 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | **no** | 73,689 | 2,214 | $0.0402 | 0 | 5 | 34 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 28,940 | 1,575 | $0.0168 | 0 | 2 | 28 s |
| A job board for a local union, with job posts and applications. | marketplace | **no** | **no** | 75,229 | 6,115 | $0.0468 | 0 | 5 | 61 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 14,232 | 1,048 | $0.0087 | 0 | 1 | 20 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 75,320 | 3,222 | $0.0425 | 0 | 5 | 46 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 14,721 | 1,322 | $0.0093 | 0 | 1 | 23 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 43,996 | 2,245 | $0.0254 | 0 | 3 | 34 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 14,992 | 1,640 | $0.0100 | 0 | 1 | 83 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 30,306 | 2,211 | $0.0185 | 0 | 2 | 185 s |

Each created app's four spec files are in [m12-first-builds-mistral-large-latest/](m12-first-builds-mistral-large-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

1 of 10 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 2 | 5 / 6 (has 5) | 10 / 11 (has 10) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, schedule, blog, privacy; read Instructor, Session, Post; create Message | 2 (no-timezone, operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | ? (words: crm) | 0 | 0 / 0 (has 6) | 0 / 0 (has 5) | 0 / 0 (has 1) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 6 | no mention; no landing page |
| 4 | marketplace (words: records) | 2 | 0 / 1 (has 1) | 3 / 5 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, catalog; read Tool; create none | 2 (public-personal-data, operator-unknown) | **public-personal-data** |  | none | 0 / 1 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 7 | records | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 1 / 6 (has 4) | 2 / 11 (has 5) | 0 / 0 (has 0); left out: register | private; admin, member (member) | none | pages home, talks, speakers, privacy; read Talk, Speaker; create Message | 2 (capacity-no-unique, operator-unknown) | none |  | none | 0 / 4 | no mention; landing page |
| 9 | support (words: invoicing) | 2 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 6) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 2) | 1 / 2 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read Recipe; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, member (member) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio Booking
  Class schedule and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, estimate, gallery, faq, posts where status is published, contact and footer)
  - Sessions (lists sessions; only for admins)
  - Instructors (lists instructors; only for admins)
  - Messages (lists messages; only for admins)
  - Posts (lists posts; filter by status; only for admins; visitors see posts on the Home page)
  - My bookings (lists bookings)
  - Schedule (a calendar of sessions by week or month)
  - Blog (posts as articles, newest first, each on its own page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

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

Booking made
  When a booking is added: mails its owner.

Booking changed
  When a booking is changed: mails its owner.

Booking cancelled
  When a booking is deleted: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (Studio staff. Manage the schedule, classes and teachers): everything
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, the privacy page, reading instructors, reading sessions, reading posts where status is published and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 171 files (171 changed, 0 removed).

Created /tmp/smithable-bench-m12-WbRzzO/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WbRzzO/app-1/smithable.yml:69:15  warning  Page "schedule" is a calendar, but the app has no time zone: records are placed in UTC.
    hint: Set "timezone" under "app", e.g. "Europe/Mariehamn".
/tmp/smithable-bench-m12-WbRzzO/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
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

Created /tmp/smithable-bench-m12-WbRzzO/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-large-latest) · 79,357 tokens (74,717 in, 4,640 out) · $0.0443
No model drafted a valid project.
addModel: addModel would make smithable.yml invalid. Field "Invoice.dueOn": Expected a closing ")", found ".".
addField: addField would make smithable.yml invalid. There is no model named "Invoice".
addPage: There is no model named "Invoice".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-WbRzzO/app-3 --starter invoicing

```

### 4. A tool library where neighbors lend each other tools.

```text
NeighborTools
  A tool library where neighbors lend each other tools.

Pages
  - Home (a landing page: hero, tools where available is yes and footer)
  - Tool catalog (lists tools; search by tool name, description or location; filter by category, condition or available; sort by tool name or date added; records can be saved as favorites; contact the owner by mail)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - My tools (lists tools; only the viewer's own records)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)

Tools
  Tools have:
  - a tool name (required)
  - photos (pictures, required)
  - a description (required)
  - a category (gardening, woodworking, automotive, cleaning, power tools, hand tools or other, gardening by default)
  - a condition (new, like new, good or worn, new by default)
  - a location (required)
  - available (yes or no, true by default)
  - a due back (a date)
  Each tool can have a borrower (a user).
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Return
  For a tool that is not available; sets available to yes; asks for the borrower and the due back.
  Mark this tool as returned and available again.

Borrow
  For a tool that is available; sets available to no, borrower to whoever presses it and due back to today plus 7 days.
  Mark this tool as borrowed by me for one week.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-WbRzzO/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WbRzzO/app-4/smithable.auth.yml:12:10  warning  Anyone on the internet can read Tool, including personal data in borrower.
/tmp/smithable-bench-m12-WbRzzO/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Suppliers (lists suppliers)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Ingredients (lists ingredients; filter by supplier; “Restock”)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact (required)
  - an email
  - a phone
  - address

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a quantity (a number, required)
  - a unit (required)
  - a minimum stock (a number, required)
  - a supplier (a supplier, required)
  - a last updated (required, today by default)

Restock
  Sets last updated to today; asks for the quantity.
  Update the stock level when restocking an ingredient.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: logo.webp.
Generated 117 files (117 changed, 0 removed).

Created /tmp/smithable-bench-m12-WbRzzO/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

Failed:

```text
able model (mistral-large-latest) · 81,344 tokens (75,229 in, 6,115 out) · $0.0468
No model drafted a valid project.
addModel: A choice field's default is its first value, so "=" is not used here. Put the default first, or use the long form with "default:".
addModel: A choice field's default is its first value, so "=" is not used here. Put the default first, or use the long form with "default:".
addPage: There is no model named "JobPost".
addPage: There is no model named "JobPost".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-WbRzzO/app-6 --starter marketplace

```

### 7. A football club's site: teams, players, matches and results.

```text
Football Club
  Teams, players, matches and results.

Pages
  - Home (a landing page: hero, matches where result is scheduled, matches where result is home win or away win or draw and footer)
  - Teams (lists teams)
  - Players (lists players)
  - Matches (lists matches)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group (youth or senior, youth by default)
  - a coach
  - a home ground

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a number (a whole number)
  - a date of birth
  - a height (a number)
  - a nationality

Matches
  Matches have:
  - a home team (a team, required)
  - an away team (a team, required)
  - a date (a date and time, required)
  - a venue
  - a competition
  - a home score (a whole number)
  - an away score (a whole number)
  - a result (scheduled, home win, away win or draw, scheduled by default)
  - a report (formatted text)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 120 files (120 changed, 0 removed).

Created /tmp/smithable-bench-m12-WbRzzO/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WbRzzO/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Left out, since it could not be made valid:
  addAction register: addAction would make smithable.yml invalid. "spotsLeft" in "when" of action "register": compares a choice field with one of its values (or a list of them), and a yes/no field with true or false. Attendee in "add" of action "register": talk is filled with the record the action runs on; leave it out.

Conference Connect
  Event registration for a conference: talks, speakers and attendees.

Pages
  - Join Us at Conference Connect (a landing page: hero, speakers, faq, contact and footer)
  - Talks (lists talks)
  - Speakers (lists speakers)
  - Attendees (lists attendees)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Talks
  Talks have:
  - a title (required)
  - a description (formatted text)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a location (required)
  - a capacity (a whole number, required, 100 by default)
  Each talk lists its attendees.
  The spots left is calculated as the capacity minus the number of its attendees.

Speakers
  Speakers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)

Attendees
  Attendees have:
  - a name (required)
  - an email (required)
  - a company
  - a talk (a talk, required)
  - registered at (a date and time, now by default, filled by the app)
  At most the talk's capacity attendees per talk.

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)

Registration confirmed
  When a attendee is added: mails email.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the talks page, the speakers page, the privacy page, reading talks, reading speakers and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: samples/1.webp, samples/2.webp, samples/3.webp, samples/4.webp, samples/5.webp, samples/6.webp, hero.webp, logo.webp.
Generated 138 files (138 changed, 0 removed).

Created /tmp/smithable-bench-m12-WbRzzO/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WbRzzO/app-8/smithable.yml:34:7  warning  Attendee has a capacity per talk, but "talk" is not unique: one person can take several places.
    hint: Write "talk: Talk! unique" for one attendee per person and talk (unique per owner with private access).
/tmp/smithable-bench-m12-WbRzzO/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets from users, assigned and tracked by the IT team.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Resolve”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required, fixed once made)
  - status (open, in progress, resolved, closed or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a body
  - attachments (documents)
  Each ticket can have an assignee (a user, required when status is in progress or resolved or closed).
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
  Sets assignee to whoever presses it.
  Take the ticket: you become its assignee.

Assign to
  Asks for the assignee.
  Give the ticket to an agent, chosen from the team.

Start work
  For a ticket that is open or reopened; sets status to in progress.
  Someone is working on the ticket now; it needs an assignee.

Resolve
  For a ticket that is open, in progress or reopened; sets status to resolved.
  The issue is fixed; the requester can confirm.

Close
  For a ticket that is resolved; sets status to closed.
  The requester is satisfied; the ticket is closed.

Reopen
  For a ticket that is resolved or closed; sets status to reopened.
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

Created /tmp/smithable-bench-m12-WbRzzO/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A place to keep and share family recipes and shopping lists.

Pages
  - Family Recipes (a landing page: hero, recipes where favorite is yes and footer)
  - Shopping lists (lists shopping lists)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Recipes (lists recipes)

Shopping Lists
  Shopping Lists have:
  - a name (required)
  - items (required)
  - completed (yes or no, false by default)
  - a for recipe (a recipe)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - ingredients (required)
  - instructions (formatted text, required)
  - a prep time (minutes) (a whole number)
  - a cook time (minutes) (a whole number)
  - servings (a whole number)
  - a category (starter, main course, dessert, side dish, snack or drink, starter by default)
  - a difficulty (easy, medium or hard, easy by default)
  - favorite (yes or no, false by default)
  - tags

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and reading recipes.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 114 files (114 changed, 0 removed).

Created /tmp/smithable-bench-m12-WbRzzO/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WbRzzO/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The current state of our API and any incidents or planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; filter by status)
  - Updates (lists incident updates)
  - Components (lists components)
  - Maintenance (lists maintenances)
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
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-WbRzzO/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WbRzzO/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  The uptime of our web shop and its services, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components)
  - Maintenance (lists maintenances)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
  - History (a page of your own (IncidentHistory), written in code; only for admins)

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
  - staff (Writes incidents and their updates): opens the incidents page, the updates page, the maintenance page and the components page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 157 files (157 changed, 0 removed).

Created /tmp/smithable-bench-m12-WbRzzO/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-WbRzzO/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-WbRzzO/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
