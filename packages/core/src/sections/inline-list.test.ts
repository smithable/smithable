import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { inlineFields, recordSummary, validateUx } from "../ux.js";

const files = import.meta.glob("../../../../examples/invoicing/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) =>
  Object.entries(files).find(([path]) => path.endsWith(`/${name}`))?.[1] as string;
const ir = validateSpec({ path: "smithable.yml", text: file("smithable.yml") }).ir;
if (!ir) throw new Error("the invoicing starter does not read");
const read = (invoices: string, spec = ir) =>
  validateUx(
    { path: "smithable.ux.yml", text: `smithableUx: 0.1\npages:\n  invoices:\n${invoices}` },
    spec,
    [],
  );

test("an invoice's lines edited in place: the row's own values, the menu warned about (A 215)", () => {
  const line = ir.models.find((m) => m.name === "InvoiceLine");
  if (!line) throw new Error("no InvoiceLine");
  // Not the invoice it is on: the row is on it. The amount is computed, shown as text.
  expect(inlineFields(line, "Invoice").map((f) => f.name)).toEqual([
    "description",
    "quantity",
    "unitPrice",
    "amount",
  ]);
  const inline = read("    record: { lists: { lines: inline } }\n");
  expect(inline.diagnostics).toEqual([]);
  expect(inline.ux?.pages.invoices?.lists).toEqual({ lines: "inline" });
  expect(read("    record: { lists: { lines: grid } }\n").diagnostics[0]?.message).toBe(
    '"lines" in "lists" is table, thread or inline.',
  );
  // With a page of their own in the menu, the lines have two ways in: a warning, not a refusal.
  const menu = validateSpec({
    path: "smithable.yml",
    text: file("smithable.yml")
      .split("  privacy:\n")
      .join("  invoice-lines:\n    crud: InvoiceLine\n  privacy:\n")
      .split("main: [overview, invoices, clients, settings]")
      .join("main: [overview, invoices, clients, invoice-lines, settings]"),
  }).ir;
  if (!menu) throw new Error("the changed starter does not read");
  expect(
    read("    record: { lists: { lines: inline } }\n", menu).diagnostics.map((d) => [
      d.severity,
      d.code,
      d.message,
    ]),
  ).toEqual([
    [
      "warning",
      "inline-in-menu",
      "Lines are edited on their invoice; invoice-lines is a page of its own in the menu too.",
    ],
  ]);
});

test("an order line picks its product in the row; a required file is refused", () => {
  const shop = (line: string, extra = "") =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1
app: { name: Shop }
models:
  Product: { fields: { name: string! } }
  Order:
    fields:
      number: string!
      lines: OrderLine[]
  OrderLine: { fields: { ${line} } }${extra}
pages:
  orders: { crud: Order }
  products: { crud: Product }
navigation:
  main: [orders, products]
`,
    }).ir;
  const messages = (line: string) => {
    const spec = shop(line);
    if (!spec) throw new Error("the shop does not read");
    return validateUx(
      {
        path: "smithable.ux.yml",
        text: "smithableUx: 0.1\npages: { orders: { record: { lists: { lines: inline } } } }\n",
      },
      spec,
      [],
    ).diagnostics.map((d) => d.message);
  };
  const spec = shop("order: Order!, product: Product!, quantity: int! = 1");
  const line = spec?.models.find((m) => m.name === "OrderLine");
  if (!line) throw new Error("no OrderLine");
  // The product is a picker in the row; the order is the row's place.
  expect(inlineFields(line, "Order").map((f) => f.name)).toEqual(["product", "quantity"]);
  expect(messages("order: Order!, product: Product!, quantity: int! = 1")).toEqual([]);
  expect(messages("order: Order!, receipt: file!")).toEqual([
    "OrderLine cannot be edited inline: its receipt is required, and a row has no place to give it (a row asks for values and references, not files or pictures).",
  ]);
});

test("a record's summary in its title row and beside its form, read by type", () => {
  const both = read("    record: { header: summary }\n    form: { aside: summary }\n");
  expect(both.diagnostics).toEqual([]);
  expect(both.ux?.pages.invoices).toMatchObject({ recordHeader: "summary", formAside: "summary" });
  // none is the default: said, it is not kept.
  expect(read("    record: { header: none }\n").ux?.pages.invoices?.recordHeader).toBeUndefined();
  expect(read("    form: { aside: wide }\n").diagnostics[0]?.message).toBe(
    '"aside" of a form is summary or none.',
  );
  const invoice = ir.models.find((m) => m.name === "Invoice");
  if (!invoice) throw new Error("no Invoice");
  const { status, amount, dates } = recordSummary(invoice, {
    "Invoice.status": { paid: "success" },
  });
  expect([status?.name, amount?.name, dates.map((d) => d.name)]).toEqual([
    "status",
    "total",
    ["issuedOn", "dueOn"],
  ]);
});

test("setRecordSummary and setRecordList write the ux file, and the defaults take the key away", () => {
  const spec = file("smithable.yml");
  const header = applyOperation({ spec }, "setRecordSummary", {
    page: "invoices",
    place: "header",
    look: "summary",
  });
  if (!header.ok) throw new Error(header.message);
  expect(header.files.ux).toBe(
    "smithableUx: 0.1\npages:\n  invoices:\n    record:\n      header: summary\n",
  );
  expect(
    applyOperation({ spec, ux: header.files.ux as string }, "setRecordSummary", {
      page: "invoices",
      place: "header",
      look: "none",
    }),
  ).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
  const inline = applyOperation({ spec }, "setRecordList", {
    page: "invoices",
    field: "lines",
    look: "inline",
  });
  if (!inline.ok) throw new Error(inline.message);
  expect(inline.files.ux).toContain("lines: inline");
});
