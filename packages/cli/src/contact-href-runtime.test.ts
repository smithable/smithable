import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { parse } from "@babel/parser";
import { kitSources } from "@smithable/adapter-tanstack";
import { expect, test } from "vitest";
import { extractSiteFacts } from "./site-facts.js";
import { projectSitePersonal } from "./site-personal.js";

const source = kitSources["src/kit/contact-href.ts"] ?? "";
const contactHref = new Function(
  `${stripTypeScriptTypes(source.replace("export function", "function"))}; return contactHref;`,
)() as (href: string | undefined, value?: string) => string | undefined;

function expressions(source: string): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node.type === "JSXAttribute" && (node.name as { name?: string })?.name === "href") {
      const expression = (
        node.value as {
          expression?: { type?: string; callee?: { name?: string }; start?: number; end?: number };
        }
      )?.expression;
      if (expression?.type === "CallExpression" && expression.callee?.name === "contactHref")
        found.push(source.slice(expression.start, expression.end));
    }
    for (const child of Object.values(node))
      if (typeof child === "object") {
        if (Array.isArray(child)) for (const entry of child) walk(entry);
        else walk(child);
      }
  };
  walk(parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] }));
  return found;
}

test("reserved sample contacts stay inert through URL and entity encodings", () => {
  for (const href of [
    "tel:+9990000001",
    "tel:009990000001",
    "tel:%2B999%20000%200001",
    "tel:%252B999000001",
    "tel:&#43;999000001",
    "tel:&amp;plus;999000001",
    "tel:%2B999000001%invalid",
    "tel:＋９９９０００００１",
    "mailto:sample-12@example.com",
    "mailto:sample%2D12%40example%2Ecom?subject=Hi",
    "https://source.invalid/ref/1",
    "https://www.source.invalid/ref/1",
    "mailto:a@mail.source.invalid",
    "https:source.invalid/ref/1",
    " https://source.invalid./ref/1 ",
    "https%3A%2F%2Fsource.invalid%2Fref%2F1",
    "https://www.openstreetmap.org/search?query=Sample%20Street%201%2C%20Mariehamn",
    "https://www.openstreetmap.org/search?query=Sample+Street+1",
    "https://www.openstreetmap.org/search?query=1%20Sample%20Street",
  ])
    expect(contactHref(href), href).toBeUndefined();
  expect(contactHref("tel:2999000001", "%2B999000001")).toBeUndefined();
});

test("collision mailboxes and every contact protocol keep reserved stand-ins inert", () => {
  for (const href of [
    "mailto:sample-3-preview@example.com",
    "mailto:?to=sample-3-preview%40example.com",
    "mailto:?TO=sample-1@example.com",
    "mailto:?to=owner@real.example&to=sample-1@example.com",
    "mailto:?CC=owner%40real.example&cc=sample-1-preview%40example.com",
    "sms:?TO=999000000001",
    "whatsapp://send?phone=3581812345&PHONE=999000000001",
    "mailto:owner@real.example?cc=Name%20%3Csample-1%40example.com%3E",
    "mailto:owner@real.example?bcc=owner%40real.example%3Bsample-1-preview%40example.com",
    "mailto:Name <sample-1@example.com>",
    "mailto:owner@real.example,Name <sample-1-preview@example.com>",
    "sms:+999000000001",
    "sms://+999000000001",
    "callto:+999000000001",
    "callto:00999000000001",
    "tel://+999000000001",
    "tel:999000000001",
    "tel:999001000001",
    "custom:+999000000001",
    "https://example.test/call/+999000000001",
    "https://example.test/call/%2B999000000001",
    "https://example.test/call?recipient=00999000000001",
    "https://wa.me/00999000000001",
    "custom:00999000000001",
    "/map?destination=%2B999000000001",
    "/map?destination=Call%20%2B999000000001",
    "custom:Call (+999) 000 000001",
    "https://example.test/call?recipient=%2B999000000001",
    "/map?destination=00999000000001",
    "custom:call?target=00999000000001",
    "sms:999000000001",
    "tel:00999000000001",
    "whatsapp://send?phone=999000000001",
    "https://wa.me/999000000001",
    "https://maps.google.com/?q=Sample+Street+1",
    "https://maps.apple.com/?address=Sample%20Street%201",
    "https://bing.com/maps?where=Sample%20Street%201",
    "geo:Sample Street 1",
    "geo:0,0?q=Sample+Street+1",
    "/map?q=Sample+Street+1",
    "map?address=Sample%20Street%201",
    "custom:map?where=1+Sample+Street",
  ])
    expect(contactHref(href), href).toBeUndefined();
});

test("real owner contacts and ordinary links remain byte-for-byte unchanged", () => {
  for (const href of [
    "tel:+3581812345",
    "mailto:hello@business.example",
    "mailto:sample-team@example.com",
    "mailto:owner-sample-3-preview@example.com",
    "mailto:Name <hello@business.example>",
    "mailto:?to=hello%40business.example&cc=team%40business.example",
    "sms:+3581812345",
    "callto:5552345678",
    "tel://+3581812345",
    "tel:9991234567",
    "https://wa.me/3581812345",
    "https://maps.google.com/?q=Real+Road+3",
    "/map?q=Real+Road+3",
    "/orders?number=999000123456",
    "/orders?number=999001123456",
    "/orders/00999000123456",
    "https://example.test/orders/00999000123456",
    "http://example.test/orders/%30%30%39%39%39%30%30%31%32%33%34%35%36",
    "//example.test/orders/00999000123456",
    "https://maps.google.com/?q=Real+Road+1,+99990+Nuorgam",
    "mailto:owner@real.example?subject=Order:+999123",
    "mailto:hello_+999123@business.example",
    "mailto:hello+999123@business.example",
    "locations/sample-street-1",
    "/locations/sample-street-1",
    "locations/sample-street-1?view=map",
    "mailto:hello+999@business.example",
    "mailto:owner-sample-1@example.com",
    "https://business.example/source.invalid/page",
    "https://business.example/path@source.invalid",
    "/people/owner@source.invalid",
    "/search?q=+999",
    "/+999",
    "https://www.openstreetmap.org/search?query=Real%20Road%203",
    "https://source.invalid.example.com/",
    "mailto:sample-12@example.com.example.org",
    "/appointments?day=1#time",
    "https://business.example/",
    "#contact",
  ])
    expect(contactHref(href)).toBe(href);
  expect(contactHref(undefined)).toBeUndefined();
});

test("embedded landing and legal contact expressions do not turn samples into links", () => {
  const landing = expressions(kitSources["src/kit/Landing.tsx"] ?? ""),
    legal = expressions(kitSources["src/kit/LegalPage.tsx"] ?? "");
  expect(landing.length).toBe(5);
  expect(legal.length).toBe(1);
  for (const expression of [...landing, ...legal]) {
    const evaluate = new Function(
      "contactHref",
      "contact",
      "phone",
      "email",
      "address",
      "o",
      `return ${expression};`,
    );
    const sample = {
      phone: "%2B999%20000%200001",
      email: "sample-1@example.com",
      address: "Sample Street 1, Mariehamn",
    };
    expect(
      evaluate(contactHref, sample, sample.phone, sample.email, sample.address, sample),
    ).toBeUndefined();
    const real = {
      phone: "+3581812345",
      email: "hello@business.example",
      address: "Real Road 3, Mariehamn",
    };
    expect(evaluate(contactHref, real, real.phone, real.email, real.address, real)).toMatch(
      /^(tel:|mailto:|https:\/\/www.openstreetmap.org)/,
    );
  }
  const appLink = kitSources["src/kit/AppLink.tsx"] ?? "";
  const guard = appLink.match(/href = contactHref\(href\);/)?.[0];
  expect(guard).toBeDefined();
  const destination = new Function("contactHref", "href", `${guard};return href;`);
  expect(destination(contactHref, "mailto:sample-1@example.com")).toBeUndefined();
  expect(destination(contactHref, "/appointments")).toBe("/appointments");
});

test("reachable seven-digit allocator fallback remains inert after its plus is removed", () => {
  const text = Array.from(
    { length: 500 },
    (_, offset) => `+999 000 ${String(1 + offset * 2000).padStart(6, "0")}`,
  ).join("\n");
  const url = "https://business.example/";
  const projected = projectSitePersonal({
    facts: extractSiteFacts('<meta property="og:site_name" content="Harbour Workshop">', url),
    images: [],
    sourceCorpus: {
      version: 1,
      pages: [{ id: "p1", text, sha256: createHash("sha256").update(text).digest("hex") }],
    },
  });
  const fallback = projected.personalMap.entries.find(
    (entry) => entry.kind === "phone" && entry.replacement.replace(/\D/g, "").length === 13,
  );
  if (!fallback) throw new Error("Fixture must reach a seven-digit phone collision slot");
  const bare = fallback.replacement.replace(/\D/g, "");
  expect(contactHref(`tel:${bare}`)).toBeUndefined();
  expect(contactHref(`/orders?number=${bare}`)).toBe(`/orders?number=${bare}`);
  expect(contactHref("tel:9990004004001")).toBe("tel:9990004004001");
  expect(contactHref("tel:9990000100001")).toBe("tel:9990000100001");
  // About 1.5 s alone: a full parallel run takes several times that (A, 2026-11-07).
}, 30_000);
