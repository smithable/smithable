import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { validateUx } from "../ux.js";

const SPEC = `smithable: 0.1
app:
  name: Studio
models:
  Room:
    fields:
      name: string!
  Session:
    fields:
      title: string!
      startsAt: datetime!
      status: open | full | canceled
      instructor: User
      room: Room
      places: int
      online: bool
      notes: text
pages:
  sessions:
    crud: Session
    filters: [startsAt, status, instructor, room, places, online, owner, createdAt]
`;

const read = (extra: string) =>
  validateSpec({ path: "smithable.yml", text: `${SPEC}${extra}` }, { roles: ["admin", "staff"] });
const messages = (extra: string) =>
  read(extra)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);

test("a default filter: each value as its filter takes it, kept as the address writes it", () => {
  const result = read(`    defaultFilter:
      startsAt: upcoming
      status: [open, full]
      instructor: me
      places: 10..
      online: true
      owner: mine
      createdAt: 2026-01-01..2026-12-31
`);
  expect(messages("")).toEqual([]);
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.ir?.pages[0]?.defaultFilter).toEqual({
    startsAt: "upcoming",
    status: "open,full",
    instructor: "me",
    places: "10..",
    online: "true",
    owner: "mine",
    createdAt: "2026-01-01..2026-12-31",
  });
});

test("what a default filter refuses, each with its reason", () => {
  const one = (line: string) => messages(`    defaultFilter:\n      ${line}\n`);
  expect(one("notes: hello")).toEqual([
    expect.stringContaining('"notes" is not among the filters of'),
  ]);
  expect(one("startsAt: soon")).toEqual([
    expect.stringContaining("one of upcoming, past, today, thisWeek, thisMonth"),
  ]);
  expect(one("startsAt: ..")).toEqual([expect.stringContaining("either side left out")]);
  expect(one("status: paused")).toEqual([
    expect.stringContaining('"status" is one of open, full, canceled; "paused" is not.'),
  ]);
  expect(one("instructor: 7")).toEqual([
    expect.stringContaining('"instructor" refers to a person: its default is "me", "none" or both'),
  ]);
  expect(one("room: 3")).toEqual([
    expect.stringContaining('"room" refers to a record, whose id changes with the data'),
  ]);
  expect(one("places: many")).toEqual([expect.stringContaining("a range like 10..500")]);
  expect(one("online: maybe")).toEqual([expect.stringContaining("true or false")]);
  expect(one("owner: me")).toEqual([expect.stringContaining('"owner" filters to "mine" only')]);
  expect(one("startsAt: ")).toEqual([expect.stringContaining('gives "startsAt" a value')]);
  // A page whose filters are refused has no defaults either, with one message per fault.
  expect(messages("    defaultFilter: { startsAt: upcoming }\n").length).toBe(0);
});

test("setDefaultFilter writes a value or takes it away; a renamed, removed or changed field follows", () => {
  const files = {
    spec: SPEC,
    auth: "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\nroles:\n  admin: { description: Runs it. }\n  staff: { description: Works. }\ndefaultRole: staff\n",
  };
  const set = applyOperation(files, "setDefaultFilter", {
    page: "sessions",
    field: "startsAt",
    value: "upcoming",
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain("    defaultFilter:\n      startsAt: upcoming\n");
  expect(set.description).toBe("Open sessions filtered by startsAt: upcoming");
  const more = applyOperation(set.files, "setDefaultFilter", {
    page: "sessions",
    field: "status",
    value: "open, full",
  });
  if (!more.ok) throw new Error(more.message);
  expect(more.files.spec).toContain("      status: [open, full]\n");
  const flag = applyOperation(more.files, "setDefaultFilter", {
    page: "sessions",
    field: "online",
    value: "true",
  });
  if (!flag.ok) throw new Error(flag.message);
  expect(flag.files.spec).toContain("      online: true\n");
  const wrong = applyOperation(files, "setDefaultFilter", {
    page: "sessions",
    field: "notes",
    value: "x",
  });
  expect(wrong.ok ? "" : wrong.message).toContain('"notes" is not among the filters of sessions');
  const bad = applyOperation(files, "setDefaultFilter", {
    page: "sessions",
    field: "startsAt",
    value: "soon",
  });
  expect(bad.ok ? "" : bad.message).toContain("one of upcoming, past");
  // A range keeps a decimal comma; a scalar list of values is trimmed when read.
  const decimal = applyOperation(files, "setDefaultFilter", {
    page: "sessions",
    field: "places",
    value: "2,5..10",
  });
  if (!decimal.ok) throw new Error(decimal.message);
  expect(decimal.files.spec).toContain("      places: 2,5..10\n");
  expect(read("    defaultFilter: { status: 'open, full' }\n").ir?.pages[0]?.defaultFilter).toEqual(
    {
      status: "open,full",
    },
  );
  // A filter taken away takes its default with it.
  const fewer = applyOperation(more.files, "setFilters", {
    page: "sessions",
    fields: ["status", "places"],
  });
  if (!fewer.ok) throw new Error(fewer.message);
  expect(fewer.files.spec).not.toContain("startsAt: upcoming");
  expect(fewer.files.spec).toContain("      status: [open, full]\n");
  const none = applyOperation(more.files, "setDefaultFilter", {
    page: "sessions",
    field: "startsAt",
    value: "none",
  });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.spec).not.toContain("startsAt: upcoming");
  expect(none.files.spec).toContain("      status: [open, full]\n");
  // The field renamed: the default follows; removed: it goes; a choice value renamed or gone.
  const renamed = applyOperation(more.files, "renameField", {
    model: "Session",
    from: "startsAt",
    to: "begins",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("      begins: upcoming\n");
  const removed = applyOperation(more.files, "removeField", {
    model: "Session",
    field: "startsAt",
  });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).not.toContain("startsAt");
  expect(removed.files.spec).toContain("      status: [open, full]\n");
  const changed = applyOperation(more.files, "changeField", {
    model: "Session",
    field: "status",
    type: "draft | open | canceled",
    renames: ["full=draft"],
  });
  if (!changed.ok) throw new Error(changed.message);
  expect(changed.files.spec).toContain("      status: [open, draft]\n");
  // Two default values merged into one are one.
  const merged = applyOperation(more.files, "changeField", {
    model: "Session",
    field: "status",
    type: "canceled | planned",
    renames: ["open=canceled", "full=canceled"],
  });
  if (!merged.ok) throw new Error(merged.message);
  expect(merged.files.spec).toContain("      status: canceled\n");
  expect(merged.files.spec).toContain("      startsAt: upcoming\n");
});

test("the ux file names the filters shown first; setFiltersShown writes it; a field follows", () => {
  const ir = read("").ir;
  if (!ir) throw new Error("spec");
  const ux = (text: string) =>
    validateUx({ path: "smithable.ux.yml", text: `smithableUx: 0.1\n${text}` }, ir);
  const shown = ux("pages:\n  sessions:\n    filters: { shown: [startsAt, status, startsAt] }\n");
  expect(shown.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(shown.ux?.pages.sessions?.filtersShown).toEqual(["startsAt", "status"]);
  // An empty list is no choice: every filter shows.
  expect(
    ux("pages:\n  sessions:\n    filters: { shown: [] }\n").ux?.pages.sessions?.filtersShown,
  ).toBeUndefined();
  const unknown = ux("pages:\n  sessions:\n    filters: { shown: [notes] }\n");
  expect(unknown.diagnostics.map((d) => d.message)).toEqual([
    expect.stringContaining('sessions has no filter named "notes" to show first'),
  ]);
  const files = { spec: SPEC, ux: "smithableUx: 0.1\n" };
  const set = applyOperation(files, "setFiltersShown", {
    page: "sessions",
    fields: ["status", "startsAt"],
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toContain(
    "pages:\n  sessions:\n    filters:\n      shown: [status, startsAt]\n",
  );
  expect(set.description).toBe("Show the status, startsAt filters of sessions first");
  const wrong = applyOperation(files, "setFiltersShown", { page: "sessions", fields: ["notes"] });
  expect(wrong.ok ? "" : wrong.message).toContain('sessions has no filter named "notes"');
  const all = applyOperation(set.files, "setFiltersShown", { page: "sessions" });
  if (!all.ok) throw new Error(all.message);
  expect(all.files.ux).not.toContain("filters");
  const renamed = applyOperation(set.files, "renameField", {
    model: "Session",
    from: "status",
    to: "state",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.ux).toContain("shown: [state, startsAt]");
  const removed = applyOperation(set.files, "removeField", { model: "Session", field: "status" });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.ux).toContain("shown: [startsAt]");
  // A filter the page no longer offers leaves the shown list too.
  const fewer = applyOperation(set.files, "setFilters", { page: "sessions", fields: ["status"] });
  if (!fewer.ok) throw new Error(fewer.message);
  expect(fewer.files.ux).toContain("shown: [status]");
  const gone = applyOperation(set.files, "setFilters", { page: "sessions", fields: ["places"] });
  if (!gone.ok) throw new Error(gone.message);
  expect(gone.files.ux).not.toContain("shown");
});
