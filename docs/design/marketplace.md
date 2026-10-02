# Marketplaces: several pictures, filters, favourites, contact the owner, the catalogue as the start page (design)

Status: proposed 2026-10-02 by Fable, from Johan's test ("a site where users sell things") and a look at blocket.se. Johan's own build reached a list with search and cards; what stopped it were bugs, now with Opus, and five missing constructs, which this document adds. Each passes ARCHITECTURE §2.4 (common on every catalogue and marketplace; deterministic; it replaces code a model would otherwise write by hand; technology-neutral; better than free text plus custom code because the list, the form and the access rules all have to agree). Merging this document is the go-ahead.

## 1. What exists

An `Item` with a `picture`, a `description`, a `price` (money), a `category` (choice) and a `place`; `owner` on every record; a crud page with `search: [title, description]` and `view: cards`; a landing page with a records section showing the newest items; a contact section for the site; themes with the brand colour. Missing: more than one picture, filtering and sorting by the visitor, a way to keep what one likes, a way to reach the seller, and a catalogue that is the front page.

## 2. The constructs

### 2.1 `pictures`: several pictures on a record

```yaml
models:
  Item:
    fields:
      photos: pictures          # up to 10; the first is the cover
```

- A field type beside `picture`, stored and served the same way (`/files/<model>/<id>/<field>/<n>`, through the model's data function, so the pictures are as private as the record). The form shows the pictures as a strip: add (several at once), remove, drag to reorder; the browser scales and encodes each as today. At most 10 (`pictures(4)` for fewer); the first is the cover.
- Cards and tables show the cover; the record page shows the strip, each opening large (the gallery's viewer, reused). Articles' `picture` stays for one.
- Like `picture`: never `unique`, no default, not in formulas, searches, dashboards or calendars. Sample data takes one to three of the starter's sample pictures.
- Operation: `addField Item photos pictures`; `changeField` between `picture` and `pictures` keeps the existing picture as the first.

### 2.2 `filters` and `sortable` on a list

```yaml
pages:
  catalogue:
    crud: Item
    search: [title, description]
    filters: [category, place, price, condition]    # chips, a select, a range, a toggle
    sortable: [price, createdAt]                    # "Sort by" with both directions
```

- `filters` names fields of the page's model. Each kind gets its control: a choice or a reference becomes chips (a select when there are more than eight values); a number, money or date field becomes a range with "from" and "to"; a yes/no field a toggle. The controls sit above the list beside the search box, collapse into a "Filters" button on phones, and show the active ones as removable chips.
- The state lives in the address (`?category=furniture&price=100..500&sort=-price`), so a filtered view can be linked and reloaded; the list's server function applies filters, search and sort together, within the viewer's read scope, in one query. Typing never remounts the list (the search-box fix).
- `sortable` names the fields the visitor may sort by; the ux file's `table.sort` stays the default order. Both keys are allowed on crud pages and on a landing page's records section (§2.5).
- Validation: a filter field must exist and be filterable (not a picture, not a long text); a reference filter needs the referenced model readable by the page's viewers.

### 2.3 Favourites

```yaml
pages:
  catalogue:
    crud: Item
    favourites: true            # a heart on each card and record; a "Saved" view
```

- A signed-in viewer can mark a record and see "Saved" as a view of the same list (`?view=saved`); a visitor who clicks the heart is asked to sign in. The mark is the viewer's own: no counts, no "most liked", nothing shown to others.
- Generated: a table `<model>_favourite (user_id, record_id, created_at)` with a unique pair, a server function `toggleFavourite`, the heart in `ModelTable`, cards and the record page, and an access test (a viewer can mark only records they may read; a removed record's marks go with it). Favourites follow the record into the one-file export and PITR like any table.
- Also allowed as a dedicated page: `pages: saved: { crud: Item, favourites: only }` lists the viewer's marks.

### 2.4 Contact the owner

```yaml
pages:
  catalogue:
    crud: Item
    contact: owner              # or a User field of the model, e.g. contact: seller
```

- The record page gets a "Contact the seller" block: the sender's name and email (filled in and locked when signed in), a message, a button. Sending mails the record's owner through the app's mail (the kit's `sendMail`; the service's relay when hosted) with the record's title and link in the subject, the sender's address as reply-to, and the app's name as the sender; nothing is stored unless `contact: { to: owner, keep: Message }` names a model to keep a copy in (then the model's `create` rule decides who may write it). The sender gets "Your message is sent" and nothing else; the owner's address is never shown.
- Who may send follows the page: public pages let visitors send; others, signed-in viewers. Limited like other writes (the existing per-address limits), and refused when the owner is gone or has no email.
- Differs from a landing page's `contact: { form: Message }`, which is a message to the site stored as a record; this one goes to the record's owner.

### 2.5 The catalogue as the start page; a searchable records section

- A crud page may take `route: /`. The app then starts on the list, in the site frame, with the landing page optional. Validation refuses two pages at `/`.
- A landing page's records section may take `search: true`, `filters` and `limit`: the section shows a search box (and the filters' chips) that lead to the model's crud page with the same address state, so a front page can be a catalogue's door without duplicating the list.

## 3. Looks

- A marketplace card: cover picture 3:2, title, price in bold, place and time in the muted tone, the favourite heart in the corner, a badge for one choice field (`condition`). `view: cards` with `density: compact` fits four across on wide screens.
- The filter bar and sort control follow the theme; on phones the filters open in a sheet.
- The record page: the picture strip, then title, price, place and time, the description, the contact block, and the seller's other items (the owner's records the viewer may read, `limit: 4`).

## 4. The starter

A fifth starter, **marketplace** ("Torget"): `Item` with `photos: pictures`, `title`, `description`, `price`, `category`, `condition`, `place`; `seller` is the owner; pages `catalogue` (`route: /`, search, filters, sortable, favourites, `contact: owner`), `myItems` (the viewer's own), `saved`; sign-in with Google and invitations off, self sign-up on; sample data with pictures. `test-apps` covers: filter by category and price in the address, sort by price, mark and unmark a favourite, send a contact message to the outbox, a visitor refused the heart.

## 5. Steps

1. **Core:** the `pictures` field type, the `filters`, `sortable`, `favourites` and `contact` page keys and the records section's `search`/`filters`, with checks, phrases ("let people filter items by category", "add favourites", "let visitors contact the seller"), index words and summaries; `route: /` on crud pages. Fable.
2. **Adapter:** the pictures strip and viewer, the filter bar and sort control in `ModelTable` and the list route's query, the favourite table and heart, the contact block and its server function, the records section's search. Opus, one pull request per construct, in the order 2.1, 2.2, 2.4, 2.3, 2.5.
3. **The starter and docs:** the marketplace starter, spec reference (fields, crud page keys, landing records section), ARCHITECTURE §10.4 and the kit list, ROADMAP. Opus.

Apps without these keys stay byte-identical.

## 6. Out of scope

Messaging between users (a mail to the owner is enough for a start), payments, paid placement, seller ratings, a map and distance (a location field and a tile provider are a design of their own), saved searches and notifications.
