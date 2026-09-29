import { expect, test } from "vitest";
import { applyOperation, OPERATIONS } from "./apply.js";
import { COMPANIONS } from "./companion.js";
import { PAGE_PATTERNS } from "./ir.js";
import { appSection } from "./sections/app.js";
import { pagesSection } from "./sections/pages.js";

const read = (name: string) =>
  Object.values(
    import.meta.glob("../../../examples/crm/*.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  )[
    Object.keys(
      import.meta.glob("../../../examples/crm/*.yml", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
    ).findIndex((k) => k.endsWith(`/${name}`))
  ] as string;
const files = {
  spec: read("smithable.yml"),
  content: read("smithable.content.yml"),
  ux: read("smithable.ux.yml"),
  auth: read("smithable.auth.yml"),
};

test("companions own their operations; nothing hangs off the app section", () => {
  expect(appSection.operations).toBeUndefined();
  for (const c of COMPANIONS) for (const op of c.operations) expect(OPERATIONS).toContain(op);
});

test("the companions follow a removed page and a retyped field", () => {
  const removed = applyOperation(files, "removePage", { page: "orders" });
  if (!removed.ok) throw new Error(removed.message);
  expect(files.content).toMatch(/^ {2}orders:/m);
  expect(removed.files.content ?? "").not.toMatch(/^ {2}orders:/m);

  // A choice that loses "cancelled" loses its tone; "shipped" keeps its.
  const retyped = applyOperation(files, "changeField", {
    model: "Order",
    field: "status",
    type: "draft | placed | shipped",
  });
  if (!retyped.ok) throw new Error(retyped.message);
  expect(retyped.files.ux).toContain("Order.status: { shipped: success }");
});

test("each page pattern is registered for the IR and for the parser alike", () => {
  const pages = pagesSection.schema.additionalProperties as { oneOf: { required: string[] }[] };
  expect(pages.oneOf.map((o) => o.required[0]).sort()).toEqual(Object.keys(PAGE_PATTERNS).sort());
});
