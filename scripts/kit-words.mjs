// The app kit says nothing visible in English by itself: what a person reads comes from
// src/kit/words/<language>.ts, so an app in another language has no English left
// (docs/design/language.md). Fails on text between tags and on a written-out aria-label, title,
// placeholder, alt or label in the kit's components. Part of `pnpm lint`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";

const kit = new URL("../packages/adapter-tanstack/templates/src/kit/", import.meta.url).pathname;
const ATTRIBUTES = new Set(["aria-label", "title", "placeholder", "alt", "label"]);
// English on purpose, each with its reason.
const ALLOWED = new Set([
  "ms", // a unit, in the administrator's trace
  "Sign-in with", // the setup note shown only in development, for the developer
  "is not set up yet: its keys are missing from the environment. See the README",
  "name@example.com", // an example address
]);

const found = [];
for (const file of readdirSync(kit).filter((f) => f.endsWith(".tsx"))) {
  const ast = parse(readFileSync(join(kit, file), "utf8"), {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  const report = (node, text) => {
    if (!ALLOWED.has(text)) found.push(`${file}:${node.loc.start.line}: ${JSON.stringify(text)}`);
  };
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "JSXText") {
      const text = node.value
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^[(),.:;?]+|[(),.:;?]+$/g, "");
      // An address (/api/v1) is not a word.
      if (/\p{L}{2}/u.test(text) && !text.startsWith("/")) report(node, text);
    }
    if (
      node.type === "JSXAttribute" &&
      ATTRIBUTES.has(node.name.name) &&
      node.value?.type === "StringLiteral" &&
      /\p{L}{2}/u.test(node.value.value)
    )
      report(node, node.value.value);
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
      if (Array.isArray(value)) for (const child of value) visit(child);
      else if (value && typeof value === "object") visit(value);
    }
  };
  visit(ast.program);
}
if (found.length) {
  console.error(
    `The app kit writes these out instead of taking them from words/en.ts and words/sv.ts:\n${found.join("\n")}`,
  );
  process.exit(1);
}
