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
import { payLinksExplained } from "./outgoing.js";

// A pay link (docs/design/payments.md §4.1): Send invoice's mail carries {pay}.
const raw = import.meta.glob("../../../examples/invoicing/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const at = (file: string) => raw[`../../../examples/invoicing/${file}`] as string;
const PAYING = at("smithable.yml").replace(
  "\nactions:\n",
  '\npayments:\n  invoicePayment: { on: Invoice, amount: total, when: { status: [sent, overdue] }, paid: { set: { status: paid } }, description: "Invoice {number}" }\n\nactions:\n',
);
const WORDS = at("smithable.content.yml");
const PAY_WORDS = WORDS.replace("See it here: {view}", "Pay here: {pay}");

function made(spec: string, words: string) {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: at("smithable.auth.yml") }, ir)
    .auth as AuthIR;
  const checked = validateContent({ path: "smithable.content.yml", text: words }, ir);
  expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const content = checked.content as ContentIR;
  const files = new Map(
    generateApp(ir, { smithableVersion: "0.0.0", auth, content }).map((f) => [f.path, f.content]),
  );
  const file = (end: string) => {
    const found = [...files].find(([path]) => path.endsWith(end))?.[1];
    if (found === undefined) throw new Error(`no ${end}`);
    return found;
  };
  return { ir, content, files, file };
}

test("a mail that says {pay} makes the pay page, a link per recipient and the bound amount", () => {
  expect(WORDS).toContain("See it here: {view}");
  const { ir, content, files, file } = made(PAYING, PAY_WORDS);
  // The page: kept out of caches, search engines and the next site's Referer.
  const route = file("routes/p.$token.tsx");
  expect(route).toContain('createFileRoute("/p/$token")');
  expect(route).toContain('"Cache-Control": "private, no-store"');
  expect(route).toContain('"Referrer-Policy": "no-referrer"');
  expect(route).toContain('"X-Robots-Tag": "noindex"');
  expect(route).toContain("if (!shown) throw notFound();");
  // Its server functions: a wrong, ended or withdrawn link counts as a miss; paying writes.
  const functions = file("src/generated/payments.ts");
  expect(functions).toContain("viewAllowed(headers, undefined, w.payLinkViews);");
  expect(functions).toContain("if (!shown) viewMissed(headers);");
  expect(functions).toContain("writeAllowed(await currentViewer(), headers);");
  expect(functions).toContain("return payByLink(token, DESCRIBE);");
  // The amount the invoice asks for now, worked out from its lines.
  const entries = file("src/generated/payments.server.ts");
  expect(entries).toContain("due(tx, record) {");
  expect(entries).toMatch(/due\(tx, record\) \{[\s\S]*?fits\([\s\S]*?Formulas\(/);
  // The mail: a link of its own per recipient, bound to the entry and the amount.
  const outgoing = [...files.values()].find((c) => c.includes("PAY_MARK"));
  expect(outgoing).toContain('pay: "invoicePayment",');
  expect(outgoing).toContain('path === "pay" ? PAY_MARK : ');
  expect(outgoing).toContain(
    "PAYMENT_ENTRIES[entry.pay]?.due?.(tx as never, record.id as number) ?? 0",
  );
  // The kit's page and the links; no Sent list without {view}.
  for (const kit of ["kit/pay-link.server.ts", "kit/PayLink.tsx", "kit/view.server.ts"])
    expect([...files.keys()].some((p) => p.endsWith(kit))).toBe(true);
  expect([...files.keys()].some((p) => p.endsWith("kit/SentDocuments.tsx"))).toBe(false);
  expect([...files.keys()].some((p) => p.endsWith("routes/d.$token.tsx"))).toBe(false);
  // The page has no frame: no menu for someone without an account.
  expect(file("src/routes/__root.tsx")).toMatch(/bareRoutes = \[[^\]]*"\/p"/);
  // A trashed or removed invoice ends its pay links.
  const data = file("/invoice.server.ts");
  expect(data).toMatch(/import \{ [^}]*removeCopies \} from "#\/kit\/view.server";/);
  // Two Pay presses at once ask for one pending Payment.
  const schema = file("src/db/schema.ts");
  expect(schema).toContain(
    "uniqueIndex(\"payments_pending\").on(t.entry, t.record).where(sql`${t.status} = 'pending'`)",
  );
  expect(schema).toContain('kind: text({ enum: ["view", "pay"] })');
  // validate --explain names the entry, found by the spec's shape alone.
  expect(payLinksExplained(ir, content)).toEqual([
    "outgoing invoiceSent: {pay} links to paying the Invoice through payments entry invoicePayment (the one that pays an existing Invoice)",
  ]);
});

test("without a {pay} mail there is no pay page, and payments alone make no links", () => {
  const { ir, content, files } = made(PAYING, WORDS.split(" See it here: {view}").join(""));
  expect([...files.keys()].some((p) => p.endsWith("routes/p.$token.tsx"))).toBe(false);
  expect([...files.keys()].some((p) => p.endsWith("kit/pay-link.server.ts"))).toBe(false);
  expect([...files.keys()].some((p) => p.endsWith("kit/view.server.ts"))).toBe(false);
  expect([...files.values()].some((c) => c.includes("payLinkPage"))).toBe(false);
  expect(payLinksExplained(ir, content)).toEqual([]);
});

test("{view} and {pay} in one mail make both links, each on its own page", () => {
  const both = WORDS.replace("See it here: {view}", "See it here: {view} Pay here: {pay}");
  const { files } = made(PAYING, both);
  const outgoing = [...files.values()].find((c) => c.includes("PAY_MARK"));
  expect(outgoing).toContain("view: 60,");
  expect(outgoing).toContain('pay: "invoicePayment",');
  for (const route of ["routes/d.$token.tsx", "routes/p.$token.tsx"])
    expect([...files.keys()].some((p) => p.endsWith(route))).toBe(true);
});
