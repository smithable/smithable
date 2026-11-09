# M12 first builds: claude-code (2026-11-09)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). Totals: 12 / 12 created, 12 type-check, 925,572 tokens (890,867 in, 34,705 out), $1.6205 (as Claude Code reports it); 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| A booking site for a yoga studio, with classes, teachers and online booking. | booking | yes | yes | 69,827 | 3,711 | $0.6328 | 0 | – | 69 s |
| A CRM for a small sales team: companies, contacts, deals and follow-ups. | crm | yes | yes | 68,532 | 3,066 | $0.0929 | 0 | – | 62 s |
| Invoicing for freelancers, with clients, invoices and payments. | invoicing | yes | yes | 138,882 | 5,189 | $0.1814 | 0 | – | 80 s |
| A tool library where neighbors lend each other tools. | marketplace | yes | yes | 67,731 | 2,464 | $0.0744 | 0 | – | 51 s |
| An inventory app for a small bakery: ingredients, suppliers and stock levels. | records | yes | yes | 67,484 | 1,446 | $0.0521 | 0 | – | 42 s |
| A job board for a local union, with job posts and applications. | marketplace | yes | yes | 67,733 | 3,794 | $0.1010 | 0 | – | 66 s |
| A football club's site: teams, players, matches and results. | records | yes | yes | 67,473 | 2,653 | $0.0761 | 0 | – | 63 s |
| Event registration for a conference: talks, speakers and attendees. | booking | yes | yes | 69,823 | 3,066 | $0.1032 | 0 | – | 58 s |
| A help desk for an IT team: tickets, priorities and who handles them. | support | yes | yes | 68,210 | 1,675 | $0.0625 | 0 | – | 43 s |
| A recipe collection for a family, with ingredients and shopping lists. | records | yes | yes | 67,479 | 1,895 | $0.0610 | 0 | – | 49 s |
| A status page for our API, with incidents and planned maintenance. | status | yes | yes | 68,845 | 2,997 | $0.0940 | 0 | – | 59 s |
| A public uptime page for a web shop: which services work, outages and their updates. | status | yes | yes | 68,848 | 2,749 | $0.0891 | 0 | – | 52 s |

Each created app's four spec files are in [m12-first-builds-claude-code/](m12-first-builds-claude-code/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 12 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | booking | 3 | 5 / 6 (has 5) | 9 / 13 (has 9) | 0 / 1 (has 0) | private; admin, staff, member (member) | none | pages home, schedule, privacy; read ClassType, Instructor, Session; create Message | 1 (operator-unknown) | none |  | none | 3 / 5 | mentions visitors; landing page |
| 2 | crm | 2 | 1 / 3 (has 4) | 3 / 5 (has 6) | 0 / 2 (has 4) | shared; admin, sales (sales) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 3 | invoicing | 3 | 3 / 4 (has 4) | 5 / 7 (has 6) | 3 / 3 (has 3) | private; admin, member (member) | none | pages home, privacy; read none; create none | 1 (operator-unknown) | none |  | none | 3 / 4 | no mention; landing page |
| 4 | marketplace (words: records) | 3 | 0 / 1 (has 2) | 3 / 5 (has 6) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, catalog, privacy; read Tool; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 5 | records (words: api) | 3 | 0 / 1 (has 2) | 0 / 2 (has 3) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 6 | marketplace | 3 | 0 / 1 (has 2) | 1 / 5 (has 6) | 0 / 0 (has 4) | private; admin, staff, member (member) | none | pages home, jobs, privacy; read Job; create none | 1 (operator-unknown) | none |  | none | 0 / 2 | no mention; landing page |
| 7 | records (words: booking) | 3 | 0 / 1 (has 3) | 1 / 2 (has 5) | 0 / 0 (has 1) | private; admin, member (member) | none | pages home, matches, teams, players, privacy; read Team, Player, Match; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | mentions visitors; landing page |
| 8 | booking (words: records) | 3 | 0 / 6 (has 3) | 4 / 13 (has 8) | 0 / 1 (has 0) | private; admin, organizer, attendee (attendee) | none | pages home, schedule, speakers, privacy; read Talk, Speaker; create none | 1 (operator-unknown) | none |  | none | 0 / 3 | no mention; landing page |
| 9 | support (words: booking) | 3 | 1 / 2 (has 2) | 1 / 2 (has 2) | 5 / 5 (has 5) | shared; admin, agent (agent) | none | pages none; read none; create none | 0 | none |  | none | 0 / 2 | no mention; no landing page |
| 10 | records | 3 | 0 / 1 (has 4) | 0 / 2 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page |
| 11 | status | 3 | 4 / 4 (has 4) | 7 / 8 (has 8) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 1 (operator-unknown) | none |  | none | 4 / 4 | no mention; landing page |
| 12 | status | 2 | 3 / 4 (has 3) | 6 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home, privacy; read Component, Incident, IncidentUpdate; create none | 1 (operator-unknown) | none |  | none | 3 / 3 | mentions visitors; landing page |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English.
<!-- /scorecard -->

## Summaries, for review

### 1. A booking site for a yoga studio, with classes, teachers and online booking.

```text
Lotus Flow Yoga
  Class schedule, teachers and online booking for a yoga studio.

Pages
  - Home (a landing page: hero, class types, instructors, faq, call to action, contact and footer)
  - Schedule (a calendar of sessions by week or month; filter by classType or instructor)
  - My bookings (lists bookings; only for members and admins)
  - Sessions (lists sessions; filter by class type, instructor or starts at; sort by starts at or capacity; only for staff users and admins)
  - Bookings (lists bookings; only for staff users and admins)
  - Class types (lists class types; filter by level; only for admins; visitors see class types on the Home page)
  - Instructors (lists instructors; only for admins; visitors see instructors on the Home page)
  - Messages (lists messages; only for staff users and admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

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

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Reception. Runs the day, the sessions and who comes to them, and reads the messages): opens the schedule page, the sessions page, the bookings page and the messages page; sees everyone's sessions, bookings and messages; adds sessions and bookings; changes everyone's sessions and bookings; deletes everyone's bookings
  - member (A student who books classes): opens the schedule page and the my bookings page; adds bookings
  New users get the member role.
  Open to anyone without signing in: the home page, the schedule page, the privacy page, reading class types, reading instructors, reading sessions and adding messages.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who may create an account to book classes? Anyone can sign up with their email address and book (or: Only people the studio invites, Only members with a paid pass)
  What can visitors see without signing in? The home page, the class schedule, the class types and the teachers (or: Only the home page, Everything except bookings and messages, including a blog)
  Who runs the studio in the app? The owner as admin, plus a reception role that manages sessions and bookings (or: Only the owner manages everything, Teachers also sign in and see their own classes)
  Should the site include a blog or news? No blog for now; the home page shows classes, teachers, questions and a contact form (or: Add a blog with studio news, Add an about page with the studio's story)
Frontier model (claude-opus-5-5) · 4,279 tokens (2,101 in, 2,178 out) · $0.0604
Pictures from the Smithable image library: samples/instructor-1.webp, samples/instructor-2.webp, samples/instructor-3.webp, samples/instructor-4.webp, samples/instructor-5.webp, samples/instructor-6.webp, hero.webp, logo.webp.
Generated 192 files (192 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-1. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-1
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7OttLD/app-1/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 2. A CRM for a small sales team: companies, contacts, deals and follow-ups.

```text
Pipeline
  A simple CRM where a small sales team keeps track of companies, contacts, deals and follow-ups.

Pages
  - Companies (lists companies; search by name or industry; sort by name or date added)
  - Contacts (lists contacts; search by name, email or job title; filter by company)
  - Deals (lists deals; search by title; filter by stage or company; sort by expected close, value or title; “Win deal”; “Lose deal”)
  - Follow ups (lists follow ups; search by note; filter by done, assigned to or company; “Mark done”; “Take follow up”)
  - Start (a dashboard: open deals, pipeline value, deals by stage and follow ups due)
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
  - a stage (lead, qualified, proposal, negotiation, won or lost, lead by default)
  - a value (an amount)
  - an expected close (a date)
  - closed on (a date, filled by the app)
  - notes
  Deleted deals stay in the trash for thirty days, where they can be restored.

Follow ups
  Follow ups have:
  - a company (a company, required)
  - a deal (a deal)
  - a contact (a contact)
  - due on (a date, required, today by default)
  - done (yes or no)
  - a note
  Each follow up can have an assigned to (a user).

Win deal
  For a deal that is lead, qualified, proposal or negotiation; sets stage to won and closed on to today.

Lose deal
  For a deal that is lead, qualified, proposal or negotiation; sets stage to lost and closed on to today.

Mark done
  For a follow up that is not done; sets done to yes.

Take follow up
  For a follow up that is not done; sets assigned to to whoever presses it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - sales (Works with companies, contacts, deals and follow-ups): opens the start page, the companies page, the contacts page, the deals page and the follow ups page; adds every kind of record; changes everyone's records
  New users get the sales role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Which currency and time zone does the team work in? Euros, Central European time (Stockholm) (or: US dollars, New York time, Pounds, London time, Swedish kronor, Stockholm time)
  May every salesperson change the whole team's records? Yes: everyone sees and edits all records, but only admins and the record's owner may delete (or: Each salesperson edits only their own companies and deals, Everyone may also delete any record)
  Who may sign in? Only colleagues invited from the team page (or: Anyone with an address on the company's email domain, Anyone who signs up)
  What does a deal go through? Lead, qualified, proposal, negotiation, then won or lost (or: Open, won or lost only, A pipeline of your own stages)
Frontier model (claude-opus-5-5) · 5,290 tokens (2,417 in, 2,873 out) · $0.0768
Pictures from the Smithable image library: logo.webp.
Generated 182 files (182 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-2. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-2
  smithable studio

or only run the app with smithable run.
```

### 3. Invoicing for freelancers, with clients, invoices and payments.

```text
Ledgerly
  Invoicing for freelancers: keep your clients, send invoices and record the payments that come in.

Pages
  - Home (a landing page: hero, features, faq, call to action and footer)
  - Clients (lists clients; search by name or email)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Invoices (lists invoices; search by number; filter by client or status; sort by issued on, due on or number; “Mark sent”; “Mark paid”; “Mark overdue”)
  - Payments (lists payments; filter by invoice, method or paid on)
  - Overview (a dashboard: outstanding, overdue, received and latest)

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
  Each invoice lists its invoice lines.
  Each invoice lists its payments.
  The total is calculated as the total amount of its lines.
  The paid amount is calculated as the total amount of its payments.
  The balance is calculated as the total minus the paid amount.

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

Mark overdue
  For an invoice that is sent; sets status to overdue.
  The invoice is late.

Invoice sent
  When “Mark sent” runs on a invoice: mails client's email.

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
Frontier model (claude-opus-5-5) · 5,134 tokens (2,318 in, 2,816 out) · $0.0749
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 180 files (180 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7OttLD/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A tool library where neighbors lend each other tools.

```text
Toolshare
  Neighbors lend each other tools instead of each buying their own.

Pages
  - Catalog (lists tools; search by title, description or place; filter by category, condition or available; records can be saved as favorites; contact the owner by mail)
  - My tools (lists tools; only the viewer's own records)
  - Loans (lists loans; filter by status or until; “Mark returned”)
  - Saved (lists tools; only the viewer's saved records)
  - Home (a landing page: hero, features, faq and footer)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Tools
  Tools have:
  - a title (required)
  - photos (pictures)
  - a description (required)
  - a category (power, garden, hand, ladders, cleaning or other, power by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)

Loans
  Loans have:
  - a tool (a tool, required)
  - a date (from, required)
  - a date (until, required)
  - status (borrowed or returned, borrowed by default)
  - a note

Mark returned
  For a loan that is borrowed; sets status to returned.
  Mark a borrowed tool as given back to its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading tools.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 3,199 tokens (1,877 in, 1,322 out) · $0.0414
Pictures from the Smithable image library: samples/tool-1.webp, samples/tool-2.webp, samples/tool-3.webp, samples/tool-4.webp, samples/tool-5.webp, samples/tool-6.webp, hero.webp, logo.webp.
Generated 164 files (164 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-4. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-4
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7OttLD/app-4/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 5. An inventory app for a small bakery: ingredients, suppliers and stock levels.

```text
Bakery Stock
  Keeps track of a small bakery's ingredients, their suppliers and how much of each is in stock.

Pages
  - Ingredients (lists ingredients; search by name or notes; filter by category, supplier, storage or in stock)
  - Suppliers (lists suppliers; search by name, contact person or email)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Suppliers
  Suppliers have:
  - a name (required)
  - a contact person
  - an email
  - a phone
  - a website (a web address)
  - notes
  Each supplier lists its ingredients.

Ingredients
  Ingredients have:
  - a name (required, unique)
  - a category (flour, sugar, dairy, eggs, fats, yeast, flavorings, fruit and nuts, packaging or other, flour by default)
  - a supplier (a supplier)
  - a unit (kg, g, l, ml, pieces or packs, kg by default)
  - an in stock (a number, required, 0 by default)
  - a reorder level (a number)
  - a unit price (an amount)
  - a storage (dry, fridge or freezer, dry by default)
  - last counted on (a date, today by default)
  - notes

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who uses the app? The bakery's staff, invited by an administrator, all working on the same stock list (or: Only the owner, Each person keeps their own list)
  How are stock levels kept up to date? Each ingredient holds its current amount, a reorder level and the date it was last counted, edited by hand (or: Record every delivery and use as separate entries, Also keep a history of stock counts)
  Which currency are prices in? Euro (or: Swedish krona, US dollar, No prices)
Frontier model (claude-opus-5-5) · 3,959 tokens (2,104 in, 1,855 out) · $0.0539
Pictures from the Smithable image library: logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-5. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-5
  smithable studio

or only run the app with smithable run.
```

### 6. A job board for a local union, with job posts and applications.

```text
Local 214 Jobs
  The union's job board: staff post openings and members apply for them.

Pages
  - Home (a landing page: hero, jobs where open is yes, features, faq and footer)
  - Jobs (lists jobs; search by title, employer, location or description; filter by trade, type, open or closes on; “Close job”)
  - My applications (lists applications; only the viewer's own records)
  - Applications (lists applications; search by name or member number; filter by job or status; only for staff users and admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Jobs
  Jobs have:
  - a title (required)
  - an employer (required)
  - a trade (carpentry, electrical, plumbing, laborer, operator or other, carpentry by default)
  - a type (full time, part time, temporary or apprenticeship, full time by default)
  - a location
  - a pay
  - a description (required)
  - starts on (a date)
  - closes on (a date)
  - open (yes or no, true by default)
  Each job lists its applications.

Applications
  Applications have:
  - a job (a job, required, unique per owner)
  - a name (required)
  - a phone (required)
  - a member number
  - a message
  - a resume (a document)
  - status (submitted, shortlisted, accepted or declined, submitted by default, filled by the app)

Shortlist
  For an application that is submitted; sets status to shortlisted.

Accept
  For an application that is submitted or shortlisted; sets status to accepted.

Decline
  For an application that is submitted or shortlisted; sets status to declined.

Close job
  For a job that is open; sets open to no.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - staff (Union staff who post jobs and handle applications): opens every page; sees everyone's jobs and applications; adds jobs; changes everyone's jobs and applications; deletes everyone's jobs
  - member (Union members who browse jobs and apply): opens the jobs page and the my applications page; sees everyone's jobs; adds applications
  New users get the member role.
  Open to anyone without signing in: the home page, the jobs page, the privacy page and reading jobs where open is yes.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who posts the jobs? Union staff post jobs and handle applications; members apply (or: Employers sign in and post their own jobs, Any member may post a job)
  Can people who are not signed in see the jobs? Yes, open jobs are public; applying needs sign-in (or: Only signed-in members see jobs)
  Who may sign up? People invited by the union staff (or: Anyone with an email address, Only addresses on the union's email domain)
  What does an application hold? Name, phone, member number, a message and a resume file (or: Just a message, Name and phone only)
Frontier model (claude-opus-5-5) · 4,050 tokens (2,033 in, 2,017 out) · $0.0566
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 171 files (171 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-6. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-6
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7OttLD/app-6/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 7. A football club's site: teams, players, matches and results.

```text
Club Pitch
  The football club's public site with its teams, players, fixtures and results.

Pages
  - Home (a landing page: hero, matches where status is scheduled, matches where status is played, teams and footer)
  - Matches (lists matches; search by opponent or competition; filter by team, status, venue or kickoff at; “Record result”)
  - Teams (lists teams)
  - Players (lists players; search by name; filter by team or position)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Teams
  Teams have:
  - a name (required, unique)
  - an age group (senior, youth, junior or veterans, senior by default)
  - a league
  - a coach
  - a photo (picture)
  - about
  Each team lists its players.
  Each team lists its matches.

Players
  Players have:
  - a name (required)
  - a team (a team, required)
  - a shirt number (a whole number)
  - a position (goalkeeper, defender, midfielder or forward, goalkeeper by default)
  - a photo (picture)
  - a bio

Matches
  Matches have:
  - a team (a team, required)
  - an opponent (required)
  - kickoff at (a date and time, required)
  - a venue (home or away, home by default)
  - a ground
  - a competition
  - status (scheduled, played, postponed or cancelled, scheduled by default)
  - an our score (a whole number)
  - a their score (a whole number)
  - a report
  A match is named after its team, its opponent and its kickoff at.

Record result
  For a match that is scheduled or postponed; sets status to played; asks for the our score and the their score.
  Enter the final score once a match has been played.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page
  New users get the member role.
  Open to anyone without signing in: the home page, the matches page, the teams page, the players page, the privacy page, reading teams, reading players and reading matches.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Who keeps the teams, players and matches up to date? Only the club's administrators; everyone else just looks (or: Each team's coach updates their own team, Any signed-in club member)
  What can visitors see without signing in? Teams, players, fixtures and results are all public (or: Only fixtures and results; player profiles need sign-in, Senior teams public, youth teams for members only)
  Which time zone are kick-off times in? Europe/London (or: Europe/Stockholm, Europe/Mariehamn, America/New_York)
  What does a match record hold? Team, opponent, kick-off, home or away, ground, competition, status, score and a short report (or: Also goal scorers and line-ups, Just date, opponent and score)
Frontier model (claude-opus-5-5) · 4,798 tokens (2,201 in, 2,597 out) · $0.0695
Pictures from the Smithable image library: samples/team-1.webp, samples/team-2.webp, samples/team-3.webp, samples/player-1.webp, hero.webp, logo.webp.
Generated 167 files (167 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7OttLD/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. Event registration for a conference: talks, speakers and attendees.

```text
Conference Hub
  Programme, speakers and talk registration for a conference.

Pages
  - Home (a landing page: hero, features, speakers, faq, call to action and footer)
  - Schedule (a calendar of talks by week or month)
  - My registrations (lists registrations; only for attendees and admins)
  - Talks (lists talks; filter by speaker or starts at; only for organizers and admins)
  - Speakers (lists speakers)
  - Registrations (lists registrations; filter by talk; only for organizers and admins)
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
  - organizer (Runs the programme: talks, speakers and who registers for them): opens the talks page, the speakers page and the registrations page; sees everyone's talks, speakers and registrations; adds talks, speakers and registrations; changes everyone's talks, speakers and registrations; deletes everyone's talks, speakers and registrations
  - attendee (Someone at the conference who registers for talks): opens the my registrations page; adds registrations
  New users get the attendee role.
  Open to anyone without signing in: the home page, the schedule page, the speakers page, the privacy page, reading talks and reading speakers.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What does an attendee register for: the whole conference or individual talks? Individual talks, each with a limited number of seats (or: A single ticket for the whole conference, Both a conference ticket and talk seats)
  What can visitors see without signing in? The schedule of talks and the speakers (or: Nothing; everything needs sign-in, Also who is registered for each talk)
  Who signs in? Organizers who run the programme, and attendees who sign up themselves (or: Only invited attendees, Speakers also sign in to edit their own talks)
  Are attendees told by email when they register? No emails for now (or: A confirmation when they register, A reminder the day before the talk)
Frontier model (claude-opus-5-5) · 3,583 tokens (1,806 in, 1,777 out) · $0.0500
Pictures from the Smithable image library: samples/speaker-1.webp, hero.webp, logo.webp.
Generated 186 files (186 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-8
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7OttLD/app-8/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 9. A help desk for an IT team: tickets, priorities and who handles them.

```text
IT Help Desk
  Tickets for the IT team: what is wrong, how urgent it is and who handles it.

Pages
  - Tickets (lists tickets; search by subject or requester email; filter by status, priority or assignee; sort by priority or date added; “Assign to me”; “Assign to”; “Start work”; “Close”; “Reopen”)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Tickets
  Tickets have:
  - a subject (required)
  - a requester email
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
  Each message can have an author (a user, who makes it, by default, filled by the app).

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
  The problem is solved.

Reopen
  For a ticket that is closed; sets status to reopened.
  The ticket needs more work after all.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - agent (Works on the tickets, takes them and passes them on): opens the tickets page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the agent role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 3,277 tokens (1,754 in, 1,523 out) · $0.0445
Pictures from the Smithable image library: logo.webp.
Generated 162 files (162 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-9. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-9
  smithable studio

or only run the app with smithable run.
```

### 10. A recipe collection for a family, with ingredients and shopping lists.

```text
Family Cookbook
  The family's recipes with their ingredients, and the shopping lists made from them.

Pages
  - Recipes (lists recipes; search by name or summary; filter by category or favorite)
  - Shopping lists (lists shopping lists; filter by status or shop on; “Mark done”)
  - Family (who has access: invite people, change roles, remove users; only for admins)

Recipes
  Recipes have:
  - a name (required)
  - a picture
  - a summary
  - a category (main, starter, side, dessert, baking, breakfast or drink, main by default)
  - servings (a whole number, 4 by default)
  - minutes (a whole number)
  - instructions (formatted text)
  - a source (a web address)
  - favorite (yes or no)
  Each recipe lists its ingredients.

Ingredients
  Ingredients have:
  - a recipe (a recipe, required)
  - a name (required)
  - a quantity
  - a note

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
  - a recipe (a recipe)
  - bought (yes or no)

Mark done
  For a shopping list that is open; sets status to done.
  Close a shopping list once everything on it is bought.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member (A family member: adds and changes recipes and shopping lists): opens every page; adds every kind of record; changes everyone's records
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  Should anyone outside the family see the recipes? No, the cookbook is private and family members are invited (or: Recipes are public, shopping lists private, Anyone may sign up)
  Who may change a recipe or shopping list? Every family member may change everyone's recipes and lists (or: Each person changes only their own recipes, Only parents change recipes)
  How are ingredients put on a shopping list? Added by hand to the list, optionally noting the recipe they are for (or: Copied automatically from a chosen recipe, One shopping list per recipe)
Frontier model (claude-opus-5-5) · 4,804 tokens (2,287 in, 2,517 out) · $0.0686
Pictures from the Smithable image library: logo.webp.
Generated 166 files (166 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-10
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
  The incident is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents, their updates and planned maintenance): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents where status is investigating or identified or monitoring or resolved, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-opus-5-5) · 4,787 tokens (2,366 in, 2,421 out) · $0.0673
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 179 files (179 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-11
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7OttLD/app-11/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 12. A public uptime page for a web shop: which services work, outages and their updates.

```text
Shop Status
  Is the shop working? The state of our web shop's services, outages and their updates, live.

Pages
  - Home (a landing page: hero, components, incidents where status is investigating or identified or monitoring, incidents where status is resolved and footer)
  - Incidents (lists incidents; filter by status or component; “Identified”; “Monitoring”; “Resolve”)
  - Updates (lists incident updates)
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

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is out. We are watching before we close this.).
  A fix is out; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved.).
  The outage is over, with an update saying so.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes outages and their updates): opens the overview page, the incidents page and the updates page; adds every kind of record; changes everyone's records
  New users get the staff role.
  Open to anyone without signing in: the home page, the privacy page, reading components, reading incidents and reading incident updates.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.

Assumed:
  What can visitors see without signing in? The status page, the outage history, each service's status and every outage with its updates (or: Only the services' current status, Ongoing outages only, not the history)
  Who writes outages and updates? Invited staff report outages and post updates; admins also manage the services and the team (or: Admins only, Every team member manages everything)
  Should the page also announce planned maintenance? No, only services, outages and their updates (or: Yes, add a list of planned maintenance)
Frontier model (claude-opus-5-5) · 3,938 tokens (2,113 in, 1,825 out) · $0.0534
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 171 files (171 changed, 0 removed).

Created /tmp/smithable-bench-m12-7OttLD/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-7OttLD/app-12
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-7OttLD/app-12/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```
