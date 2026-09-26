import { expect, test } from "vitest";
import { validateContent } from "./content.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const spec = `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields:
      name: string!
      segment: smb | enterprise
pages:
  customers: { crud: Customer }
navigation:
  main: [customers]
  admin: [customers]
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;

const check = (text: string) => validateContent({ path: "smithable.content.yml", text }, ir);

test("reads labels, help, choice texts, page titles and menu labels", () => {
  const { content, diagnostics } = check(`smithableContent: 0.1
models:
  Customer:
    label: Client
    fields:
      name: { label: Company name, help: As on the invoice. }
      segment: { values: { smb: Small business } }
pages:
  customers: { title: Our clients }
menus:
  admin: { label: Administration }
`);
  expect(diagnostics).toEqual([]);
  expect(content).toEqual({
    models: {
      Customer: {
        label: "Client",
        fields: {
          name: { label: "Company name", help: "As on the invoice." },
          segment: { values: { smb: "Small business" } },
        },
      },
    },
    pages: { customers: { title: "Our clients" } },
    menus: { admin: { label: "Administration" } },
  });
});

test("every reference must exist in the spec", () => {
  const { content, diagnostics } = check(`smithableContent: 0.1
models:
  Custmer: { label: X }
  Customer:
    fields:
      nme: { label: X }
      name: { values: { a: A } }
      segment: { values: { small: S }, tooltip: T }
pages:
  clients: { title: X }
`);
  expect(content).toBeUndefined();
  expect(diagnostics.map((d) => [d.line, d.code, d.hint])).toEqual([
    [3, "unknown-model", 'Did you mean "Customer"?'],
    [6, "unknown-field", 'Did you mean "name"?'],
    [7, "invalid-key", undefined],
    [8, "unknown-value", undefined],
    [8, "unknown-key", undefined],
    [10, "unknown-page", undefined],
  ]);
});

test("the content file needs its version", () => {
  expect(check("models: {}\n").diagnostics.map((d) => d.code)).toEqual(["invalid-version"]);
});
