import { expect, test } from "vitest";
import type { TraceEntry } from "./api";
import {
  lastLine,
  line,
  lineByWords,
  listing,
  milestoneNamed,
  readHistory,
  restores,
  splitHistory,
} from "./history";

/** A history, newest first, as the trace gives it. */
const entry = (
  number: number,
  description: string,
  more: Partial<TraceEntry> = {},
): TraceEntry => ({
  id: `${number}`.padStart(40, "0"),
  description,
  at: "2026-11-07T10:00:00Z",
  engine: "generator",
  tokens: 0,
  undone: false,
  isUndo: false,
  files: [],
  rewritten: [],
  snapshot: false,
  number,
  ...more,
});

test("requests about the history are read by rule, free text only where §8 allows it", () => {
  expect(readHistory("What have I changed?")).toEqual({ kind: "list", scope: { all: true } });
  expect(readHistory("what did I do today")).toEqual({ kind: "list", scope: { today: true } });
  expect(readHistory("what have I changed since #12")).toEqual({
    kind: "list",
    scope: { since: 12 },
  });
  expect(readHistory("what have I changed since Before the shop")).toEqual({
    kind: "list",
    scope: { milestone: "Before the shop" },
  });
  expect(readHistory('what have I changed since "today"')).toEqual({
    kind: "list",
    scope: { milestone: "today", quoted: true },
  });
  expect(readHistory("What have I changed since Before the shop?")).toEqual({
    kind: "list",
    scope: { milestone: "Before the shop" },
  });
  expect(readHistory("Undo the last change")).toEqual({ kind: "undo", last: true });
  expect(readHistory("undo that")).toEqual({ kind: "undo", last: true });
  expect(readHistory("take that back")).toEqual({ kind: "undo", last: true });
  expect(readHistory("undo #12")).toEqual({ kind: "undo", from: 12, to: 12 });
  expect(readHistory("undo change 14 to 12")).toEqual({ kind: "undo", from: 12, to: 14 });
  expect(readHistory("undo the change that added the phone field")).toEqual({
    kind: "undo",
    words: "added the phone field",
  });
  expect(readHistory("what did #12 do?")).toEqual({ kind: "what", number: 12 });
  expect(readHistory("name this a milestone Before the shop")).toEqual({
    kind: "name",
    name: "Before the shop",
  });
  expect(readHistory("name #3 a milestone 'First bookings'")).toEqual({
    kind: "name",
    number: 3,
    name: "First bookings",
  });
  expect(readHistory("rename the milestone Old to New")).toEqual({
    kind: "rename",
    from: "Old",
    to: "New",
  });
  expect(readHistory("remove the milestone Old")).toEqual({ kind: "unname", name: "Old" });
  expect(readHistory("add a phone field to customers")).toBeUndefined();
  expect(readHistory("what have I changed in the colours")).toBeUndefined();
});

test("an undo before another request is split at the clause boundary; free text never is", () => {
  expect(splitHistory("undo that and add a notes field")).toEqual({
    first: { kind: "undo", last: true },
    rest: "add a notes field",
  });
  expect(splitHistory("undo the change that added phone and email")).toBeUndefined();
  expect(splitHistory("add a field and a page")).toBeUndefined();
  expect(splitHistory("remove the milestone Rock and Roll")).toBeUndefined();
  expect(splitHistory("what have I changed since Before and after")).toBeUndefined();
  expect(splitHistory("what did #3 do and add a notes field")).toEqual({
    first: { kind: "what", number: 3 },
    rest: "add a notes field",
  });
});

test("lines carry their numbers, a group's range, and who undid them", () => {
  const group = [entry(14, "Added the Orders page"), entry(13, "c"), entry(12, "b")];
  for (const e of group) e.request = "add orders";
  expect(line(group)).toBe("#12 to #14 b; c; Added the Orders page");
  expect(line([entry(15, "x"), entry(12, "y")])).toBe("#12, #15 y; x");
  expect(line([entry(12, "Added phone", { undone: true, undoneBy: 15 })])).toBe(
    "#12 Added phone, undone by #15",
  );
  expect(line([entry(0, "Old change", { number: undefined })])).toBe("Old change");
});

test("the listing: scopes, five lines at most, milestones by a misspelt name", () => {
  const entries = [6, 5, 4, 3, 2, 1].map((n) =>
    entry(n, `Change ${n}`, n === 3 ? { milestone: "Before the shop" } : {}),
  );
  const all = listing(entries, { all: true });
  if ("unknown" in all) throw new Error("unknown");
  expect(all.lines.map((l) => l.text)).toEqual([
    "#6 Change 6",
    "#5 Change 5",
    "#4 Change 4",
    "#3 Change 3 (milestone: Before the shop, #3)",
    "#2 Change 2",
  ]);
  expect(all.more).toBe(true);
  const since = listing(entries, { milestone: "Befor the shop" });
  expect("lines" in since && since.lines.map((l) => l.text)).toEqual([
    "#6 Change 6",
    "#5 Change 5",
    "#4 Change 4",
  ]);
  expect(listing(entries, { since: 5 })).toMatchObject({ lines: [{ text: "#6 Change 6" }] });
  expect(listing(entries, { milestone: "Nowhere" })).toEqual({ unknown: "Nowhere" });
  expect(listing(entries, { since: 40 })).toEqual({ unknown: "#40" });
  const today = listing(entries, { today: true }, undefined, new Date("2026-11-08T12:00:00"));
  expect("lines" in today && today.lines).toEqual([]);
  expect(milestoneNamed(entries, "before the shop")?.number).toBe(3);
});

test("the last line in place, what undoing it puts back, and a line by its words", () => {
  const entries = [
    entry(4, "Undid: Added the phone field to Customer", { isUndo: true, undoes: 3 }),
    entry(3, "Added the phone field to Customer", { undone: true, undoneBy: 4 }),
    entry(2, "Added the Orders page", { snapshot: true }),
    entry(1, "Renamed the app to Shop"),
  ];
  expect(lastLine(entries)?.map((e) => e.number)).toEqual([2]);
  expect(restores(entries[2] as TraceEntry, entries)).toContain("the records as they were");
  expect(restores(entries[3] as TraceEntry, entries)).toContain("the records stay");
  expect(lineByWords(entries, "the orders page")).toMatchObject({ group: [{ number: 2 }] });
  expect(lineByWords(entries, "the oders page")).toMatchObject({ group: [{ number: 2 }] });
  expect(lineByWords(entries, "the colours")).toBeUndefined();
  const two = [
    entry(2, "Added the phone field to Customer"),
    entry(1, "Added the phone field to Vendor"),
  ];
  expect(lineByWords(two, "the phone field")).toMatchObject({
    two: [[{ number: 2 }], [{ number: 1 }]],
  });
});
