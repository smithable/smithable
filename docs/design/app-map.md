# The app map (design)

From the app-map proposal of 2026-10-20 (Fable's decisions, A 127): Studio draws the app as a
map and says why access is what it is, read-only, from the IR and core's rules, never a second
reading of the files. The first PR has two parts; the navigation view (pages, menus: shown in a
menu, may open, may read its records), the behaviour view (actions' `when` and `set`, outgoing
entries, custom code marked opaque) and a Mermaid export of the same data come after.

## 1. The Data map (No code → Data map)

- A box per kind of record, its fields folded behind "n fields" (each field with what it holds:
  a kind of value, a choice, `→ Model` for a reference, `Model list` for the other side of one),
  and a box for the people who sign in (`User`) when a field refers to them or a record is
  someone's.
- An arrow per reference a field stores, from the record that stores it, labelled with the
  field; a list is that arrow's other side and gets none of its own. Whose a record is, dashed:
  the `ownedBy` field's arrow is marked "(owns it)", and without `ownedBy`, under sign-in, an
  arrow "made by (owns it)" to the people.
- The first layout is dagre's, left to right; a box moved by hand keeps its place in this
  browser (localStorage, per app). A box's name opens Behavior at that kind of record.
- React Flow and dagre (MIT) are Studio's only; generated apps never get them.
- Built: `apps/studio/src/builder/data-map.ts` (the content, unit-tested on the CRM) and
  `DataMap.tsx`.

## 2. Who can's Why?

In who-can.md ("Why?"): a question under the grid answered by `explainAccess`
(explain-access.md), each reason a link that shows its setting in Code.
