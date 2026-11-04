# M12 first builds: eu.anthropic.claude-sonnet-4-6 (2026-11-04)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 998,935 tokens (949,222 in, 49,713 out), $1.4346; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

Prompt caching: of the input of the 55 calls the model answered (the response cache's are not counted), 861,192 tokens were read from the cache (the fixed system text, at a tenth of the price), 47,844 written to it (a quarter more than the price) and 93,591 were new.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 103,154 | 7,798 | $0.3664 | 0 | – | 105 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 49,586 | 4,122 | $0.0896 | 0 | – | 53 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 151,442 | 5,716 | $0.1678 | 0 | – | 59 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 100,087 | 5,598 | $0.1385 | 0 | – | 62 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 48,752 | 2,114 | $0.0537 | 0 | – | 42 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 48,947 | 3,730 | $0.0810 | 0 | – | 58 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 148,568 | 3,731 | $0.1255 | 0 | – | 52 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 50,629 | 2,835 | $0.0718 | 0 | – | 63 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 49,331 | 3,192 | $0.0734 | 0 | – | 48 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 48,749 | 2,857 | $0.0659 | 0 | – | 48 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 100,196 | 3,984 | $0.1122 | 0 | – | 71 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 49,781 | 4,036 | $0.0888 | 0 | – | 57 s |

Each created app's four spec files are in [m12-first-builds-eu.anthropic.claude-sonnet-4-6/](m12-first-builds-eu.anthropic.claude-sonnet-4-6/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 0 | 6 / 6 (has 6) | 13 / 13 (has 14) | 1 / 1 (has 1) | private; admin, staff, member (member) | none | pages home, schedule, blog, about, privacy; read Instructor, Session, Post; create Message | 1 (operator-unknown) | none |  | Foundations, Hatha, Vinyasa | 4 / 6 | mentions visitors; landing page |
| 2 | crm | 3 | 1 / 3 (has 4) | 3 / 5 (has 6) | 0 / 2 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 1 | 4 / 4 (has 4) | 5 / 7 (has 5) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | Invoicely, 2026-001, 2026-002 | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 3 / 5 (has 6) | 0 / 0 (has 4) | private; admin, member (member) | none | pages home; read none; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 3) | 0 / 2 (has 4) | 0 / 0 (has 0) | shared; admin, staff (staff) | none | pages none; read none; create none | 0 | none |  | none | 0 / 3 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 5) | private; admin, member (member) | none | pages home, jobs; read JobPost; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 6) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages home, teams; read Team, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 5) | 4 / 13 (has 10) | 0 / 1 (has 1) | private; admin, organizer, attendee (attendee) | none | pages home, schedule, speakers, privacy; read Talk, Speaker, Track; create ContactMessage | 2 (role-opens-nothing, operator-unknown) | none |  | none | 0 / 5 | no mention; landing page |
| 9 | support (words: booking) | 3 | 0 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 6) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 1 / 2 (has 5) | 0 / 0 (has 2) | shared; admin, member (member) | none | pages home, recipes; read Recipe; create none | 1 (operator-unknown) | none |  | none | 0 / 4 | no mention; landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Yoga Studio
  Class schedule and online booking for a yoga studio.

Pages
  - Find Your Flow (a landing page: hero, features, gallery, faq, call to action, posts where status is published, contact and footer)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for staff users and admins)
  - Instructors (lists instructors; search by name; only for admins)
  - Bookings (lists bookings; filter by session or attendee; only for staff users and admins)
  - My bookings (lists bookings; only the viewer's own records; only for members and admins)
  - Posts (lists posts; search by title; filter by status; “Publish”; only for admins; visitors see posts on the Find Your Flow page)
  - Messages (lists messages; only for staff users and admins)
  - Schedule (a calendar of sessions by week or month; filter by classType or instructor)
  - Blog (posts as articles, newest first, each on its own page)
  - About (a page of parts: intro, instructors and faq)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Admin (every kind of record, to find, open, change and delete; only for admins)
  - Class types (lists class types; search by name; filter by level; only for admins)

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
  The post is published and visible to everyone.

Booking made
  When a booking is added: mails its owner.

Booking changed
  When a booking is changed: mails its owner.

Booking cancelled
  When a booking is deleted: mails its owner.

Reminder
  When the timer “Remind” comes for a booking: mails its owner.

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
  - staff (Reception. Manages the day, sessions and bookings, and reads messages): opens the sessions page, the bookings page and the messages page; sees everyone's sessions, bookings and messages; adds sessions and bookings; changes everyone's sessions and bookings; deletes everyone's bookings
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the blog page, the about page, the privacy page, reading instructors, reading sessions, reading posts where status is published and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What should the hero's call-to-action button lead to? The class schedule, so visitors can browse and book classes right away. (or: A sign-up page, The about page, The contact form)
  Should the studio offer a monthly pass calculator on the home page? Yes, a simple calculator showing savings versus drop-in pricing. (or: No calculator, A different pricing section, A pricing table instead)
  Should the blog/news section be included? Yes, a blog for studio news and articles, visible to visitors. (or: No blog, A simple news feed only, Social media links instead)
  Who may sign up to the app? Anyone may sign up and becomes a member by default. (or: Only invited members, Only people on a specific domain, Invite-only with a waiting list)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 6,119 tokens (1,640 in, 4,479 out) · $0.0793
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, samples/post-1.webp, samples/post-2.webp, samples/post-3.webp, hero.webp, logo.webp.
Generated 216 files (216 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  Lightweight CRM for a small sales team to manage companies, contacts, deals and follow-ups.

Pages
  - Dashboard (a dashboard: companies, open deals, won deals and follow ups due)
  - Companies (lists companies; search by name or email; filter by segment or account manager; sort by name or date added; “Merge companies”)
  - Contacts (lists contacts; search by name or email; filter by company; sort by name or date added)
  - Deals (lists deals; search by title; filter by status, company, contact or expected close on; sort by expected close on, value or date added; “Won deal”; “Lost deal”)
  - Follow-ups (lists follow ups; search by note; filter by done, company, contact or due on; sort by due on or date added; “Complete follow up”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Companies
  Companies have:
  - a name (required)
  - an email (unique)
  - a phone
  - a website (a web address)
  - a segment (smb, enterprise or government, smb by default)
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  Each company lists its follow ups.
  The account manager owns the company.
  Deleted companies stay in the trash for thirty days, where they can be restored.
  Companies can be merged.

Contacts
  Contacts have:
  - a name (required)
  - an email
  - a phone
  - a company (a company, required)
  - a role
  - notes
  Deleted contacts stay in the trash for thirty days, where they can be restored.

Deals
  Deals have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - status (prospecting, qualified, proposal, negotiation, won or lost, prospecting by default)
  - a value (an amount)
  - expected close on (a date)
  - notes
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a company (a company, required)
  - a contact (a contact)
  - due on (a date, required, today by default)
  - done (yes or no)
  - a note
  Deleted follow ups stay in the trash for thirty days, where they can be restored.

Won deal
  For a deal that is prospecting, qualified, proposal or negotiation; sets status to won.
  Mark a deal as won.

Lost deal
  For a deal that is prospecting, qualified, proposal or negotiation; sets status to lost.
  Mark a deal as lost.

Complete follow up
  For a follow up that is not done; sets done to yes.
  Mark a follow-up as done.

Merge companies
  Merge two or more companies: the others' contacts, deals and follow ups move to the kept one; where they differ, the person chooses; the others go to the trash.
  Merge two duplicate company records into one, moving all contacts, deals and follow-ups to the kept record.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the start page, the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What currency and timezone should the app use? USD and America/New_York (or: EUR and Europe/London, GBP and Europe/London, AUD and Australia/Sydney)
  Should the app restrict sign-up to invited colleagues only, or allow anyone to sign up? Invited colleagues only (no self sign-up) (or: Anyone with a valid email may sign up, Anyone on a specific domain may sign up)
  Should sales reps be able to delete deals and contacts, or only their own? Sales reps can only delete their own records; admins delete anyone's (or: Sales reps can delete anyone's records, Only admins can delete records)
  What should the app's start page show? A dashboard with counts of companies, open deals, and follow-ups due soon (or: A list of today's follow-ups, A list of recent activity, A blank page that redirects to companies)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 4,220 tokens (1,657 in, 2,563 out) · $0.0478
Pictures from the Smithable image library: logo.webp.
Generated 167 files (167 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Invoicely
  Simple invoicing for freelancers. Each user manages their own clients and invoices.

Pages
  - Get Paid Faster (a landing page: hero, features, pricing, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Clients (lists clients; search by name or email; sort by name or date added)
  - Invoices (lists invoices; search by number; filter by client or status; sort by issued on, due on or number)
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
  - due on (a date, required)
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

Auto mark overdue
  7 days after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A freelancer using Invoicely): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and the privacy page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (eu.anthropic.claude-sonnet-4-6) · 3,509 tokens (1,608 in, 1,901 out) · $0.0367
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 165 files (165 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
ToolShare
  A neighborhood tool library where people lend and borrow tools from each other.

Pages
  - Catalog (lists tools; search by name, description or location; filter by category, condition or available; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - Loans (lists loans; filter by status or tool; “Approve”; “Decline”; “Mark active”; “Mark returned”)
  - Review (the pictures and files waiting for review, to approve or reject; only for admins)
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - My tools (lists tools; only the viewer's own records)

Loans
  Loans have:
  - a borrower note
  - a start date (required)
  - an end date (required)
  - status (requested, approved, active, returned or declined, requested by default)
  - a tool (a tool, required)
  A loan is named after its tool and its start date.

Tools
  Tools have:
  - a name (required)
  - photos (pictures)
  - a description (required)
  - a category (hand tools, power tools, garden, measuring, ladders, plumbing or other, hand tools by default)
  - a condition (like new, good or worn, like new by default)
  - a location
  - available (yes or no, true by default)
  A tool is named after its name.
  Photos of tools are reviewed before others see them.

Approve
  For a loan that is requested; sets status to approved.

Decline
  For a loan that is requested; sets status to declined.

Mark active
  For a loan that is approved; sets status to active.

Mark returned
  For a loan that is active; sets status to returned.

Loan requested
  When a loan is added: mails its owner.

Loan approved
  When “Approve” runs on a loan: mails its owner.

Loan declined
  When “Decline” runs on a loan: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Lists tools to lend and requests to borrow tools from neighbors): opens every page; adds tools and loans
  New users get the member role.
  Open to anyone without signing in: the home page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What is the app called? ToolShare (or: Borrow & Lend, NeighborTools, Tool Library)
  Who may sign up to borrow and lend tools? Anyone may sign up (or: Only invited neighbors, Only people on a specific domain)
  What should the landing page's main call to action lead to? Browse the tool catalog (or: Sign in to borrow, Learn how it works, See what's available near you)
  What can members do beyond browsing? List tools to lend and request to borrow (or: Only borrow tools, Only lend tools, Lend, borrow, and leave reviews)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 2,978 tokens (1,312 in, 1,666 out) · $0.0318
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 165 files (165 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Inventory
  Track ingredients, suppliers and stock levels for a small bakery.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by category or supplier; sort by name, category or unit cost)
  - Suppliers (lists suppliers; search by name, contact name or email; sort by name)
  - Stock (lists stock entries; filter by ingredient, entry type, entry date or supplier; sort by entry date, quantity or unit cost)
  - Team (who has access: invite people, change roles, remove users)

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
  - a category (flour, sugar, dairy, eggs, fat, leavening, flavoring or other, flour by default)
  - a unit (required)
  - a reorder point (a number)
  - a reorder quantity (a number)
  - a unit cost (an amount)
  - a supplier (a supplier)
  - notes

Stock entries
  Stock entries have:
  - an ingredient (an ingredient, required)
  - a quantity (a number)
  - an entry type (delivery, adjustment or usage, delivery by default)
  - an entry date (required, today by default)
  - a supplier (a supplier)
  - a unit cost (an amount)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff: everything
  New users get the staff role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What currency and time zone should the app use? USD and America/New_York (or: EUR and Europe/London, GBP and Europe/London, AUD and Australia/Sydney)
  Who uses the app — just the bakery team, or are there different roles? A single staff role for all bakery team members, plus admin (or: Separate manager and staff roles, Admin only, no other roles, Owner and employee roles)
  How is stock tracked — as individual entries (deliveries, usage, adjustments) or as a single current quantity per ingredient? Individual stock entries with an entry type (delivery, usage, adjustment) to build a log (or: A single current quantity field on each ingredient, Both a log and a running total on the ingredient)
  Is the inventory visible to anyone, or only to signed-in team members? Signed-in team members only — no public access (or: Public read-only view of ingredients, Public supplier directory)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 3,988 tokens (1,540 in, 2,448 out) · $0.0455
Pictures from the Smithable image library: logo.webp.
Generated 140 files (140 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Job Board
  A job board for local union members to browse job postings and submit applications.

Pages
  - Jobs (lists job posts; search by title, employer, location or description; filter by category, type or status; sort by closing date, date added or wage; “Close job”; “Reopen job”)
  - Applications (lists applications; search by full name or email; filter by job post or status; “Shortlist”; “Reject”; “Hire”)
  - Union Job Board (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Job posts
  Job posts have:
  - a title (required)
  - an employer (required)
  - a location (required)
  - a description (required)
  - a category (construction, manufacturing, transportation, healthcare, education or other, construction by default)
  - a type (full time, part time, temporary or apprenticeship, full time by default)
  - a wage (an amount)
  - a closing date
  - status (open or closed, open by default)

Applications
  Applications have:
  - a job post (a job post, required)
  - a full name (required)
  - an email (required)
  - a phone
  - a cover letter (required)
  - a resume (a document)
  - status (submitted, reviewing, shortlisted, rejected or hired, submitted by default)

Close job
  For a job post that is open; sets status to closed.
  Close a job post so no more applications are accepted.

Reopen job
  For a job post that is closed; sets status to open.
  Reopen a closed job post to accept applications again.

Shortlist
  For an application that is submitted or reviewing; sets status to shortlisted.
  Move an application to the shortlist.

Reject
  For an application that is submitted, reviewing or shortlisted; sets status to rejected.
  Reject an application.

Hire
  For an application that is shortlisted; sets status to hired.
  Mark an applicant as hired.

Application submitted
  When a application is added: mails email with its job post, full name, status.

Application status changed
  When a application's status changes: mails email with its job post, full name, status.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (A union member who can browse job posts and submit applications): opens the jobs page and the applications page; sees everyone's job posts; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page and reading job posts where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Can visitors browse job posts without signing in? Yes — job posts are public so members and non-members can see what is available, but signing in is required to apply. (or: Only signed-in members can see job posts, Visitors can see post titles only, not details)
  Can union members post jobs, or only administrators? Only administrators post jobs; members browse and apply. (or: Any signed-in member can post a job, Members can post jobs but an admin must approve them first)
  Can members see each other's applications? No — private access means each member sees only their own applications. (or: All members can see all applications, Members see only their own; admins see all)
  Should the board track a wage or salary for each posting? Yes — an optional wage (money) field is included on each job post. (or: No wage field; salary is discussed separately, A wage range with minimum and maximum fields)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 3,856 tokens (1,392 in, 2,464 out) · $0.0452
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 161 files (161 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Hub
  A football club's public site for teams, players, matches and results.

Pages
  - Home (a landing page: hero, features, teams, matches where status is scheduled, matches where status is played and footer)
  - Teams (lists teams; search by name or age group)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Players (lists players; search by name; filter by team or position)
  - Matches (lists matches; search by opponent or venue; filter by team, status, home away or match date; “Record result”; “Cancel match”)

Teams
  Teams have:
  - a name (required)
  - an age group
  - a description
  - a photo (picture)

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
  - a match date (a date and time, required)
  - a venue
  - a home away (home or away, home by default)
  - a home score (a whole number)
  - an away score (a whole number)
  - status (scheduled, played or cancelled, scheduled by default)

Record result
  For a match that is scheduled; sets status to played; asks for the home score and the away score.

Cancel match
  For a match that is scheduled; sets status to cancelled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the teams page, reading teams and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What is the club's name? Named the app "Club Hub" as a generic placeholder — the real club name can be set later. (or: Use the real club name once provided, Keep a generic name like "Club Hub", Use "Our Football Club")
  Who may add and edit teams, players and matches? Only administrators may create and edit records; the public site is read-only for visitors. (or: Any signed-in member may also add records, A separate editor role manages content, Admins only (chosen))
  Should match scores be entered when recording a result, or are home/away score fields always editable? A "Record Result" action on scheduled matches asks for the scores and marks the match as played. (or: Scores are always editable fields on the match form, A dedicated result action asks for scores (chosen), A separate Result model holds scores)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 3,128 tokens (1,412 in, 1,716 out) · $0.0330
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
ConferenceHub
  Event registration for a conference: browse talks and speakers, and register for sessions.

Pages
  - ConferenceHub (a landing page: hero, features, speakers, faq, call to action, contact and footer)
  - Talks (lists talks; search by title or room; filter by track, speaker or starts at; sort by starts at or title; only for organizers and admins)
  - Speakers (lists speakers; search by name, company or title)
  - Tracks (lists tracks; only for organizers and admins)
  - Registrations (lists registrations; filter by talk; only for organizers and admins)
  - Messages (lists contact messages; only for organizers and admins)
  - Schedule (a calendar of talks by week or month)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for organizers and admins)
  - My registrations (lists registrations; filter by talk; only the viewer's own records; only for organizers and admins)

Tracks
  Tracks have:
  - a name (required)
  - a description

Speakers
  Speakers have:
  - a name (required)
  - a bio (formatted text)
  - a photo (picture)
  - a company
  - a title
  Each speaker lists its talks.

Talks
  Talks have:
  - a title (required)
  - a speaker (a speaker, required)
  - a track (a track)
  - a room
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a capacity (a whole number, required, 100 by default)
  - a summary
  Each talk lists its registrations.
  The places left is calculated as the capacity minus the number of its registrations.
  A talk is named after its title and its starts at.

Registrations
  Registrations have:
  - a talk (a talk, required, unique per owner)
  Each registration can have an attendee (a user).
  The attendee owns the registration.
  At most the talk's capacity registrations per talk.
  A registration is added until the talk's starts at.
  Its owner deletes it until the talk's starts at.
  A registration is named after its talk.

Contact messages
  Contact messages have:
  - a name (required)
  - an email (required)
  - a message (required)

Cancel registration
  Asks for the talk.
  Attendee cancels their registration for a talk.

Registration made
  When a registration is added: mails its owner.

Registration cancelled
  When a registration is deleted: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - organizer: everything
  - attendee (A conference participant who registers for talks): adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the schedule page, the speakers page, the privacy page, reading talks, reading speakers, reading tracks and adding contact messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should visitors be able to browse the conference schedule (talks and speakers) without signing in? Yes — talks, speakers, and the schedule are public; registration requires sign-in. (or: No — everything requires sign-in, Yes, but only the list of speakers is public)
  Who signs in to the app — attendees only, or also staff/organizers? Two roles: organizer (manages everything) and attendee (registers for talks). (or: Attendees only, no staff role, Three roles: organizer, speaker, attendee)
  Should the app have a public landing page for the conference? Yes — a public landing page with hero, features, schedule, FAQ, and contact form. (or: No public landing page, app-only, Landing page with just a hero and schedule)
  Should attendees be able to register for individual talks, or just the whole conference? Attendees register for individual talks (like booking a session). (or: Register for the whole conference only, Register for tracks or days, not individual talks)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 4,103 tokens (1,459 in, 2,644 out) · $0.0484
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 185 files (185 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-8/smithable.auth.yml:8:3  warning  attendee can open no page: a role opens only the pages its "pages" lists.
    hint: Add "pages: all" (or a list of pages) under roles.attendee in smithable.auth.yml.
/tmp/smithable-bench-m12-NNELXD/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets for the IT team: track issues, priorities and who handles them.

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
  Each ticket can have an assignee (a user, required when status is in progress or resolved).
  Each ticket lists its ticket messages.
  A ticket is named after its subject.

Ticket messages
  Ticket messages have:
  - a content (required)
  - a sender (agent or requester, agent by default)
  - a from email
  - attachments (documents)
  - a ticket (a ticket, required)
  Each ticket message can have an agent (a user, who makes it, by default, filled by the app).
  A ticket message is named after its content.
  Shown as a conversation, the content is the message, the agent wrote it, the sender says the side (agent is ours).

Assign to me
  Sets assignee to whoever presses it.
  Take the ticket: you become its assignee.

Assign to
  Asks for the assignee.
  Give the ticket to a team member, chosen from the list.

Start work
  For a ticket that is open or reopened; sets status to in progress.
  Mark the ticket as in progress; it needs an assignee.

Resolve
  For a ticket that is open, in progress or reopened; sets status to resolved.
  The issue has been fixed and the requester has their answer.

Close
  For a ticket that is resolved; sets status to closed.
  Close the ticket after it has been resolved.

Reopen
  For a ticket that is closed or resolved; sets status to reopened.
  The ticket needs more work after all.

Ticket received
  When a ticket is added: mails requester email.

Reply sent
  When a ticket message is added and sender is agent: mails ticket's requester email.

Support
  When support is called: a mail becomes a ticket, its attachments with it; a reply to one of them is added to it as a ticket message, as admin.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - agent (Handles tickets, takes them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should requesters be able to submit tickets through a public form, or is this an internal tool for the IT team only? Internal tool only — tickets come in by email or are created by the team; no public form. (or: Add a public ticket submission form on a landing page, Allow anyone with a company email to sign in and submit tickets)
  Are there different tiers of IT support (e.g. first-line and second-line agents), or is the team flat? Flat team: one agent role alongside the admin. (or: Two tiers: first-line (triage) and second-line (specialist), Three tiers: first-line, second-line and a team lead)
  Should the app track resolution time or SLA deadlines per ticket? No SLA tracking in this version — priority alone signals urgency. (or: Add a due date field per ticket, Add SLA tiers (e.g. 4 h, 8 h, 24 h) linked to priority)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 2,907 tokens (1,231 in, 1,676 out) · $0.0317
Pictures from the Smithable image library: logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A shared recipe collection for the family, with ingredients and shopping lists.

Pages
  - Recipes (lists recipes; search by name or description; filter by category or is favorite; sort by name, category, prep minutes or cook minutes; “Mark favorite”; “Unmark favorite”)
  - Shopping lists (lists shopping lists; search by name; filter by date)
  - Home (a landing page: hero, features, call to action and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a description
  - a category (breakfast, lunch, dinner, dessert, snack or drink, breakfast by default)
  - servings (a whole number, required, 4 by default)
  - prep minutes (a whole number)
  - cook minutes (a whole number)
  - a picture
  - notes
  - is favorite (yes or no)

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity (required)
  - a unit
  - notes

Shopping lists
  Shopping lists have:
  - a name (required)
  - a date (required, today by default)
  - notes

Shopping items
  Shopping items have:
  - a shopping list (a shopping list, required)
  - a name (required)
  - a quantity
  - a unit
  - checked (yes or no)

Mark favorite
  For a recipe that is not is favorite; sets is favorite to yes.

Unmark favorite
  For a recipe that is is favorite; sets is favorite to no.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the recipes page and reading recipes.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can add and edit recipes and shopping lists? Only invited family members (admin role) can add and edit; the recipe collection is public for anyone to browse. (or: Any signed-in user can add recipes, Only admins can add; other members can view but not edit)
  Should shopping lists be private to each family member or shared across the whole family? Shopping lists are shared across the family (shared access). (or: Each person sees only their own shopping lists (private access), Shopping lists are public like recipes)
  Should the app track cooking time as separate prep and cook times, or as a single total time? Separate prep time and cook time fields on each recipe. (or: A single total time field, No time tracking at all)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 4,029 tokens (1,563 in, 2,466 out) · $0.0458
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-10
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-10/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The state of our API services, live — incidents and planned maintenance.

Pages
  - API Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; search by title; filter by status or component)
  - Updates (lists incident updates; filter by status or incident)
  - Components (lists components; search by name; filter by status; only for admins; visitors see components on the API Status page)
  - Maintenance (lists maintenances; filter by component)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights; only for admins)
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
  The incident is over, with an update saying so. The component's status stays what the team sets.

Chat command
  When chat command is called: adds an incident, as staff; the call is signed with its time.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
  Other programs can read and change components and incidents with a key, and run resolve. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (eu.anthropic.claude-sonnet-4-6) · 4,635 tokens (1,626 in, 3,009 out) · $0.0550
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 178 files (178 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Live status of our web shop's services, with outages and their updates.

Pages
  - Shop Status (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; search by title; filter by status or component)
  - Updates (lists incident updates)
  - Components (lists components; search by name; filter by status; only for admins; visitors see components on the Shop Status page)
  - Maintenance (lists maintenances; filter by component or starts at)
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
  The incident is over, with an update saying so. The component's status stays what the team sets.

Chat command
  When chat command is called: adds an incident, as staff; the call is signed with its time.

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

Assumed:
  What time zone should the app use? UTC, since the web shop's location is not specified. (or: Europe/London, America/New_York, Europe/Amsterdam)
  Should visitors be able to subscribe to status updates by email? No — the description only mentions reading status; no subscription feature added. (or: Yes, with a contact/subscribe form on the home page, Yes, via a mailing list link in the footer)
  Should the incident history page show all incidents or only resolved ones? All incidents (the articles page lists every Incident record, matching the starter). (or: Only resolved incidents, Resolved and monitoring only)
Frontier model (eu.anthropic.claude-sonnet-4-6) · 4,599 tokens (1,635 in, 2,964 out) · $0.0543
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 178 files (178 changed, 0 removed).

Created /tmp/smithable-bench-m12-NNELXD/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-NNELXD/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-NNELXD/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
