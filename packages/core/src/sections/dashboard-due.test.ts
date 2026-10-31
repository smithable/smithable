import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";

const spec = (tiles: string) => `smithable: 0.1
app: { name: Desk }
models:
  FollowUp:
    fields:
      title: string!
      dueOn: date
      done: bool
pages:
  overview:
    route: /
    dashboard:
${tiles}
  follow-ups: { crud: FollowUp }
`;
const read = (tiles: string) => validateSpec({ path: "smithable.yml", text: spec(tiles) });
const tile = (tiles: string) => {
  const page = read(tiles).ir?.pages.find((p) => p.id === "overview");
  return page?.pattern.kind === "dashboard" ? page.pattern.items[0] : undefined;
};

test("a list tile of what is due names its date field; within is 7 days unsaid (look-gap §4)", () => {
  expect(
    read("      due: { list: FollowUp, when: dueOn, where: { done: false } }\n").diagnostics,
  ).toEqual([]);
  // Unsaid, the span is the readers' default (DUE_WITHIN, 7 days), so --explain can say so.
  expect(tile("      due: { list: FollowUp, when: dueOn }\n")).toMatchObject({
    kind: "list",
    when: "dueOn",
  });
  expect(tile("      due: { list: FollowUp, when: dueOn }\n")?.within).toBeUndefined();
  expect(tile("      due: { list: FollowUp, when: dueOn, within: 2 weeks }\n")?.within).toEqual({
    amount: 2,
    unit: "week",
  });
  const message = (tiles: string) => read(tiles).diagnostics[0]?.message;
  expect(message("      due: { count: FollowUp, when: dueOn }\n")).toBe(
    '"when" makes a list of what is due: it goes with "list", as in { list: FollowUp, when: dueOn }.',
  );
  expect(message("      due: { list: FollowUp, when: title }\n")).toBe(
    '"when" needs a date field: title is not one.',
  );
  expect(message("      due: { list: FollowUp, within: 3 days }\n")).toBe(
    '"within" goes with "when": how far ahead what is due reaches.',
  );
  expect(message("      due: { list: FollowUp, when: dueOn, within: soon }\n")).toBe(
    '"within" is a number of days or weeks, as in 7 days or 2 weeks.',
  );
});

test("the latest changes are a tile of their own kind, by its key, never by its name (look-gap §4)", () => {
  expect(tile("      recent: { activity: changes, limit: 8 }\n")).toEqual({
    name: "recent",
    kind: "activity",
    model: "",
    limit: 8,
  });
  // A tile named "activity" that says count is a count: the name decides nothing.
  expect(tile("      activity: { count: FollowUp }\n")?.kind).toBe("stat");
  const message = (tiles: string) => read(tiles).diagnostics[0]?.message;
  expect(message("      recent: { activity: all }\n")).toBe(
    '"activity" is changes: the app\'s latest changes.',
  );
  expect(message("      recent: { activity: changes, where: { done: false } }\n")).toBe(
    '"where" does not apply to the latest changes.',
  );
});

test("a due list follows its renamed date field, and holds the field from removal", () => {
  const files = { spec: spec("      due: { list: FollowUp, when: dueOn }\n") };
  const renamed = applyOperation(files, "renameField", {
    model: "FollowUp",
    from: "dueOn",
    to: "dueDate",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("due: { list: FollowUp, when: dueDate }");
  const removed = applyOperation(files, "removeField", { model: "FollowUp", field: "dueOn" });
  expect(removed.ok ? "" : removed.message).toContain(
    'The "due" tile of the overview page uses FollowUp.dueOn',
  );
});
