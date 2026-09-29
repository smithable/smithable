import { isMap, isScalar as isScalarNode, type ParsedNode } from "yaml";
import {
  type At,
  checkKeys,
  mapEntries,
  type ParseContext,
  readNameList,
  readNumber,
  readRoleList,
  readString,
} from "../context.js";
import {
  type DashboardItem,
  type LandingSection,
  type OnboardingStep,
  type PageIR,
  SECTION_KINDS,
  type SectionKind,
  type SpecIR,
} from "../ir.js";
import { capitalize, kebab } from "../naming.js";
import type { JsonSchema, SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { NAME_PATTERN } from "./names.js";
import { pageOperations } from "./page-operations.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

const ROUTE_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

/** Routes the generated app uses itself (see the deployment contract). */
const RESERVED_ROUTES = [/^\/health$/, /^\/api(?:\/|$)/, /^\/sign-in$/];

/** The schema of each pattern's key in a page. */
const PATTERN_SCHEMAS: Record<PageIR["pattern"]["kind"], JsonSchema> = {
  crud: { type: "string", description: "A model to list, view, create, edit and delete." },
  settings: {
    type: "string",
    description:
      "A model with one record per user (private data) or per app (shared): the page edits it.",
  },
  onboarding: {
    type: "object",
    required: ["model", "steps"],
    additionalProperties: false,
    description: "Fills the settings record in steps after the first sign-in.",
    properties: {
      model: { type: "string" },
      steps: {
        type: "object",
        additionalProperties: { type: "array", items: { type: "string" } },
      },
    },
  },
  landing: {
    type: "object",
    description:
      "Sections of a landing page, in order: hero, features, records, pricing, testimonials, faq, callToAction, contact, gallery, footer.",
    additionalProperties: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        records: { type: "string", description: "A model whose records the section shows." },
        button: { type: "string", description: "The page the section's button opens." },
        limit: { type: "integer", minimum: 1 },
        form: {
          type: "string",
          description: "A contact section's form: the model visitors add a record of.",
        },
      },
    },
  },
  dashboard: {
    type: "object",
    description: "Tiles of a dashboard, in order: numbers, charts by month, latest records.",
    additionalProperties: {
      type: "object",
      additionalProperties: false,
      properties: {
        count: { type: "string", description: "Count a model's records, e.g. Invoice." },
        sum: { type: "string", description: "Sum a number field, e.g. Invoice.total." },
        average: { type: "string", description: "Average a number field." },
        list: { type: "string", description: "Show a model's latest records." },
        query: { type: "string", description: "Show a custom query's records." },
        where: {
          type: "object",
          description: "Only records with these choice values or yes/no values.",
        },
        by: { type: "string", description: "A date field: one bar per month." },
        limit: { type: "integer", minimum: 1 },
      },
    },
  },
};

type PatternKind = PageIR["pattern"]["kind"];

/**
 * How each page pattern is written in smithable.yml: its key's schema and parser (what the IR
 * knows about a pattern is in PAGE_PATTERNS, ir.ts). A new pattern registers here and there.
 */
const PAGE_PATTERN_PARSERS: {
  [K in PatternKind]: {
    schema: JsonSchema;
    /** How it is written, for the message when a page has no pattern. */
    example: string;
    parse(
      ctx: ParseContext,
      value: ParsedNode | null,
      where: string,
      parsed: Partial<SpecIR>,
    ): Extract<PageIR["pattern"], { kind: K }> | undefined;
  };
} = {
  crud: {
    schema: PATTERN_SCHEMAS.crud,
    example: "crud: <Model>",
    parse(ctx, value, where) {
      const model = readString(ctx, value, `"crud" in ${where}`);
      if (model === undefined) return undefined;
      ctx.reference("model", model, value);
      return { kind: "crud", model };
    },
  },
  landing: {
    schema: PATTERN_SCHEMAS.landing,
    example: "landing",
    parse: (ctx, value, where, parsed) => ({
      kind: "landing",
      sections: readLanding(ctx, value, where, parsed),
    }),
  },
  dashboard: {
    schema: PATTERN_SCHEMAS.dashboard,
    example: "dashboard",
    parse: (ctx, value, where, parsed) => ({
      kind: "dashboard",
      items: readDashboard(ctx, value, where, parsed),
    }),
  },
  settings: {
    schema: PATTERN_SCHEMAS.settings,
    example: "settings: <Model>",
    parse(ctx, value, where) {
      const model = readString(ctx, value, `"settings" in ${where}`);
      if (model === undefined) return undefined;
      ctx.reference("model", model, value);
      return { kind: "settings", model };
    },
  },
  onboarding: {
    schema: PATTERN_SCHEMAS.onboarding,
    example: "onboarding",
    parse(ctx, value, where, parsed) {
      const onboarding = readOnboarding(ctx, value, where, parsed);
      return onboarding && { kind: "onboarding", ...onboarding };
    },
  },
};
const PATTERNS = Object.keys(PAGE_PATTERN_PARSERS) as PatternKind[];

export const pagesSection: SpecSection<"pages"> = {
  key: "pages",
  required: false,
  operations: pageOperations,
  schema: {
    type: "object",
    description: `The application's pages. Each page uses one pattern: ${PATTERNS.slice(0, -1).join(", ")} or ${PATTERNS.at(-1)}.`,
    propertyNames: { pattern: NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      oneOf: PATTERNS.map((k) => ({ required: [k] })),
      additionalProperties: false,
      properties: {
        route: {
          type: "string",
          pattern: ROUTE_PATTERN.source,
          description: "Defaults to / plus the page name.",
        },
        ...Object.fromEntries(Object.entries(PAGE_PATTERN_PARSERS).map(([k, p]) => [k, p.schema])),
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
    allowed: ["route", ...PATTERNS, "actions", "access", "search", ...TEXT_KEYS],
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
    } else if (key in PAGE_PATTERN_PARSERS) {
      pattern = PAGE_PATTERN_PARSERS[key as PatternKind].parse(ctx, value, where, parsed);
    }
  }
  const patterns = known.filter((e) => (PATTERNS as readonly string[]).includes(e.key));
  if (patterns.length > 1) {
    ctx.error(
      patterns[1]?.keyNode ?? keyNode,
      "invalid-key",
      `${capitalize(where)} can use only one pattern: ${PATTERNS.join(", ")}.`,
    );
    return undefined;
  }
  if (!pattern) {
    if (patterns.length === 0) {
      const examples = PATTERNS.map((k) => `"${PAGE_PATTERN_PARSERS[k].example}"`);
      ctx.error(
        keyNode,
        "missing-pattern",
        `${capitalize(where)} needs a pattern: ${examples.slice(0, -1).join(", ")} or ${examples.at(-1)}.`,
      );
    }
    return undefined;
  }
  const model = pattern.kind === "crud" ? pattern.model : undefined;
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

/** Landing sections: a section named like its kind (hero, faq, …), or any name with `records`. */
function readLanding(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  parsed: Partial<SpecIR>,
): LandingSection[] {
  const sections: LandingSection[] = [];
  for (const { key: name, keyNode, value } of mapEntries(ctx, node, `the landing of ${where}`) ??
    []) {
    const sectionWhere = `section "${name}" of ${where}`;
    // "faq:" with nothing after it is a section with no options.
    const empty = value === null || (isScalarNode(value) && value.value === null);
    if (!empty && !isMap(value)) {
      ctx.error(
        value,
        "expected-mapping",
        `${capitalize(sectionWhere)} takes options or nothing.`,
        `Write "${name}:" with nothing after it, or options like "hero: { button: <page> }" or "classes: { records: <Model> }". Its texts go in smithable.content.yml.`,
      );
      continue;
    }
    const entries = empty ? [] : (mapEntries(ctx, value, sectionWhere) ?? []);
    const options = checkKeys(ctx, entries, sectionWhere, {
      allowed: ["records", "button", "limit", "form"],
      content: ["title", "subtitle", "text", "items"],
    });
    const section: LandingSection = { name, kind: "records" };
    for (const { key, value: option, keyNode: optionKey } of options) {
      if (key === "records") {
        const model = readString(ctx, option, `"records" in ${sectionWhere}`);
        if (model !== undefined) {
          ctx.reference("model", model, option);
          section.model = model;
        }
      } else if (key === "form") {
        const model = readString(ctx, option, `"form" in ${sectionWhere}`);
        if (name !== "contact")
          ctx.error(optionKey, "invalid-key", `Only a contact section has a form.`);
        else if (model !== undefined) {
          ctx.reference("model", model, option);
          section.form = model;
          // Visitors fill it in: they cannot pick other records, which would show them.
          const links = parsed.models
            ?.find((m) => m.name === model)
            ?.fields.filter((f) => f.type.kind === "relation" && !f.type.many && !f.formula);
          if (links?.length)
            ctx.error(
              option,
              "invalid-value",
              `A contact form's model cannot link to other records (${model} has ${links.map((f) => f.name).join(", ")}): visitors would have to choose among them.`,
              "Use a model of its own for messages, e.g. Message with name, email and message.",
            );
        }
      } else if (key === "button") {
        const page = readString(ctx, option, `"button" in ${sectionWhere}`);
        if (page !== undefined) {
          ctx.reference("page", page, option);
          section.button = page;
        }
      } else {
        const limit = readNumber(ctx, option, `"limit" in ${sectionWhere}`);
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
          ctx.error(option, "invalid-value", `"limit" must be a whole number above 0.`);
        else if (limit !== undefined) section.limit = limit;
      }
      if (key === "button" && !["hero", "callToAction"].includes(name))
        ctx.error(optionKey, "invalid-key", `Only a hero or callToAction section has a button.`);
    }
    if (!section.model) {
      if (!(SECTION_KINDS as readonly string[]).includes(name) || name === "records") {
        ctx.error(
          keyNode,
          "unknown-section",
          `There is no section kind "${name}". Name a section after its kind, or give it "records: <Model>".`,
          didYouMean(
            name,
            SECTION_KINDS.filter((k) => k !== "records"),
          ) ?? `Kinds: ${SECTION_KINDS.filter((k) => k !== "records").join(", ")}.`,
        );
        continue;
      }
      section.kind = name as SectionKind;
    }
    sections.push(section);
  }
  return sections;
}

const NUMBER_TYPES = ["int", "decimal", "money"];

/** Steps of an onboarding; together they must ask for every required field without a default. */
function readOnboarding(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  parsed: Partial<SpecIR>,
): { model: string; steps: OnboardingStep[] } | undefined {
  const onboardingWhere = `the onboarding of ${where}`;
  const options = checkKeys(ctx, mapEntries(ctx, node, onboardingWhere) ?? [], onboardingWhere, {
    allowed: ["model", "steps"],
    content: ["title", "subtitle"],
  });
  const modelEntry = options.find((o) => o.key === "model");
  const stepsEntry = options.find((o) => o.key === "steps");
  if (!modelEntry || !stepsEntry) {
    ctx.error(node, "missing-key", `${capitalize(onboardingWhere)} needs "model" and "steps".`);
    return undefined;
  }
  const modelName = readString(ctx, modelEntry.value, `"model" in ${onboardingWhere}`);
  if (modelName === undefined) return undefined;
  ctx.reference("model", modelName, modelEntry.value);
  const model = parsed.models?.find((m) => m.name === modelName);
  const steps: OnboardingStep[] = [];
  for (const step of mapEntries(ctx, stepsEntry.value, `the steps of ${onboardingWhere}`) ?? []) {
    const fields = readNameList(
      ctx,
      step.value,
      `step "${step.key}" of ${onboardingWhere}`,
    ).flatMap(({ name, at }) => {
      const field = model?.fields.find((f) => f.name === name);
      if (model && !field) {
        ctx.error(
          at,
          "unknown-field",
          `${modelName} has no field named "${name}".`,
          didYouMean(
            name,
            model.fields.map((f) => f.name),
          ),
        );
        return [];
      }
      if (field && (field.formula || (field.type.kind === "relation" && field.type.many))) {
        ctx.error(
          at,
          "invalid-field",
          `"${name}" is not entered in a form, so no step can ask for it.`,
        );
        return [];
      }
      return [name];
    });
    steps.push({ name: step.key, fields });
  }
  const asked = new Set(steps.flatMap((s) => s.fields));
  const missing = (model?.fields ?? []).filter(
    (f) => f.required && f.default === undefined && !f.formula && !asked.has(f.name),
  );
  if (missing.length)
    ctx.error(
      stepsEntry.keyNode,
      "missing-field",
      `The steps never ask for ${missing.map((f) => f.name).join(", ")}, which ${modelName} requires.`,
    );
  return { model: modelName, steps };
}

/** Dashboard tiles; every model, field and value they name is checked against the models. */
function readDashboard(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  parsed: Partial<SpecIR>,
): DashboardItem[] {
  const items: DashboardItem[] = [];
  for (const { key: name, keyNode, value } of mapEntries(ctx, node, `the dashboard of ${where}`) ??
    []) {
    const itemWhere = `"${name}" in the dashboard of ${where}`;
    const options = checkKeys(ctx, mapEntries(ctx, value, itemWhere) ?? [], itemWhere, {
      allowed: ["count", "sum", "average", "list", "query", "where", "by", "limit"],
      content: ["label", "title"],
    });
    const measures = options.filter((o) =>
      ["count", "sum", "average", "list", "query"].includes(o.key),
    );
    const measure = measures[0];
    if (measures.length !== 1 || !measure) {
      ctx.error(
        keyNode,
        "invalid-dashboard",
        `${capitalize(itemWhere)} needs one of count, sum, average, list or query.`,
      );
      continue;
    }
    const target = readString(ctx, measure.value, `"${measure.key}" in ${itemWhere}`);
    if (target === undefined) continue;
    if (measure.key === "query") {
      // The records of a custom query, e.g. the customers most likely to churn.
      ctx.reference("query", target, measure.value);
      const query = parsed.queries?.find((q) => q.name === target);
      const item: DashboardItem = {
        name,
        kind: "list",
        model: query?.returns ?? "",
        query: target,
      };
      const limit = options.find((o) => o.key === "limit");
      const n = limit ? readNumber(ctx, limit.value, `"limit" in ${itemWhere}`) : undefined;
      if (n !== undefined && (!Number.isInteger(n) || n < 1))
        ctx.error(limit?.value ?? null, "invalid-value", `"limit" must be a whole number above 0.`);
      else if (n !== undefined) item.limit = n;
      for (const o of options.filter((o) => o.key === "where" || o.key === "by"))
        ctx.error(
          o.keyNode,
          "invalid-key",
          `"${o.key}" does not apply to a query: its code chooses the records.`,
        );
      if (query) items.push(item);
      continue;
    }
    const [modelName = "", fieldName] = target.split(".");
    const model = parsed.models?.find((m) => m.name === modelName);
    ctx.reference("model", modelName, measure.value);
    const item: DashboardItem = {
      name,
      kind: measure.key === "list" ? "list" : "stat",
      model: modelName,
      ...(measure.key === "list" ? {} : { measure: measure.key as "count" | "sum" | "average" }),
    };
    const fieldOf = (field: string, at: ParsedNode | null) => {
      const found = model?.fields.find((f) => f.name === field);
      if (model && !found)
        ctx.error(
          at,
          "unknown-field",
          `${modelName} has no field named "${field}".`,
          didYouMean(
            field,
            model.fields.map((f) => f.name),
          ),
        );
      return found;
    };
    if (measure.key === "sum" || measure.key === "average") {
      const field = fieldName === undefined ? undefined : fieldOf(fieldName, measure.value);
      if (fieldName === undefined)
        ctx.error(
          measure.value,
          "invalid-dashboard",
          `Name the field to ${measure.key}, as in Invoice.total.`,
        );
      else if (field && !(field.type.kind === "scalar" && NUMBER_TYPES.includes(field.type.name)))
        ctx.error(
          measure.value,
          "invalid-dashboard",
          `${target} is not a number, so it cannot be added up.`,
        );
      else item.field = fieldName;
    } else if (fieldName !== undefined) {
      ctx.error(
        measure.value,
        "invalid-dashboard",
        `"${measure.key}" takes a model, as in Invoice.`,
      );
    }
    for (const { key, value: option, keyNode: optionKey } of options) {
      if (key === "where") {
        item.where = {};
        for (const condition of mapEntries(ctx, option, `"where" in ${itemWhere}`) ?? []) {
          const field = fieldOf(condition.key, condition.keyNode);
          if (!field || !isScalarNode(condition.value)) continue;
          const wanted = condition.value.value;
          if (field.type.kind === "choice" && typeof wanted === "string") {
            if (field.type.values.includes(wanted)) item.where[condition.key] = wanted;
            else
              ctx.error(
                condition.value,
                "unknown-value",
                `${modelName}.${condition.key} has no value "${wanted}".`,
                didYouMean(wanted, field.type.values),
              );
          } else if (
            field.type.kind === "scalar" &&
            field.type.name === "bool" &&
            typeof wanted === "boolean"
          ) {
            item.where[condition.key] = wanted;
          } else {
            ctx.error(
              condition.value,
              "invalid-dashboard",
              `"where" compares choice fields with one of their values, and yes/no fields with true or false.`,
            );
          }
        }
      } else if (key === "by") {
        const by = readString(ctx, option, `"by" in ${itemWhere}`);
        const field = by === undefined ? undefined : fieldOf(by, option);
        if (item.kind === "list")
          ctx.error(optionKey, "invalid-key", `"by" makes a chart; a list has no bars.`);
        else if (
          field &&
          !(field.type.kind === "scalar" && ["date", "datetime"].includes(field.type.name))
        )
          ctx.error(
            option,
            "invalid-dashboard",
            `"by" needs a date field: the chart has a bar per month.`,
          );
        else if (by !== undefined) {
          item.by = by;
          item.kind = "chart";
        }
      } else if (key === "limit") {
        const limit = readNumber(ctx, option, `"limit" in ${itemWhere}`);
        if (item.kind !== "list") ctx.error(optionKey, "invalid-key", `"limit" belongs to a list.`);
        else if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
          ctx.error(option, "invalid-value", `"limit" must be a whole number above 0.`);
        else if (limit !== undefined) item.limit = limit;
      }
    }
    items.push(item);
  }
  return items;
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
