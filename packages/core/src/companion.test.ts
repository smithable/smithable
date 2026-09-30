import { expect, test } from "vitest";
import { applyOperation, OPERATIONS } from "./apply.js";
import { COMPANIONS } from "./companion.js";
import { PAGE_PATTERNS, PATTERN_KINDS } from "./patterns.js";
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
  expect(appSection.operations?.map((o) => o.name)).toEqual(["setApp"]);
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

test("a page pattern is one object: how it is written, what it shows, its operations", () => {
  for (const kind of PATTERN_KINDS) {
    const pattern = PAGE_PATTERNS[kind];
    expect(pattern.kind).toBe(kind);
    expect(pattern.schema).toBeTruthy();
    expect(pattern.example).toBeTruthy();
    for (const op of pattern.operations ?? []) expect(pagesSection.operations).toContain(op);
  }
});

test("a registrant's refusal fails the operation with its message, and nothing is written", () => {
  // The invoicing dashboard sums Invoice.total: the field cannot go while the tile counts on it.
  const invoicing = Object.values(
    import.meta.glob("../../../examples/invoicing/smithable.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  )[0] as string;
  const result = applyOperation({ spec: invoicing }, "removeField", {
    model: "Invoice",
    field: "total",
  });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.message).toMatch(/tile .* uses Invoice\.total; change or remove the tile first/);
});
