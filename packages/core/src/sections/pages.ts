import type { ParsedNode } from "yaml";
import { checkKeys, mapEntries, type ParseContext, readString } from "../context.js";
import type { PageIR } from "../ir.js";
import type { SpecSection } from "../section.js";
import { NAME_PATTERN } from "./names.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

const ROUTE_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

/** Routes the generated app uses itself (see the deployment contract). */
const RESERVED_ROUTES = [/^\/health$/, /^\/api(?:\/|$)/];

export const pagesSection: SpecSection<"pages"> = {
  key: "pages",
  required: false,
  schema: {
    type: "object",
    description:
      "The application's pages. Each page uses one pattern; in spec version 0.1 that is crud.",
    propertyNames: { pattern: NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      required: ["crud"],
      additionalProperties: false,
      properties: {
        route: {
          type: "string",
          pattern: ROUTE_PATTERN.source,
          description: "Defaults to / plus the page name.",
        },
        crud: { type: "string", description: "A model to list, view, create, edit and delete." },
        ...textSchema,
      },
    },
  },
  parse(ctx, node) {
    if (node === undefined) return [];
    const pages: PageIR[] = [];
    const routes = new Map<string, string>();
    for (const { key: id, keyNode, value } of mapEntries(ctx, node, `"pages"`) ?? []) {
      if (!NAME_PATTERN.test(id)) {
        ctx.error(
          keyNode,
          "invalid-name",
          `Page name "${id}" must start with a lowercase letter and use only letters, digits and dashes.`,
        );
        continue;
      }
      ctx.define("page", id);
      const page = readPage(ctx, id, keyNode, value);
      if (!page) continue;
      const other = routes.get(page.route);
      if (other !== undefined) {
        ctx.error(
          keyNode,
          "duplicate-route",
          `Pages "${other}" and "${id}" both use the route ${page.route}.`,
        );
      }
      routes.set(page.route, id);
      pages.push(page);
    }
    return pages;
  },
};

function readPage(
  ctx: ParseContext,
  id: string,
  keyNode: ParsedNode,
  node: ParsedNode | null,
): PageIR | undefined {
  const where = `page "${id}"`;
  const entries = mapEntries(ctx, node, where);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, where, {
    allowed: ["route", "crud", ...TEXT_KEYS],
    later: [
      "landing",
      "dashboard",
      "list",
      "calendar",
      "custom",
      "access",
      "search",
      "filters",
      "actions",
    ],
    content: ["title", "label", "heading"],
  });
  let route = `/${kebab(id)}`;
  let model: string | undefined;
  for (const { key, value } of known) {
    if (key === "route") {
      const r = readString(ctx, value, `The route of ${where}`);
      if (r === undefined) continue;
      if (!ROUTE_PATTERN.test(r)) {
        ctx.error(
          value,
          "invalid-route",
          `Route "${r}" must start with "/" and use lowercase letters, digits, dashes and slashes.`,
        );
      } else if (RESERVED_ROUTES.some((reserved) => reserved.test(r))) {
        ctx.error(value, "reserved-route", `Route "${r}" is reserved for the application itself.`);
      } else {
        route = r;
      }
    } else if (key === "crud") {
      model = readString(ctx, value, `"crud" in ${where}`);
      if (model !== undefined) ctx.reference("model", model, value);
    }
  }
  if (model === undefined) {
    if (!known.some((e) => e.key === "crud")) {
      ctx.error(
        keyNode,
        "missing-pattern",
        `${capitalize(where)} needs a pattern. In spec version 0.1 that is "crud: <Model>".`,
      );
    }
    return undefined;
  }
  return { id, route, pattern: { kind: "crud", model }, ...readSemanticText(ctx, known) };
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
