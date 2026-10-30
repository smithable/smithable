import { describe, expect, it } from "vitest";
import { conditionOf, setRowsOf, valuesOf, waysFor, whenRowsOf } from "./action-rows";

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
