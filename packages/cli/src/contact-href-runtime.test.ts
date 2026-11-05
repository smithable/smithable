import { stripTypeScriptTypes } from "node:module";
import { parse } from "@babel/parser";
import { kitSources } from "@smithable/adapter-tanstack";
import { expect, test } from "vitest";

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

test("real owner contacts and ordinary links remain byte-for-byte unchanged", () => {
  for (const href of [
    "tel:+3581812345",
    "mailto:hello@business.example",
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
