import { isScalar as isScalarNode, type ParsedNode } from "yaml";
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
import type { SpecSection } from "../section.js";
import { didYouMean } from "../suggest.js";
import { NAME_PATTERN } from "./names.js";
import { pageOperations } from "./page-operations.js";
import { readSemanticText, TEXT_KEYS } from "./text.js";
import { textSchema } from "./text-schema.js";

const ROUTE_PATTERN = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/;

const PATTERNS = ["crud", "landing", "dashboard", "settings", "onboarding"] as const;

/** Routes the generated app uses itself (see the deployment contract). */
const RESERVED_ROUTES = [/^\/health$/, /^\/api(?:\/|$)/, /^\/sign-in$/];

export const pagesSection: SpecSection<"pages"> = {
  key: "pages",
  required: false,
  operations: pageOperations,
  schema: {
    type: "object",
    description:
      "The application's pages. Each page uses one pattern: crud, landing, dashboard, settings or onboarding.",
    propertyNames: { pattern: NAME_PATTERN.source },
    additionalProperties: {
      type: "object",
      oneOf: [
        { required: ["crud"] },
        { required: ["landing"] },
        { required: ["dashboard"] },
        { required: ["settings"] },
        { required: ["onboarding"] },
      ],
      additionalProperties: false,
      properties: {
        route: {
          type: "string",
          pattern: ROUTE_PATTERN.source,
          description: "Defaults to / plus the page name.",
        },
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
            "Sections of a landing page, in order: hero, features, records, pricing, testimonials, faq, callToAction.",
          additionalProperties: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              records: { type: "string", description: "A model whose records the section shows." },
              button: { type: "string", description: "The page the section's button opens." },
              limit: { type: "integer", minimum: 1 },
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
              where: {
                type: "object",
                description: "Only records with these choice values or yes/no values.",
              },
              by: { type: "string", description: "A date field: one bar per month." },
              limit: { type: "integer", minimum: 1 },
            },
          },
        },
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
  let model: string | undefined;
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
    } else if (key === "crud") {
      model = readString(ctx, value, `"crud" in ${where}`);
      if (model !== undefined) ctx.reference("model", model, value);
    } else if (key === "landing") {
      pattern = { kind: "landing", sections: readLanding(ctx, value, where) };
    } else if (key === "dashboard") {
      pattern = { kind: "dashboard", items: readDashboard(ctx, value, where, parsed) };
    } else if (key === "settings") {
      const settings = readString(ctx, value, `"settings" in ${where}`);
      if (settings !== undefined) {
        ctx.reference("model", settings, value);
        pattern = { kind: "settings", model: settings };
      }
    } else if (key === "onboarding") {
      const onboarding = readOnboarding(ctx, value, where, parsed);
      if (onboarding) pattern = { kind: "onboarding", ...onboarding };
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
  if (pattern) {
    for (const e of known.filter((e) => e.key === "actions" || e.key === "search"))
      ctx.error(e.keyNode, "invalid-key", `"${e.key}" belongs to a crud page.`);
    return {
      id,
      route,
      pattern,
      ...(access ? { access } : {}),
      ...readSemanticText(ctx, known),
    };
  }
  if (!known.some((e) => e.key === "route") && RESERVED_ROUTES.some((r) => r.test(route))) {
    ctx.error(
      keyNode,
      "reserved-route",
      `Page "${id}" would use the route ${route}, which is reserved for the application itself.`,
      `Give it another name, or a "route".`,
    );
  }
  if (model === undefined) {
    if (patterns.length === 0) {
      ctx.error(
        keyNode,
        "missing-pattern",
        `${capitalize(where)} needs a pattern: "crud: <Model>", "landing", "dashboard", "settings: <Model>" or "onboarding".`,
      );
    }
    return undefined;
  }
  return {
    id,
    route,
    pattern: { kind: "crud", model },
    ...(actions?.length ? { actions } : {}),
    ...(access ? { access } : {}),
    ...(search?.length ? { search: checkSearch(ctx, search, model, parsed, where) } : {}),
    ...readSemanticText(ctx, known),
  };
}

/** Landing sections: a section named like its kind (hero, faq, …), or any name with `records`. */
function readLanding(ctx: ParseContext, node: ParsedNode | null, where: string): LandingSection[] {
  const sections: LandingSection[] = [];
  for (const { key: name, keyNode, value } of mapEntries(ctx, node, `the landing of ${where}`) ??
    []) {
    const sectionWhere = `section "${name}" of ${where}`;
    // "faq:" with nothing after it is a section with no options.
    const empty = value === null || (isScalarNode(value) && value.value === null);
    const entries = empty ? [] : (mapEntries(ctx, value, sectionWhere) ?? []);
    const options = checkKeys(ctx, entries, sectionWhere, {
      allowed: ["records", "button", "limit"],
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
      allowed: ["count", "sum", "average", "list", "where", "by", "limit"],
      content: ["label", "title"],
    });
    const measures = options.filter((o) => ["count", "sum", "average", "list"].includes(o.key));
    const measure = measures[0];
    if (measures.length !== 1 || !measure) {
      ctx.error(
        keyNode,
        "invalid-dashboard",
        `${capitalize(itemWhere)} needs one of count, sum, average or list.`,
      );
      continue;
    }
    const target = readString(ctx, measure.value, `"${measure.key}" in ${itemWhere}`);
    if (target === undefined) continue;
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

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
