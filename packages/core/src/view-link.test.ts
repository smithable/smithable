import { expect, test } from "vitest";
import { validateContent } from "./content.js";
import { validateSpec } from "./spec.js";

// {view}: the link to a copy of the document as sent (docs/design/record-documents.md §5).
const files = import.meta.glob("../../../examples/invoicing/smithable.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const starter = Object.values(files)[0] as string;
const sent = "    recipient: client.email\n";
if (!starter.includes(sent)) throw new Error("the invoicing starter changed");

const messages = (spec: string, text: string) => {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
  if (!ir) throw new Error("no IR");
  return validateContent(
    {
      path: "smithable.content.yml",
      text: `smithableContent: 0.1\noutgoing:\n  invoiceSent:\n    subject: Invoice {number}\n    text: "${text}"\n`,
    },
    ir,
  )
    .diagnostics.filter((d) => d.message.includes("outgoing"))
    .map((d) => d.message);
};

test("{view} fills a mail's text only on a model whose page has a document", () => {
  expect(messages(starter, "Your invoice: {view}")).toEqual([]);
  const without = starter.replace(/^ {4}document:\n(?: {6}.*\n)+/m, "");
  expect(messages(without, "Your invoice: {view}")).toContainEqual(
    expect.stringContaining('no crud page of Invoice has a "document"'),
  );
});

test("viewDays is a whole number of days from 1 to 365", () => {
  const days = (value: string) =>
    validateSpec({
      path: "smithable.yml",
      text: starter.split(sent).join(`${sent}    viewDays: ${value}\n`),
    });
  const ok = days("30");
  expect(ok.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(ok.ir?.outgoing.find((o) => o.name === "invoiceSent")?.viewDays).toBe(30);
  for (const bad of ["0", "366", "1.5"])
    expect(days(bad).diagnostics.map((d) => d.message)).toContainEqual(
      expect.stringContaining('"viewDays" is how many days the {view} link opens'),
    );
});
