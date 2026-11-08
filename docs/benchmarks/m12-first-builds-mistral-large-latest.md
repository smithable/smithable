# M12 first builds: mistral-large-latest (2026-11-08)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 11 / 12 created, 8 type-check, 746,046 tokens (711,777 in, 34,269 out), $0.4074 (Mistral's list price); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 77,914 | 5,140 | $0.0467 | 0 | 4 | 141 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | **no** | 74,157 | 3,338 | $0.0421 | 0 | 4 | 87 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | **no** | **no** | 124,820 | 6,972 | $0.0729 | 0 | 5 | 72 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 23,636 | 1,422 | $0.0140 | 0 | 2 | 47 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 47,450 | 1,729 | $0.0263 | 0 | 3 | 58 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | **no** | 71,137 | 1,630 | $0.0380 | 0 | 4 | 75 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 23,457 | 2,349 | $0.0153 | 0 | 2 | 72 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 25,142 | 1,438 | $0.0147 | 0 | 2 | 63 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 23,976 | 1,605 | $0.0144 | 0 | 2 | 64 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 122,021 | 3,498 | $0.0663 | 0 | 6 | 86 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | **no** | 49,088 | 3,181 | $0.0293 | 0 | 3 | 67 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 48,979 | 1,967 | $0.0274 | 0 | 3 | 58 s |

Each created app's four spec files are in [m12-first-builds-mistral-large-latest/](m12-first-builds-mistral-large-latest/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

2 of 11 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 (has 6) | 13 / 13 (has 13) | 1 / 1 (has 1) | private; admin, staff, member (member) | none | pages home, schedule, blog, about, privacy; read Instructor, Session, Post, ClassType; create Message | 1 (operator-unknown) | none |  | Hatha, Vinyasa, Restorative | 4 / 6 | mentions visitors; landing page |
| 2 | crm | 2 | 1 / 3 (has 4) | 2 / 5 (has 6) | 1 / 2 (has 2) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 1 / 4 | no mention; no landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, tools; read Tool; create none | 2 (review-no-page, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 1 / 2 (has 3) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home; read none; create none | 0 | none |  | none | 0 / 2 | no mention; landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 4) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, jobPosts; read none; create none | 3 (public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, teams, players, matches; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 2 / 13 (has 5) | 0 / 1 (has 2) | private; admin, member (member) | none | pages home, talks, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 2 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 2 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 5) | 1 / 2 (has 6) | 0 / 0 (has 0); left out: addToShoppingList | private; admin, member (member) | none | pages home, privacy; read none; create none | 3 (write-without-read, public-page-closed-records, operator-unknown) | **public-page-closed-records** |  | none | 0 / 5 | no mention; landing page |
| 11 | status | 0 | 4 / 4 (has 4) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, member (member) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 2 (operator-unknown, thread-needs-form) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, member (member) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Harmony Yoga Studio
  Class schedule and online booking for a yoga studio.

Pages
  - Find Your Balance at Harmony Yoga (a landing page: hero, estimate, gallery, faq, call to action, posts, contact, class types and footer)
  - Schedule (lists sessions)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for staff users and admins)
  - Instructors (lists instructors; only for admins)
  - Messages (lists messages; only for staff users and admins)
  - Blog (lists posts)
  - About Us (a page of parts: intro, story, instructors and faq)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Posts (lists posts; filter by status; only for admins; visitors see posts on the Find Your Balance at Harmony Yoga page)
  - My bookings (lists bookings; with cancelling; only for members and admins)
  - Bookings (lists bookings; filter by session.startsAt or session.classType; only for staff users and admins)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Class types (lists class types; only for admins; visitors see class types on the Find Your Balance at Harmony Yoga page)

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

Session moved
  When a session's starts at changes: mails every booking's owner with its class type, starts at, instructor and what the changed fields were.

Todays bookings
  Every day at 06:30: the day's bookings (session, attendee) to the administrators by mail; nothing to send is skipped.

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
  - staff (Reception. Manages the schedule, bookings, and messages): opens the sessions page, the bookings page and the messages page; sees everyone's sessions, bookings and messages; adds sessions and bookings; changes everyone's sessions and bookings; deletes everyone's bookings
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, the about page, the privacy page, reading instructors, reading sessions, reading posts where status is published, reading class types and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can sign up to book classes? Only invited members and admins (private access). (or: Anyone with an email (open sign-up), Only invited members and admins)
  What can visitors see without signing in? The schedule, class types, instructors, blog, and contact form. (or: Only the landing page and contact form, The schedule, class types, instructors, blog, and contact form)
  What can members do after signing in? Book classes and view their own bookings. (or: Only view the schedule, Book classes and view their own bookings)
  What is the purpose of the 'about' page? A page with the studio's story, team, and FAQ. (or: Only a simple text page, A page with the studio's story, team, and FAQ)
Smithable model (mistral-large-latest) · 5,315 tokens (418 in, 4,897 out) · $0.0076
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, samples/post-1.webp, samples/post-2.webp, samples/post-3.webp, hero.webp, logo.webp.
Generated 215 files (215 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Mqq6EK/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
SalesFlow CRM
  Lightweight CRM for a small B2B sales team.

Pages
  - Companies (lists companies; search by name or email; sort by name or date added; “Merge companies”)
  - Contacts (lists contacts; search by first name, last name, email or company; sort by last name or date added)
  - Deals (lists deals; search by title, company or contact; filter by status; sort by expected close date, amount or date added)
  - Follow-ups (lists follow-ups; search by company, contact or note; filter by done; sort by due on)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Start (a dashboard: companies, open deals and follow ups due; only for admins)

Companies
  Companies have:
  - a name (required)
  - an email (unique)
  - a phone
  - a segment (smb, enterprise or government, smb by default)
  - a credit limit (an amount)
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  Each company lists its follow-ups.
  The account manager owns the company.
  Companies can be merged.

Contacts
  Contacts have:
  - a first name (required)
  - a last name (required)
  - an email (unique)
  - a phone
  - a company (a company, required)
  - a title
  - notes
  Each contact lists its follow-ups.
  The company owns the contact.

Deals
  Deals have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - status (prospect, negotiation, closed won or closed lost, prospect by default)
  - an amount (an amount, required)
  - an expected close date
  - notes
  Each deal lists its follow-ups.
  The company owns the deal.

Follow-ups
  Follow-ups have:
  - a company (a company)
  - a contact (a contact)
  - a deal (a deal)
  - due on (a date, required, today by default)
  - done (yes or no)
  - a note
  The company owns the follow-up.
  No two follow-ups have the same company and contact and deal for one owner.

Merge companies
  Merge two or more companies: the others' contacts, deals and follow-ups move to the kept one; where they differ, the person chooses; the others are deleted.

Schedule follow ups
  Plan a series of follow-up notes for a company, contact or deal, one every so many days.
  Reads companies, contacts, deals and follow-ups, writes follow-ups.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts and deals): opens the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which time zone should the app use? Europe/London (or: UTC, America/New_York, Asia/Singapore)
  Should the sales role be able to delete any record, or only their own? Only their own (default access) (or: Delete any record, Only their own records)
  Should the app be accessible to the public, or only to the sales team? Only to the sales team (no public access) (or: Public landing page with sign-up, Internal tool only)
  Should the assistant be available to all signed-in users, or only to administrators? All signed-in users (default) (or: Only administrators, No assistant)
Smithable model (mistral-large-latest) · 3,249 tokens (576 in, 2,673 out) · $0.0043
Pictures from the Smithable image library: logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

Failed:

```text
Starting from the invoicing starter.
Smithable model (mistral-large-latest) · 131,792 tokens (124,820 in, 6,972 out) · $0.0729
No model drafted a valid project.
addModel: addModel would make smithable.yml invalid. Field "Invoice.dueOn": Expected a closing ")", found ".".
addField: addField would make smithable.yml invalid. There is no model named "Invoice".
addPage: There is no model named "Invoice".
addPage: addPage: "model" is missing.
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-Mqq6EK/app-3 --starter invoicing

```

### 4. A tool library where neighbors lend each other tools.

```text
NeighborTools
  A tool library where neighbors lend each other tools.

Pages
  - Borrow tools from your neighbors (a landing page: hero and footer)
  - Tools (lists tools; search by name, description or location; filter by category, condition or available; sort by name or date added; records can be saved as favorites)
  - My Loans (lists loans; “Approve loan”; “Return tool”)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Admin (every kind of record, to find, open, change and delete; only for admins)

Tools
  Tools have:
  - a name (required)
  - photos (pictures, required)
  - a description (required)
  - a category (gardening, woodworking, cleaning, kitchen, power, hand or other, gardening by default)
  - a condition (new, like new, good or worn, new by default)
  - a location
  - available (yes or no, true by default)
  Photos of tools are reviewed before others see them; a tool waits until its photos are.

Loans
  Loans have:
  - a tool (a tool, required)
  - borrowed at (a date and time, now by default)
  - due at (a date and time)
  - returned at (a date and time)
  - status (requested, approved or returned, requested by default)
  Each loan can have a borrower (a user).

Approve loan
  For a loan that is requested; sets status to approved.

Return tool
  For a loan that is approved; sets status to returned and returned at to now.

Loan requested
  When a loan is added and status is requested: mails its owner.

Loan approved
  When “Approve loan” runs on a loan: mails borrower.

Loan due soon
  When a loan's due at changes so that status is approved: mails borrower.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Borrows and lends tools): opens the tools page and the loans page; adds tools and loans
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who may sign up to lend and borrow tools? Anyone in the neighborhood may sign up. (or: Only invited members may join., Anyone may sign up.)
  What is the main page visitors see before signing in? A landing page with a hero and a list of recently added tools. (or: A list of all available tools., A landing page with a hero and a list of recently added tools.)
  What may visitors see without signing in? The landing page and the list of available tools. (or: Only the landing page., The landing page and the list of available tools.)
  What records may a signed-in user change? Only their own tools and loans. (or: Only their own tools and loans., All tools and loans in the app.)
Smithable model (mistral-large-latest) · 1,073 tokens (291 in, 782 out) · $0.0013
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 172 files (172 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Mqq6EK/app-4/smithable.yml:26:3  warning  Tool's photos wait for review, but no review page lists Tool, so nothing is ever approved.
    hint: Add one: smithable op addReviewPage (a page with "review: all").
/tmp/smithable-bench-m12-Mqq6EK/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
SweetStock
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - SweetStock Bakery (a landing page: hero and footer)
  - Suppliers (lists suppliers)
  - Ingredients (lists ingredients; search by name; filter by supplier)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact person
  - an email
  - a phone
  - address

Ingredients
  Ingredients have:
  - a name (required)
  - a description
  - a unit (kg, g, l, ml or item, kg by default)
  - a current stock (a number, required)
  - a minimum stock (a number, required)
  - a supplier (a supplier)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who will use the app? Bakery staff only (private access) (or: Public visitors can view ingredients, Only invited bakery staff can use the app)
  Should the app include a dashboard for quick overview? No dashboard (simple list pages) (or: Dashboard with stock level tiles, Only list pages for ingredients and suppliers)
  Are there different roles for bakery staff? Single role (member) with full access (or: Manager role with additional privileges, Multiple roles for different staff levels)
  Should visitors see ingredient information? No public access (or: Public ingredient list, No public access to the app)
Smithable model (mistral-large-latest) · 1,657 tokens (377 in, 1,280 out) · $0.0021
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 133 files (133 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  Find and post union jobs in your area.

Pages
  - Home (a landing page: hero, job posts where filled is no, call to action and footer)
  - Job posts (lists job posts; search by title, description or location; filter by category, wage or filled; sort by wage or posted at; records can be saved as favorites)
  - My applications (lists applications)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Job posts
  Job posts have:
  - a title (required)
  - a description (formatted text, required)
  - a category (construction, healthcare, education, transportation, hospitality or other, construction by default)
  - a location (required)
  - a wage (an amount)
  - hours
  - a contact email (required)
  - a contact phone
  - posted at (a date and time, now by default, filled by the app)
  - expires at (a date)
  - filled (yes or no, false by default)
  The contact email owns the job post.

Applications
  Applications have:
  - a job (a job post, required)
  - a name (required)
  - an email (required)
  - a phone
  - a resume (a document)
  - a cover letter
  - applied at (a date and time, now by default, filled by the app)
  - status (pending, reviewed, interviewed, rejected or hired, pending by default)
  The email owns the application.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and the job posts page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who may sign up to post jobs? Only invited people and admins (setSignUp invited). (or: Anyone with an email address (setSignUp anyone).)
  What can visitors see without signing in? The landing page and job posts (setPublic pages [home, jobPosts], read [JobPost]). (or: Only the landing page (setPublic pages [home]).)
  What records do signed-in users see by default? Only their own (defaultAccess private). (or: All records (defaultAccess shared).)
Smithable model (mistral-large-latest) · 2,912 tokens (371 in, 2,541 out) · $0.0040
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 147 files (147 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Mqq6EK/app-6/smithable.auth.yml:11:11  warning  Visitors can open home, but may not read JobPost, so the page shows them none: add it under public.read, or remove the section of home that shows it.
/tmp/smithable-bench-m12-Mqq6EK/app-6/smithable.auth.yml:11:17  warning  Visitors can open jobPosts, but may not read JobPost, so the page shows them none: add it under public.read, or take jobPosts out of public.pages.
/tmp/smithable-bench-m12-Mqq6EK/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Greenfield FC
  The club's teams, players, matches and results.

Pages
  - Home (a landing page: hero, teams, matches and footer)
  - Teams (lists teams)
  - Players (lists players)
  - Matches (lists matches; filter by team, result or date)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - an age group (required)
  - a coach
  - a home ground
  - a logo (picture)

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a position (required)
  - a number (a whole number)
  - a date of birth (required)
  - a nationality
  - a height (a number)
  - a weight (a number)
  - a profile picture

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a date (a date and time, required)
  - a venue (required)
  - a competition
  - a home score (a whole number)
  - an away score (a whole number)
  - a result (win, draw or loss, win by default)
  - a report (formatted text)
  - highlights (a web address)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who signs in to the app? Only administrators (to manage records). (or: Anyone (open sign-up), Only invited people (members and administrators))
  What can visitors see without signing in? Teams, players, matches and results (public site). (or: Only a landing page (sign-in required for the rest), A limited set of records (e.g., only teams and matches))
  How are the records displayed on the landing page? Recent wins in a table, teams as cards. (or: Only upcoming matches in a table, Only teams as cards, A mix of players and matches)
  What access do administrators have? Full access to all records (shared access). (or: Limited access (e.g., only their own records), No access (visitors only))
Smithable model (mistral-large-latest) · 2,891 tokens (389 in, 2,502 out) · $0.0039
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Mqq6EK/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Connect
  Event registration for a conference: talks, speakers and attendees.

Pages
  - Join us at Conference Connect (a landing page: hero, talks where status is scheduled, speakers, faq and footer)
  - Talks (lists talks; “Cancel talk”; “Schedule talk”)
  - Speakers (lists speakers)
  - My attendance (lists attendees)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Talks
  Talks have:
  - a title (required)
  - a description
  - a summary
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a room
  - a capacity (a whole number, required, 50 by default)
  - status (draft, scheduled or cancelled, draft by default)
  - a cover (picture)
  - a speaker (a speaker, required)
  Each talk lists its attendees.

Speakers
  Speakers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)

Attendees
  Attendees have:
  - a talk (a talk, required, unique)
  Each attendee can have a participant (a user).
  The registered at is calculated as now.
  The participant owns the attendee.
  At most the talk's capacity attendees per talk.
  A attendee is added until the talk's starts at.
  Its owner deletes it until the talk's starts at.

Cancel talk
  For a talk that is scheduled; sets status to cancelled.

Schedule talk
  For a talk that is draft; sets status to scheduled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the talks page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can view the conference details without signing in? Anyone can view talks and speakers, but only registered attendees can register for talks. (or: Only registered attendees can view talks and speakers., No public access to talks or speakers.)
  What can attendees do after signing in? Attendees can register for talks and view their own attendance. (or: Attendees can only view talks., Attendees can manage all talks and speakers.)
  Are there different roles for organizers and attendees? One role for attendees, and admins manage everything. (or: Separate roles for organizers and attendees., No roles, everyone has the same access.)
  What is the default access for attendees? Private: attendees only see their own registrations. (or: Shared: attendees see all registrations., No default access, roles define everything.)
Smithable model (mistral-large-latest) · 2,379 tokens (321 in, 2,058 out) · $0.0032
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 157 files (157 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Mqq6EK/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets from users, prioritized and handled by the team.

Pages
  - Tickets (lists support cases; search by subject or customer email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Support cases
  Support cases have:
  - a subject (required)
  - a customer email (required, fixed once made)
  - status (open, in progress, closed or reopened, open by default)
  - a priority (a whole number, required, 3 by default)
  - a body
  - attachments (documents)
  Each support case can have an assignee (a user, required when status is in progress or closed).
  Each support case lists its messages.

Messages
  Messages have:
  - a content (required)
  - a sender (agent or customer, agent by default)
  - a from email
  - attachments (documents)
  - a support case (a support case, required)
  Each message can have an agent (a user, who makes it, by default, filled by the app).

Assign to me
  For a support case that is not me(); sets assignee to whoever presses it.
  Take the ticket: you become its assignee.

Assign to
  Asks for the assignee.
  Assign the ticket to an agent, chosen from the team.

Start work
  For a support case that is open or reopened; sets status to in progress.
  Someone is working on the ticket now; it needs an assignee.

Close
  For a support case that is open, in progress or reopened; sets status to closed.
  The user has their answer.

Reopen
  For a support case that is closed; sets status to reopened.
  The ticket needs more work after all.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who may sign in to the app? Only invited agents and admins (default access: shared). (or: Anyone with an email address (setSignUp anyone), Only invited agents and admins (default))
  May visitors see or create tickets without signing in? No, the app is for the team's work only. (or: No (default), Yes, a public contact form (setPublic create: [SupportCase]))
Smithable model (mistral-large-latest) · 1,927 tokens (326 in, 1,601 out) · $0.0026
Pictures from the Smithable image library: logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Left out, since it could not be made valid:
  addAction addToShoppingList: A standard action sets fields of a record, so it takes no input or output.

Family Recipes
  A collection of family recipes with ingredients and shopping lists.

Pages
  - Family Recipes (a landing page: hero, recipes where kind is favorite and footer)
  - Ingredients (lists ingredients)
  - Shopping Lists (lists shopping lists)
  - Shopping list items (lists items)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Recipes (lists recipes)

Ingredients
  Ingredients have:
  - a name (required)
  - an amount (a number)
  - a unit

Shopping Lists
  Shopping Lists have:
  - a name (required)
  - created on (a date, required, today by default)
  - completed (yes or no, false by default)

Items
  Items have:
  - an ingredient (an ingredient, required)
  - an amount (a number)
  - a unit
  - a shopping list (a shopping list, required)
  - purchased (yes or no, false by default)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - status (general or favorite, general by default)
  - a link (a web address)
  - added on (a date, required, today by default)
  - servings (a whole number, required, 4 by default)
  - a prep time (minutes) (a whole number)
  - a cook time (minutes) (a whole number)
  - instructions (formatted text, required)
  Each recipe lists its recipe ingredients.

Recipe ingredients
  Recipe ingredients have:
  - a recipe (a recipe, required)
  - an ingredient (an ingredient, required)
  - an amount (a number)
  - a unit

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds shopping lists and shopping list items; changes everyone's shopping lists and shopping list items
  New users get the member role.
  Open to anyone without signing in: the home page and the privacy page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can add and manage recipes? Only administrators can add and manage recipes; members can view them and manage shopping lists. (or: Anyone who signs in can add and manage recipes., Only administrators can add and manage recipes.)
  Should the app include a way to mark ingredients as purchased? Yes, each shopping list item has a purchased checkbox. (or: No, shopping lists are just for reference., Yes, each shopping list item has a purchased checkbox.)
  Should visitors be able to see the shopping lists? No, shopping lists are private to signed-in users. (or: Yes, shopping lists are public., No, shopping lists are private to signed-in users.)
Smithable model (mistral-large-latest) · 3,845 tokens (584 in, 3,261 out) · $0.0052
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Mqq6EK/app-10/smithable.auth.yml:7:67  warning  member may change others' ShoppingList, ShoppingListItem it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant member "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-Mqq6EK/app-10/smithable.auth.yml:11:11  warning  Visitors can open home, but may not read Recipe, so the page shows them none: add it under public.read, or remove the section of home that shows it.
/tmp/smithable-bench-m12-Mqq6EK/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The current state of our API and its components, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
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

Assumed:
  What timezone should the app use? UTC (or: Europe/London, America/New_York, Asia/Singapore)
  Should visitors see all incident statuses or only some? All statuses (investigating, identified, monitoring, resolved) (or: Only open incidents, Only investigating and identified)
Smithable model (mistral-large-latest) · 2,967 tokens (410 in, 2,557 out) · $0.0040
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 178 files (178 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Mqq6EK/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
/tmp/smithable-bench-m12-Mqq6EK/app-11/smithable.ux.yml:14:18  warning  IncidentUpdate.at is required and the reply box does not ask for it: give it a default, or `by: app`, or the thread shows Add incident update instead.
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is our shop working? The state of our services, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring and footer)
  - Incidents (lists incidents; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
  - Components (lists components)
  - Maintenance (lists maintenances)
  - Overview (every kind of record, to find, open, change and delete; only for admins)
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

Assumed:
  Who signs in to update the status? Only invited team members (or: Anyone can sign up to report issues, Only invited team members)
  What can visitors see without signing in? The status page and incident history (or: Only the current status, The status page and incident history)
Smithable model (mistral-large-latest) · 2,711 tokens (418 in, 2,293 out) · $0.0036
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 189 files (189 changed, 0 removed).

Created /tmp/smithable-bench-m12-Mqq6EK/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-Mqq6EK/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-Mqq6EK/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
