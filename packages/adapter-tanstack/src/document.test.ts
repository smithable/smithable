import {
  type AuthIR,
  type ContentIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// The invoice as a document (docs/design/record-documents.md §4.2, §8).
const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const at = (file: string) => raw[`../../../examples/invoicing/${file}`] as string;

function route(spec: string, signIn?: AuthIR["signIn"]): string | undefined {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const read = validateAuth({ path: "smithable.auth.yml", text: at("smithable.auth.yml") }, ir)
    .auth as AuthIR;
  const auth = signIn ? { ...read, signIn } : read;
  const content = validateContent(
    { path: "smithable.content.yml", text: at("smithable.content.yml") },
    ir,
  ).content as ContentIR;
  // The page's route and the reader it calls (the same reader a sent copy is made with).
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  const page = files.find((f) => f.path.endsWith("/invoices/$id_.document.tsx"))?.content;
  const reader = files.find((f) => f.path.endsWith("/invoice.document.server.ts"))?.content;
  return page && reader && `${page}\n${reader}`;
}

test("the document sends only its named fields, also after a column is added to a part's table", () => {
  const spec = at("smithable.yml");
  const before = route(spec);
  if (!before) throw new Error("no document route");
  expect(before).toContain(
    'lines: lines.map((line) => pick(line, ["description", "quantity", "unitPrice", "amount"]))',
  );
  expect(before).toContain('to: to && pick(to, ["name", "address", "vatNumber"])');
  expect(before).toContain('from: pick(from, ["businessName", "vatNumber", "iban"])');
  // Each part is read by its own read rule, and private business details are the record owner's.
  expect(before).toContain("invoiceLineData.getIn(q, viewer, line.id)");
  expect(before).toContain("clientData.getIn(q, viewer, Number(toId))");
  expect(before).toContain("if (businessProfileAccess.read.owner)");
  // A worked-out value missing refuses the document instead of printing a blank.
  expect(before).toContain(
    'lines.map((line) => missing(line, [["amount", "Amount"]])).find(Boolean)',
  );
  const added = spec
    .split("      description: string!\n      quantity: decimal! = 1\n")
    .join("      description: string!\n      internalNote: string\n      quantity: decimal! = 1\n")
    .split("      email: email!\n      address: text\n")
    .join("      email: email!\n      creditRating: string\n      address: text\n");
  expect(added).toContain("internalNote");
  expect(added).toContain("creditRating");
  expect(route(added)).toBe(before);
});

test("a page without a document has no document route", () => {
  const spec = at("smithable.yml").replace(/^ {4}document:\n(?: {6}.*\n)+/m, "");
  expect(route(spec)).toBeUndefined();
});

test("a worked-out value of the one it is for is missing only when there is someone", () => {
  const spec = at("smithable.yml")
    .split("      vatNumber: string\n      invoices: Invoice[]\n")
    .join(
      '      vatNumber: string\n      tag: { type: string, formula: "CONCAT(name, vatNumber)" }\n      invoices: Invoice[]\n',
    )
    .split("show: [name, address, vatNumber] }")
    .join("show: [name, address, vatNumber, tag] }");
  expect(spec).toContain("vatNumber, tag]");
  expect(route(spec)).toMatch(/\(to \? missing\(to, \[\["tag", /);
});

test("a line in the trash is not on the document, so it refuses nothing", () => {
  const spec = at("smithable.yml").replace("  InvoiceLine:\n", "  InvoiceLine:\n    trash: true\n");
  expect(route(spec)).toContain("where: (t, { isNull }) => isNull(t.deletedAt),");
  expect(route(at("smithable.yml"))).not.toContain("isNull(t.deletedAt)");
});

test("without sign-in the business details are the app's, not an owner's", () => {
  const signedOut = route(at("smithable.yml"), "none");
  if (!signedOut) throw new Error("no document route");
  expect(signedOut).not.toContain("ownerId");
  expect(signedOut).not.toContain(".read.owner");
});

// A sent invoice's link (record-documents.md §5, §8).
function files(spec: string, words = at("smithable.content.yml")): Map<string, string> {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: at("smithable.auth.yml") }, ir)
    .auth as AuthIR;
  const content = validateContent({ path: "smithable.content.yml", text: words }, ir)
    .content as ContentIR;
  const made = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  return new Map(made.map((f) => [f.path, f.content]));
}

test("a mail that says {view} makes the link's page, and the document page lists what was sent", () => {
  const app = files(at("smithable.yml"));
  const view = [...app].find(([path]) => path.endsWith("routes/d.$token.tsx"))?.[1];
  if (!view) throw new Error("no link page");
  // Wrong, ended and withdrawn links answer alike, and the copy is never cached or indexed.
  expect(view).toContain("viewAllowed(headers);");
  expect(view).toContain("if (!copy) viewMissed(headers);");
  expect(view).toContain('"Cache-Control": "private, no-store"');
  expect(view).toContain('"X-Robots-Tag": "noindex"');
  // The page shows the stored copy, never the live record.
  expect(view).not.toContain("readInvoiceDocument");
  const page = [...app].find(([path]) => path.endsWith("/invoices/$id_.document.tsx"))?.[1];
  expect(page).toContain("<SentDocuments");
  // Only whoever may read the invoice sees what was sent, and withdrawing needs its write rule.
  expect(page).toContain(
    "if (!(await invoiceData.get(viewer, id))) return { sent: [], withdraw: false };",
  );
  expect(page).toContain("allows(invoiceAccess.write, viewer,");
  expect(page).toContain("writeAllowed(viewer, getRequestHeaders());");
  // Removing an invoice removes its copies, and their links with them (it has no trash).
  const data = [...app].find(([path]) => path.endsWith("/invoice.server.ts"))?.[1];
  expect(data).toContain('removeCopies(tx, "Invoice", id);');
  // With a trash, trashing ends the links (restoring touches no link, so they stay ended).
  const trashed = files(
    at("smithable.yml").replace("  Invoice:\n", "  Invoice:\n    trash: true\n"),
  );
  const kept = [...trashed].find(([path]) => path.endsWith("/invoice.server.ts"))?.[1];
  expect(kept).toContain('endLinks(tx, viewer, "Invoice", id, "trashed");');
});

test("without a {view} mail there is no link page and no Sent list", () => {
  const words = at("smithable.content.yml");
  expect(words).toContain(" You can open it at {view} and");
  const app = files(
    at("smithable.yml"),
    words.split(" You can open it at {view} and").join(" And"),
  );
  expect([...app.keys()].some((p) => p.endsWith("routes/d.$token.tsx"))).toBe(false);
  expect([...app.keys()].some((p) => p.endsWith("kit/view.server.ts"))).toBe(false);
  const page = [...app].find(([path]) => path.endsWith("/invoices/$id_.document.tsx"))?.[1];
  expect(page).not.toContain("SentDocuments");
});
