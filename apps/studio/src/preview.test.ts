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
        { op: "setText", args: { path: ["pages", "suppliers", "subtitle"] } },
        "/orders",
        ir,
      ),
    ).toBe(false);
    expect(touchesPage({ op: "addModel", args: { model: "Tag" } }, "/orders", ir)).toBe(false);
  });
  it("the menu, the look, a page not known, or no operation loads it again", () => {
    // Another page's title is in this page's menu.
    expect(
      touchesPage(
        { op: "setText", args: { path: ["pages", "suppliers", "title"] } },
        "/orders",
        ir,
      ),
    ).toBe(true);
    expect(
      touchesPage({ op: "addPage", args: { page: "x", model: "Supplier" } }, "/orders", ir),
    ).toBe(true);
    expect(touchesPage(field("Supplier"), "/sign-in", ir)).toBe(true);
    expect(touchesPage(undefined, "/orders", ir)).toBe(true);
  });
  it("a change that rewrote only words modules leaves every page as it is: the preview shows the words in place", () => {
    const title = { op: "setText", args: { path: ["pages", "orders", "title"] } };
    expect(touchesPage(title, "/orders", ir, ["src/generated/pages.ts"])).toBe(false);
    expect(touchesPage(undefined, "/orders", ir, ["src/generated/pages.ts"])).toBe(false);
    expect(touchesPage(title, "/", undefined, ["src/generated/pages.ts"])).toBe(false);
    expect(
      touchesPage(title, "/orders", ir, ["src/generated/order.ts", "src/generated/app.ts"]),
    ).toBe(false);
    // A model's label is also in its list page's code and its server module: as before.
    expect(
      touchesPage({ op: "setText", args: { path: ["models", "Order", "label"] } }, "/orders", ir, [
        "src/generated/order.ts",
        "src/generated/order.server.ts",
        "src/routes/orders/index.tsx",
      ]),
    ).toBe(true);
    expect(touchesPage(title, "/orders", ir, [])).toBe(true);
  });
});
