import { describe, expect, it } from "vitest";
import { editAsOperations } from "./edit-words.js";

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

describe("editAsOperations", () => {
  it("fields added, removed, changed or renamed are those operations", () => {
    expect(
      editAsOperations(spec, spec.replace("email: email", "email: email, phone: phone")),
    ).toEqual({
      operations: [{ op: "addField", args: { model: "Customer", field: "phone", type: "phone" } }],
      other: [],
    });
    expect(editAsOperations(spec, spec.replace(", email: email", ""))?.operations).toEqual([
      { op: "removeField", args: { model: "Customer", field: "email" } },
    ]);
    expect(editAsOperations(spec, spec.replace("total: money", "total: int"))?.operations).toEqual([
      { op: "changeField", args: { model: "Order", field: "total", type: "int" } },
    ]);
    // A rename beside another change: the rename operation still, so the records are kept in words too.
    const edited = spec
      .replace("email: email", "mail: email")
      .replace("total: money", "total: int");
    expect(editAsOperations(spec, edited)?.operations).toEqual([
      { op: "renameField", args: { model: "Customer", from: "email", to: "mail" } },
      { op: "changeField", args: { model: "Order", field: "total", type: "int" } },
    ]);
  });
  it("kinds of record and pages that come, go or are renamed; the rest named as parts", () => {
    const more =
      `${spec}  suppliers: { crud: Supplier }\n  home: { landing: { sections: [] } }\n`.replace(
        "  Order:",
        "  Supplier:\n    fields: { name: string! }\n  Order:",
      );
    expect(editAsOperations(spec, more)).toEqual({
      operations: [
        { op: "addModel", args: { model: "Supplier" } },
        { op: "addPage", args: { page: "suppliers", model: "Supplier" } },
        { op: "addLandingPage", args: { page: "home" } },
      ],
      other: [],
    });
    expect(editAsOperations(more, spec)).toEqual({
      operations: [
        { op: "removePage", args: { page: "suppliers" } },
        { op: "removePage", args: { page: "home" } },
      ],
      other: ["removed the Supplier records"],
    });
    expect(editAsOperations(spec, spec.replace("  orders:", "  sales:"))?.operations).toEqual([
      { op: "renamePage", args: { from: "orders", to: "sales" } },
    ]);
    expect(
      editAsOperations(
        spec,
        spec
          .replace("name: Shop", "name: Store")
          .replace("crud: Order }", "crud: Order, search: [total] }")
          .replace("  Order:\n", "  Order:\n    trash: true\n"),
      ),
    ).toEqual({
      operations: [],
      other: ["the Order records' settings", "the orders page", "the app"],
    });
  });
  it("the content file's texts are setText of their paths", () => {
    const content =
      "smithableContent: 0.1\npages:\n  orders: { subtitle: Every order. }\nmodels:\n  Order: { fields: { total: { label: Sum } } }\n";
    expect(
      editAsOperations(
        content,
        content.replace("Every order.", "All orders").replace("{ label: Sum }", "{}"),
        "smithable.content.yml",
      ),
    ).toEqual({
      operations: [
        { op: "setText", args: { path: ["pages", "orders", "subtitle"], text: "All orders" } },
        { op: "setText", args: { path: ["models", "Order", "fields", "total", "label"] } },
      ],
      other: [],
    });
  });
  it("the same text, or no YAML, reads as nothing", () => {
    expect(editAsOperations(spec, spec)).toBeUndefined();
    expect(editAsOperations(spec, "models: [")).toBeUndefined();
    expect(editAsOperations("a: 1", "a: 2", "smithable.auth.yml")).toEqual({
      operations: [],
      other: ["a in smithable.auth.yml"],
    });
  });
});
