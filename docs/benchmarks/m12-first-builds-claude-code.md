# M12 first builds: claude-code (2026-11-05)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 919,046 tokens (846,657 in, 72,389 out), $2.3427 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 66,387 | 8,104 | $0.6932 | 0 | – | 122 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 65,091 | 6,710 | $0.1651 | 0 | – | 115 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 132,521 | 9,482 | $0.2701 | 0 | – | 128 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 64,290 | 7,494 | $0.1743 | 0 | – | 110 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 64,043 | 3,336 | $0.0892 | 0 | – | 72 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 64,291 | 6,815 | $0.1608 | 0 | – | 114 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 64,032 | 5,473 | $0.1318 | 0 | – | 101 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 66,382 | 7,263 | $0.1864 | 0 | – | 113 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 64,770 | 3,755 | $0.1034 | 0 | – | 75 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 64,038 | 3,472 | $0.0919 | 0 | – | 81 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 65,404 | 5,007 | $0.1335 | 0 | – | 94 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 65,408 | 5,478 | $0.1430 | 0 | – | 91 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 2 | 4 / 6 (has 4) | 8 / 13 (has 9) | 0 / 1 (has 0) | private; admin, staff, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | mentions visitors; landing page |
| 2 | crm | 2 | 1 / 3 (has 4) | 3 / 5 (has 6) | 0 / 2 (has 3) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 2 | 3 / 4 (has 4) | 5 / 7 (has 6) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 2 / 5 (has 7) | 0 / 0 (has 3) | shared; admin, member (member) | none | pages home, catalog, privacy; read Tool; create none | 2 (capacity-no-unique, operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 5) | private; admin, member, steward (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 6) | 0 / 0 (has 1) | private; admin, staff (staff) | none | pages home, teams, players, matches, privacy; read Team, Player, Match; create none | 3 (write-without-read, operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 3 / 13 (has 8) | 0 / 1 (has 0) | private; admin, staff, member (member) | none | pages home, schedule, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 2 | 2 / 2 (has 2) | 2 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 2 / 2 | no mention; no landing page |
| 10 | records | 2 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 2 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 0 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | Payments | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Open Door Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, classes, teachers, faq, call to action and footer)
  - Schedule (a calendar of sessions by week or month; filter by classType or instructor)
  - My bookings (lists bookings; only the viewer's own records; only for members and admins)
  - Sessions (lists sessions; filter by class, teacher or starts at; sort by starts at or capacity; only for staff users and admins)
  - Bookings (lists bookings; filter by session.startsAt or session.classType; only for staff users and admins)
  - Classes (lists classes; filter by level; only for admins; visitors see classes on the Home page)
  - Teachers (lists teachers; only for admins; visitors see teachers on the Home page)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Classes
  Classes have:
  - a name (required)
  - a summary
  - a level (all levels, beginner or advanced, all levels by default)
  - duration minutes (a whole number, required, 60 by default)
  Each class lists its sessions.

Teachers
  Teachers have:
  - a name (required)
  - a bio (formatted text)
  - a portrait (picture)
  Each teacher lists its sessions.

Sessions
  Sessions have:
  - class (a class, required)
  - a teacher (a teacher, required)
  - starts at (a date and time, required)
  - a capacity (a whole number, required, 12 by default)
  Each session lists its bookings.
  The places left is calculated as the capacity minus the number of its bookings.
  A session is named after its class and its starts at.

Bookings
  Bookings have:
  - a session (a session, required, unique)
  Each booking can have an attendee (a user).
  The attendee owns the booking.
  At most the session's capacity bookings per session.
  A booking is added until the session's starts at.
  Its owner deletes it until the session's starts at.
  A booking is named after its session.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Reception. Runs the day, the sessions and who comes to them): opens the sessions page and the bookings page; sees everyone's sessions and bookings; adds sessions and bookings; changes everyone's sessions and bookings; deletes everyone's bookings
  - member (A student who books classes): opens the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors and reading sessions.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can people see without signing in? The home page, the classes, the teachers and the schedule; signing in is only needed to book (or: Only the home page; the schedule needs sign-in, Everything but the booking button is on the home page alone)
  Who can book a class? Anyone who signs in with their email address becomes a member and books their own places (or: Only members the studio has invited, Visitors book with a name and email, without an account)
  Who runs the studio in the app? An owner (admin) who manages everything, and reception staff who manage sessions and bookings (or: Only the owner, Teachers also sign in and see who is coming to their classes)
  Is a class paid for when it is booked? No, a booking only reserves a place; payment happens at the studio (or: Pay online when booking, Members use class passes or a monthly membership)
Frontier model (claude-opus-5-5) · 3,691 tokens (1,974 in, 1,717 out) · $0.0501
Pictures from the Smithable image library: samples/instructor-1.webp, hero.webp, logo.webp.
Generated 171 files (171 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-70GSvF/app-1/smithable.content.yml:16:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Sales CRM
  A CRM where a small sales team keeps its companies, contacts, deals and follow-ups in one place.

Pages
  - Start (a dashboard: open deals, pipeline value, deals by stage and open follow ups)
  - Companies (lists companies; search by name or industry; filter by account manager; sort by name or date added)
  - Contacts (lists contacts; search by name, email or job title; filter by company; sort by name or date added)
  - Deals (lists deals; search by title; filter by stage, company or salesperson; sort by expected close, value or title; “Mark won”; “Mark lost”)
  - Follow-ups (lists follow-ups; search by note; filter by done or company; sort by due on; “Mark done”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Companies
  Companies have:
  - a name (required)
  - a website (a web address)
  - a phone
  - an industry
  - notes
  Each company can have an account manager (a user).
  Each company lists its contacts.
  Each company lists its deals.
  Each company lists its follow-ups.
  The account manager owns the company.
  Deleted companies stay in the trash for thirty days, where they can be restored.

Contacts
  Contacts have:
  - a name (required)
  - a company (a company, required)
  - a job title
  - an email (unique)
  - a phone
  - notes
  Each contact lists its deals.
  Deleted contacts stay in the trash for thirty days, where they can be restored.

Deals
  Deals have:
  - a title (required)
  - a company (a company, required)
  - a contact (a contact)
  - a stage (lead, qualified, proposal, negotiation, won or lost, lead by default)
  - a value (an amount, required)
  - an expected close (a date)
  - closed on (a date)
  - a lost reason
  - notes
  Each deal can have a salesperson (a user).
  Each deal lists its follow-ups.
  The salesperson owns the deal.
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow-ups
  Follow-ups have:
  - a company (a company, required)
  - a contact (a contact)
  - a deal (a deal)
  - due on (a date, required, today by default)
  - done (yes or no)
  - a note
  Deleted follow-ups stay in the trash for thirty days, where they can be restored.

Mark won
  For a deal that is lead, qualified, proposal or negotiation; sets stage to won and closed on to today.

Mark lost
  For a deal that is lead, qualified, proposal or negotiation; sets stage to lost and closed on to today; asks for the lost reason.

Mark done
  For a follow-up that is not done; sets done to yes.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the start page, the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency are deal values in? Euros (EUR) (or: US dollars (USD), British pounds (GBP), Swedish kronor (SEK))
  Who can use the CRM, and what may they do? Invited colleagues only: salespeople can see and change every record but delete only their own, and an admin also manages the team (or: Salespeople see and change only their own companies and deals, Everyone has the same full access, including deleting, Anyone with a company email address can join without an invitation)
  What stages does a deal move through? Lead, qualified, proposal, negotiation, then won or lost, with a reason asked when a deal is lost (or: A shorter pipeline: open, won or lost, Stages the team defines and edits itself)
  What should the team see first after signing in? A start page with open deals, pipeline value, deals by stage and open follow-ups (or: The list of deals, The list of follow-ups, The list of companies)
Frontier model (claude-opus-5-5) · 5,696 tokens (2,449 in, 3,247 out) · $0.0845
Pictures from the Smithable image library: logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Duly
  Invoicing for freelancers: keep your clients, send invoices and track the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Overview (a dashboard: received, outstanding, overdue, invoiced and latest)
  - Clients (lists clients; search by name or email; sort by name or date added)
  - Payments (lists payments; filter by invoice or method; sort by paid on or amount)
  - Invoices (lists invoices; search by number; filter by client or status; sort by issued on, due on or number; “Mark sent”; “Mark paid”; “Mark overdue”)

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
  - paid on (a date, required, today by default)
  - an amount (an amount, required)
  - a method (bank transfer, card, cash or other, bank transfer by default)
  - a note
  - an invoice (an invoice, required)
  A payment is named after its invoice and its paid on.

Invoices
  Invoices have:
  - a number (required, unique)
  - a client (a client, required)
  - issued on (a date, required, today by default)
  - due on (a date, required, the issued on plus 30 days by default)
  - status (draft, sent, paid or overdue, draft by default)
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The amount paid is calculated as the total amount of its payments.
  The balance due is calculated as the total minus the amount paid.

Mark sent
  For an invoice that is draft; sets status to sent.
  The invoice went to the client.

Mark paid
  For an invoice that is sent or overdue; sets status to paid; asks for the payment's amount; adds a payment (paid on today).
  The client paid the invoice; the final payment is recorded with it.

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Mark overdue
  7 days after an invoice's due on, where status is sent: runs “Mark overdue”.

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
  Who signs in, and who sees what? Each freelancer signs in with their own account and sees only their own clients, invoices and payments. (or: A small team shares all clients and invoices, by invitation, One business with an administrator and bookkeepers)
  What do visitors see before signing in? A public landing page explaining the app, plus a privacy page; all records need sign-in. (or: No public pages, straight to sign-in, A landing page with a pricing section as well)
  How are payments recorded? Payments have their own page and show on their invoice, partial payments count towards the balance due, and Mark paid records the final payment. (or: Only a Mark paid button, with no payment records, Recording a payment also marks a fully paid invoice as paid, written as custom code)
  Should the app hold your own business details for the invoices, and in which currency? Euros, and no business details yet: no name, VAT number or IBAN of your own in this first version. (or: Add a page for business name, VAT number and IBAN, Use another currency)
Frontier model (claude-opus-5-5) · 4,366 tokens (2,317 in, 2,049 out) · $0.0595
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 157 files (157 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-70GSvF/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Neighbor Toolshed
  A tool library where neighbors lend each other the tools they own.

Pages
  - Tools (lists tools; search by name, description or area; filter by category or condition; sort by name or date added; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Borrowed (lists loans; filter by borrower or status)
  - Lending (lists loans; filter by status; only the viewer's own records)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tools
  Tools have:
  - a name (required)
  - photos (pictures)
  - a description
  - a category (power tools, hand tools, garden, ladders, cleaning or other, power tools by default)
  - a condition (like new, good or worn, like new by default)
  - an area
  Each tool lists its loans.

Loans
  Loans have:
  - a tool (a tool, required)
  - status (requested, lent, returned or declined, requested by default, filled by the app)
  - a needed from (a date, required)
  - a return by (a date, required)
  - a note
  - returned on (a date, filled by the app)
  Each loan can have a borrower (a user, who makes it, by default, filled by the app).
  At most 1 loans per tool (counting those with status requested or lent).
  A loan is named after its tool and its needed from.

Lend
  For a loan that is requested; sets status to lent.
  The tool's owner agrees and hands the tool over.

Decline
  For a loan that is requested; sets status to declined.
  The tool's owner cannot lend it this time, which frees the tool for others.

Mark returned
  For a loan that is lent; sets status to returned and returned on to today.
  The tool is back with its owner and can be borrowed again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who can join the tool library? Only neighbors who are invited by an administrator (or: Anyone who signs up, Only people with an email address on a certain domain)
  What can people see without signing in? The tools and a welcome page; borrowing and lending need a sign-in (or: Nothing: the whole app needs a sign-in, Only a welcome page)
  How does a tool get lent? A neighbor requests it with dates, the owner lends or declines, then marks it returned; a tool has one open request or loan at a time (or: Neighbors just take a free tool and mark it borrowed themselves, Several requests can wait in line for one tool)
  Who can see the loans? Everyone signed in can see all loans, and only the tool's owner can change one (or: Only the borrower and the tool's owner see a loan, Administrators also manage every loan)
Frontier model (claude-opus-5-5) · 2,362 tokens (1,614 in, 748 out) · $0.0279
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-70GSvF/app-4/smithable.yml:34:7  warning  Loan has a capacity per tool, but "tool" is not unique: one person can take several places.
    hint: Write "tool: Tool! unique" for one loan per person and tool (unique per owner with private access).
/tmp/smithable-bench-m12-70GSvF/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of a small bakery's ingredients, their suppliers and how much of each is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by category or supplier)
  - Suppliers (lists suppliers; search by name, contact name or email)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required, unique)
  - a contact name
  - an email
  - a phone
  - a website (a web address)
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a category (other, flour, sugar, dairy, eggs, fats, leavening, flavoring or packaging, other by default)
  - a unit (kg, g, l, ml or pieces, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number, required, 0 by default)
  - a supplier (a supplier)
  - notes
  The above reorder level is calculated as the in stock minus the reorder level.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; changes everyone's ingredients and suppliers
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who uses the app, and what may they do? The bakery's invited staff share all records and can add and edit them; only admins can delete them. (or: Staff can also delete records, Only admins can change records; staff can only view them, Staff can update stock levels only)
  How are stock levels kept up to date? Staff edit the amount in stock on each ingredient directly, for example after a delivery or a stock count. (or: Record each delivery and each use as a stock movement, with a history, Record dated stock counts)
  How many suppliers can an ingredient have? One supplier per ingredient, and each supplier's page lists its ingredients. (or: Several suppliers per ingredient, each with its own price)
  How does the app show what needs reordering? The ingredients list has an "Above reorder level" column; a value below zero means it is time to reorder. (or: Add a dashboard of low-stock ingredients, Email someone when an ingredient runs low)
Frontier model (claude-opus-5-5) · 3,625 tokens (1,995 in, 1,630 out) · $0.0486
Pictures from the Smithable image library: logo.webp.
Generated 134 files (134 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Local Union Job Board
  A job board where the union posts jobs and its members apply for them.

Pages
  - Jobs (lists jobs; search by title, employer, location or description; filter by job type or status; sort by hourly wage, closes on or date added; “Mark filled”; “Close job”)
  - My applications (lists applications; only the viewer's own records; only for members and admins)
  - All applications (lists applications; search by applicant name, email or member number; filter by job or status; only for stewards and admins)
  - Home (a landing page: hero, jobs where status is open, features and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a description (required)
  - a location
  - a job type (full time, part time, temporary or apprenticeship, full time by default)
  - a hourly wage (an amount)
  - closes on (a date)
  - status (open, filled or closed, open by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique)
  - an applicant name (required)
  - an email (required)
  - a phone
  - a member number
  - a cover note
  - a resume (a document)
  - status (submitted, shortlisted, hired or declined, submitted by default, filled by the app)
  A application is named after its job and its applicant name.

Mark filled
  For a job that is open; sets status to filled.

Close job
  For a job that is open; sets status to closed.

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
  - member (A union member who browses jobs and applies for them): opens the home page, the jobs page, the my applications page and the privacy page; sees everyone's jobs; adds applications
  - steward (Union staff who post jobs and handle the applications): opens the home page, the jobs page, the applications page and the privacy page; sees everyone's jobs and applications; adds jobs; changes everyone's jobs and applications; deletes everyone's jobs; runs every custom action
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where status is open.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can people see without signing in? Open jobs are public; signing in is only needed to apply. (or: Everything requires sign-in, so only members see the jobs, Visitors can also see filled and closed jobs)
  Who can create an account and apply? Anyone can sign up with their email and apply, giving a member number if they have one. (or: Only people invited by the union can sign in, Only addresses on the union's email domain can sign up)
  Who posts jobs and handles applications? Union stewards post jobs and review every application; employers have no accounts. (or: Employers sign in and post their own jobs and see their own applicants, Only administrators post jobs and review applications)
  What does an application hold? Name, email, phone, member number, cover note and an optional resume, with one application per person per job. (or: Just a name and contact details, Also a list of certifications and years of experience)
Frontier model (claude-opus-5-5) · 4,146 tokens (1,981 in, 2,165 out) · $0.0591
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 160 files (160 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-70GSvF/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Our Football Club
  The club's public site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Teams (lists teams; search by name or coach; filter by age group)
  - Players (lists players; search by name; filter by team or position)
  - Matches (lists matches; search by opponent or ground; filter by team, status or venue; “Record result”)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Staff (who has access: invite people, change roles, remove users; only for admins)

Teams
  Teams have:
  - a name (required)
  - an age group (senior, youth or veterans, senior by default)
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
  - about

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - a kickoff (a date and time, required)
  - a venue (home or away, home by default)
  - a ground
  - status (scheduled, played or postponed, scheduled by default)
  - a goals for (a whole number, required when status is played)
  - a goals against (a whole number, required when status is played)
  - a report
  A match is named after its team and its opponent.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the goals for and the goals against.
  Enter the final score of a match and mark it as played.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Keeps the club's teams, players, matches and results up to date): opens the home page, the teams page, the players page and the matches page; adds teams, players and matches; changes everyone's teams, players and matches; deletes everyone's teams, players and matches
  New users get the staff role.
  Open to anyone without signing in: the home page, the teams page, the players page, the matches page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who signs in to the site? Only invited club staff, who keep the teams, players, matches and results up to date (or: Only one administrator, Coaches, who update only their own team, Anyone can join as a club member)
  What can visitors see without signing in? All teams, players, matches and results (or: Teams and matches only, with players after sign-in, Senior teams only, with youth teams hidden, Everything, plus a contact form for visitors)
  What should a player's public profile show? Name, team, shirt number, position, photo and a short text, with no contact details or birth date (or: Name, team and position only, with no photo, Also add date of birth, height and nationality, Also add season stats such as goals and appearances)
  How are match results recorded? Staff enter the final score for each match, without goalscorers or league tables (or: Also record goalscorers and cards for each match, Also add league tables with points and standings, Also organise matches by season and competition)
Frontier model (claude-opus-5-5) · 4,142 tokens (2,136 in, 2,006 out) · $0.0572
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 156 files (156 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-70GSvF/app-7/smithable.auth.yml:12:5  warning  staff may change others' Team, Player, Match it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "write".
/tmp/smithable-bench-m12-70GSvF/app-7/smithable.auth.yml:13:5  warning  staff may delete others' Team, Player, Match it cannot read: with private access a role reads only its own records unless granted "read".
    hint: Grant staff "read" on them too, or drop the "delete".
/tmp/smithable-bench-m12-70GSvF/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Registration
  The programme of a conference, its speakers, and registration for its talks.

Pages
  - Home (a landing page: hero, features, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month; filter by speaker)
  - My registrations (lists registrations; only the viewer's own records; only for members and admins)
  - Talks (lists talks; filter by speaker or starts at; only for staff users and admins)
  - Speakers (lists speakers)
  - Attendees (lists registrations; filter by talk; only for staff users and admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)
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
  - a capacity (a whole number, required, 100 by default)
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
  - staff (The conference team. Runs the programme, the speakers and who attends): opens the schedule page, the talks page, the speakers page and the attendees page; sees everyone's talks, speakers and registrations; adds talks, speakers and registrations; changes everyone's talks, speakers and registrations; deletes everyone's registrations
  - member (An attendee who registers for talks): opens the my registrations page; adds registrations
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What does an attendee register for? Individual talks, each with a limited number of places (or: The conference as a whole, with one registration per person, The conference as a whole, plus individual talks)
  What can people see without signing in? The schedule and the speakers are public; signing in is only needed to register (or: Everything requires signing in, Only a landing page is public)
  Who runs the conference in the app? Administrators and an invited staff role manage talks, speakers and attendees; anyone else who signs in is an attendee (or: Administrators only, with no staff role, Speakers also sign in and edit their own talks)
  How many conferences does the app handle? One conference, so talks need no event to belong to (or: Several conferences, each with its own talks and speakers)
Frontier model (claude-opus-5-5) · 3,608 tokens (1,810 in, 1,798 out) · $0.0504
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-70GSvF/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Where an IT team tracks its tickets, their priorities and who handles them.

Pages
  - Cases (lists tickets; search by subject or requester email; filter by status, priority (1 = most urgent) or assignee; sort by priority (1 = most urgent) or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email (required, fixed once made)
  - status (open, in progress, closed or reopened, open by default)
  - a priority (1 = most urgent) (a whole number, required, 3 by default)
  - a description
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
  - agent (Handles the tickets, takes them and passes them on): opens the cases page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who signs in to the help desk? Only the IT team, invited from the team page; the person with the problem is recorded by email address on the ticket (or: Employees also sign in to raise and follow their own tickets, Anyone with a company email address can sign in)
  How do tickets get into the help desk? The IT team enters them by hand (or: Mail to a support address becomes a ticket, Employees fill in a form themselves)
  How are priorities expressed? A number from 1 to 5, where 1 is the most urgent and the list shows the most urgent first (or: Named levels: low, normal, high, urgent, Priority set by impact and urgency together)
  What is written under a ticket as it is worked on? Notes from the team, shown as a conversation on the ticket and not sent to anyone (or: Replies mailed to the requester, Both internal notes and replies mailed to the requester)
Frontier model (claude-opus-5-5) · 3,322 tokens (1,808 in, 1,514 out) · $0.0447
Pictures from the Smithable image library: logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Recipes
  A family's shared recipe collection, with each recipe's ingredients and shopping lists for the next trip to the store.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category)
  - Shopping lists (lists shopping lists; filter by status; “Mark done”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a photo (picture)
  - a category (dinner, breakfast, lunch, dessert, baking or other, dinner by default)
  - a summary
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - instructions (formatted text)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required)
  - an amount
  - a recipe (a recipe, required)

Shopping lists
  Shopping lists have:
  - a name (required)
  - status (active or done, active by default)
  Each shopping list lists its shopping items.

Shopping items
  Shopping items have:
  - a name (required)
  - an amount
  - bought (yes or no, false by default)
  - a shopping list (a shopping list, required)
  - a recipe (a recipe)

Mark done
  For a shopping list that is active; sets status to done.
  Close a shopping list once the shopping is finished.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; changes everyone's records; deletes everyone's ingredients, shopping lists and shopping items
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should the recipes be visible to people outside the family? No, the whole app is private and family members are invited (or: Recipes are public and only the shopping lists are private, Anyone can sign up and keep their own recipes)
  What may each family member change? Everyone can add and edit all recipes and lists, but only a recipe's creator or an administrator can delete it (or: Everyone can also delete any recipe, Only parents can change recipes; everyone else can only view them and use the lists, People can only change what they added themselves)
  How do items get onto a shopping list? Family members type them into the list, and can note which recipe each item is for (or: A button adds all of a recipe's ingredients to a list, Plan a week's meals and build the list from the plan)
  What does a recipe hold? Name, photo, category, short summary, servings, time in minutes, instructions and its ingredients with amounts (or: Also the source or a link to the original recipe, Also ratings and comments from the family, Also tags, such as vegetarian or gluten-free)
Frontier model (claude-opus-5-5) · 4,841 tokens (2,214 in, 2,627 out) · $0.0702
Pictures from the Smithable image library: logo.webp.
Generated 151 files (151 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. A status page for our API, with incidents and planned maintenance.

```text
API Status
  The live state of our API, its incidents and its planned maintenance.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, maintenances, incidents where status is resolved and footer)
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
  The incident is over, with an update saying so. The component's state stays what the team sets.

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
  What can visitors see without signing in? The status page and incident history: components, incidents with their updates, and planned maintenance (or: Only current status and open incidents, Everything, but only for signed-in customers)
  Who signs in, and what do they do? An invited team: staff write incidents, updates and maintenance; administrators also manage components and the team (or: One role where everyone can do everything, Anyone may sign up and subscribe to updates)
  How is the API's status broken down? Into components (such as authentication or payments), each with its own status set by the team (or: One overall status for the whole API, Status worked out automatically from a monitoring tool)
  Should the team or visitors be told by mail about incidents? No mail for now: people read the status page (or: Mail the team when an incident is opened, Let visitors subscribe to incident mail)
Frontier model (claude-opus-5-5) · 5,178 tokens (2,365 in, 2,813 out) · $0.0752
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 161 files (161 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-70GSvF/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the web shop working? The state of its services, its outages and their updates, live.

Pages
  - Home (a landing page: hero, services, outages where status is investigating or identified or monitoring, outages where status is resolved and footer)
  - Outages (lists outages; filter by status or service; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists updates)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Overview (a dashboard: open, per month and latest)
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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
  Each outage lists its updates.

Updates
  Updates have:
  - an outage (an outage, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Identified
  For an outage that is investigating; sets status to identified; adds an update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the outage moves to identified, with an update saying so.

Monitoring
  For an outage that is investigating or identified; sets status to monitoring; adds an update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the outage is watched before it is closed, with an update saying so.

Resolve
  For an outage that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an update (at now, status resolved, message This outage is resolved.).
  The outage is over, with an update saying so. The service's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes outages and their updates): opens the overview page, the incidents page and the updates page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents where status is investigating or identified or monitoring or resolved and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can visitors see without signing in? Each service's status, current and past outages, and their updates (or: Only each service's current status, Current status and open outages, without the history)
  Who writes the outages and updates? An invited team: staff write outages and updates, admins also keep the services and the team (or: One administrator does everything, Everyone on the team has the same rights)
  How does a service's status and uptime get updated? The team sets statuses and opens outages by hand (or: A monitoring tool opens outages automatically, Also show uptime percentages per service, worked out by custom code)
  Should the page also announce planned maintenance? No, only services, outages and their updates (or: Yes, add a list of planned maintenance)
Frontier model (claude-opus-5-5) · 3,953 tokens (2,126 in, 1,827 out) · $0.0535
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 155 files (155 changed, 0 removed).

Created /tmp/smithable-bench-m12-70GSvF/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-70GSvF/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-70GSvF/app-12/smithable.content.yml:22:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
