import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { generateApp } from "@smithable/adapter-tanstack";
import {
  type AuthIR,
  type ContentIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";

// Whose business details a document carries (docs/design/record-documents.md §4): the record
// owner's, read from the row itself, also when the reader may read the record by another rule and
// so sees no owner on it. The same reader makes a sent copy in the action's transaction (§5).
const at = (file: string) =>
  readFileSync(new URL(`../../../examples/invoicing/${file}`, import.meta.url), "utf8");
const ir = validateSpec({ path: "smithable.yml", text: at("smithable.yml") }).ir as SpecIR;
const auth = validateAuth({ path: "smithable.auth.yml", text: at("smithable.auth.yml") }, ir)
  .auth as AuthIR;
const content = validateContent(
  { path: "smithable.content.yml", text: at("smithable.content.yml") },
  ir,
).content as ContentIR;
const source =
  generateApp(ir, { smithableVersion: "0.0.0", auth, content }).find((f) =>
    f.path.endsWith("/invoice.document.server.ts"),
  )?.content ?? "";

type Viewer = { id: string; role: string };
type Row = Record<string, unknown>;

/**
 * The reader run on stand-ins: `owner` is the owner column of the row as stored, the record as the
 * reader is given it shows no owner, and `readable` says which business details they may read.
 */
function read(viewer: Viewer, owner: string | null, readable: (profile: number) => boolean) {
  const profiles: Record<string, Row> = {
    alice: { id: 7, businessName: "Alice Oy" },
    bob: { id: 9, businessName: "Bob Ab" },
  };
  const record: Row = { id: 1, ownerId: null, clientId: null, netTotal: 1, vatTotal: 0, total: 1 };
  const q = {
    query: {
      invoices: {
        findFirst: (options: { columns: Row }) => ({
          sync: () => ("ownerId" in options.columns ? { ownerId: owner } : { id: 1, lines: [] }),
        }),
      },
      businessProfiles: {
        findFirst: (options: { where: string }) => ({
          sync: () => profiles[options.where] && { id: profiles[options.where]?.id },
        }),
      },
    },
  };
  const stand = {
    eq: (_column: unknown, value: unknown) => value,
    schema: new Proxy({}, { get: () => ({}) }),
    invoiceData: { getIn: () => record },
    clientData: { getIn: () => null },
    invoiceLineData: { getIn: () => null },
    businessProfileAccess: { read: { owner: true } },
    businessProfileData: {
      getIn: (_q: unknown, _viewer: unknown, id: number) =>
        readable(id) ? Object.values(profiles).find((p) => p.id === id) : null,
      firstIn: () => null,
    },
    AccessDenied: class extends Error {},
  };
  const body = stripTypeScriptTypes(
    source.replace(/^import[\s\S]*?;\n/gm, "").replace(/\bexport /g, ""),
  );
  const run = new Function(...Object.keys(stand), `${body}\nreturn readInvoiceDocument;`)(
    ...Object.values(stand),
  );
  return run(q, viewer, 1) as { refused?: string; from?: Row } | null;
}

const bob = { id: "bob", role: "member" };

test("a reader by another rule gets the owner's business details, never their own", () => {
  // Bob may read Alice's invoice and her business details: the document is from Alice.
  expect(read(bob, "alice", () => true)?.from).toMatchObject({ id: 7, businessName: "Alice Oy" });
  // Bob may read the invoice but not her business details: refused, never Bob's own.
  expect(read(bob, "alice", (id) => id === 9)).toEqual({ refused: "read" });
  // The owner has none: refused as missing details, again never Bob's own.
  expect(read(bob, "carol", () => true)).toEqual({ refused: "settings" });
});

test("only a record with no owner at all takes the reader's own business details", () => {
  expect(read(bob, null, (id) => id === 9)?.from).toMatchObject({ id: 9, businessName: "Bob Ab" });
});
