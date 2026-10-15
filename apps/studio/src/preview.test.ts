import { type SpecIR, validateSpec } from "@smithable/core";
import { describe, expect, it } from "vitest";
import { touchesPage } from "./preview";

const checked = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Shop }
models:
  Customer: { fields: { name: string! } }
  Order: { fields: { customer: Customer, total: money } }
  Supplier: { fields: { name: string! } }
pages:
  orders: { crud: Order }
  suppliers: { crud: Supplier }
`,
});
const ir = checked.ir as SpecIR;

const field = (model: string) => ({ op: "addField", args: { model, field: "note", type: "text" } });

describe("touchesPage", () => {
  it("reads its app", () => {
    expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
  it("a field of the page's own records, or of one its links name, loads the page again", () => {
    expect(touchesPage(field("Order"), "/orders", ir)).toBe(true);
    expect(touchesPage(field("Customer"), "/orders/3", ir)).toBe(true);
  });
  it("a field or a text of other records leaves the page as it is", () => {
    expect(touchesPage(field("Supplier"), "/orders", ir)).toBe(false);
    expect(
      touchesPage(
        { op: "setText", args: { path: ["models", "Supplier", "label"] } },
        "/orders",
        ir,
      ),
    ).toBe(false);
    expect(
      touchesPage(
        { op: "setText", args: { path: ["pages", "suppliers", "title"] } },
        "/orders",
        ir,
      ),
    ).toBe(false);
    expect(touchesPage({ op: "addModel", args: { model: "Tag" } }, "/orders", ir)).toBe(false);
  });
  it("the menu, the look, a page not known, or no operation loads it again", () => {
    expect(
      touchesPage({ op: "addPage", args: { page: "x", model: "Supplier" } }, "/orders", ir),
    ).toBe(true);
    expect(touchesPage(field("Supplier"), "/sign-in", ir)).toBe(true);
    expect(touchesPage(undefined, "/orders", ir)).toBe(true);
  });
});
