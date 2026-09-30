import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields:
      name: string!
      email: email
      phone: phone
      segment: smb | enterprise
      creditLimit: { type: money, min: 0, max: 100000 }
      notes: text
pages:
  customers: { crud: Customer }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [customers], read: [Customer], create: [Customer] }\n",
  },
  ir,
).auth as AuthIR;
const ux = validateUx(
  {
    path: "smithable.ux.yml",
    text: `smithableUx: 0.1
pages:
  customers:
    table: { sort: -creditLimit, view: cards }
    form:
      columns: 2
      sections:
        - { name: contact, fields: [name, email, phone] }
        - { name: terms, fields: [creditLimit, segment] }
      control: { creditLimit: slider, segment: radio, notes: textarea }
`,
  },
  ir,
).ux;
const content =
  validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  customers:\n    form: { sections: { contact: { title: How to reach them } } }\n",
    },
    ir,
  ).content ?? emptyContent();
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content, ux });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("the form's sections, columns and controls reach the routes as props; the list its sort and view", () => {
  const form = file("src/routes/customers/new.tsx");
  const oneLine = form.replace(/\s+/g, " ").replace(/,( ?[}\]])/g, "$1");
  expect(oneLine).toContain(
    '{ name: "contact", title: "How to reach them", fields: ["name", "email", "phone"] }',
  );
  expect(oneLine).toContain(
    '{ name: "terms", title: "Terms", fields: ["creditLimit", "segment"] }',
  );
  expect(form).toContain("formColumns={2}");
  expect(form).toContain(
    'control={{ creditLimit: "slider", segment: "radio", notes: "textarea" }}',
  );
  const list = file("src/routes/customers/index.tsx");
  expect(list).toContain('rows={sortRows(rows, "creditLimit", true)}');
  expect(list).toContain('view="cards"');
  expect(file("src/generated/customer.ts").replace(/\s+/g, " ")).toMatch(/min: 0, max: 100000/);
});

test("without any of it the routes are as before", () => {
  const plain = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const form = plain.find((f) => f.path === "src/routes/customers/new.tsx")?.content ?? "";
  expect(form).not.toContain("sections=");
  expect(form).not.toContain("control=");
  expect(plain.find((f) => f.path === "src/routes/customers/index.tsx")?.content).not.toContain(
    "sortRows",
  );
});
