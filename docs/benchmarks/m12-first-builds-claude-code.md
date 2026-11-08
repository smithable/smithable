# M12 first builds: claude-code (2026-11-08)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 954,702 tokens (916,990 in, 37,712 out), $1.6873 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 133,048 | 4,419 | $0.6602 | 0 | – | 82 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 65,431 | 2,820 | $0.0873 | 0 | – | 64 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 132,810 | 5,819 | $0.1938 | 0 | – | 96 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 64,629 | 2,776 | $0.0800 | 0 | – | 66 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 64,380 | 1,677 | $0.0561 | 0 | – | 48 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 64,629 | 3,635 | $0.0972 | 0 | – | 75 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 64,369 | 2,562 | $0.0737 | 0 | – | 62 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 66,720 | 3,326 | $0.1078 | 0 | – | 75 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 65,108 | 2,244 | $0.0732 | 0 | – | 48 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 64,377 | 1,711 | $0.0567 | 0 | – | 48 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 65,743 | 3,475 | $0.1029 | 0 | – | 64 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 65,746 | 3,248 | $0.0984 | 0 | – | 75 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 2 | 5 / 6 (has 5) | 9 / 13 (has 9) | 0 / 1 (has 0) | private; admin, staff, member (member) | none | pages home, schedule, privacy; read Instructor, Session, ClassType; create Message | 1 (operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | crm | 3 | 1 / 3 (has 4) | 3 / 5 (has 6) | 0 / 2 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 3 | 3 / 4 (has 4) | 5 / 7 (has 6) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 1 / 5 (has 5) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, tools, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 5) | private; admin, staff, member (member) | none | pages home, jobs, privacy; read Job; create none | 3 (write-without-read, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 2) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 2 / 13 (has 7) | 0 / 1 (has 1) | private; admin, organizer, attendee (attendee) | none | pages home, programme, talks, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 2 (operator-unknown, thread-needs-form) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 5 / 8 (has 6) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 2 (role-opens-nothing, operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Hall Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, instructors, faq, call to action, contact, class types and footer)
  - Schedule (a calendar of sessions by week or month; filter by classType or instructor)
  - My bookings (lists bookings; only for members and admins)
  - Sessions (lists sessions; filter by class type, instructor or starts at; only for staff users and admins)
  - Bookings (lists bookings; only for staff users and admins)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - Messages (lists messages; only for staff users and admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
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

Messages
  Messages have:
  - a name (required)
  - an email (required)
  - a message (required)

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
  - staff (Reception. Runs the day, the sessions and who comes to them, and reads the messages): opens the sessions page, the bookings page and the messages page; sees everyone's sessions, bookings and messages; adds sessions and bookings; changes everyone's sessions and bookings; deletes everyone's bookings
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading instructors, reading sessions, reading class types and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can visitors see before they sign in? The home page, the class schedule, the class types and the teachers; signing in is only for booking (or: Everything needs sign-in, Only the home page is public)
  Who may create an account to book? Anyone may sign up with their email and book classes as a member (or: Only people the studio invites, Only addresses on certain email domains)
  Should visitors be able to contact the studio? Yes, a contact form on the home page whose messages staff read (or: No contact form, Contact form plus a blog with news)
  Which currency does the studio use? Euro (EUR) (or: US dollar (USD), British pound (GBP), Swedish krona (SEK))
Frontier model (claude-opus-5-5) · 4,356 tokens (2,101 in, 2,255 out) · $0.0619
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, hero.webp, logo.webp.
Generated 174 files (174 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-JkAFb8/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline CRM
  A lightweight CRM where a small sales team keeps its companies, contacts, deals and follow-ups in one place.

Pages
  - Start (a dashboard: open deals, pipeline value and follow ups due)
  - Companies (lists companies; search by name; filter by segment or account manager)
  - Contacts (lists contacts; search by name, email or job title; filter by company)
  - Deals (lists deals; search by title; filter by stage, company or expected close; sort by value, expected close or title; “Mark won”; “Mark lost”)
  - Follow ups (lists follow ups; filter by done, due on or company; “Mark done”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Companies
  Companies have:
  - a name (required)
  - a website (a web address)
  - a phone
  - a segment (smb, enterprise or government, smb by default)
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  Each company lists its follow ups.
  The account manager owns the company.
  Deleted companies stay in the trash for thirty days, where they can be restored.

Contacts
  Contacts have:
  - a name (required)
  - a company (a company, required)
  - a job title
  - an email
  - a phone
  - notes

Deals
  Deals have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - a stage (lead, qualified, proposal, won or lost, lead by default)
  - a value (an amount)
  - an expected close (a date)
  - closed on (a date)
  - notes
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a company (a company, required)
  - a deal (a deal)
  - due on (a date, required, today by default)
  - done (yes or no)
  - a note

Mark won
  For a deal that is lead, qualified or proposal; sets stage to won and closed on to today.
  Close a deal as won.

Mark lost
  For a deal that is lead, qualified or proposal; sets stage to lost and closed on to today.
  Close a deal as lost.

Mark done
  For a follow up that is not done; sets done to yes.
  Tick off a follow-up once it is handled.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the start page, the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency and time zone should the team work in? Euros, Stockholm time (or: Swedish kronor, Stockholm time, US dollars, New York time, Pounds, London time)
  What can salespeople do with each other's records? Everyone sees and edits all records; only the owner or an admin can delete them (or: Each salesperson sees only their own companies and deals, Everyone can also delete any record)
  Who owns a company? Its account manager, who can be someone other than the person who added it (or: Whoever added the company, Nobody in particular: the whole team shares it)
  What should the start page show? Open deals, the value of the pipeline, and follow-ups that aren't done yet (or: The deals list, Only the follow-ups due)
Frontier model (claude-opus-5-5) · 5,334 tokens (2,401 in, 2,933 out) · $0.0779
Pictures from the Smithable image library: logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-2
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
  - Clients (lists clients; search by name or email; sort by name or date added)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; search by number; filter by client, status or due on; sort by issued on, due on or number; “Mark sent”; “Mark paid”; “Mark overdue”)

Clients
  Clients have:
  - a name (required)
  - an email (required)
  - a phone
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
  - an invoice (an invoice, required)

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required)
  - status (draft, sent, paid or overdue, draft by default)
  - notes
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The paid is calculated as the total amount of its payments.
  The balance is calculated as the total minus the paid.
  A invoice is named after its number.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid; asks for the payment's amount and the payment's method; adds a payment (paid on today).
  The client paid the invoice; the payment is recorded with it.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Mark overdue
  A day after an invoice's due on, where status is sent: runs “Mark overdue”.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page and the privacy page.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can see the records? Each freelancer sees only their own clients, invoices and payments (or: A small team shares all clients and invoices)
  Should the app have a public front page? A landing page and privacy page; everything else needs sign-in (or: No public pages, sign-in only)
  How are payments recorded? As their own records under an invoice, so partial payments add up to a balance; Mark paid records one (or: Only a paid status on the invoice, no payment records)
  Who may join? Only invited people and the admins (or: Any freelancer may sign up)
Frontier model (claude-opus-5-5) · 5,333 tokens (2,359 in, 2,974 out) · $0.0783
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-JkAFb8/app-3/smithable.content.yml:9:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshare
  Neighbors lend each other the tools they own, from drills to ladders.

Pages
  - Tools (lists tools; search by title, description or place; filter by category, condition or available; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Lent out (lists loans; filter by status or due on; “Mark returned”)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (power, hand, garden, ladders, cleaning or other, power by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)

Loans
  Loans have:
  - a tool (a tool, required)
  - a borrower name (required)
  - a borrower email
  - lent on (a date, required)
  - due on (a date)
  - status (out or returned, out by default)
  - returned on (a date, filled by the app)
  - a note

Mark returned
  For a loan that is out; sets status to returned and returned on to today.
  Record that the borrowed tool came back.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the tools page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can people see before they sign in? The tool catalog is public, without owners' names; signing in is needed to ask to borrow or to list a tool. (or: Everything requires sign-in, Only the landing page is public)
  How does borrowing work? A borrower contacts the owner from the tool's page; the owner records the loan and marks it returned. (or: Borrowers send a loan request that the owner approves, Borrowers book tools for set dates on a calendar)
  Who may join? Anyone may sign up and list their own tools. (or: Only invited neighbors, Only addresses from one email domain)
  What does a loan record hold? The tool, the borrower's name and email, the lending and due dates, and whether it's back. (or: Also a deposit amount, Also photos of the tool's condition at hand-over)
Frontier model (claude-opus-5-5) · 4,058 tokens (1,984 in, 2,074 out) · $0.0573
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 149 files (149 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-JkAFb8/app-4/smithable.content.yml:6:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Crumb & Count
  Keeps track of the bakery's ingredients, their suppliers and how much of each is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by storage, supplier or in stock)
  - Suppliers (lists suppliers; search by name, contact person or email)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required, unique)
  - a contact person
  - an email
  - a phone
  - a website (a web address)
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - reorder at (a number)
  - a storage (dry, chilled or frozen, dry by default)
  - a supplier (a supplier)
  - a cost per unit (an amount)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (Works in the bakery and keeps the ingredients, suppliers and stock levels up to date): opens every page; adds every kind of record; changes everyone's ingredients and suppliers
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 3,569 tokens (1,943 in, 1,626 out) · $0.0481
Pictures from the Smithable image library: logo.webp.
Generated 135 files (135 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Union Jobs
  Job posts from the local union, where members find work and apply.

Pages
  - Jobs (lists jobs; search by title, employer, location, trade or description; filter by job type, status or closes on; sort by closes on or date added; “Close job”; “Reopen job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; filter by job or status; only for staff users and admins)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a location
  - a trade
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a pay
  - a description (required)
  - closes on (a date)
  - status (open or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique per owner)
  - a name (required)
  - an email (required)
  - a phone
  - a member number
  - a message
  - a resume (a document)
  - status (submitted, shortlisted, hired or declined, submitted by default, filled by the app)

Close job
  For a job that is open; sets status to closed.

Reopen job
  For a job that is closed; sets status to open.

Shortlist
  For an application that is submitted; sets status to shortlisted.

Hire
  For an application that is submitted or shortlisted; sets status to hired.

Decline
  For an application that is submitted or shortlisted; sets status to declined.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's applications; adds every kind of record; changes everyone's jobs and applications; deletes everyone's jobs; runs every custom action
  - member (Union members who look for work and apply): opens the home page, the jobs page and the my applications page; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts jobs and who applies? Union staff post jobs and review applications; members apply (or: Employers post their own jobs, Any member can post a job)
  Can people who aren't signed in see the jobs? Yes, open jobs are public; signing in is only needed to apply (or: Only signed-in members see jobs)
  Who can create an account? Anyone can sign up and apply; staff check membership when reviewing (or: Only people the union invites, Only addresses on the union's email domain)
  What does an application include? Name, email, phone, member number, a message and a resume file (or: Just a message, A full form with work history and certifications)
Frontier model (claude-opus-5-5) · 4,172 tokens (1,966 in, 2,206 out) · $0.0598
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 161 files (161 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-JkAFb8/app-6/smithable.auth.yml:12:5  warning  staff may change others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-JkAFb8/app-6/smithable.auth.yml:13:5  warning  staff may delete others' Job it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-JkAFb8/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Football
  The football club's site: our teams, their players, the fixtures coming up and the results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent, competition or ground; filter by team, status, venue or kickoff; “Record result”; “Postpone”)
  - Teams (lists teams; search by name or coach; filter by category)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required)
  - a category (senior, youth, women or veterans, senior by default)
  - a coach
  - about
  - a photo (picture)
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
  - a venue (home, away or neutral, home by default)
  - a ground
  - a competition
  - status (scheduled, played, postponed or cancelled, scheduled by default)
  - a goals for (a whole number)
  - a goals against (a whole number)
  - a report
  A match is named after its team, its opponent and its kickoff.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Enter the final score once a match has been played.

Postpone
  For a match that is scheduled; sets status to postponed.
  Mark a match as postponed.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who keeps the teams, squads and fixtures up to date? Only the club's administrators; everyone else just looks (or: Each team's coach updates their own team, Club officials as a separate editor role)
  What may visitors see without signing in? Everything: teams, players, fixtures and results (or: Only teams and results, squads for members, Nothing until signed in)
  What does a player's profile show? Name, team, shirt number, position, photo and a short bio, with no contact details (or: Also date of birth and nationality, Also appearances and goals)
  How is a result recorded? A Record result button on a match asks for the goals scored and conceded and marks it played (or: Separate goal and scorer records per match, Just a free-text score)
Frontier model (claude-opus-5-5) · 4,346 tokens (2,171 in, 2,175 out) · $0.0609
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-JkAFb8/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Podium Conference
  Programme, speakers and attendee registration for a conference.

Pages
  - Home (a landing page: hero, speakers, features, faq, call to action and footer)
  - Programme (a calendar of talks by week or month)
  - Talks (lists talks; filter by speaker, track or starts at)
  - Speakers (lists speakers)
  - My registration (lists registrations; only the viewer's own records; only for attendees and admins)
  - Registrations (lists registrations; search by full name, email or company; filter by ticket or status; only for organizers and admins)
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
  - an abstract (formatted text)
  - a speaker (a speaker, required)
  - starts at (a date and time, required)
  - duration minutes (a whole number, required, 45 by default)
  - a room
  - a track (keynote, technical, business or workshop, keynote by default)

Registrations
  Registrations have:
  - a full name (required)
  - an email (required, unique)
  - a company
  - a ticket (standard, student or speaker, standard by default)
  - dietary needs
  - status (confirmed or cancelled, confirmed by default)
  A registration is named after its full name.

Cancel registration
  For a registration that is confirmed; sets status to cancelled.
  The attendee no longer comes to the conference.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - organizer (Runs the programme, the speakers and the list of attendees): opens the programme page, the talks page, the speakers page and the registrations page; sees everyone's talks, speakers and registrations; adds talks, speakers and registrations; changes everyone's talks, speakers and registrations; deletes everyone's talks, speakers and registrations
  - attendee (Registers for the conference and keeps their registration up to date): opens the my registration page; adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the programme page, the talks page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 4,167 tokens (2,098 in, 2,069 out) · $0.0582
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 158 files (158 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-JkAFb8/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  The IT team's tickets: what is wrong, how urgent it is and who is handling it.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email
  - status (open, in progress, closed or reopened, open by default)
  - a priority (low, normal, high or urgent, low by default)
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
  Give the ticket to someone on the team.

Start work
  For a ticket that is open or reopened; sets status to in progress.
  Someone is working on the ticket now; it needs an assignee.

Close
  For a ticket that is open, in progress or reopened; sets status to closed.
  The problem is solved.

Reopen
  For a ticket that is closed; sets status to reopened.
  The ticket needs more work after all.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - agent (A member of the IT team: logs tickets, takes them, works on them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who logs the tickets? The IT team logs them, noting the requester's email address (or: Employees sign in and open their own tickets, Mail to an IT address becomes a ticket)
  How is priority written? Low, normal, high or urgent (or: A number from 1 to 5, Low, medium or high)
  What may agents do? Every agent sees, changes and assigns every ticket; admins also manage the team (or: Agents change only the tickets assigned to them, A team lead role that assigns tickets)
  Are requesters told when their ticket changes? No mail is sent for now (or: Mail the requester when a ticket is closed, Mail the assignee when a ticket is assigned to them)
Frontier model (claude-opus-5-5) · 3,167 tokens (1,776 in, 1,391 out) · $0.0420
Pictures from the Smithable image library: logo.webp.
Generated 152 files (152 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Kitchen
  The family's recipes in one place, with their ingredients and the shopping lists for the week.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status; “Mark done”)
  - Family (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a summary
  - a category (main, starter, side, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - a picture
  - instructions (formatted text)
  - favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - an amount
  - a note

Shopping lists
  Shopping lists have:
  - a name (required)
  - a needed by (a date)
  - status (open or done, open by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a list (a shopping list, required)
  - a name (required)
  - an amount
  - a for recipe (a recipe)
  - bought (yes or no)

Mark done
  For a shopping list that is open; sets status to done.
  Close a shopping list once the shopping is done.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can see and change the recipes? Everyone in the family who is invited sees and edits all recipes and lists (or: Each person keeps their own recipes private, Only parents edit; others just look)
  Should the recipes be visible to people outside the family? No, the whole app needs sign-in (or: Recipes public, shopping lists private)
  How are ingredients put on a shopping list? Items are added to a list by hand, optionally noting which recipe they are for (or: A button that copies a recipe's ingredients onto a list)
Frontier model (claude-opus-5-5) · 4,587 tokens (2,274 in, 2,313 out) · $0.0644
Pictures from the Smithable image library: samples/recipe-1.webp, samples/recipe-2.webp, logo.webp.
Generated 153 files (153 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  Is our API working? Live status, incidents and planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can visitors see without signing in? The status page, every component's state, all incidents with their updates, and planned maintenance (or: Only open incidents and component states, Everything, plus a form to report a problem, Nothing: the status page needs sign-in)
  Who writes incidents and maintenance? Invited staff write incidents, updates and maintenance; admins also manage the components and the team (or: Admins only, Every invited person does everything)
  Which time zone are times shown in? UTC (or: Europe/Stockholm, America/New_York, Europe/London)
  Should there be a page with the history of past incidents? Yes: a public incident history page, linked from the status page's main button (or: No, only the recent incidents on the status page, History only for signed-in staff)
Frontier model (claude-opus-5-5) · 4,812 tokens (2,365 in, 2,447 out) · $0.0679
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-JkAFb8/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
/tmp/smithable-bench-m12-JkAFb8/app-11/smithable.ux.yml:6:18  warning  IncidentUpdate.at is required and the reply box does not ask for it: give it a default, or `by: app`, or the thread shows Add incident update instead.
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our web shop's services, outages and their updates, live.

Pages
  - Home (a landing page: hero, services, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or service; “Identified”; “Monitoring”; “Resolve”; only for admins; visitors see incidents on the Home page)
  - Updates (lists incident updates; only for admins)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its incidents.

Incidents
  Incidents have:
  - a title (required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a service (a service)
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
  The outage is over, with an update saying so. The service's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes outages and their updates): adds incidents and incident updates; changes everyone's incidents and incident updates
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the page also announce planned maintenance? No, only services, outages and their updates (or: Yes, a list of planned maintenance windows)
  Who writes outages and updates? An invited team: admins keep the list of services, staff write outages and updates (or: Only the administrators, Everyone on the team, services included)
  Which time zone are times shown in? Europe/Stockholm (or: UTC, Europe/London, America/New_York)
  What do visitors see without signing in? The status of every service, ongoing and recent outages with their updates, and the incident history (or: Only the current status of the services, Status and ongoing outages, no history)
Frontier model (claude-opus-5-5) · 3,923 tokens (2,121 in, 1,802 out) · $0.0530
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 154 files (154 changed, 0 removed).

Created /tmp/smithable-bench-m12-JkAFb8/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-JkAFb8/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-JkAFb8/app-12/smithable.auth.yml:8:3  warning  staff can open no page: a role opens only the pages its "pages" lists.
    hint: Add "pages: all" (or a list of pages) under roles.staff in smithable.auth.yml.
/tmp/smithable-bench-m12-JkAFb8/app-12/smithable.content.yml:11:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
