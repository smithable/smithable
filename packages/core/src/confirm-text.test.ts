import { expect, test } from "vitest";
import { validateContent } from "./content.js";
import { validateSpec } from "./spec.js";

// A standard action that asks before it runs (docs/design/record-documents.md §6).
const SPEC = `smithable: 0.1
app:
  name: Bills
models:
  Client:
    fields:
      name: string!
      email: email
      ssn: string
      ssnTail: { type: string, formula: "CONCAT(name, ssn)" }
  Invoice:
    fields:
      number: string!
      client: Client!
      status: draft | sent
      lines: Line[]
      total: { type: money, formula: SUM(lines.amount) }
  Line:
    fields:
      invoice: Invoice!
      amount: money!
actions:
  send:
    on: Invoice
    when: { status: draft }
    set: { status: sent }
    confirm: true
  remind:
    on: Invoice
    set: { status: sent }
`;

const errors = (text: string) =>
  validateSpec({ path: "smithable.yml", text }).diagnostics.filter((d) => d.severity === "error");

test("confirm: true asks before a standard action, and goes with nothing else", () => {
  const { ir } = validateSpec({ path: "smithable.yml", text: SPEC });
  expect(ir?.actions.find((a) => a.name === "send")).toMatchObject({ confirm: true });
  expect(ir?.actions.find((a) => a.name === "remind")).not.toHaveProperty("confirm");
  expect(errors(SPEC)).toEqual([]);
  const custom = `${SPEC}  check:\n    custom: true\n    confirm: true\n`;
  expect(errors(custom).map((d) => d.message)).toContainEqual(
    expect.stringContaining('"confirm" of action "check" goes with a standard action'),
  );
});

test("the confirm text fills from the record, its references and worked-out values, not a mail's", () => {
  const ir = validateSpec({ path: "smithable.yml", text: SPEC }).ir;
  if (!ir) throw new Error("spec");
  const messages = (action: string, text: string) =>
    validateContent(
      {
        path: "smithable.content.yml",
        text: `smithableContent: 0.1\nactions:\n  ${action}: { confirm: ${JSON.stringify(text)} }\n`,
      },
      ir,
    ).diagnostics.map((d) => d.message);
  expect(
    messages("send", "Send invoice {number} of {total} to {client.email} ({client}, {title})?"),
  ).toEqual([]);
  expect(messages("remind", "Sure?")).toEqual([
    expect.stringContaining('"confirm" of action "remind" is the question its button asks first'),
  ]);
  for (const mail of ["view", "pay", "link", "by", "before.status"])
    expect(messages("send", `{${mail}}`)).toEqual([
      expect.stringContaining("belongs in a mail's text"),
    ]);
  expect(messages("send", "{numbr}")).toEqual([
    expect.stringContaining('Invoice has no field named "numbr"'),
  ]);
  expect(messages("send", "{lines}")).toEqual([expect.stringContaining("lists other records")]);
  expect(messages("send", "{client.ssn}")).toEqual([expect.stringContaining("identity number")]);
  expect(messages("send", "{client.ssnTail}")).toEqual([
    expect.stringContaining("is worked out from ssn"),
  ]);
  expect(messages("send", "{number.x}")).toEqual([
    expect.stringContaining("is not a reference to one record"),
  ]);
});
