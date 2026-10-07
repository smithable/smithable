# Stranger walks, 2026-10-07

Johan's decision (2026-10-07): consolidate before the flip; no new constructs. Each starter used end to end as someone who never read the spec, on a phone viewport (390×844) and desktop, in a real browser. Severity: **breaks** (cannot go on), **confuses** (goes on, but wrongly or after a search), **cosmetic**. Pictures: `/mnt/c/Users/johan/Pictures/claude/walks/<starter>/`. Fixed on the spot where small; the rest are backlog items.

## Booking (Fable, phone first)

| # | Where | What | Severity |
|---|---|---|---|
| B1 | Studio, the guide on a phone | The tour skips the preview and the change box: five stops (mode, What it does, Details, Look, Publish), because their anchors are off the screen (the preview is the second panel; the change box is folded). The stranger's first tour never shows them their app. The design says a stop scrolls its panel into view and opens what it needs. | confuses |
| B2 | Studio, Code mode on a phone | Opens on the concept list alone, with no panel bar as Builder has ("Your app / Preview / Details"); the editor is two swipes away with nothing saying so. Once found, the editor is full width and readable (A's #417). Open on the editor, and give Code mode the same panel bar. | confuses |
| B3 | Studio, the change box | The example reads "customers should have a mobile number", and this app has no customers; a stranger who copies it is refused. Word the example from the app's own models ("instructors should have a phone number"). | confuses |
| B4 | Studio, after a change in No code | The result line says "Generator (add field) · 0 tokens": engineer's words in the no-code mode. Say "Done in a second, no AI needed" (and the model's name when one was used); keep the detail for Code mode. | cosmetic |
| B5 | Studio header on a phone | "Publish" is a link to the self-host page of the docs; a stranger expects a button that publishes. On a local Studio, call it "How to publish". | cosmetic |
| B6 | Studio, Select on a phone | Selecting the hero title makes it editable in place with a white box wider than the text behind the selection. Works; looks like a glitch for a moment. | cosmetic |
| B7 | Studio, a question without a model | "who can delete bookings?" is answered from the rules ("The record's owner and admins can delete bookings."), but "who can book a class?", the question a yoga studio asks, is not: "book" is the app's own verb for adding a booking, and the wording rules know only add, change, delete and read. Map a model's natural verbs (book → add a booking, the reservation words in the content file) in packages/index phrases. | confuses |
| B8 | Studio, the refusal without a model | "No model is available under the AI policy. Set up a local model or the Smithable model, or change the policy." is written for us. For a maker: "This needs an AI model, and none is set up yet: see Help, AI setup." with the link. | confuses |
| B9 | `smithable deploy` of the walk's app | Refused by the Release checks: the privacy page's route did not type-check once a public model had a personal field (the phone added in B3's change: `readers: "visitors"` widened to string against the kit's union). Fixed on the spot: the generated facts are typed as the kit's LegalFacts; a unit test generates that case. Nothing in the examples had a public model with a personal field, which is why the gate never saw it. | breaks |
| B10 | `smithable deploy`, the same run | Refused by "Dependencies, at their source": vite 8.3.2 has three advisories fixed in 8.3.3, so every new app's deploy was refused today until the pin moved. Fixed on the spot (the pin, the template hashes). The weekly bump is Monday's; an advisory published mid-week stops every deploy until it. Consider: the check as a warning when the fix is a patch release the stack profile does not have yet, with the daily stack-advisories run opening the bump. | breaks |
| B11 | The published app, /privacy | Two nested `main` landmarks: the root frames every public page for visitors already, and the privacy route framed itself again. Fixed on the spot (the route renders the page alone). The visual checks run axe on a fixed list of paths, which the privacy page was not on; add every public page's route to that list. | cosmetic |
| B12 | The published app, the schedule as a visitor | A freshly published app's week reads "Nothing" seven times. Once would do: "No classes this week yet", and for the owner signed in, "Add a session". | cosmetic |
| B13 | The published app, sign-in | Without a mail provider the page says so plainly ("cannot send mail, contact whoever runs it") and the deploy warned; right as it is. The member's walk (book, cancel, the mails) could not be done on this deploy for that reason; test-apps covers it. | — |

What went well: the published app on a phone (home in under two seconds, the schedule without a reload, the privacy page in the site's frame, the sign-in page's honesty). On the phone in Studio: the preview, the sample-data notice, "Show the change box", a change in words applied in under two seconds with the preview updating, Details showing the app's own details without a selection (A's #417), the "In my words" sentences.

## crm (Opus A)

Made with `smithable new crm --starter crm`, then `smithable studio`; desktop 1440×900 and phone 390×844. Pictures: `walks/crm/`.

- crm · `smithable new` · drizzle-kit's table listing and "[✓] Your SQL migration file ➜ … 🚀" fill the output between our own lines · cosmetic · **fixed**: its output shows only when it fails
- crm · `smithable new` · ends with "Start it with: smithable run", never naming Studio, which is where a newcomer wants to go · confuses · **fixed**: names `smithable studio` first, `smithable run` second (and the start page's sample run)
- crm · `smithable new` · "Sign-in was limited to acme.example, the starter's sample domain: taken out." reads as an error to someone who never set a domain · confuses
- crm · Studio, first screen · the samples notice is said twice at once: the yellow bar over the preview and the guide's card 2 beside it · cosmetic
- crm · Details tab · the theme shows as its id, "corporate", where Look calls it "Corporate" · cosmetic · **fixed**
- crm · Details tab · saving only a new name logs "Set the app: name Acme Sales, description Lightweight CRM…", as if the description changed too · confuses · **fixed**: only what changed is sent
- crm · change list · "Use the coastal theme": the preset id in lower case (core's describe) · cosmetic
- crm · words box · "customers should have a mobile number" adds the field but not to the list's columns (the starter sets columns), so the preview shows no change at all; the Change form adds to the list by default ("Show it in the list") · confuses
- crm · words box · "Done: … Generator (add field) · 0 tokens": the engine's words for a stranger · cosmetic
- crm · Look tab · the theme in use has only a faint outline; with twelve cards it is hard to see which is on · cosmetic
- crm · Builder tabs · "Change" is both a tab (forms) and the box below it (words); a newcomer cannot tell which to use · confuses
- crm · preview (both modes) · every preview load logged a hydration error, because Studio's select-mode script set `draggable="false"` on the table's headings before React hydrated; Code mode's Logs tab was full of it · cosmetic · **fixed**: the attribute is removed instead
- crm · preview after a rename · the server renders the old name once ("Acme CRM" vs "Acme Sales"), so a hydration error and a flash of the old name follow the change (dev server: the SSR module reloads after the client's) · cosmetic
- crm · Code mode · the guide's "Guide" link is gone from the header (Builder only), with no way to find the tour from Code mode · cosmetic
- crm · Code mode · editor lines do not wrap; the starter's comments run off the right edge at 1440 wide · cosmetic
- crm · Code mode, change list · a saved text edit says only "Edit smithable.yml", not what changed (Last change has the diff) · confuses
- crm · Publish (local) · opens docs.smithable.ai/self-host in a new tab; nothing in Studio says `smithable deploy` · confuses
- crm · phone, Code mode · only the Concepts panel shows; nothing says the editor and preview are a swipe away · confuses
- crm · phone, Builder · once opened, the change box stays open and leaves the Preview panel a strip of about 280 px · confuses
- crm · `smithable deploy` (no GITHUB_TOKEN) · refused: "Dependencies, at their source … 1 finding" when six advisory lists were only "Not read, so not checked" (GitHub's sixty an hour), then "Findings are never suppressed: fix them, or record an exception", with nothing a newcomer can fix · breaks · Fable takes it (a day's cache on disk, a message naming the cause and the remedies)
- crm · `smithable deploy` · refused for every app today: vite 8.3.2 has three advisories fixed in 8.3.3 (GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg) · breaks · **fixed** by Fable's bump on fable/stranger-walk
- crm · `smithable deploy` · 3 min 50 s before the first word after "Building the image…": no sign of progress while the image builds and the scanners run · confuses
- crm · published app, not walked: the deploy was refused (above); the visitor and member walk ran against the app's own server instead
- crm · app, visitor · an invite-only app's sign-in page does not say who may sign in; an uninvited visitor types an address and waits for a code · confuses
- crm · app, visitor, phone · the menu button on the sign-in page opens a menu holding only "Sign in", the page already open · cosmetic
- crm · app, member (sales), both sizes · Customers and Orders read well; cards at phone width; no page wider than the screen; no console errors · fine


## invoicing (Opus A)

Made with `smithable new --starter invoicing`, then `smithable studio`; desktop and phone. Pictures: `walks/invoicing/`.

- invoicing · Builder, Change tab · "Kind of record" lists "BusinessProfile", "InvoiceLine": the spec's names, not words · cosmetic · **fixed**: the forms' lists of kinds (and "Links to") show "Business profile", "Invoice line"
- invoicing · words box · "clients should have a VAT number" answers "No model was used · No operation can do this: Clients already have a field called "vat number"": right, but "No operation can do this" is the engine's word for "already there" · cosmetic
- invoicing · Studio preview · opens on the landing page, signed out, with "Sign in" (as status) · confuses
- invoicing · app, member, menu · "Invoice lines" is a page of its own beside Invoices and Clients; lines belong to an invoice · confuses
- invoicing · app, member, invoice page · "Lines: No invoice lines yet. Create the first one to get started.", with no button to create one there; the only way is the separate Invoice lines page, choosing the invoice again · breaks (a dead end on the starter's main task) · **fixed in part**: a record's related list now says only "No invoice lines yet."; a way to add a line from the invoice is still missing
- invoicing · app, member, new invoice · the number is typed by hand ("Number *"), with nothing suggested; the total shows "€0.00 (calculated)" before any line exists · confuses
- invoicing · app, visitor and member, both sizes · landing page, sign-in, Invoices and Clients: no page wider than the screen, no console errors · fine
- invoicing · `smithable deploy`: not walked, refused like crm (vite advisories, Fable's bump)


## marketplace (Opus A)

Made with `smithable new --starter marketplace`, then `smithable studio`; desktop and phone. Pictures: `walks/marketplace/`.

- marketplace · Studio, first screen · the guide opens while the preview still says "Starting…"; its card 2, "Your app, running", points at an empty panel · confuses · **fixed**: the first tour waits for the preview's page (or twenty seconds)
- marketplace · words box · "items should have a condition note" adds it in two seconds and the form shows it; same "Generator (add field) · 0 tokens" wording as crm · fine
- marketplace · Studio, phone, Preview panel · after a change, the green "Use the navy theme. Undo this change" bar, the yellow samples bar and Studio's own rows leave the app about 490 of 844 px · cosmetic
- marketplace · app, visitor · `/` is the catalogue, and the landing page ("Give things a second home") lives at `/welcome`, which nothing in the menu links to; a visitor never sees the hero unless sent there · confuses
- marketplace · app, visitor · My items and Saved send a visitor to sign-in without saying why ("Sign in to Torget") · cosmetic
- marketplace · app, member, phone · New item form, create, and the item in My items: all work, no page wider than the screen, no console errors · fine
- marketplace · app, member · My items (one's own few items) offers "Export CSV" · cosmetic
- marketplace · `smithable deploy`: not walked, refused like crm (vite advisories, Fable's bump)


## status (Opus A)

Made with `smithable new --starter status`, then `smithable studio`; desktop and phone. Pictures: `walks/status/`.

- status · words box · "incidents should have a severity" adds a free-text field; someone who says severity means a few levels (minor, major, critical), and nothing asks · confuses
- status · Studio preview, first load · the landing page shows "Sign in", as to a visitor; the owner is signed in only once a page that needs it opens, and then the same header says "Open Northwind Status" · confuses
- status · Studio, phone · with a two-word app name the header wraps onto three rows (name, mode switch, links), above the change bar and the samples bar · cosmetic
- status · app, visitor · the question a visitor comes with ("is it working now?") is answered in the fifth section, "Going on now", under the hero, the services and the ninety-day bars; the hero's button leads to past incidents · confuses
- status · app, visitor, both sizes · the landing page, the uptime bars and Incident history read well at 390 wide; Incidents and Overview send to sign-in · fine
- status · app, staff, phone · one tap on Resolve resolves the incident: no question, no notice, no Undo, though the action's intent speaks of "an update saying so" · confuses
- status · app, staff, both sizes · Overview, Incidents, Updates, Maintenance: no page wider than the screen, no console errors · fine
- status · `smithable deploy`: not walked, refused like crm (vite advisories, Fable's bump)


## Records (Fable, phone)

| # | Where | What | Severity |
|---|---|---|---|
| R1 | Studio, What it does | "an added (a date, required, today by default)": a field named by a verb reads wrong with an article. Fields named `added`, `created`, `updated`, `due` and the like should read "the date added" / "added on". | cosmetic |
| R2 | Studio, a question | "who can see the items?" answers "Anyone, without signing in can see items.": the comma is in the wrong place. "Anyone can see items, without signing in." | cosmetic |
| R3 | Studio, the words box | "members should be able to add items" is not read by the rules and falls to the model (none here): the shape "<role> should be able to / can / may <verb> <model>" is setAccess, which the rules know in the "Only admins may delete customers" form. Add it. | confuses |
| R4 | Studio on a phone, the change box open | With the change box open, the preview is a letterbox of a few lines between the panel bar and the box. After a change is made, fold the box by itself; or make it a sheet that slides up over the preview and down after. | confuses |
| R5 | Studio preview | A hydration error in the console on every preview load (`draggable`): the preview script sets the attribute before hydration. Fixed by A's #424. | cosmetic |
| R6 | The published app, /items as a visitor | An empty list says "No items yet. Create the first one to get started." to a visitor who may not add one (only admins may). The empty state should say only "No items yet" unless the viewer may add, and then carry the button (A's add-child change does this for related lists; the same for list pages). | confuses |

What went well: the summary reads well for a one-model app; a price added by words in under two seconds; the list's search on the phone, with "No items match “zzz”".

## Api (Fable, desktop)

| # | Where | What | Severity |
|---|---|---|---|
| A1 | Studio, What it does | "Only member users and admins can add projects", "member users, assistant users and admins": a role is said as "<role> users". Say "members", "assistants" (the role's plural as a word), with "users" only for a role whose name is not a noun. | cosmetic |

What went well: the preview opens on the Team page as the development admin with the keys right there; a key made with one form, the curl line and the assistant's settings shown to copy; the API answers with the key (200) and refuses without (401); the OpenAPI description is served. A stranger who wants an API for an assistant gets one in a minute.

## Summary of the walks

Seven starters, two sessions, one day. Nothing in a published app broke for a visitor. What broke was getting there: a fresh app's deploy was refused twice today (a type error in the privacy page with a public personal field; advisories published mid-week; and, for a newcomer without a GitHub token, the advisory lists not readable), all three fixed. The rest is Studio: its words for strangers (examples from another app, engineer's lines after a change, the no-model refusal, role words), the phone layout (the guide skipping the preview, Code mode without a panel bar, the change box over the preview), and the reading rules missing natural phrasings ("who can book a class", "members should be able to add items", "a severity"), several fixed the same day. The invited testers' walks will find what a model cannot: whether it feels worth paying for.
