import type { ParsedNode } from "yaml";
import {
  type At,
  checkKeys,
  mapEntries,
  type ParseContext,
  readNameList,
  readRoleList,
  readString,
} from "../context.js";
import type { PageIR, PatternKind, SpecIR } from "../ir.js";
import { capitalize, kebab } from "../naming.js";
import { PAGE_PATTERNS, PATTERN_KINDS, patternInfo } from "../patterns.js";
import type { SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { NAME_PATTERN } from "./names.js";
import { pageOperations } from "./page-operations.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

const ROUTE_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

/** Routes the generated app uses itself (see the deployment contract). */
const RESERVED_ROUTES = [/^\/health$/, /^\/api(?:\/|$)/, /^\/sign-in$/];

export const pagesSection: SpecSection<"pages"> = {
  key: "pages",
  required: false,
  operations: [
    ...pageOperations,
    ...PATTERN_KINDS.flatMap((k) => PAGE_PATTERNS[k].operations ?? []),
  ],
  follow(spec, effect, ir) {
    // Each page follows through its pattern: a search, a tile, an onboarding step.
    for (const page of ir.pages) {
      const refused = patternInfo(page).follow(spec, effect, ir);
      if (refused) return refused;
    }
    return undefined;
  },
  schema: {
    type: "object",
    description: `The application's pages. Each page uses one pattern: ${PATTERN_KINDS.slice(0, -1).join(", ")} or ${PATTERN_KINDS.at(-1)}.`,
    propertyNames: { pattern: NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      oneOf: PATTERN_KINDS.map((k) => ({ required: [k] })),
      additionalProperties: false,
      properties: {
        route: {
          type: "string",
          pattern: ROUTE_PATTERN.source,
          description: "Defaults to / plus the page name.",
        },
        ...Object.fromEntries(PATTERN_KINDS.map((k) => [k, PAGE_PATTERNS[k].schema])),
        actions: {
          type: "array",
          items: { type: "string" },
          description: "Actions offered on the page, as buttons.",
        },
        access: {
          type: "array",
          items: { type: "string" },
          description: "Only these roles may open the page (admins always can).",
        },
        search: {
          type: "array",
          items: { type: "string" },
          description: "Fields the list can be searched by, e.g. [name, email].",
        },
        ...textSchema,
      },
    },
  },
  parse(ctx, node, parsed) {
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
      const page = readPage(ctx, id, keyNode, value, parsed);
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
  parsed: Partial<SpecIR>,
): PageIR | undefined {
  const where = `page "${id}"`;
  const entries = mapEntries(ctx, node, where);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, where, {
    allowed: ["route", ...PATTERN_KINDS, "actions", "access", "search", ...TEXT_KEYS],
    later: ["list", "calendar", "custom", "filters"],
    content: ["title", "label", "heading"],
  });
  let route = `/${kebab(id)}`;
  let pattern: PageIR["pattern"] | undefined;
  let actions: string[] | undefined;
  let access: string[] | undefined;
  let search: { name: string; at: At }[] | undefined;
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
    } else if (key === "actions") {
      actions = readNameList(ctx, value, `the actions of ${where}`).map(({ name, at }) => {
        ctx.reference("action", name, at);
        return name;
      });
    } else if (key === "search") {
      search = readNameList(ctx, value, `the search of ${where}`);
    } else if (key === "access") {
      access = readRoleList(ctx, value, `the access of ${where}`, false);
    } else if (key in PAGE_PATTERNS) {
      pattern = PAGE_PATTERNS[key as PatternKind].parse(ctx, value, where, parsed);
    }
  }
  const patterns = known.filter((e) => (PATTERN_KINDS as readonly string[]).includes(e.key));
  if (patterns.length > 1) {
    ctx.error(
      patterns[1]?.keyNode ?? keyNode,
      "invalid-key",
      `${capitalize(where)} can use only one pattern: ${PATTERN_KINDS.join(", ")}.`,
    );
    return undefined;
  }
  if (!pattern) {
    if (patterns.length === 0) {
      const examples = PATTERN_KINDS.map((k) => `"${PAGE_PATTERNS[k].example}"`);
      ctx.error(
        keyNode,
        "missing-pattern",
        `${capitalize(where)} needs a pattern: ${examples.slice(0, -1).join(", ")} or ${examples.at(-1)}.`,
      );
    }
    return undefined;
  }
  const model = patternInfo({ id, route, pattern }).manages();
  if (!model)
    for (const e of known.filter((e) => e.key === "actions" || e.key === "search"))
      ctx.error(e.keyNode, "invalid-key", `"${e.key}" belongs to a crud page.`);
  if (!known.some((e) => e.key === "route") && RESERVED_ROUTES.some((r) => r.test(route))) {
    ctx.error(
      keyNode,
      "reserved-route",
      `Page "${id}" would use the route ${route}, which is reserved for the application itself.`,
      `Give it another name, or a "route".`,
    );
  }
  return {
    id,
    route,
    pattern,
    ...(model && actions?.length ? { actions } : {}),
    ...(access ? { access } : {}),
    ...(model && search?.length ? { search: checkSearch(ctx, search, model, parsed, where) } : {}),
    ...readSemanticText(ctx, known),
  };
}

/** Text you can type into a search box: strings, text, emails, phone numbers, web addresses, choices; and references, by the related record's name. */
const SEARCHABLE = ["string", "text", "email", "phone", "url"];

function checkSearch(
  ctx: ParseContext,
  fields: { name: string; at: At }[],
  model: string,
  parsed: Partial<SpecIR>,
  where: string,
): string[] {
  const target = parsed.models?.find((m) => m.name === model);
  if (!target) return fields.map((f) => f.name); // reported as an unknown model
  for (const { name, at } of fields) {
    const field = target.fields.find((f) => f.name === name);
    if (!field) {
      ctx.error(
        at,
        "unknown-field",
        `${model} has no field named "${name}" to search ${where} by.`,
        didYouMean(
          name,
          target.fields.map((f) => f.name),
        ),
      );
    } else if (field.type.kind === "relation") {
      // A reference is searched by the related record's name: it needs a text field.
      const related = parsed.models?.find(
        (m) => field.type.kind === "relation" && m.name === field.type.model,
      );
      const named =
        field.type.model === "User" ||
        related?.fields.some((f) => f.type.kind === "scalar" && f.type.name === "string");
      if (field.type.many || !named)
        ctx.error(
          at,
          "invalid-search",
          field.type.many
            ? `"${name}" is a list of records; search the other page instead.`
            : `"${name}" cannot be searched: ${field.type.model} has no text field to search by.`,
        );
    } else if (
      field.formula ||
      !(
        field.type.kind === "choice" ||
        (field.type.kind === "scalar" && SEARCHABLE.includes(field.type.name))
      )
    ) {
      ctx.error(
        at,
        "invalid-search",
        `"${name}" cannot be searched: only stored text, email, phone, web address and choice fields, and references to records with a name, can.`,
      );
    }
  }
  return fields.map((f) => f.name);
}
