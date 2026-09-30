// Page patterns (ARCHITECTURE §10.4), each registered as one object: how it is written in
// smithable.yml (schema, parser), what the IR knows about it (models, icon, menu, texted parts),
// its own operations, and how its pages follow a change made elsewhere (a field renamed or
// removed). A new pattern is one entry here; menus, icons, texts, access and the index ask it.
import { isMap, isScalar as isScalarNode, isSeq, type ParsedNode } from "yaml";
import {
  type At,
  checkKeys,
  mapEntries,
  type ParseContext,
  readNameList,
  readNumber,
  readString,
} from "./context.js";
import type { YamlEditor } from "./edit.js";
import {
  type CalculatorExample,
  type CalculatorIR,
  type DashboardItem,
  type FieldIR,
  type FieldValue,
  type LandingSection,
  type OnboardingStep,
  type PageIR,
  type PatternKind,
  type PatternOf,
  SECTION_KINDS,
  type SectionKind,
  type SpecIR,
} from "./ir.js";
import { capitalize, kebab, plural } from "./naming.js";
import type { AnyOperation, Effect, Refusal } from "./operation.js";
import type { JsonSchema } from "./section.js";
import { checkModelFormulas, readField } from "./sections/models.js";
import {
  calculatorOperations,
  calendarOperations,
  crudOperations,
  dashboardOperations,
  dataOperations,
  landingOperations,
  usersOperations,
} from "./sections/page-operations.js";
import { didYouMean } from "./suggest.js";

export interface PagePattern<K extends PatternKind = PatternKind> {
  kind: K;
  /** The schema of the page key that selects the pattern (`crud: Model`, `landing: …`). */
  schema: JsonSchema;
  /** How it is written, for the message when a page has no pattern. */
  example: string;
  parse(
    ctx: ParseContext,
    value: ParsedNode | null,
    where: string,
    parsed: Partial<SpecIR>,
  ): PatternOf<K> | undefined;
  /** Every model its pages show. */
  models(pattern: PatternOf<K>): string[];
  /** The model its pages list and edit record by record (crud), if any. */
  manages?(pattern: PatternOf<K>): string;
  /** Its navigation icon when none is set; without one it is suggested by the model's name. */
  icon?: string;
  /** In the main menu when the spec names no menus; landing and onboarding pages are ways in. */
  inMenu: boolean;
  /** Routes its pages take besides their own (a data page's model lists), for the duplicate check. */
  routes?(route: string, pattern: PatternOf<K>): string[];
  /** The roles that may open its pages when a page says nothing; every role without it. */
  access?: string[];
  /** Its named parts with texts in smithable.content.yml: name → kind of text. */
  parts?(pattern: PatternOf<K>): Record<string, string>;
  /** Custom queries its pages show. */
  queries?(pattern: PatternOf<K>): string[];
  /** Models visitors add records of from its pages without an account (contact forms). */
  forms?(pattern: PatternOf<K>): string[];
  /** Operations that make or change pages of this pattern. */
  operations?: AnyOperation[];
  /** Keeps a page of this pattern in step with an effect elsewhere, or refuses the change. */
  follow?(
    spec: YamlEditor,
    page: PageIR & { pattern: PatternOf<K> },
    effect: Effect,
    ir: SpecIR,
  ): Refusal | undefined;
}

/**
 * What each landing section kind may be given: a button (the page it opens), a form (the model
 * visitors add a record of). `records: <Model>` makes a section of any name a records section.
 */
export const LANDING_SECTIONS: Record<SectionKind, { button?: true; form?: true }> = {
  hero: { button: true },
  features: {},
  records: {},
  pricing: {},
  testimonials: {},
  faq: {},
  callToAction: { button: true },
  contact: { form: true },
  gallery: {},
  footer: {},
  calculator: {},
};

const NUMBER_TYPES = ["int", "decimal", "money"];

/** A rename or removal of a field in a list at `path`: the list follows, or goes when empty. */
function followInList(
  spec: YamlEditor,
  path: string[],
  from: string,
  to: string | undefined,
  keepDepth: number,
): void {
  const list = spec.has(path) ? (spec.get(path) as string[]) : undefined;
  if (!list?.includes(from)) return;
  const next = to ? list.map((f) => (f === from ? to : f)) : list.filter((f) => f !== from);
  if (next.length) spec.set(path, next);
  else spec.removeAndPrune(path, keepDepth);
}

/** The field an effect renames or removes, if it is one of those. */
function fieldEffect(effect: Effect): { model: string; from: string; to?: string } | undefined {
  if (effect.kind === "rename-field")
    return { model: effect.model, from: effect.from, to: effect.to };
  if (effect.kind === "remove-field") return { model: effect.model, from: effect.field };
  return undefined;
}

const crud: PagePattern<"crud"> = {
  kind: "crud",
  schema: { type: "string", description: "A model to list, view, create, edit and delete." },
  example: "crud: <Model>",
  parse(ctx, value, where) {
    const model = readString(ctx, value, `"crud" in ${where}`);
    if (model === undefined) return undefined;
    ctx.reference("model", model, value);
    return { kind: "crud", model };
  },
  models: (p) => [p.model],
  manages: (p) => p.model,
  inMenu: true,
  operations: crudOperations,
  follow(spec, page, effect) {
    // The page's search follows a renamed field, or loses a removed one.
    const f = fieldEffect(effect);
    if (f && page.pattern.model === f.model)
      followInList(spec, ["pages", page.id, "search"], f.from, f.to, 3);
    return undefined;
  },
};

const landing: PagePattern<"landing"> = {
  kind: "landing",
  schema: {
    type: "object",
    description: `Sections of a landing page, in order: ${SECTION_KINDS.join(", ")}.`,
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
  example: "landing",
  parse: (ctx, value, where, parsed) => ({
    kind: "landing",
    sections: readLanding(ctx, value, where, parsed),
  }),
  models: (p) => p.sections.flatMap((s) => (s.model ? [s.model] : [])),
  icon: "home",
  inMenu: false,
  parts: (p) => Object.fromEntries(p.sections.map((s) => [s.name, s.kind])),
  forms: (p) => p.sections.flatMap((s) => (s.form ? [s.form] : [])),
  operations: landingOperations,
};

const dashboard: PagePattern<"dashboard"> = {
  kind: "dashboard",
  schema: {
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
  example: "dashboard",
  parse: (ctx, value, where, parsed) => ({
    kind: "dashboard",
    items: readDashboard(ctx, value, where, parsed),
  }),
  models: (p) => p.items.map((i) => i.model),
  icon: "chart",
  inMenu: true,
  parts: (p) => Object.fromEntries(p.items.map((i) => [i.name, "tile"])),
  queries: (p) => p.items.flatMap((i) => (i.query ? [i.query] : [])),
  operations: dashboardOperations,
  follow(spec, page, effect) {
    // A tile follows a renamed field; a removal is refused while a tile counts on the field.
    const f = fieldEffect(effect);
    if (!f) return undefined;
    for (const item of page.pattern.items) {
      if (item.model !== f.model) continue;
      const uses =
        item.field === f.from || item.by === f.from || (item.where && f.from in item.where);
      if (!uses) continue;
      if (!f.to)
        return {
          refusal: `The "${item.name}" tile of the ${page.id} page uses ${f.model}.${f.from}; change or remove the tile first.`,
        };
      const tile = ["pages", page.id, "dashboard", item.name];
      if (item.field === f.from && item.measure)
        spec.set([...tile, item.measure], `${f.model}.${f.to}`);
      if (item.by === f.from) spec.set([...tile, "by"], f.to);
      if (item.where && f.from in item.where) spec.renameKey([...tile, "where", f.from], f.to);
    }
    return undefined;
  },
};

const settings: PagePattern<"settings"> = {
  kind: "settings",
  schema: {
    type: "string",
    description:
      "A model with one record per user (private data) or per app (shared): the page edits it.",
  },
  example: "settings: <Model>",
  parse(ctx, value, where) {
    const model = readString(ctx, value, `"settings" in ${where}`);
    if (model === undefined) return undefined;
    ctx.reference("model", model, value);
    return { kind: "settings", model };
  },
  models: (p) => [p.model],
  icon: "settings",
  inMenu: true,
};

const onboarding: PagePattern<"onboarding"> = {
  kind: "onboarding",
  schema: {
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
  example: "onboarding",
  parse(ctx, value, where, parsed) {
    const result = readOnboarding(ctx, value, where, parsed);
    return result && { kind: "onboarding", ...result };
  },
  models: (p) => [p.model],
  icon: "home",
  inMenu: false,
  parts: (p) => Object.fromEntries(p.steps.map((step) => [step.name, "step"])),
  follow(spec, page, effect) {
    // A step follows a renamed field and loses a removed one; an emptied step goes.
    const f = fieldEffect(effect);
    if (!f || page.pattern.model !== f.model) return undefined;
    const { from, to } = f;
    for (const step of page.pattern.steps) {
      if (!step.fields.includes(from)) continue;
      const path = ["pages", page.id, "onboarding", "steps", step.name];
      const next = to
        ? step.fields.map((x) => (x === from ? to : x))
        : step.fields.filter((x) => x !== from);
      if (next.length) spec.set(path, next);
      else spec.remove(path);
    }
    return undefined;
  },
};

/** Every page pattern, by kind. TypeScript insists on one entry per kind of the IR. */
const users: PagePattern<"users"> = {
  kind: "users",
  schema: {
    type: "string",
    enum: ["manage"],
    description:
      "Who has access: invite people by email with a role, change roles and remove users. For admins, unless the page's access says otherwise.",
  },
  example: "users: manage",
  parse(ctx, value, where) {
    const mode = readString(ctx, value, `"users" in ${where}`);
    if (mode === undefined) return undefined;
    if (mode !== "manage") {
      ctx.error(value, "invalid-value", `"users" in ${where} must be "manage".`);
      return undefined;
    }
    return { kind: "users", mode };
  },
  models: () => [],
  icon: "users",
  inMenu: true,
  access: ["admin"],
  operations: usersOperations,
};

/** A model's records on a week or month grid, by the date or date-time that places them. */
const calendar: PagePattern<"calendar"> = {
  kind: "calendar",
  schema: {
    oneOf: [
      { type: "string", description: "A model whose records have one date or date-time field." },
      {
        type: "object",
        required: ["model"],
        additionalProperties: false,
        properties: {
          model: { type: "string" },
          starts: {
            type: "string",
            description: "The date or date-time field that places a record.",
          },
          ends: { type: "string", description: "An end field of the same kind." },
          duration: {
            type: "string",
            description:
              "Minutes: a whole-number field, here or one reference away (classType.durationMinutes).",
          },
          title: {
            type: "string",
            description: "What a block says: a field, or a reference's title.",
          },
        },
      },
    ],
    description: "A model's records in a week or month calendar.",
  },
  example: "calendar: <Model>",
  parse: (ctx, value, where, parsed) => readCalendar(ctx, value, where, parsed),
  models: (p) => [p.model],
  icon: "calendar",
  inMenu: true,
  operations: calendarOperations,
  follow(spec, page, effect, ir) {
    // A renamed field is renamed where the calendar names it; a removal it relies on is refused.
    const f = fieldEffect(effect);
    if (!f) return undefined;
    const p = page.pattern;
    const path = (key: string) => ["pages", page.id, "calendar", key];
    // Where the calendar uses the field: its own keys, or a duration one reference away.
    const own = f.model === p.model;
    const uses: [string, string][] = [];
    if (own)
      for (const key of ["starts", "ends", "title"] as const)
        if (p[key] === f.from) uses.push([key, f.to ?? ""]);
    if (p.duration) {
      const [first, second] = p.duration.split(".");
      if (second === undefined) {
        if (own && first === f.from) uses.push(["duration", f.to ?? ""]);
      } else {
        const ref = ir.models.find((m) => m.name === p.model)?.fields.find((x) => x.name === first);
        const target = ref?.type.kind === "relation" ? ref.type.model : undefined;
        if (own && first === f.from) uses.push(["duration", f.to ? `${f.to}.${second}` : ""]);
        else if (target === f.model && second === f.from)
          uses.push(["duration", f.to ? `${first}.${f.to}` : ""]);
      }
    }
    if (!uses.length) return undefined;
    if (!f.to)
      return {
        refusal: `The ${page.id} calendar uses ${f.model}.${f.from}; change or remove the calendar first.`,
      };
    // The short form (\`calendar: Session\`) names no field: an inferred start follows by itself.
    if (!spec.has(path("model"))) return undefined;
    for (const [key, value] of uses) if (spec.has(path(key))) spec.set(path(key), value);
    return undefined;
  },
};

/** An admin view of every model (or some): each one's records, found, opened, changed. */
/**
 * A calculator's fields, written as a model's, and its examples. No references, lists or
 * pictures (nothing to point at), nothing required or unique (nothing is stored). The formulas
 * are checked as a model's are, over the calculator's own fields.
 */
function readCalculator(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  /** The calculator's name for messages and formula marks, e.g. "mortgage" or "home.estimate". */
  name: string,
): CalculatorIR | undefined {
  const entries = mapEntries(ctx, node, `"calculator" in ${where}`);
  if (!entries) return undefined;
  const known = checkKeys(ctx, entries, `"calculator" in ${where}`, {
    allowed: ["fields", "examples"],
  });
  const fieldsEntry = known.find((e) => e.key === "fields");
  if (!fieldsEntry) {
    ctx.error(node, "missing-key", `${capitalize(where)} needs "fields": its inputs and results.`);
    return undefined;
  }
  const fields: FieldIR[] = [];
  for (const entry of mapEntries(ctx, fieldsEntry.value, `the fields of ${where}`) ?? []) {
    const field = readField(ctx, name, entry);
    if (!field) continue;
    const fieldWhere = `field "${name}.${field.name}"`;
    const unfit =
      field.type.kind === "relation"
        ? "cannot refer to records"
        : field.type.kind === "scalar" && field.type.name === "picture"
          ? "cannot be a picture"
          : field.unique
            ? "cannot be unique"
            : field.required && !field.formula
              ? 'cannot be required ("!"): nothing is stored, and an empty input counts as 0'
              : undefined;
    if (unfit) {
      ctx.error(
        entry.value ?? entry.keyNode,
        "invalid-field",
        `${capitalize(fieldWhere)} in a calculator ${unfit}.`,
      );
      continue;
    }
    fields.push(field);
  }
  if (!fields.some((f) => f.formula))
    ctx.warning(
      fieldsEntry.keyNode,
      "calculator-no-result",
      `${capitalize(where)} has no formula field, so it calculates nothing.`,
    );
  const examples: CalculatorExample[] = [];
  const examplesEntry = known.find((e) => e.key === "examples");
  if (examplesEntry) {
    const items = isSeq(examplesEntry.value) ? (examplesEntry.value.items as ParsedNode[]) : [];
    if (!isSeq(examplesEntry.value))
      ctx.error(
        examplesEntry.value,
        "expected-list",
        `"examples" in ${where} is a list of { input, expected }.`,
      );
    for (const item of items) {
      const parts = checkKeys(
        ctx,
        mapEntries(ctx, item, `an example of ${where}`) ?? [],
        `an example of ${where}`,
        {
          allowed: ["input", "expected"],
        },
      );
      const read = (
        key: "input" | "expected",
        allow: (f: FieldIR) => boolean,
      ): Record<string, FieldValue> | undefined => {
        const part = parts.find((e) => e.key === key);
        if (!part) {
          ctx.error(item, "missing-key", `An example of ${where} needs "${key}".`);
          return undefined;
        }
        const values: Record<string, FieldValue> = {};
        for (const v of mapEntries(ctx, part.value, `"${key}" of an example of ${where}`) ?? []) {
          const field = fields.find((f) => f.name === v.key);
          if (!field || !allow(field)) {
            ctx.error(
              v.keyNode,
              "invalid-example",
              `"${v.key}" is not ${key === "input" ? "an input" : "a result"} of ${where}.`,
              didYouMean(
                v.key,
                fields.filter(allow).map((f) => f.name),
              ),
            );
            continue;
          }
          const value = isScalarNode(v.value) ? v.value.value : undefined;
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
            values[v.key] = value;
          else
            ctx.error(
              v.value,
              "invalid-value",
              `"${v.key}" in an example of ${where} must be a single value.`,
            );
        }
        return values;
      };
      const input = read("input", (f) => !f.formula);
      const expected = read("expected", (f) => Boolean(f.formula));
      if (input && expected) examples.push({ input, expected });
    }
  }
  // The formulas, defaults and cycles, as for a model, over the calculator's own fields.
  checkModelFormulas(ctx, { name, fields }, []);
  return { fields, examples };
}

const calculator: PagePattern<"calculator"> = {
  kind: "calculator",
  schema: {
    type: "object",
    required: ["fields"],
    additionalProperties: false,
    properties: {
      fields: {
        type: "object",
        description:
          "Fields as a model's: entered ones are the inputs, formula fields the results.",
        additionalProperties: true,
      },
      examples: {
        type: "array",
        description: "Inputs and the results they must give; each becomes a test.",
        items: {
          type: "object",
          required: ["input", "expected"],
          properties: { input: { type: "object" }, expected: { type: "object" } },
        },
      },
    },
    description: "Inputs and results computed as you type, stored nowhere.",
  },
  example: "calculator: { fields: { … } }",
  parse(ctx, value, where) {
    const name = /page "([^"]+)"/.exec(where)?.[1] ?? "calculator";
    const calculator = readCalculator(ctx, value, where, name);
    return calculator ? { kind: "calculator", calculator } : undefined;
  },
  models: () => [],
  icon: "chart",
  inMenu: true,
  parts: () => ({ results: "results" }),
  operations: calculatorOperations,
};

const data: PagePattern<"data"> = {
  kind: "data",
  schema: {
    oneOf: [
      { type: "string", enum: ["all"] },
      { type: "array", items: { type: "string" }, minItems: 1 },
    ],
    description:
      "An administrator's view of the app's data: all (every model) or a list of models, each with its records to find, open, change and delete. For admins, unless the page's access says otherwise.",
  },
  example: "data: all",
  parse(ctx, value, where, parsed) {
    if (isScalarNode(value)) {
      if (readString(ctx, value, `"data" in ${where}`) !== "all") {
        ctx.error(value, "invalid-value", `"data" in ${where} is "all" or a list of models.`);
        return undefined;
      }
      return { kind: "data", models: (parsed.models ?? []).map((m) => m.name), all: true };
    }
    const models = readNameList(ctx, value, `"data" in ${where}`);
    // An empty list would make the page vanish without a word.
    if (!models.length) {
      if (isSeq(value))
        ctx.error(
          value,
          "invalid-value",
          `"data" in ${where} is "all" or a list of at least one model.`,
        );
      return undefined;
    }
    for (const { name, at } of models) ctx.reference("model", name, at);
    return { kind: "data", models: models.map((m) => m.name), all: false };
  },
  models: (p) => p.models,
  // Each model's list lives under the page, e.g. /admin/order-lines.
  routes: (route, p) => p.models.map((m) => `${route === "/" ? "" : route}/${kebab(plural(m))}`),
  icon: "layers",
  inMenu: true,
  access: ["admin"],
  operations: dataOperations,
};

export const PAGE_PATTERNS: { [K in PatternKind]: PagePattern<K> } = {
  crud,
  landing,
  dashboard,
  settings,
  onboarding,
  users,
  data,
  calendar,
  calculator,
};

export const PATTERN_KINDS = Object.keys(PAGE_PATTERNS) as PatternKind[];

/** A page's pattern with what is known about it (the lookup TypeScript cannot type). */
export function patternInfo(page: PageIR) {
  const info = PAGE_PATTERNS[page.pattern.kind] as unknown as PagePattern<"crud">;
  const pattern = page.pattern as PatternOf<"crud">;
  return {
    models: () => info.models(pattern),
    manages: () => info.manages?.(pattern),
    icon: info.icon,
    inMenu: info.inMenu,
    access: info.access,
    routes: (route: string) => info.routes?.(route, pattern) ?? [],
    parts: () => info.parts?.(pattern) ?? {},
    queries: () => info.queries?.(pattern) ?? [],
    forms: () => info.forms?.(pattern) ?? [],
    follow: (spec: YamlEditor, effect: Effect, ir: SpecIR) =>
      info.follow?.(spec, page as PageIR & { pattern: PatternOf<"crud"> }, effect, ir),
  };
}

/** The model a crud page manages; other pages have none. */
export function pageModel(page: PageIR): string | undefined {
  return patternInfo(page).manages();
}

/** Every model a page shows: a crud page's, a landing page's records, a dashboard's tiles. */
export function pageModels(page: PageIR): string[] {
  return [...new Set(patternInfo(page).models())];
}

/** Landing sections: a section named like its kind (hero, faq, …), or any name with `records`. */
function readLanding(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  parsed: Partial<SpecIR>,
): LandingSection[] {
  const sections: LandingSection[] = [];
  const named = SECTION_KINDS.filter((k) => k !== "records");
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
      allowed: ["records", "button", "limit", "form", "calculator"],
      content: ["title", "subtitle", "text", "items"],
    });
    const kindOf = (named as readonly string[]).includes(name) ? (name as SectionKind) : undefined;
    const allows = kindOf ? LANDING_SECTIONS[kindOf] : {};
    const section: LandingSection = { name, kind: "records" };
    for (const { key, value: option, keyNode: optionKey } of options) {
      if (key === "calculator") {
        // A calculator of any name: inputs and results, stored nowhere (docs/design/calculator.md).
        const calculator = readCalculator(ctx, option, sectionWhere, `${where}.${name}`);
        if (calculator) {
          section.kind = "calculator";
          section.calculator = calculator;
        }
      } else if (key === "records") {
        const model = readString(ctx, option, `"records" in ${sectionWhere}`);
        if (model !== undefined) {
          ctx.reference("model", model, option);
          section.model = model;
        }
      } else if (key === "form") {
        const model = readString(ctx, option, `"form" in ${sectionWhere}`);
        if (!allows.form) {
          const kinds = named.filter((k) => LANDING_SECTIONS[k].form);
          ctx.error(optionKey, "invalid-key", `Only a ${kinds.join(" or ")} section has a form.`);
        } else if (model !== undefined) {
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
        if (!allows.button) {
          const kinds = named.filter((k) => LANDING_SECTIONS[k].button);
          ctx.error(
            optionKey,
            "invalid-key",
            `Only a ${kinds.slice(0, -1).join(", ")} or ${kinds.at(-1)} section has a button.`,
          );
        }
      } else {
        const limit = readNumber(ctx, option, `"limit" in ${sectionWhere}`);
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
          ctx.error(option, "invalid-value", `"limit" must be a whole number above 0.`);
        else if (limit !== undefined) section.limit = limit;
      }
    }
    if (section.kind === "calculator") {
      sections.push(section);
      continue;
    }
    if (!section.model) {
      if (!kindOf) {
        ctx.error(
          keyNode,
          "unknown-section",
          `There is no section kind "${name}". Name a section after its kind, or give it "records: <Model>".`,
          didYouMean(name, named) ?? `Kinds: ${named.join(", ")}.`,
        );
        continue;
      }
      section.kind = kindOf;
    }
    sections.push(section);
  }
  return sections;
}

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

const DATES = ["date", "datetime"];
const scalarKind = (f: FieldIR | undefined) =>
  f?.type.kind === "scalar" ? f.type.name : undefined;

/** A calendar, short (`calendar: Session`) or long (`{ model, starts, ends, duration, title }`). */
function readCalendar(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  parsed: Partial<SpecIR>,
): PatternOf<"calendar"> | undefined {
  const calendarWhere = `the calendar of ${where}`;
  let modelName: string | undefined;
  let modelAt: At = node;
  const given: Record<string, { value: string; at: At }> = {};
  if (isMap(node)) {
    for (const { key, value } of checkKeys(
      ctx,
      mapEntries(ctx, node, calendarWhere) ?? [],
      calendarWhere,
      {
        allowed: ["model", "starts", "ends", "duration", "title"],
      },
    )) {
      const text = readString(ctx, value, `"${key}" in ${calendarWhere}`);
      if (text === undefined) continue;
      if (key === "model") {
        modelName = text;
        modelAt = value;
      } else given[key] = { value: text, at: value };
    }
    if (modelName === undefined) {
      ctx.error(node, "missing-key", `${capitalize(calendarWhere)} needs "model".`);
      return undefined;
    }
  } else modelName = readString(ctx, node, `"calendar" in ${where}`);
  if (modelName === undefined) return undefined;
  ctx.reference("model", modelName, modelAt);
  const model = parsed.models?.find((m) => m.name === modelName);
  if (!model) return { kind: "calendar", model: modelName, starts: given.starts?.value ?? "" };
  const field = (name: string) => model.fields.find((f) => f.name === name);
  const unknown = (at: At, name: string) =>
    ctx.error(
      at,
      "unknown-field",
      `${modelName} has no field named "${name}".`,
      didYouMean(
        name,
        model.fields.map((f) => f.name),
      ),
    );

  // Starts: given, or the model's one stored date or date-time field.
  let starts = given.starts?.value;
  if (starts !== undefined) {
    const f = field(starts);
    if (!f) unknown(given.starts?.at ?? null, starts);
    else if (!DATES.includes(scalarKind(f) ?? ""))
      ctx.error(
        given.starts?.at ?? null,
        "invalid-value",
        `"${starts}" places records in ${calendarWhere}: it must be a date or date-time field.`,
      );
  } else {
    const dates = model.fields.filter((f) => !f.formula && DATES.includes(scalarKind(f) ?? ""));
    if (dates.length !== 1) {
      ctx.error(
        modelAt,
        "missing-key",
        dates.length
          ? `${modelName} has several date fields (${dates.map((f) => f.name).join(", ")}): name the one that places a record with "starts".`
          : `${modelName} has no date or date-time field to place its records in a calendar.`,
        dates.length
          ? `Write "calendar: { model: ${modelName}, starts: ${dates[0]?.name} }".`
          : undefined,
      );
      return undefined;
    }
    starts = dates[0]?.name as string;
  }
  const startKind = scalarKind(field(starts));

  const ends = given.ends;
  if (ends) {
    const f = field(ends.value);
    if (!f) unknown(ends.at, ends.value);
    else if (scalarKind(f) !== startKind)
      ctx.error(
        ends.at,
        "invalid-value",
        `"${ends.value}" ends records that "${starts}" starts: it must be the same kind of field.`,
      );
    if (given.duration)
      ctx.error(
        given.duration.at,
        "invalid-key",
        `${capitalize(calendarWhere)} has "ends" or "duration", not both.`,
      );
  }

  // Duration: minutes, on the record or one reference away.
  const duration = given.duration;
  if (duration && !ends) {
    const [first, second] = duration.value.split(".");
    const own = field(first ?? "");
    const target =
      second === undefined
        ? own
        : own?.type.kind === "relation" && !own.type.many
          ? parsed.models
              ?.find((m) => own.type.kind === "relation" && m.name === own.type.model)
              ?.fields.find((f) => f.name === second)
          : undefined;
    if (!target || scalarKind(target) !== "int")
      ctx.error(
        duration.at,
        "invalid-value",
        `"${duration.value}" is a calendar's duration: a whole-number field of ${modelName}, or of a record it refers to (reference.field).`,
      );
  }

  // Title: a field, or a reference (its record's title).
  const title = given.title;
  if (title && !field(title.value)) unknown(title.at, title.value);

  if (!parsed.app?.timezone)
    ctx.warning(
      modelAt,
      "no-timezone",
      `${capitalize(where)} is a calendar, but the app has no time zone: records are placed in UTC.`,
      `Set "timezone" under "app", e.g. "Europe/Mariehamn".`,
    );
  return {
    kind: "calendar",
    model: modelName,
    starts,
    ...(ends ? { ends: ends.value } : {}),
    ...(duration && !ends ? { duration: duration.value } : {}),
    ...(title ? { title: title.value } : {}),
  };
}
