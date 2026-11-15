import { validateSpec } from "@smithable/core";
import { describe, expect, it } from "vitest";
import {
  conditionOf,
  setRowsOf,
  unfinishedConditions,
  valuesOf,
  waysFor,
  whenable,
  whenRowsOf,
} from "./action-rows";

describe("a standard action's rows (A 203)", () => {
  it("reads a condition into rows and back, a choice with one value as that value", () => {
    const rows = whenRowsOf({ status: ["todo", "doing"], done: false, assignee: "not ME()" });
    expect(rows).toEqual([
      { field: "status", value: ["todo", "doing"] },
      { field: "done", value: false },
      { field: "assignee", value: "not ME()" },
    ]);
    expect(
      conditionOf([...rows, { field: "kind", value: ["bug"] }, { field: "x", value: [] }]),
    ).toEqual({
      status: ["todo", "doing"],
      done: false,
      assignee: "not ME()",
      kind: "bug",
    });
  });
  it("reads what an action sets into rows and gives back setAction's values", () => {
    const rows = setRowsOf([
      { field: "status", value: "done" },
      {
        field: "doneOn",
        formula: { kind: "call", name: "TODAY", args: [] } as never,
        text: "TODAY()",
      },
      { field: "reason", asked: true },
      { field: "owner", me: true },
    ]);
    expect(rows.map((r) => r.how)).toEqual(["value", "formula", "ask", "me"]);
    expect(valuesOf(rows)).toEqual({
      status: "done",
      doneOn: "TODAY()",
      reason: "",
      owner: "ME()",
    });
  });
  it("offers ME() only for a reference to User, and only asking for another reference", () => {
    const ref = (model: string) =>
      ({ name: "r", type: { kind: "relation", model, many: false } }) as never;
    expect(waysFor(ref("User"))).toEqual(["me", "ask"]);
    expect(waysFor(ref("Customer"))).toEqual(["ask"]);
    expect(waysFor({ name: "n", type: { kind: "scalar", name: "int" } } as never)).toEqual([
      "value",
      "formula",
      "ask",
    ]);
  });
});

it("timer condition choices exclude references and computed fields while shared defaults stay rich", () => {
  const checked = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Conditions }
models:
  Item:
    fields:
      status: todo | done
      active: bool
      assignee: User
      derived: { type: bool, formula: active }
`,
  });
  expect(checked.diagnostics).toEqual([]);
  const model = checked.ir?.models.find((item) => item.name === "Item");
  expect(model).toBeDefined();
  expect(whenable(model).map((field) => field.name)).toEqual([
    "status",
    "active",
    "assignee",
    "derived",
  ]);
  expect(
    whenable(model, { computed: false, references: false }).map((field) => field.name),
  ).toEqual(["status", "active"]);
});

it("a saved empty computed-text condition is settled, while a new or cleared condition is pending", () => {
  const checked = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: {name: Empty condition}
models:
  Item:
    fields:
      name: string
      derived: {type: string, formula: name}
actions:
  fillName:
    on: Item
    when: {derived: ""}
    set: {name: filled}
`,
  });
  expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const action = checked.ir?.actions[0];
  expect(action && !action.custom).toBe(true);
  const original = whenRowsOf(action && !action.custom ? action.when : undefined);
  expect(original).toEqual([{ field: "derived", value: "" }]);
  expect(conditionOf([...original, { field: "active", value: false }])).toEqual({
    derived: "",
    active: false,
  });
  expect(unfinishedConditions(original, original)).toBe(false);
  expect(unfinishedConditions([{ field: "derived", value: "" }], [])).toBe(true);
  expect(
    unfinishedConditions(
      [{ field: "derived", value: "" }],
      [{ field: "derived", value: "filled" }],
    ),
  ).toBe(true);
});
