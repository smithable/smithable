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

// An action that asks before it runs (docs/design/record-documents.md §6), on the invoicing
// starter's Mark sent.
const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const at = (file: string) => raw[`../../../examples/invoicing/${file}`] as string;

function files(spec: string, contentText = at("smithable.content.yml")) {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: at("smithable.auth.yml") }, ir)
    .auth as AuthIR;
  const content = validateContent({ path: "smithable.content.yml", text: contentText }, ir)
    .content as ContentIR;
  const all = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  const file = (end: string) => all.find((f) => f.path.endsWith(end))?.content ?? "";
  return {
    server: file("/actions/mark-sent.server.ts"),
    page: file("/invoices/$id.tsx"),
    list: file("/invoices/index.tsx"),
  };
}

test("the question reads what its text names as the viewer, and checks the mail's address", () => {
  const { server, page, list } = files(at("smithable.yml"));
  expect(server).toContain("export async function questionMarkSent(");
  // Read with the viewer's own rights: the invoice, then its client.
  expect(server).toContain("const row = await invoiceData.get(viewer, id);");
  expect(server).toContain("check(markSentAccess, viewer, row.ownerId);");
  expect(server).toContain(
    "const clientRecord = row.clientId == null ? null : await clientData.get(viewer, row.clientId);",
  );
  expect(server).toContain('"client.email": shown(clientUi, "email", clientRecord),');
  expect(server).toContain('"total": shown(invoiceUi, "total", row),');
  // invoiceSent goes to client.email: with none, the question says the mail would reach nobody.
  // A client the viewer may not read says nothing about its address; none, or a blank one, does.
  expect(server).toContain(
    "if ((row.clientId == null || (clientRecord !== null && !clientRecord.email))) return { noRecipient: true };",
  );
  expect(server.slice(server.indexOf("questionMarkSent("))).not.toContain("db.select");
  expect(page).toContain(
    'confirm={{ text: "Send invoice {number} of {total} to {client} at {client.email}?", load: () => markSentQuestion({ data: row.id }) }}',
  );
  expect(list).toContain("confirm: true,");
});

test("another mail that may go keeps the question from saying it reaches nobody", () => {
  const spec = at("smithable.yml").replace(
    "    recipient: client.email\n",
    "    recipient: client.email\n  invoiceCopy:\n    when: markSent\n    to: mail\n    recipient: client.email\n    where: { status: draft }\n",
  );
  const { server } = files(spec);
  expect(server).toContain("export async function questionMarkSent(");
  expect(server).not.toContain("noRecipient: true };");
});

test("without a text it asks with the title only; without confirm there is no question", () => {
  const content = at("smithable.content.yml").replace(/\nactions:\n {2}markSent:\n.*\n/, "\n");
  const { server, page } = files(at("smithable.yml"), content);
  expect(server).toContain(
    '"title": shown(invoiceUi, invoiceUi.titleField, row) || String(row.id),',
  );
  expect(server).not.toContain('"client.email":');
  expect(server).not.toContain('"number":');
  expect(page).toContain("confirm={{ load: () => markSentQuestion({ data: row.id }) }}");
  const plain = files(at("smithable.yml").replace(/\n {4}confirm: true.*\n/, "\n"), content);
  expect(plain.server).not.toContain("questionMarkSent");
  expect(plain.page).not.toContain("confirm=");
});
