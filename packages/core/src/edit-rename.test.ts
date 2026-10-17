import { describe, expect, it } from "vitest";
import { applyOperation } from "./apply.js";
import { editAsRename } from "./edit-rename.js";

const spec = `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields: { name: string!, email: email }
  Order:
    fields: { total: money, customer: Customer }
pages:
  customers: { crud: Customer }
  orders: { crud: Order }
`;

describe("editAsRename", () => {
  it("a kind of record, a page or a field renamed and nothing else is that rename", () => {
    expect(editAsRename(spec, spec.replace("  Customer:\n", "  Client:\n"))).toEqual({
      op: "renameModel",
      args: { from: "Customer", to: "Client" },
    });
    expect(editAsRename(spec, spec.replace("  orders:", "  sales:"))).toEqual({
      op: "renamePage",
      args: { from: "orders", to: "sales" },
    });
    expect(editAsRename(spec, spec.replace("email: email", "mail: email"))).toEqual({
      op: "renameField",
      args: { model: "Customer", from: "email", to: "mail" },
    });
  });
  it("anything more than one renamed key is a plain edit", () => {
    // The value changed too, two keys renamed, a key moved, or the same text.
    expect(
      editAsRename(
        spec,
        spec.replace("  Customer:\n", "  Client:\n").replace("email: email", "email: email!"),
      ),
    ).toBeUndefined();
    expect(
      editAsRename(
        spec,
        spec.replace("  Customer:\n", "  Client:\n").replace("  orders:", "  sales:"),
      ),
    ).toBeUndefined();
    expect(editAsRename(spec, spec)).toBeUndefined();
    expect(editAsRename(spec, "a: [")).toBeUndefined();
    expect(
      editAsRename(
        spec,
        spec.replace(
          "Order:\n    fields: { total: money, customer: Customer }",
          "Order:\n    fields: { total: money, customer: Client }",
        ),
      ),
    ).toBeUndefined();
  });
  it("applied through editSpec, the edit is the rename operation, references followed", () => {
    const result = applyOperation({ spec }, "editSpec", {
      text: spec.replace("  Customer:\n", "  Client:\n"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.description).toBe("Rename Customer to Client");
    expect(result.effects).toEqual([{ kind: "rename-model", from: "Customer", to: "Client" }]);
    expect(result.files.spec).toContain("customer: Client");
    expect(result.files.spec).toContain("customers: { crud: Client }");
  });
});
