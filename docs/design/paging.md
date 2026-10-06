# Paging: tables by pages, cards as you scroll

Design, 2026-10-06 (Fable). Johan: "Galleries should perhaps have forever lazyloading type but other lists paging." Status: built by A the same day (#384), with one deviation: cards load fifty at a time, the table's page size, from the one server function, not twenty-four.

## 1. Today

A crud page's list loads every record the viewer may read in one call (`list` in `<model>.server.ts`) and shows them all: a table on a wide screen, cards on a phone or when `view: cards`. Search and filters narrow the set on the server, but a model with a thousand records sends a thousand rows to the browser on every visit. The API and the assistant's tools already page (`find` takes `limit` and `offset` and returns `items` and `total`; `/api/v1` takes `limit` and `page`), the data page lists the newest only, and a dashboard list takes `limit`. Only the pages people use most are without.

## 2. The rule

The list's view decides its form, nothing new in the spec and nothing new in the ux file:

- **A table** is paged: fifty records a page, "Previous", "Next" and "1–50 of 1,234" under it, the page in the address (`?page=3`) so that Back, a reload and a shared link keep it. Sorting, a search or a filter starts again at page 1.
- **Cards** (a gallery: `view: cards`, a phone, a catalogue, the marketplace) load more as the reader nears the end: twenty-four cards, then twenty-four more each time the last row comes into view, with a "More" button under them for keyboards, readers and a browser without the observer. The address does not change; Back returns to the top with the first page, which is what a reader of a gallery expects.
- **Selection** (checkboxes for actions on chosen records, actions.md §9) stays within the loaded records: "Select all" selects the page, and the bar says "50 selected on this page".
- **Counts** come from `total`, which the data layer already gives with each page.

The sizes are defaults in the kit, not settings: nobody has asked for a page of twenty or two hundred, and a setting would need a place in the ux file and an operation. When someone does, `table.pageSize` in `smithable.ux.yml` is where it goes.

## 3. Where it goes

- `<model>.server.ts`: the list route calls `find` with `limit`, `offset`, the sort and the filters it already passes to the search, instead of `list`. `list` stays for the places that want everything (a calendar's week, a dashboard's chart, an export).
- The list route (`src/routes/<page>/index.tsx`): `page` in the search params, validated as a positive integer; the loader passes it on and gets `{ items, total }`.
- `ModelTable.tsx`: the pager under the table, with the count; the first and last page disable their buttons. A phone's card view uses the gallery's loading instead.
- A `MoreOnScroll` piece in the kit (an `IntersectionObserver` on a sentinel after the cards, calling the route's loader for the next page through a server function; the "More" button is the same call).
- The preview editor's markers (`editorMarker`) and the Look tab's column controls do not change: they are about columns, not rows.
- The API is unchanged; its `limit` and `page` already match.

## 4. What must be true

- A list of 1,200 sample records (a test seeds them) opens in the same time as one of 20, and the browser receives at most one page of rows.
- Paging, sorting, a search and a filter compose: page 3 of "status = placed, sorted by total" is the third fifty of that set.
- The last page shows the remainder, not a blank; `?page=99` beyond the end shows the last page.
- Cards keep loading until `total` is reached, then stop, and the "More" button goes.
- An action on selected records acts on the selected ids only, never on "every record that fits", unless it says so.
- The smoke tests pass for every example, and test-apps gets a check with the seeded thousand.

## 5. Out of scope, for later

- A page size in the ux file (`table.pageSize`), when someone asks.
- Keyset paging (after id 12345) instead of offsets, when a model passes a hundred thousand records; the offset is fine until then and the API's `page` keeps its meaning.
- Remembering a gallery's scroll position on Back.
