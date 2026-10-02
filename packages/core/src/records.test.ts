import { expect, test } from "vitest";
import { validateContent } from "./content.js";
import { parseCsv, readRecords } from "./records.js";
import { validateSpec } from "./spec.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields: { name: string!, segment: smallBusiness | enterprise, creditLimit: money, active: bool = true, since: date, logo: picture }
  Order:
    fields: { number: string!, customer: Customer!, total: money!, placedAt: datetime }
pages:
  customers: { crud: Customer }
`,
}).ir;
if (!ir) throw new Error("invalid");
const customer = ir.models.find((m) => m.name === "Customer");
const order = ir.models.find((m) => m.name === "Order");
if (!customer || !order) throw new Error("no models");
const content = validateContent(
  {
    path: "smithable.content.yml",
    text: "smithableContent: 0.1\nmodels:\n  Customer:\n    fields:\n      creditLimit: { label: Credit line }\n",
  },
  ir,
).content;

test("CSV: quotes, doubled quotes, line breaks in quotes, a semicolon file, blank lines", () => {
  expect(parseCsv('a,b\n"x, y","say ""hi"""\n"two\nlines",3\n\n')).toEqual([
    ["a", "b"],
    ["x, y", 'say "hi"'],
    ["two\nlines", "3"],
  ]);
  expect(parseCsv("﻿name;total\r\nA;12,50\r\n")).toEqual([
    ["name", "total"],
    ["A", "12,50"],
  ]);
});

test("columns by name, label or map; values converted as samples are; unknown columns left out", () => {
  const read = readRecords(
    'Name,Segment,Credit line,Active,Since,Notes\nNordic Timber,Enterprise,"1 200,50",no,2026-01-05,keep\nSkerry,smallBusiness,,,,\n',
    customer,
    content,
  );
  expect(read.refusals).toEqual([]);
  expect(read.ignored).toEqual(["Notes"]);
  expect(read.columns.map((c) => c.field)).toEqual([
    "name",
    "segment",
    "creditLimit",
    "active",
    "since",
  ]);
  expect(read.rows).toEqual([
    {
      name: "Nordic Timber",
      segment: "enterprise",
      creditLimit: 120050,
      active: false,
      since: "2026-01-05",
    },
    // An empty cell with a default keeps the default; one without is no value.
    { name: "Skerry", segment: "smallBusiness", creditLimit: null, since: null },
  ]);
  expect(readRecords("Company\nAcme\n", customer, content, { Company: "name" }).rows).toEqual([
    { name: "Acme" },
  ]);
});

test("every refusal with its line and column; references as titles for the host", () => {
  const bad = readRecords(
    "Number,Customer,Total,Placed at\nORD-1,Nordic Timber,lots,2026-10-05 08:00\n,Skerry,10,\n",
    order,
  );
  expect(bad.rows[0]).toEqual({
    number: "ORD-1",
    customer: { title: "Nordic Timber" },
    placedAt: "2026-10-05T08:00",
  });
  expect(bad.refusals).toEqual([
    { line: 2, column: "Total", message: '"lots" is not an amount, like 12.50.' },
    { line: 3, column: "Number", message: '"number" is required.' },
  ]);
  // A required field no column fills, a picture column, two columns for one field.
  expect(readRecords("Logo,Name,name\nx,A,B\n", customer).refusals.map((r) => r.message)).toEqual([
    '"logo" cannot be imported: pictures and calculated fields are not imported.',
    'Two columns fill "name".',
  ]);
  expect(readRecords("Segment\nenterprise\n", customer).refusals[0]?.message).toBe(
    'No column fills "name", which every customer needs.',
  );
});
