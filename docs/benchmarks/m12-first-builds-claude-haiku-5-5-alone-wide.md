# M12 first builds: claude-haiku-5-5, the second set (2026-10-27)

The app descriptions, each started with `smithable new --describe … --yes` (the starter the first step picks, adapted by the model; errors go back up to four times). The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported. Totals: 11 / 24 created, 11 type-check, 714,996 tokens (617,269 in, 97,727 out), $0.0745; 0 model calls answered from the response cache. *Rounds* counts the model's drafting calls: the first draft and each round of corrections after it.

| Description | Starter | Created | Type-checks | Tokens in | Tokens out | Cost | Cached calls | Rounds | Time |
|---|---|---|---|---|---|---|---|---|---|
| My clients as a freelance translator: who they are, what I quoted and what they paid. | invoicing | **no** | **no** | 26,031 | 2,866 | $0.0046 | 0 | – | 60 s |
| A sales pipeline for our six-person web agency: leads, deals and who follows up when. | crm | **no** | **no** | 25,774 | 2,668 | $0.0017 | 0 | – | 39 s |
| Online booking for a hair salon: customers pick a stylist and a free time themselves. | barbers | yes | yes | 25,904 | 5,490 | $0.0031 | 0 | – | 437 s |
| A piano teacher's lessons: my pupils, their weekly times and what each one practises. | booking | **no** | **no** | 27,087 | 2,505 | $0.0046 | 0 | – | 36 s |
| Invoices for my photography work: clients, shoots and what is still unpaid. | invoicing | **no** | **no** | 26,030 | 4,948 | $0.0029 | 0 | – | 42 s |
| Our cleaning company of three sends invoices to households every month; we need one place for them. | invoicing | **no** | **no** | 26,031 | 3,685 | $0.0022 | 0 | – | 46 s |
| A town flea market site where anyone can post things to sell, with photos and a price. | marketplace | yes | yes | 25,310 | 3,837 | $0.0022 | 0 | – | 377 s |
| A swap shelf for our office: colleagues offer things they no longer need and others claim them. | marketplace | yes | yes | 25,314 | 2,278 | $0.0043 | 0 | – | 321 s |
| My vinyl record collection: albums, artists, condition and what I paid. | records | **no** | **no** | 25,102 | 1,827 | $0.0040 | 0 | – | 23 s |
| Our local museum's collection online, so visitors can browse the objects and their stories. | records | yes | yes | 25,104 | 2,210 | $0.0014 | 0 | – | 232 s |
| An internal status board for our IT systems, so staff see what is down and when it is back. | status | yes | yes | 26,250 | 3,842 | $0.0023 | 0 | – | 257 s |
| Service status for our municipality's online services, for residents to check outages. | status | yes | yes | 26,245 | 5,296 | $0.0031 | 0 | – | 308 s |
| A log of my car's fuel, service visits and costs. | records | **no** | **no** | 25,096 | 2,433 | $0.0043 | 0 | – | 21 s |
| The guest list and seating plan for our wedding, with who has answered and their meal choices. | records | **no** | **no** | 25,106 | 3,758 | $0.0022 | 0 | – | 35 s |
| Bird sightings for our birdwatching club: species, place, date and who saw it. | records | yes | yes | 25,105 | 1,543 | $0.0011 | 0 | – | 155 s |
| Our allotment society: who has which plot, the waiting list and the yearly fee. | records | yes | yes | 25,105 | 2,966 | $0.0018 | 0 | – | 280 s |
| Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet. | barbers | **no** | **no** | 25,956 | 6,609 | $0.0037 | 0 | – | 43 s |
| Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor. | invoicing | **no** | **no** | 26,086 | 8,752 | $0.0048 | 0 | – | 54 s |
| En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris. | marketplace | yes | yes | 25,368 | 2,679 | $0.0017 | 0 | – | 340 s |
| Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa. | booking | **no** | **no** | 27,058 | 8,084 | $0.0074 | 0 | – | 50 s |
| Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa. | crm | **no** | **no** | 25,748 | 6,626 | $0.0037 | 0 | – | 41 s |
| Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten. | kiosk | **no** | **no** | 25,971 | 9,446 | $0.0051 | 0 | – | 54 s |
| A backend for my habit app: habits, daily check-ins and streaks. | records | yes | yes | 25,102 | 1,781 | $0.0012 | 0 | – | 153 s |
| Somewhere my AI assistant keeps my tasks and notes, by project. | api | yes | yes | 25,386 | 1,598 | $0.0011 | 0 | – | 129 s |

Each created app's four spec files are in [m12-first-builds-claude-haiku-5-5-alone-wide/](m12-first-builds-claude-haiku-5-5-alone-wide/), one folder per description (app-1 …).

<!-- scorecard -->
## Scorecard (scripts/bench-m12.mjs --score)

0 of 11 drafts end with a warning about what is public (*Public flaws left*: public-personal-data, public-page-closed-records, contact-form-closed, shortcut-closed, mine-public, visitors-read-drafts); since #266 a draft with one goes back to the model once to fix it. *API app*, for the second set's two descriptions of apps for programs and assistants: "yes" when the draft has no landing page, an `api` block, tools when the description names an assistant, and a role other than admin for keys; otherwise what it lacks.

| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Public flaws left | API app | Starter's texts in the draft | Models with the starter's samples | Visitors / landing | Language | App name in it | Labels in it | Landing texts in it | With a text of their own |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | barbers | 2 | 3 / 4 (has 4) | 6 / 7 (has 7) | 2 / 2 (has 2) | private; admin, member (member) | none | pages home, privacy; read Service, Stylist; create none | 1 (operator-unknown) | none |  | none | 1 / 4 | no mention; landing page | en | | | | |
| 7 | marketplace (words: booking) | 1 | 1 / 1 (has 1) | 5 / 5 (has 6) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, catalog, privacy; read Item; create none | 1 (operator-unknown) | none |  | none | 1 / 1 | mentions visitors; landing page | en | | | | |
| 8 | marketplace (words: booking) | 2 | 1 / 1 (has 1) | 0 / 5 (has 3) | 0 / 0 (has 1) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | en | | | | |
| 10 | records (words: marketplace) | 3 | 0 / 1 (has 1) | 1 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages home, collection; read Artifact; create none | 0 | none |  | Our Collection | 0 / 1 | mentions visitors; landing page | en | | | | |
| 11 | status | 2 | 3 / 4 (has 3) | 3 / 8 (has 3) | 2 / 3 (has 2) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 1 / 3 | no mention; no landing page | en | | | | |
| 12 | status (words: barbers) | 2 | 4 / 4 (has 4) | 7 / 8 (has 7) | 3 / 3 (has 3) | shared; admin, staff (staff) | none | pages home; read Component, Incident, IncidentUpdate, Maintenance; create none | 0 | none |  | none | 4 / 4 | no mention; landing page | en | | | | |
| 15 | records (words: invoicing) | 2 | 0 / 1 (has 1) | 0 / 2 (has 2) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 1 | no mention; no landing page | en | | | | |
| 16 | records (words: booking) | 2 | 0 / 1 (has 4) | 0 / 2 (has 5) | 0 / 0 (has 0) | shared; admin, member (member) | none | pages none; read none; create none | 0 | none |  | none | 0 / 4 | no mention; no landing page | en | | | | |
| 19 | marketplace (words: records) | 2 (sv: yes (ska, att)) | 1 / 1 (has 1) | 0 / 5 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages varor; read Item; create none | 0 | none |  | none | 1 / 1 | no mention; no landing page | sv | no | yes (bilder, pris, till) | none | models 1/1, fields 6/6, pages 2/2 |
| 23 | records (words: barbers) | 2 | 0 / 1 (has 2) | 0 / 2 (has 2) | 0 / 0 (has 0) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | **no api block** | none | 0 / 2 | no mention; no landing page | en | | | | |
| 24 | api | 0 | 3 / 3 (has 3) | 0 / 2 (has 3) | 2 / 2 (has 2) | private; admin, member (member) | none | pages none; read none; create none | 0 | none | yes | none | 3 / 3 | no mention; no landing page | en | | | | |

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after `fitSamples`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one `new --describe --yes` printed, with the word-match starter (`closestStarter`) beside it when it differs; "Questions" counts what `smithable clarify` would ask (`--yes` asks nothing), with their language for a description not in English. For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file.
<!-- /scorecard -->

## Summaries, for review

### 1. My clients as a freelance translator: who they are, what I quoted and what they paid.

Failed:

```text
ng starter.
Frontier model (claude-haiku-5-5) · 28,897 tokens (26,031 in, 2,866 out) · $0.0046
No model drafted a valid project.
addModel: addModel would make smithable.yml invalid. Field "Quote.balance": Quote has no field "paid".
addPage: There is no model named "Quote".
addField: addField would make smithable.yml invalid. There is no model named "Quote".
addField: There is no model named "Quote".
addField: addField would make smithable.yml invalid. There is no model named "Quote".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-1 --starter invoicing

```

### 2. A sales pipeline for our six-person web agency: leads, deals and who follows up when.

Failed:

```text
Starting from the crm starter.
Frontier model (claude-haiku-5-5) · 28,442 tokens (25,774 in, 2,668 out) · $0.0017
No model drafted a valid project.
addModel: Choice value "cold outreach" must start with a lowercase letter and use only letters and digits, like "inProgress".
addPage: There is no model named "Lead".
addField: addField would make smithable.yml invalid. There is no model named "Lead". Did you mean "Deal"?
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-2 --starter crm

```

### 3. Online booking for a hair salon: customers pick a stylist and a free time themselves.

```text
Velvet Scissors
  Online booking for a hair salon, where customers pick a stylist and a free time themselves.

Pages
  - Home (a landing page: hero, services, stylists and footer)
  - Appointments (lists appointments; filter by status)
  - Day (a calendar of appointments by week or month; only for admins)
  - Services (lists services; only for admins; visitors see services on the Home page)
  - Stylists (lists stylists; only for admins; visitors see stylists on the Home page)
  - Time off (lists time offs; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Services
  Services have:
  - a name (required)
  - a summary
  - minutes (a whole number, required, 30 by default)
  - a price (an amount)

Stylists
  Stylists have:
  - a name (required)
  - a bio
  - a portrait (picture)
  Each stylist lists its time offs.
  Stylists are booked by their time: Mon–Fri 09:00–17:00, Sat 10:00–14:00, a break 12:00–12:30, 10 minutes kept free after each booking, away during their time offs (by their fields from and until).

Time offs
  Time offs have:
  - a stylist (a stylist, required)
  - a date and time (from, required)
  - a date and time (until, required)
  - a note

Appointments
  Appointments have:
  - a service (a service, required)
  - a stylist (a stylist, required)
  - starts at (a date and time, required)
  - a name (required)
  - a phone
  - a note
  - status (requested, confirmed or cancelled, requested by default, filled by the app)
  An appointment takes its stylist's time from its starts at for the number of minutes in its service's minutes while status is requested or confirmed; whoever made it may cancel it until 12 hours before.

Confirm
  For an appointment that is requested; sets status to confirmed.

Cancel
  For an appointment that is requested or confirmed; sets status to cancelled.

Appointment requested
  When a appointment is added: mails every admin.

Appointment made
  When a appointment is added: mails its owner.

Appointment confirmed
  When “Confirm” runs on a appointment: mails its owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin (The salon. Keeps the services, the stylists and their time off; confirms appointments): everything
  - member (A customer who books appointments): opens the appointments page; adds appointments
  New users get the member role.
  Open to anyone without signing in: the home page, the privacy page, reading services and reading stylists.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,516 tokens (460 in, 2,056 out) · $0.0011
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 148 files (148 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-3. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-3
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-TvAhnF/app-3/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 4. A piano teacher's lessons: my pupils, their weekly times and what each one practises.

Failed:

```text
Starting from the booking starter.
Frontier model (claude-haiku-5-5) · 29,592 tokens (27,087 in, 2,505 out) · $0.0046
No model drafted a valid project.
addModel: Choice value "to learn" must start with a lowercase letter and use only letters and digits, like "inProgress".
addPage: There is no model named "Piece".
addField: addField would make smithable.yml invalid. There is no model named "Piece".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-4 --starter booking

```

### 5. Invoices for my photography work: clients, shoots and what is still unpaid.

Failed:

```text
Starting from the invoicing starter.
Frontier model (claude-haiku-5-5) · 30,978 tokens (26,030 in, 4,948 out) · $0.0029
No model drafted a valid project.
addModel: Field "dueOn": the long form is for a formula, bounds (min, max) or rules (by, locked, required); otherwise write the shorthand, like "int! = 3".
addPage: There is no model named "Invoice".
addField: addField would make smithable.yml invalid. There is no model named "Invoice".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-5 --starter invoicing

```

### 6. Our cleaning company of three sends invoices to households every month; we need one place for them.

Failed:

```text
Starting from the invoicing starter.
Frontier model (claude-haiku-5-5) · 29,716 tokens (26,031 in, 3,685 out) · $0.0022
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 1449 (line 1 column 1450)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-6 --starter invoicing

```

### 7. A town flea market site where anyone can post things to sell, with photos and a price.

```text
Town Flea Market
  Post things you no longer need to sell, with photos and a price, and browse what others offer.

Pages
  - Catalog (lists items; search by title, description or place; filter by category, price, condition or available; sort by price or date added; records can be saved as favorites; contact the owner by mail)
  - Home (a landing page: hero, items and footer)
  - My items (lists items; only the viewer's own records)
  - Saved (lists items; only the viewer's saved records)
  - Review (the pictures and files waiting for review (items), to approve or reject; only for admins)
  - Privacy (a privacy page written from the app: who runs it, what it stores and why, cookies, mail, logs, your rights)

Items
  Items have:
  - a title (required)
  - photos (pictures, required)
  - a description (required)
  - a price (an amount)
  - a category (furniture, bikes, electronics, sports, kids or other, furniture by default)
  - a condition (like new, good or worn, like new by default)
  - a place
  - available (yes or no, true by default)
  Photos of items are reviewed before others see them; an item waits until its photos are.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member (Sells and saves items): opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the catalog page, the privacy page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,718 tokens (411 in, 1,307 out) · $0.0007
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, hero.webp, logo.webp.
Generated 131 files (131 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-7. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-7
  smithable studio

or only run the app with smithable run.
/tmp/smithable-bench-m12-TvAhnF/app-7/smithable.content.yml:3:3  warning  The privacy page "privacy" does not say who runs the app: give the operator's name under pages.privacy.operator (name, address, email, country, hosting).
```

### 8. A swap shelf for our office: colleagues offer things they no longer need and others claim them.

```text
Office Swap Shelf
  Colleagues offer things they no longer need and others claim them from the office shelf.

Pages
  - Shelf (lists items; search by title, description or place; filter by condition or status)
  - Mine (lists items; only the viewer's own records)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Items
  Items have:
  - a title (required)
  - a description
  - a photo (picture)
  - a condition (like new, good or worn, like new by default)
  - a place
  - status (available or claimed, available by default)
  Each item can have a claimed by (a user).

Claim
  For an item that is available; sets status to claimed and claimed by to whoever presses it.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record; runs “Claim”
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,393 tokens (390 in, 1,003 out) · $0.0005
Pictures from the Smithable image library: samples/item-1.webp, samples/item-2.webp, samples/item-3.webp, samples/item-4.webp, samples/item-5.webp, samples/item-6.webp, logo.webp.
Generated 125 files (125 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-8. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-8
  smithable studio

or only run the app with smithable run.
```

### 9. My vinyl record collection: albums, artists, condition and what I paid.

Failed:

```text
Starting from the records starter.
Frontier model (claude-haiku-5-5) · 26,929 tokens (25,102 in, 1,827 out) · $0.0040
No model drafted a valid project.
addModel: Choice value "very good" must start with a lowercase letter and use only letters and digits, like "inProgress".
addPage: There is no model named "Album".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-9 --starter records

```

### 10. Our local museum's collection online, so visitors can browse the objects and their stories.

```text
Local Museum Collection
  An online collection where visitors browse the museum's objects and read their stories.

Pages
  - Our collection online (a landing page: hero, objects where featured is yes and footer)
  - Collection (lists objects; search by title or story; filter by category)

Objects
  Objects have:
  - a title (required)
  - a story (formatted text)
  - a period
  - an origin
  - a category (painting, textile, tool, photograph or other, painting by default)
  - an image (picture)
  - featured (yes or no)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the home page, the collection page and reading artifacts.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,962 tokens (392 in, 1,570 out) · $0.0008
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-10. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-10
  smithable studio

or only run the app with smithable run.
```

### 11. An internal status board for our IT systems, so staff see what is down and when it is back.

```text
IT Status Board
  Shows which IT systems are down, what is being done about it, and when they are expected back.

Pages
  - Team (who has access: invite people, change roles, remove users; only for admins)
  - Incidents (lists incidents; filter by status or component; “Monitoring”; “Resolve”)
  - Components (lists components; search by name)

Components
  Components have:
  - a name (required, unique)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description

Incidents
  Incidents have:
  - a title (required)
  - a component (a component, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - started at (a date and time, required)
  - an expected back (a date and time)
  - resolved at (a date and time)
  - a summary (formatted text)
  Each incident lists its incident updates.

Incident updates
  Incident updates have:
  - an incident (an incident, required)
  - a date and time (at, required)
  - status (investigating, identified, monitoring or resolved, investigating by default)
  - a message (required)

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is in place. We are watching before we close this.).
  A fix is in place; the incident is watched before it is closed, with an update saying so.

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
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,828 tokens (538 in, 4,290 out) · $0.0022
Pictures from the Smithable image library: logo.webp.
Generated 126 files (126 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-11. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-11
  smithable studio

or only run the app with smithable run.
```

### 12. Service status for our municipality's online services, for residents to check outages.

```text
Municipal Service Status
  Live status of the municipality's online services, so residents can check outages and planned work.

Pages
  - Home (a landing page: hero, services, incidents where status is investigating or identified or monitoring, incidents where status is resolved, maintenances and footer)
  - Incidents (lists incidents; filter by status)
  - Updates (lists incident updates)
  - Components (lists services; only for admins; visitors see services on the Home page)
  - Maintenance (lists maintenances)
  - Overview (a dashboard: open now, per month and latest)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Services
  Services have:
  - a name (required)
  - status (operational, degraded, down or maintenance, operational by default)
  - a description
  Each service lists its incidents.
  Each service lists its maintenances.

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

Maintenances
  Maintenances have:
  - a title (required)
  - a service (a service)
  - starts at (a date and time, required)
  - ends at (a date and time, required)
  - a description

Identified
  For an incident that is investigating; sets status to identified; adds an incident update (at now, status identified, message The cause is found and a fix is being worked on.).
  The cause is found; the incident moves to identified, with an update saying so.

Monitoring
  For an incident that is investigating or identified; sets status to monitoring; adds an incident update (at now, status monitoring, message A fix is in place. We are watching the service before closing this incident.).
  A fix is in place; the incident is watched before it is closed, with an update saying so.

Resolve
  For an incident that is investigating, identified or monitoring; sets status to resolved and resolved at to now; adds an incident update (at now, status resolved, message This incident is resolved and the service is working again.).
  The incident is over, with an update saying so. The service's state stays what the team sets.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - staff (Writes incidents and their updates): opens the overview page, the incidents page, the updates page and the maintenance page; adds every kind of record; changes everyone's records; runs every custom action
  New users get the staff role.
  Open to anyone without signing in: the home page, reading components, reading incidents, reading incident updates and reading maintenances.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 6,016 tokens (596 in, 5,420 out) · $0.0028
Pictures from the Smithable image library: hero.webp, logo.webp.
Generated 142 files (142 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-12. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-12
  smithable studio

or only run the app with smithable run.
```

### 13. A log of my car's fuel, service visits and costs.

Failed:

```text
Starting from the records starter.
Frontier model (claude-haiku-5-5) · 27,529 tokens (25,096 in, 2,433 out) · $0.0043
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 738 (line 1 column 739)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-13 --starter records

```

### 14. The guest list and seating plan for our wedding, with who has answered and their meal choices.

Failed:

```text
Starting from the records starter.
Frontier model (claude-haiku-5-5) · 28,864 tokens (25,106 in, 3,758 out) · $0.0022
No model drafted a valid project.
addModel: addModel would make smithable.yml invalid. Field "Guest.meal" is always required (its type says "!", or a choice has a default), so a condition on "required" adds nothing.
addField: addField would make smithable.yml invalid. There is no model named "Guest".
addPage: There is no model named "Guest".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-14 --starter records

```

### 15. Bird sightings for our birdwatching club: species, place, date and who saw it.

```text
Bird Sightings
  Records the birds the club sees, with species, place, date and who saw them.

Pages
  - Sightings (lists sightings; search by species or place)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Sightings
  Sightings have:
  - species (required)
  - a place (required)
  - seen on (a date, required, today by default)
  - notes
  Each sighting can have an observer (a user, who makes it, by default, filled by the app).

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,425 tokens (374 in, 1,051 out) · $0.0006
Pictures from the Smithable image library: logo.webp.
Generated 111 files (111 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-15. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-15
  smithable studio

or only run the app with smithable run.
```

### 16. Our allotment society: who has which plot, the waiting list and the yearly fee.

```text
Allotment Society
  Keeps track of which member holds which plot, the waiting list and each year's fee.

Pages
  - Plots (lists plots; filter by status)
  - Members (lists members; search by name or email; only for admins)
  - Waiting list (lists waiting entries; only for admins)
  - Fees (lists fees; filter by status or year; only for admins)
  - Team (who has access: invite people, change roles, remove users; only for admins)

Members
  Members have:
  - a name (required)
  - an email
  - a phone
  - joined on (a date, required, today by default)

Plots
  Plots have:
  - a number (required, unique)
  - status (let or free, let by default)
  - a holder (a member)
  - notes

Waiting entries
  Waiting entries have:
  - a name (required)
  - an email
  - a phone
  - requested on (a date, required, today by default)
  - status (waiting, offered or withdrawn, waiting by default)
  - a note

Fees
  Fees have:
  - a member (a member, required)
  - a year (a whole number, required, 2026 by default)
  - an amount (an amount)
  - status (due or paid, due by default)
  - paid on (a date)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone who signs in sees all records, and changes and deletes the ones they own.
  Roles:
  - admin: everything
  - member: opens the plots page
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 4,171 tokens (548 in, 3,623 out) · $0.0019
Pictures from the Smithable image library: logo.webp.
Generated 130 files (130 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-16. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-16
  smithable studio

or only run the app with smithable run.
```

### 17. Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.

Failed:

```text
Starting from the barbers starter.
Frontier model (claude-haiku-5-5) · 32,565 tokens (25,956 in, 6,609 out) · $0.0037
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 878 (line 1 column 879)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-17 --starter barbers

```

### 18. Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.

Failed:

```text
Starting from the invoicing starter.
Frontier model (claude-haiku-5-5) · 34,838 tokens (26,086 in, 8,752 out) · $0.0048
No model drafted a valid project.
addModel: Field "dueOn": the long form is for a formula, bounds (min, max) or rules (by, locked, required); otherwise write the shorthand, like "int! = 3".
addPage: There is no model named "Invoice".
addField: addField would make smithable.yml invalid. There is no model named "Invoice".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-18 --starter invoicing

```

### 19. En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.

```text
Loppisen
  Här lägger folk upp begagnade saker de vill sälja, med bilder och pris.

Pages
  - Till salu (lists “Varor”; search by “Titel” or “Beskrivning”; filter by “Skick”, “Pris” or “Till salu”; sort by “Pris” or date added)
  - Mina varor (lists “Varor”; only the viewer's own records)

Varor
  Varor have:
  - a field “Titel” (required)
  - a field “Bilder” (pictures, required)
  - a field “Pris” (an amount, required)
  - a field “Beskrivning”
  - a field “Skick” (“Som ny”, “Gott skick” or “Slitet”, “Som ny” by default)
  - a field “Till salu” (yes or no, true by default)

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Open to anyone without signing in: the varor page and reading items.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 1,484 tokens (445 in, 1,039 out) · $0.0006
Pictures from the Smithable image library: logo.webp.
Generated 118 files (118 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-19. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-19
  smithable studio

or only run the app with smithable run.
```

### 20. Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.

Failed:

```text
Starting from the booking starter.
Frontier model (claude-haiku-5-5) · 35,142 tokens (27,058 in, 8,084 out) · $0.0074
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 4653 (line 67 column 4)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-20 --starter booking

```

### 21. Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.

Failed:

```text
Starting from the crm starter.
Frontier model (claude-haiku-5-5) · 32,374 tokens (25,748 in, 6,626 out) · $0.0037
No model drafted a valid project.
Expected ',' or ']' after array element in JSON at position 1581 (line 1 column 1582)
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-21 --starter crm

```

### 22. Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.

Failed:

```text
 Choice value "Gemüse" must start with a lowercase letter and use only letters and digits, like "inProgress".
addModel: Choice value "bestätigt" must start with a lowercase letter and use only letters and digits, like "inProgress".
addPage: There is no model named "Product".
addPage: There is no model named "Order".
addField: addField would make smithable.yml invalid. There is no model named "Order".
addField: addField would make smithable.yml invalid. There is no model named "Product".
Without a model, start from a starter: smithable new /tmp/smithable-bench-m12-TvAhnF/app-22 --starter kiosk

```

### 23. A backend for my habit app: habits, daily check-ins and streaks.

```text
Habit Tracker
  Track the habits you want to keep, check them in each day and see your streaks.

Pages
  - Habits (lists habits; search by name; filter by frequency or active)
  - Check ins (lists check ins; filter by habit, done or date)

Habits
  Habits have:
  - a name (required)
  - a frequency (daily or weekly, daily by default)
  - started on (a date, required, today by default)
  - active (yes or no, true by default)
  Each habit lists its check ins.

Check ins
  Check ins have:
  - a habit (a habit, required)
  - a date (required, today by default)
  - done (yes or no)
  - a note
  No two check ins have the same habit and date for one owner.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,035 tokens (423 in, 1,612 out) · $0.0008
Pictures from the Smithable image library: logo.webp.
Generated 113 files (113 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-23. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-23
  smithable studio

or only run the app with smithable run.
```

### 24. Somewhere my AI assistant keeps my tasks and notes, by project.

```text
Project Memory
  Tasks and notes, grouped by project, that my AI assistant keeps for me.

Pages
  - Projects (lists projects)
  - Tasks (lists tasks; “Complete”; “Reopen”)
  - Notes (lists notes)

Projects
  Projects have:
  - a name (required)
  - a description
  Each project lists its tasks.
  Each project lists its notes.

Tasks
  Tasks have:
  - a title (required)
  - a project (a project, required)
  - status (todo, doing or done, todo by default)
  - a due date
  - details

Notes
  Notes have:
  - a title (required)
  - a project (a project, required)
  - a body
  - an attachment (a document)

Complete
  For a task that is todo or doing; sets status to done.
  Mark a task as done.

Reopen
  For a task that is done; sets status to todo.
  Open a finished task again.

Sign-in and access
  People sign in with a code sent to their email.
  Everyone sees, changes and deletes only their own records.
  Roles:
  - admin: everything
  - member: opens every page; adds every kind of record
  New users get the member role.
  Other programs can read and change every kind of record, also ones added later, with a key, and run complete and reopen. AI assistants can use it too.
  Everyone who signs in can ask the app questions; it changes nothing. It answers plainly.
Frontier model (claude-haiku-5-5) · 2,795 tokens (445 in, 2,350 out) · $0.0012
Pictures from the Smithable image library: logo.webp.
Generated 127 files (127 changed, 0 removed).

Created /tmp/smithable-bench-m12-TvAhnF/app-24. Open it in Studio, to see it and change it:

  cd /tmp/smithable-bench-m12-TvAhnF/app-24
  smithable studio

or only run the app with smithable run.
```
