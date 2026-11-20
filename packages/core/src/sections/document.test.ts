import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";

const files = import.meta.glob("../../../../examples/invoicing/smithable.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
// The starter without its own document, so each test gives the page the one it reads.
const spec = (Object.values(files)[0] as string).replace(/^ {4}document:\n(?: {6}.*\n)+/m, "");
const crud = "    crud: Invoice\n";
if (!spec.includes(crud)) throw new Error("the invoicing starter changed");

const DOCUMENT = `    document:
      from: [businessName, vatNumber, iban]
      to: { ref: client, show: [name, address, vatNumber] }
      show: [number, issuedOn, dueOn]
      lines: { list: lines, show: [description, quantity, unitPrice, amount] }
      totals: [total]
      note: notes
`;
const withDocument = (document: string, text = spec) =>
  text
    .split(crud)
    .join(`${crud}${document}`)
    .split("      contract: file")
    .join("      notes: text\n      contract: file");
const read = (document: string, text?: string) =>
  validateSpec({ path: "smithable.yml", text: withDocument(document, text) });
const messages = (document: string, text?: string) =>
  read(document, text).diagnostics.map((d) => d.message);

test("a crud page's document keeps exactly the fields its blocks name (record-documents.md §4.1)", () => {
  const { ir, diagnostics } = read(DOCUMENT);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(ir?.pages.find((p) => p.id === "invoices")?.document).toEqual({
    from: ["businessName", "vatNumber", "iban"],
    to: { ref: "client", show: ["name", "address", "vatNumber"] },
    show: ["number", "issuedOn", "dueOn"],
    lines: { list: "lines", show: ["description", "quantity", "unitPrice", "amount"] },
    totals: ["total"],
    note: "notes",
  });
});

test("a document refuses files, lists, unknown fields and wrong blocks", () => {
  expect(messages("    document: { show: [number, contract] }\n")).toContain(
    "Invoice.contract holds files or pictures, so it cannot be on a document.",
  );
  expect(messages("    document: { show: [number, lines] }\n")).toContain(
    "Invoice.lines lists other records, so it cannot be on a document.",
  );
  expect(messages("    document: { show: [numbr] }\n")[0]).toMatch(
    /^"show" of "document" of page "invoices" names "numbr", which is no field of Invoice\./,
  );
  expect(
    messages("    document: { show: [number], to: { ref: status, show: [name] } }\n"),
  ).toContain(
    `"to" of "document" of page "invoices" names "status", which is no reference of Invoice to one record.`,
  );
  expect(
    messages("    document: { show: [number], lines: { list: client, show: [name] } }\n"),
  ).toContain(
    `"lines" of "document" of page "invoices" names "client", which is no list field of Invoice.`,
  );
  expect(messages("    document: { show: [number], note: dueOn }\n")).toContain(
    `"note" of "document" of page "invoices" is one text field of Invoice; dueOn is not text.`,
  );
  // A note is printed as the other fields are, so it is refused as they are.
  expect(
    messages(
      "    document: { show: [number], note: ssn }\n",
      spec.split("      contract: file").join("      ssn: string\n      contract: file"),
    ),
  ).toEqual(expect.arrayContaining([expect.stringContaining("Invoice.ssn")]));
  expect(messages("    document: { to: { ref: client, show: [name] } }\n")).toContain(
    `"document" of page "invoices" needs "show": the record's fields it prints.`,
  );
  expect(messages("    document: { show: [number], title: Invoice }\n")).toContain(
    `"title" in "document" of page "invoices" is visible text, which does not belong in smithable.yml.`,
  );
});

test("a worked-out field is refused when what it is worked out from could not be printed", () => {
  const text = spec
    .split("      unitPrice: money!\n")
    .join("      unitPrice: money!\n      cardNumber: string\n")
    .split("        formula: ROUND(quantity * unitPrice, 2)\n")
    .join(`        formula: IF(cardNumber = "", quantity * unitPrice, 0)\n`);
  expect(messages("    document: { show: [number], totals: [total] }\n", text)).toContain(
    "Invoice.total is worked out from InvoiceLine.cardNumber, which looks like a card number, a password or an identity number, so it cannot be on a document.",
  );
});

test("from needs a settings page, a document belongs to a crud page, and a model has one", () => {
  const noSettings = spec.split("  settings:\n    settings: BusinessProfile\n").join("");
  expect(
    messages("    document: { show: [number], from: [businessName] }\n", noSettings),
  ).toContain(
    `"from" of page "invoices"'s document names fields of the app's settings, and the app has no settings page.`,
  );
  expect(messages("    document: { show: [number], from: [nope] }\n")[0]).toMatch(
    /names "nope", which is no field of BusinessProfile/,
  );
  const twice = withDocument("    document: { show: [number] }\n")
    .split("  clients:\n")
    .join(
      "  bills:\n    crud: Invoice\n    route: /bills\n    document: { show: [number] }\n  clients:\n",
    );
  expect(
    validateSpec({ path: "smithable.yml", text: twice }).diagnostics.map((d) => d.message),
  ).toContain(`Pages "invoices" and "bills" both give Invoice a document; a model has one.`);
  const onSettings = spec
    .split("    settings: BusinessProfile\n")
    .join("    settings: BusinessProfile\n    document: { show: [businessName] }\n");
  expect(
    validateSpec({ path: "smithable.yml", text: onSettings }).diagnostics.map((d) => d.message),
  ).toContain(`"document" belongs to a crud page.`);
});

test("a document follows renamed fields, loses removed ones, and keeps the record's own show", () => {
  const project = { spec: Object.values(files)[0] as string };
  const document = (spec: string) =>
    validateSpec({ path: "smithable.yml", text: spec }).ir?.pages.find((p) => p.id === "invoices")
      ?.document;
  const apply = (name: string, args: Record<string, string>) => {
    const result = applyOperation(project, name, args);
    if (!result.ok) throw new Error(result.message);
    return document(result.files.spec);
  };
  expect(
    apply("renameField", { model: "InvoiceLine", from: "amount", to: "lineTotal" })?.lines,
  ).toEqual({
    list: "lines",
    show: ["description", "quantity", "unitPrice", "lineTotal", "vatRate", "vatAmount"],
  });
  expect(apply("renameField", { model: "Invoice", from: "client", to: "customer" })?.to).toEqual({
    ref: "customer",
    show: ["name", "address", "vatNumber"],
  });
  expect(
    apply("renameField", { model: "BusinessProfile", from: "iban", to: "account" })?.from,
  ).toEqual(["businessName", "businessId", "registeredOffice", "address", "vatNumber", "account"]);
  expect(apply("removeField", { model: "Invoice", field: "number" })?.show).toEqual([
    "issuedOn",
    "deliveryDate",
    "dueOn",
  ]);
  // A block whose reference or list goes, goes with it; so does a list left empty.
  const issuer = project.spec
    .replace(/^( {6}client: .*)$/m, "$1\n      issuer: BusinessProfile")
    .replace(
      "to: { ref: client, show: [name, address, vatNumber] }",
      "to: { ref: issuer, show: [businessName] }",
    );
  const unsent = applyOperation({ spec: issuer }, "removeField", {
    model: "Invoice",
    field: "issuer",
  });
  if (!unsent.ok) throw new Error(unsent.message);
  expect(document(unsent.files.spec)?.to).toBeUndefined();
  const onlyIban = applyOperation(
    {
      spec: project.spec.replace(
        "from: [businessName, businessId, registeredOffice, address, vatNumber, iban]",
        "from: [iban]",
      ),
    },
    "removeField",
    { model: "BusinessProfile", field: "iban" },
  );
  if (!onlyIban.ok) throw new Error(onlyIban.message);
  expect(document(onlyIban.files.spec)?.from).toBeUndefined();
  const shown = applyOperation(
    {
      spec: project.spec.replace(
        "      show: [number, issuedOn, deliveryDate, dueOn]\n",
        "      show: [number]\n",
      ),
    },
    "removeField",
    { model: "Invoice", field: "number" },
  );
  expect(shown).toMatchObject({
    ok: false,
    message: expect.stringContaining("document shows only Invoice.number"),
  });
});
