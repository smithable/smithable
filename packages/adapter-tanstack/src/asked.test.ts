import { expect, test } from "vitest";

// The kit file is the app's own; it is loaded as the app would have it, not compiled here.
const path: string = "../templates/src/kit/asked.ts";
const { asked, foundNone, spreadField, spreadWords } = (await import(path)) as {
  asked: (
    tool: string,
    args: Record<string, unknown>,
    result: unknown,
    kind: unknown,
    split?: unknown,
  ) => string | undefined;
  foundNone: (result: unknown) => boolean;
  spreadField: (kind: unknown, where: unknown) => string | undefined;
  spreadWords: (kind: unknown, field: string, rows: unknown[]) => string;
};

const component = {
  model: "Component",
  label: "Component",
  pluralLabel: "Components",
  fields: [
    { name: "name", label: "Name" },
    { name: "status", label: "Status" },
    { name: "checkedAt", label: "Checked at" },
  ],
  filters: [
    {
      field: "status",
      by: "value",
      values: ["operational", "degraded", "down"],
      labels: { operational: "Operational", degraded: "Degraded", down: "Down" },
    },
    { field: "checkedAt", by: "date" },
  ],
  numbers: [],
  by: ["status"],
  path: "/components",
};

test("a find says the kind, each condition in the app's words, the sort, and how many of all", () => {
  expect(
    asked(
      "find",
      { kind: "Component", where: { status: "down" }, sort: "-checkedAt", limit: 10 },
      { columns: ["id", "name"], rows: [[1, "Payments"]], total: 1 },
      component,
    ),
  ).toBe("Components where Status is Down, largest Checked at first · 1");
  expect(
    asked(
      "find",
      { kind: "Component", where: { status: ["degraded", "down"], mine: true }, search: "pay" },
      {
        columns: ["id", "name"],
        rows: [
          [1, "Payments"],
          [2, "Cards"],
        ],
        total: 12,
      },
      component,
    ),
  ).toBe('Components where Status is Degraded or Down, yours, with "pay" · 2 of 12');
  expect(asked("find", { kind: "Component" }, { columns: [], rows: [], total: 0 }, component)).toBe(
    "Components · 0",
  );
});

test("a find that found none says how many there are when the records were split", () => {
  const split = {
    by: "status",
    rows: [
      { value: "operational", number: 3 },
      { value: "degraded", number: 1 },
    ],
  };
  expect(
    asked(
      "find",
      { kind: "Component", where: { status: "down" } },
      { columns: ["id", "name"], rows: [], total: 0 },
      component,
      split,
    ),
  ).toBe("Components where Status is Down · 0 of 4");
  expect(spreadWords(component, "status", split.rows)).toBe("3 Operational, 1 Degraded");
});

test("the spread field is a choice the app can count by that the call filtered on", () => {
  expect(spreadField(component, { status: "down" })).toBe("status");
  expect(spreadField(component, { checkedAt: { from: "2026-10-01" } })).toBeUndefined();
  expect(spreadField(component, undefined)).toBeUndefined();
  expect(foundNone({ columns: [], rows: [], total: 0 })).toBe(true);
  expect(foundNone({ total: 3 })).toBe(false);
  expect(foundNone(null)).toBe(false);
});

test("a measure says what was counted or summed, over which records, per what", () => {
  expect(
    asked("measure", { kind: "Component", where: { status: "down" } }, { total: 0 }, component),
  ).toBe("Count of components where Status is Down");
  expect(
    asked(
      "measure",
      { kind: "Component", of: "max checkedAt", by: "status" },
      { largest: 1 },
      component,
    ),
  ).toBe("Largest Checked at over components, per Status");
  expect(asked("read", { kind: "Component", id: 7 }, {}, component)).toBe("Component 7");
  expect(asked("add", { kind: "Component", values: {} }, {}, component)).toBeUndefined();
});
