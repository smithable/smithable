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

function route(spec: string): string | undefined {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: at("smithable.auth.yml") }, ir)
    .auth as AuthIR;
  const content = validateContent(
    { path: "smithable.content.yml", text: at("smithable.content.yml") },
    ir,
  ).content as ContentIR;
  return generateApp(ir, { smithableVersion: "0.0.0", auth, content }).find((f) =>
    f.path.endsWith("/invoices/$id_.document.tsx"),
  )?.content;
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
  expect(before).toContain("await invoiceLineData.get(viewer, line.id)");
  expect(before).toContain("await clientData.get(viewer, Number(toId))");
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
