// Page patterns (ARCHITECTURE §10.4), each registered as one object: how it is written in
// smithable.yml (schema, parser), what the IR knows about it (models, icon, menu, texted parts),
// its own operations, and how its pages follow a change made elsewhere (a field renamed or
// removed). A new pattern is one entry here; menus, icons, texts, access and the index ask it.
import { isMap, isScalar as isScalarNode, isSeq, type ParsedNode } from "yaml";
import { followRenamed, lostValues, readCondition } from "./condition.js";
import {
  type At,
  checkKeys,
  mapEntries,
  type ParseContext,
  readBoolean,
  readNameList,
  readNumber,
  readString,
} from "./context.js";
import type { YamlEditor } from "./edit.js";
import { readHours } from "./hours.js";
import {
  type CalculatorExample,
  type CalculatorIR,
  type Condition,
  type DashboardItem,
  type FieldIR,
  type FieldValue,
  type LandingSection,
  type ModelIR,
  type OnboardingStep,
  type PageIR,
  type PageSection,
  type PatternKind,
  type PatternOf,
  SECTION_KINDS,
  type SectionKind,
  type SpecIR,
  storesFiles,
  storesPictures,
  USER_MODEL,
} from "./ir.js";
import { capitalize, kebab, plural } from "./naming.js";
import type { AnyOperation, Effect, Note, Refusal } from "./operation.js";
import { titleField } from "./samples.js";
import type { JsonSchema } from "./section.js";
import { checkFilterFields } from "./sections/list-keys.js";
import { checkModelFormulas, readField } from "./sections/models.js";
import { COMPONENT_PATTERN, FIELD_NAME_PATTERN } from "./sections/names.js";
import {
  articlesOperations,
  calculatorOperations,
  calendarOperations,
  crudOperations,
  customOperations,
  dashboardOperations,
  dataOperations,
  landingOperations,
  legalOperations,
  orderOperations,
  reviewOperations,
  sectionsOperations,
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
  /** The models visitors must read for its public pages to show anything; by default `models`. */
  reads?(pattern: PatternOf<K>): string[];
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
  ): Refusal | Note | undefined;
}

/**
 * What each landing section kind may be given: a button (the page it opens), a form (the model
 * visitors add a record of). `records: <Model>` makes a section of any name a records section.
 */
export const LANDING_SECTIONS: Record<
  SectionKind,
  { button?: true; secondButton?: true; form?: true; shortcuts?: true }
> = {
  hero: { button: true, secondButton: true, shortcuts: true },
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
  custom: {},
  text: {},
};

function readComponent(ctx: ParseContext, value: ParsedNode | null, where: string) {
  const name = readString(ctx, value, `"custom" in ${where}`);
  if (name !== undefined && !COMPONENT_PATTERN.test(name)) {
    ctx.error(
      value,
      "invalid-value",
      `"custom" in ${where} names a component, like Planner: a capital letter, then letters and digits.`,
    );
    return undefined;
  }
  return name;
}

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
    // The page's search, filters and sort follow a renamed field, or lose a removed one.
    const f = fieldEffect(effect);
    if (f && page.pattern.model === f.model) {
      for (const key of ["search", "filters", "sortable"])
        followInList(spec, ["pages", page.id, key], f.from, f.to, 3);
      // The field's default filter follows its name, and goes with the field.
      const defaulted = ["pages", page.id, "defaultFilter", f.from];
      if (spec.has(defaulted)) {
        if (f.to) spec.renameKey(defaulted, f.to);
        else spec.removeAndPrune(defaulted, 3);
      }
    }
    // A choice's renamed values follow into its default filter; values that are gone leave it,
    // and a default with none left goes.
    if (
      effect.kind === "change-field" &&
      page.pattern.model === effect.model &&
      page.defaultFilter?.[effect.field] !== undefined
    ) {
      const path = ["pages", page.id, "defaultFilter", effect.field];
      const kept = [
        ...new Set(
          (page.defaultFilter[effect.field] as string)
            .split(",")
            .map((v) => effect.renamed?.[v.trim()] ?? v.trim())
            .filter((v) => !effect.choices || effect.choices.includes(v)),
        ),
      ];
      if (!kept.length) spec.removeAndPrune(path, 3);
      else spec.set(path, kept.length > 1 ? kept : (kept[0] as string));
    }
    // The contact block's user field follows a rename; when the field goes, it mails the owner.
    if (f && page.pattern.model === f.model && page.contact && page.contact.to === f.from) {
      const short = ["pages", page.id, "contact"];
      const long = [...short, "to"];
      if (spec.has(long)) spec.set(long, f.to ?? "owner");
      else if (spec.has(short)) spec.set(short, f.to ?? "owner");
    }
    return undefined;
  },
};

/** A calculator's schema: a page's, and a landing section's (`estimate: { calculator: … }`). */
const CALCULATOR_SCHEMA: JsonSchema = {
  type: "object",
  required: ["fields"],
  additionalProperties: false,
  properties: {
    fields: {
      type: "object",
      description: "Fields as a model's: entered ones are the inputs, formula fields the results.",
      additionalProperties: true,
    },
    examples: {
      type: "array",
      description: "Inputs and the results they must give; each becomes a test.",
      items: {
        type: "object",
        required: ["input", "expected"],
        properties: {
          input: { type: "object", description: "The values entered." },
          expected: { type: "object", description: "The results they must give." },
        },
      },
    },
  },
  description: "Inputs and results computed as you type, stored nowhere.",
};

/** The schema of a page's sections (a landing page's `landing`, any page's `sections`). */
const SECTIONS_SCHEMA = (of: string): JsonSchema => ({
  type: "object",
  description: `Sections of ${of}, in order: ${SECTION_KINDS.join(", ")}.`,
  additionalProperties: {
    type: ["object", "null"],
    additionalProperties: false,
    properties: {
      records: { type: "string", description: "A model whose records the section shows." },
      view: {
        enum: ["cards", "table", "calendar"],
        description: "A records section's view: cards (the default), a table, or a calendar.",
      },
      starts: {
        type: "string",
        description: "A calendar view: the date field the records are placed by.",
      },
      text: {
        type: ["boolean", "null"],
        description: "A text section: a heading and paragraphs from smithable.content.yml.",
      },
      ...Object.fromEntries(
        SECTION_KINDS.filter((k) => !["records", "calculator", "custom", "text"].includes(k)).map(
          (k) => [
            k,
            {
              type: ["boolean", "null"],
              description: `A ${k} section under another name, written alone.`,
            },
          ],
        ),
      ),
      search: {
        type: "boolean",
        description: "A records section with a search box, leading to the model's list page.",
      },
      filters: {
        type: "array",
        items: { type: "string" },
        description: "A records section's filters (fields of the model), leading to its list page.",
      },
      where: {
        type: "object",
        description:
          "A records section shows only records with these choice values (or lists of them) or yes/no values, e.g. { status: [investigating, identified] }.",
      },
      button: { type: "string", description: "The page the section's button opens." },
      secondButton: {
        type: "string",
        description:
          "A hero's second button, an outline one beside the first: the page it opens. None when not given.",
      },
      shortcuts: {
        type: "array",
        items: { type: "string" },
        maxItems: 4,
        description: "A hero's shortcuts: up to four pages, shown as round icons.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        description: "A records section: how many it shows.",
      },
      form: {
        type: "string",
        description: "A contact section's form: the model visitors add a record of.",
      },
      calculator: CALCULATOR_SCHEMA,
      custom: {
        type: "string",
        description: "A section of your own: the component in src/custom/sections/<Name>.tsx.",
      },
    },
  },
});

const landing: PagePattern<"landing"> = {
  kind: "landing",
  schema: SECTIONS_SCHEMA("a landing page"),
  example: "landing",
  parse: (ctx, value, where, parsed) => ({
    kind: "landing",
    sections: readSections(ctx, value, where, parsed),
  }),
  // Its sections' models, forms, texts and following are every page's (patternInfo).
  models: () => [],
  icon: "home",
  inMenu: false,
  operations: landingOperations,
};

const dashboard: PagePattern<"dashboard"> = {
  kind: "dashboard",
  schema: {
    type: "object",
    description: "Tiles of a dashboard, in order: numbers, charts by month, latest records.",
    propertyNames: { pattern: FIELD_NAME_PATTERN.source },
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
        limit: { type: "integer", minimum: 1, description: "A list: how many records it shows." },
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
    // A tile follows a renamed field, and a renamed value its "where" names; a removal is refused
    // while a tile counts on the field, and so is a retyped field that loses such a value.
    if (effect.kind === "change-field") {
      for (const item of page.pattern.items) {
        const named = item.model === effect.model ? item.where?.[effect.field] : undefined;
        const wanted =
          named === undefined
            ? undefined
            : followRenamed(
                spec,
                ["pages", page.id, "dashboard", item.name, "where", effect.field],
                named,
                effect.renamed,
              );
        const lost = wanted === undefined ? [] : lostValues(wanted, effect.choices);
        if (lost.length)
          return {
            refusal: `The "${item.name}" tile of the ${page.id} page counts ${effect.model} records where ${effect.field} is ${lost.join(" or ")}; change its "where" first.`,
          };
      }
      return undefined;
    }
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
      model: { type: "string", description: "The model of the settings record." },
      steps: {
        type: "object",
        description: "The steps in order, each with the fields it asks for.",
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
          model: { type: "string", description: "The model whose records the calendar shows." },
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

/** The fields an articles page names, and what each must be (docs/design/articles.md). */
const ARTICLE_KEYS = ["title", "body", "picture", "date", "address", "summary", "author"] as const;

/** A model's records as articles: a list newest first, and a page per article. */
const articles: PagePattern<"articles"> = {
  kind: "articles",
  schema: {
    oneOf: [
      {
        type: "string",
        description:
          "A model with a title and a markdown body; its other parts are read from the fields' types (docs/design/inference.md).",
      },
      {
        type: "object",
        required: ["model"],
        additionalProperties: false,
        properties: {
          model: { type: "string", description: "The model whose records are the articles." },
          title: { type: "string", description: "The article's title." },
          body: { type: "string", description: "A markdown field: the article itself." },
          picture: {
            type: "string",
            description: "A picture field shown with the article; none for no picture.",
          },
          date: {
            type: "string",
            description: "A date or date-time field: when it appeared; none for no date.",
          },
          address: {
            type: "string",
            description:
              "A unique string field: the article's address (/blog/<address>); none for the number.",
          },
          summary: {
            type: "string",
            description:
              "A string or text field shown in the list; none for the body's first paragraph.",
          },
          author: {
            type: "string",
            description:
              "A field that refers to the user who wrote it, shown with the article; none for no author.",
          },
        },
      },
    ],
    description: "A model's records as articles: a blog, news or a knowledge base.",
  },
  example: "articles: <Model>",
  parse: (ctx, value, where, parsed) => readArticles(ctx, value, where, parsed),
  models: (p) => [p.model],
  icon: "book",
  inMenu: true,
  operations: articlesOperations,
  follow(spec, page, effect) {
    // A renamed field is renamed where the page names it; a removal it relies on is refused.
    const f = fieldEffect(effect);
    const p = page.pattern;
    if (!f || f.model !== p.model) return undefined;
    const keys = ARTICLE_KEYS.filter((key) => p[key] === f.from);
    if (!keys.length) return undefined;
    if (!f.to)
      return {
        refusal: `The ${page.id} page shows ${f.model}.${f.from} in its articles; change or remove the page first.`,
      };
    const path = (key: string) => ["pages", page.id, "articles", key];
    for (const key of keys) if (spec.has(path(key))) spec.set(path(key), f.to);
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
        : storesPictures(field)
          ? "cannot be a picture"
          : storesFiles(field)
            ? "cannot be a document"
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
  schema: CALCULATOR_SCHEMA,
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

const custom: PagePattern<"custom"> = {
  kind: "custom",
  schema: {
    type: "string",
    description:
      "A page of your own: the component in src/custom/pages/<Name>.tsx, created once as a stub; the route, access and menu entry stay Smithable's.",
  },
  example: "custom: <Component>",
  parse(ctx, value, where) {
    const component = readComponent(ctx, value, where);
    return component ? { kind: "custom", component } : undefined;
  },
  models: () => [],
  icon: "layers",
  inMenu: true,
  operations: customOperations,
};

/** The order page's keys besides from and into (docs/design/orders.md §2). */
const ORDER_KEYS = ["from", "into", "ask", "hours", "lead", "price", "quantity", "available"];

/** A page where visitors compose an order from a model's records (docs/design/orders.md §3). */
const order: PagePattern<"order"> = {
  kind: "order",
  schema: {
    type: "object",
    description:
      "A page where visitors choose records of one model and send them as one order of another, with its lines, in one write; the prices are read on the server.",
    required: ["from", "into"],
    additionalProperties: false,
    properties: {
      from: {
        type: "string",
        description:
          "The model people choose from (dishes): its one money field is the price, its one yes/no field says what is available.",
      },
      price: {
        type: "string",
        description: 'The money field of "from" that is the price, when it has several.',
      },
      quantity: {
        type: "string",
        description:
          "The whole-number field of the lines' model that holds how many, when it has several; none for no quantity.",
      },
      available: {
        type: "string",
        description:
          'The yes/no field of "from" that says a record can be ordered, when it has several; none for always.',
      },
      into: {
        type: "string",
        description:
          "The model an order is (one record per order, numbered with sequence: true), whose one list holds the lines.",
      },
      ask: {
        type: "array",
        items: { type: "string" },
        description:
          "The order's fields the customer fills, in this order (name, phone, wanted, note).",
      },
      hours: {
        type: "object",
        description: `When orders are taken, in the app's time zone: a day or a range of days to a span or a list of spans, e.g. { mon-thu: "11:00-20:00", sat: ["10:00-14:00", "17:00-22:00"] }. Without hours, always.`,
        additionalProperties: {
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
        },
      },
      lead: {
        type: "integer",
        minimum: 0,
        description: "Minutes from now to the earliest time a customer may want the order.",
      },
    },
  },
  example: "order: { from: <Model>, into: <Model> }",
  parse: (ctx, value, where, parsed) => readOrder(ctx, value, where, parsed),
  models: (p) => [p.from, p.into, p.line],
  // Visitors read what they choose; the order and its lines they only write.
  reads: (p) => [p.from],
  inMenu: false,
  forms: (p) => [p.into],
  operations: orderOperations,
  follow(spec, page, effect) {
    // A renamed field the customer is asked for follows; a field the page relies on is refused.
    // A change of such a field's type is not refused here: the next validation says what is wrong.
    const f = fieldEffect(effect);
    if (!f) return undefined;
    const p = page.pattern;
    const relied: [string, string][] = [
      [p.from, p.price],
      [p.into, p.lines],
      [p.into, p.number],
      [p.line, p.item],
      [p.line, p.unitPrice],
    ];
    if (relied.some(([m, name]) => m === f.model && name === f.from))
      return f.to
        ? undefined
        : {
            refusal: `The ${page.id} order page uses ${f.model}.${f.from}; change or remove the page first.`,
          };
    if (f.model !== p.into || !p.ask.includes(f.from)) return undefined;
    const path = ["pages", page.id, "order", "ask"];
    spec.set(
      path,
      f.to
        ? p.ask.map((a) => (a === f.from ? (f.to as string) : a))
        : p.ask.filter((a) => a !== f.from),
    );
    return undefined;
  },
};

const legal: PagePattern<"legal"> = {
  kind: "legal",
  schema: {
    type: "string",
    enum: ["privacy"],
    description:
      "A privacy page written from the app itself: who runs it, what it stores and why, cookies, mail, logs, your rights. The operator's details are texts in smithable.content.yml (operator: name, address, email, country, hosting).",
  },
  example: "legal: privacy",
  parse(ctx, value, where) {
    const kind = readString(ctx, value, `"legal" in ${where}`);
    if (kind === undefined) return undefined;
    if (kind !== "privacy") {
      ctx.error(
        value,
        "invalid-value",
        `"legal" in ${where} is "privacy" (the only legal page so far).`,
      );
      return undefined;
    }
    return { kind: "legal", legal: "privacy" };
  },
  models: () => [],
  icon: "shield",
  // Linked from the site's footer and the consent bar, not a menu entry.
  inMenu: false,
  // The operator's details, and a part of the maker's own words under the generated text.
  parts: () => ({ operator: "operator", more: "custom" }),
  operations: legalOperations,
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

const review: PagePattern<"review"> = {
  kind: "review",
  schema: {
    oneOf: [
      { type: "string", enum: ["all"] },
      { type: "array", items: { type: "string" }, minItems: 1 },
    ],
    description:
      "The pictures and files waiting for review, to approve or reject with a reason: all (every model with review) or a list of models. For admins and the roles granted review in smithable.auth.yml.",
  },
  example: "review: all",
  parse(ctx, value, where, parsed) {
    const reviewed = (parsed.models ?? []).filter((m) => m.review);
    if (isScalarNode(value)) {
      if (readString(ctx, value, `"review" in ${where}`) !== "all") {
        ctx.error(value, "invalid-value", `"review" in ${where} is "all" or a list of models.`);
        return undefined;
      }
      if (!reviewed.length)
        ctx.warning(
          value,
          "review-nothing",
          `No model has "review", so the page in ${where} has nothing to show.`,
          `Add "review: [<picture field>]" to a model, or remove the page.`,
        );
      return { kind: "review", models: reviewed.map((m) => m.name), all: true };
    }
    const models = readNameList(ctx, value, `"review" in ${where}`);
    if (!models.length) {
      if (isSeq(value))
        ctx.error(
          value,
          "invalid-value",
          `"review" in ${where} is "all" or a list of at least one model.`,
        );
      return undefined;
    }
    for (const { name, at } of models) {
      ctx.reference("model", name, at);
      const model = parsed.models?.find((m) => m.name === name);
      if (model && !model.review)
        ctx.warning(
          at,
          "review-nothing",
          `${name} has no "review", so none of its files wait here.`,
          `Add "review: [<picture field>]" to ${name}, or leave it out of the list.`,
        );
    }
    return { kind: "review", models: models.map((m) => m.name), all: false };
  },
  models: (p) => p.models,
  icon: "shield",
  inMenu: true,
  access: ["admin"],
  operations: reviewOperations,
};

/** A page of parts and no kind (docs/design/page-sections.md §2): its `sections` alone. */
const sectionsPage: PagePattern<"sections"> = {
  kind: "sections",
  schema: SECTIONS_SCHEMA("a page"),
  example: "sections",
  parse: () => ({ kind: "sections" }),
  models: () => [],
  inMenu: true,
  operations: sectionsOperations,
};

/** Whether a section is a page kind's own (a crud page's list, a dashboard's tiles), not a part. */
export function isOwnSection(section: PageSection): boolean {
  return section.own === true;
}

/** A page's sections that are parts (not the page kind's own): what the generic page adds. */
export function partSections(page: PageIR): PageSection[] {
  return (page.sections ?? []).filter((s) => !isOwnSection(s));
}

/**
 * Keeps a page's sections in step with an effect elsewhere: a removed page leaves a hero's
 * button and shortcuts; a records section's condition follows a renamed field, and keeps the
 * field and the values it names, since losing them would silently show every record.
 */
export function followSections(
  spec: YamlEditor,
  page: PageIR,
  effect: Effect,
): Refusal | Note | undefined {
  const under = page.pattern.kind === "landing" ? "landing" : "sections";
  const sections = partSections(page);
  if (effect.kind === "remove-page") {
    const linked = sections.filter(
      (s) =>
        s.button === effect.page ||
        s.secondButton === effect.page ||
        s.shortcuts?.includes(effect.page),
    );
    for (const section of linked) {
      const at = ["pages", page.id, under, section.name];
      if (section.button === effect.page) spec.removeAndPrune([...at, "button"], 4);
      if (section.secondButton === effect.page) spec.removeAndPrune([...at, "secondButton"], 4);
      const rest = section.shortcuts?.filter((p) => p !== effect.page) ?? [];
      if (section.shortcuts?.includes(effect.page))
        if (rest.length) spec.set([...at, "shortcuts"], rest);
        else spec.removeAndPrune([...at, "shortcuts"], 4);
    }
    return linked.length
      ? {
          note: `the ${page.id} page's ${linked.map((s) => s.name).join(" and ")} no longer ${linked.length > 1 ? "link" : "links"} to it`,
        }
      : undefined;
  }
  if (
    effect.kind !== "rename-field" &&
    effect.kind !== "remove-field" &&
    effect.kind !== "change-field"
  )
    return undefined;
  for (const section of sections) {
    if (section.model === effect.model && section.starts !== undefined) {
      const path = ["pages", page.id, under, section.name, "starts"];
      if (effect.kind === "rename-field" && section.starts === effect.from && spec.has(path))
        spec.set(path, effect.to);
      else if (effect.kind === "remove-field" && section.starts === effect.field)
        return {
          refusal: `The ${section.name} section of the ${page.id} page places ${effect.model} records by ${effect.field}; give it another date first.`,
        };
    }
    if (!section.where || section.model !== effect.model) continue;
    const path = ["pages", page.id, under, section.name, "where"];
    const field = effect.kind === "rename-field" ? effect.from : effect.field;
    if (!(field in section.where)) continue;
    const at = `the ${section.name} section of the ${page.id} page`;
    if (effect.kind === "remove-field")
      return {
        refusal: `${capitalize(at)} shows only ${effect.model} records where ${field} fits; change its "where" first.`,
      };
    if (effect.kind === "change-field") {
      const wanted = followRenamed(
        spec,
        [...path, field],
        section.where[field] as Condition[string],
        effect.renamed,
      );
      const lost = lostValues(wanted, effect.choices);
      if (lost.length)
        return {
          refusal: `${capitalize(at)} shows only ${effect.model} records where ${field} is ${lost.join(" or ")}; change its "where" first.`,
        };
    }
    if (effect.kind === "rename-field") spec.renameKey([...path, field], effect.to);
  }
  return undefined;
}

export const PAGE_PATTERNS: { [K in PatternKind]: PagePattern<K> } = {
  crud,
  landing,
  sections: sectionsPage,
  dashboard,
  settings,
  onboarding,
  users,
  data,
  review,
  calendar,
  calculator,
  articles,
  custom,
  legal,
  order,
};

export const PATTERN_KINDS = Object.keys(PAGE_PATTERNS) as PatternKind[];

/** A page's pattern with what is known about it (the lookup TypeScript cannot type). */
export function patternInfo(page: PageIR) {
  const info = PAGE_PATTERNS[page.pattern.kind] as unknown as PagePattern<"crud">;
  const pattern = page.pattern as PatternOf<"crud">;
  // The page's parts add to what its kind brings: their records, their forms and their texts.
  const parts = partSections(page);
  const shown = parts.flatMap((s) => (s.model ? [s.model] : []));
  return {
    models: () => [...info.models(pattern), ...shown],
    reads: () => [...(info.reads ?? info.models)(pattern), ...shown],
    manages: () => info.manages?.(pattern),
    icon: info.icon,
    inMenu: info.inMenu,
    access: info.access,
    routes: (route: string) => info.routes?.(route, pattern) ?? [],
    parts: () => ({
      ...info.parts?.(pattern),
      ...Object.fromEntries(parts.map((s) => [s.name, s.kind])),
    }),
    queries: () => info.queries?.(pattern) ?? [],
    forms: () => [
      ...(info.forms?.(pattern) ?? []),
      ...parts.flatMap((s) => (s.form ? [s.form] : [])),
    ],
    follow: (spec: YamlEditor, effect: Effect, ir: SpecIR) => {
      const own = info.follow?.(spec, page as PageIR & { pattern: PatternOf<"crud"> }, effect, ir);
      if (own && "refusal" in own) return own;
      const parts = followSections(spec, page, effect);
      if (parts && "refusal" in parts) return parts;
      if (own && parts) return { note: `${own.note}; ${parts.note}` };
      return own ?? parts;
    },
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

/**
 * A page's sections (docs/design/page-sections.md §2): a section named like its kind (hero, faq,
 * …), or any name with `records`, `text`, `calculator` or `custom`. With `own`, the page's
 * kind, that kind's name places the kind's own section and takes no value; any other page kind
 * named here is refused, since a flow is written only as a page's kind.
 */
export function readSections(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  parsed: Partial<SpecIR>,
  own?: { kind?: string; label?: string },
): PageSection[] {
  const sections: PageSection[] = [];
  // A records, text, calculator or custom section is known by its options, not its name.
  const named = SECTION_KINDS.filter(
    (k) => k !== "records" && k !== "calculator" && k !== "custom" && k !== "text",
  );
  const listed = own ? `the sections of ${where}` : `the landing of ${where}`;
  for (const { key: name, keyNode, value } of mapEntries(ctx, node, listed) ?? []) {
    const sectionWhere = `section "${name}" of ${where}`;
    const empty = value === null || (isScalarNode(value) && value.value === null);
    if (own?.kind && name === own.kind) {
      // The page's own section, placed here: a crud page's list, a dashboard's tiles.
      if (!empty)
        ctx.error(
          value,
          "invalid-value",
          `"${name}" in ${listed} places the page's own ${own.label ?? own.kind} and takes no value.`,
        );
      sections.push({ name, kind: own.kind as PageSection["kind"], own: true });
      continue;
    }
    // A page kind named as a section (crud, order, …) is a flow, written only as a page's kind;
    // calculator and custom are section kinds too, so they pass to the options below.
    // A page kind written as a section with a value ("crud: Session") is a flow: a page, never a
    // part; the same name with a part's options (records, text) is only a name.
    const partKeys = ["records", "text", "calculator", "custom", ...named];
    const makesPart =
      isMap(value) &&
      (mapEntries(ctx, value, sectionWhere) ?? []).some((e) => partKeys.includes(e.key));
    if (
      (PATTERN_KINDS as readonly string[]).includes(name) &&
      !(SECTION_KINDS as readonly string[]).includes(name) &&
      !makesPart
    ) {
      ctx.error(
        keyNode,
        "invalid-key",
        `"${name}" is a page's kind, not a section: a page has one kind, written as its own key${own?.kind ? ` (this page's is ${own.kind})` : ""}.`,
      );
      continue;
    }
    // "faq:" with nothing after it is a section with no options.
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
    const sectionFilters: {
      filters?: { name: string; at: At }[];
      at?: At;
      searchAt?: At;
      where?: ParsedNode | null;
    } = {};
    const options = checkKeys(ctx, entries, sectionWhere, {
      allowed: [
        "records",
        "view",
        "starts",
        "search",
        "filters",
        "where",
        "button",
        "secondButton",
        "shortcuts",
        "limit",
        "form",
        "calculator",
        "custom",
        "text",
        // A kind as an option gives a section of that kind any name: "visit: { contact: }".
        ...named,
      ],
      content: ["title", "subtitle", "items"],
    });
    const byOption = options.find((o) => (named as readonly string[]).includes(o.key));
    const kindOf = byOption
      ? (byOption.key as SectionKind)
      : (named as readonly string[]).includes(name)
        ? (name as SectionKind)
        : undefined;
    const allows = kindOf ? LANDING_SECTIONS[kindOf] : {};
    const section: PageSection = { name, kind: "records" };
    let view: { value: string; at: At } | undefined;
    let starts: { value: string; at: At } | undefined;
    for (const { key, value: option, keyNode: optionKey } of options) {
      if (byOption && key === byOption.key) {
        const on = isScalarNode(option) ? option.value : option;
        if (on !== null && on !== true)
          ctx.error(
            option,
            "invalid-value",
            `"${key}" in ${sectionWhere} names its kind and is written alone, with nothing after it.`,
          );
        if (options.filter((o) => (named as readonly string[]).includes(o.key)).length > 1)
          ctx.error(optionKey, "invalid-key", `${capitalize(sectionWhere)} can be of one kind.`);
        if (options.some((o) => ["records", "calculator", "custom", "text"].includes(o.key)))
          ctx.error(
            optionKey,
            "invalid-key",
            `${capitalize(sectionWhere)} is a ${key} section, so it shows no records and is not text, a calculator or custom.`,
          );
      } else if (key === "text") {
        // A text section: a heading and paragraphs, from the content file; nothing else here.
        const on = isScalarNode(option) ? option.value : option;
        if (on !== null && on !== true)
          ctx.error(
            option,
            "invalid-value",
            `"text" in ${sectionWhere} is written alone, with nothing after it.`,
          );
        section.kind = "text";
        if (options.length > 1)
          ctx.error(
            optionKey,
            "invalid-key",
            `A text section has no other options; its heading and paragraphs are in smithable.content.yml (pages.${where.replace(/^page "(.*)"$/, "$1")}.${name}).`,
          );
      } else if (key === "view") {
        const v = readString(ctx, option, `"view" in ${sectionWhere}`);
        if (v === "cards" || v === "table" || v === "calendar") view = { value: v, at: option };
        else if (v !== undefined)
          ctx.error(
            option,
            "invalid-value",
            `"view" in ${sectionWhere} is cards, table or calendar.`,
          );
      } else if (key === "starts") {
        const v = readString(ctx, option, `"starts" in ${sectionWhere}`);
        if (v !== undefined) starts = { value: v, at: option };
      } else if (key === "custom") {
        const component = readComponent(ctx, option, sectionWhere);
        if (component) {
          section.kind = "custom";
          section.component = component;
        }
      } else if (key === "calculator") {
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
      } else if (key === "search") {
        const on = readBoolean(ctx, option, `"search" in ${sectionWhere}`);
        if (on) section.search = true;
        sectionFilters.searchAt = optionKey;
      } else if (key === "filters") {
        sectionFilters.filters = readNameList(ctx, option, `"filters" in ${sectionWhere}`);
        sectionFilters.at = optionKey;
      } else if (key === "where") {
        sectionFilters.where = option;
        sectionFilters.at ??= optionKey;
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
      } else if (key === "shortcuts") {
        if (!allows.shortcuts) {
          ctx.error(optionKey, "invalid-key", "Only a hero section has shortcuts.");
          continue;
        }
        const pages = readNameList(ctx, option, `"shortcuts" in ${sectionWhere}`);
        if (pages.length > 4)
          ctx.error(option, "invalid-value", "A hero has at most four shortcuts.");
        for (const { name: page, at } of pages) ctx.reference("page", page, at);
        section.shortcuts = pages.slice(0, 4).map((p) => p.name);
      } else if (key === "secondButton") {
        const page = readString(ctx, option, `"secondButton" in ${sectionWhere}`);
        if (page !== undefined) {
          ctx.reference("page", page, option);
          section.secondButton = page;
        }
        if (!allows.secondButton)
          ctx.error(optionKey, "invalid-key", "Only a hero section has a second button.");
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
    // A search box, filters or a condition belong to a records section: the first two lead to the
    // model's list page, the condition keeps some of its records (open incidents, featured items).
    if (sectionFilters.searchAt || sectionFilters.filters || sectionFilters.where !== undefined) {
      if (!section.model) {
        ctx.error(
          sectionFilters.at ?? sectionFilters.searchAt ?? null,
          "invalid-key",
          `Only a records section has a search box, filters or "where" (${sectionWhere} shows no records).`,
        );
      } else if (sectionFilters.where !== undefined) {
        const model = parsed.models?.find((m) => m.name === section.model);
        const condition = readCondition(
          ctx,
          sectionFilters.where,
          `"where" in ${sectionWhere}`,
          model,
        );
        if (condition) section.where = condition;
      }
      if (section.model && sectionFilters.filters) {
        const checked = checkFilterFields(
          ctx,
          sectionFilters.filters,
          section.model,
          parsed,
          sectionWhere,
        );
        if (checked.length) section.filters = checked;
      }
    }
    // A view is a records section's; a calendar needs the date field the records are placed by.
    if ((view || starts) && !section.model) {
      ctx.error(
        (view ?? starts)?.at ?? null,
        "invalid-key",
        `Only a records section has a view (${sectionWhere} shows no records).`,
      );
    } else if (section.model && (view?.value === "calendar" || starts)) {
      const model = parsed.models?.find((m) => m.name === section.model);
      const dates =
        model?.fields.filter(
          (f) => f.type.kind === "scalar" && (f.type.name === "date" || f.type.name === "datetime"),
        ) ?? [];
      if (view?.value !== "calendar")
        ctx.error(
          starts?.at ?? null,
          "invalid-key",
          `"starts" in ${sectionWhere} goes with "view: calendar".`,
        );
      else if (starts && model && !dates.some((f) => f.name === starts?.value))
        ctx.error(
          starts.at,
          "unknown-field",
          `${section.model} has no date field named "${starts.value}" to place its records by.`,
          didYouMean(
            starts.value,
            dates.map((f) => f.name),
          ),
        );
      else if (starts) section.starts = starts.value;
      else if (dates.length === 1) section.starts = dates[0]?.name;
      else if (model)
        ctx.error(
          view.at,
          dates.length ? "missing-key" : "invalid-value",
          dates.length
            ? `A calendar of ${section.model} records needs "starts": which of ${dates.map((f) => f.name).join(", ")} places them.`
            : `${section.model} has no date field to place its records in a calendar by.`,
        );
    }
    if (view && section.model) section.view = view.value as PageSection["view"];
    if (section.kind === "calculator" || section.kind === "custom" || section.kind === "text") {
      sections.push(section);
      continue;
    }
    if (!section.model) {
      if (!kindOf) {
        ctx.error(
          keyNode,
          "unknown-section",
          `There is no section kind "${name}". Name a section after its kind, or give it a kind ("${name}: { faq: }"), "records: <Model>" or "text".`,
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
    // A tile's name is a name in the generated code too: camelCase, like a field's.
    if (!FIELD_NAME_PATTERN.test(name)) {
      ctx.error(
        keyNode,
        "invalid-name",
        `A tile's name starts with a lowercase letter and uses only letters and digits, like "totalFuelCost": "${name}".`,
      );
      continue;
    }
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
        const condition = readCondition(ctx, option, `"where" in ${itemWhere}`, model);
        if (condition) item.where = condition;
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

/**
 * An articles page, short (`articles: Post`) or long (`{ model, title, body, … }`). Each part
 * not named is inferred by type and name; one that cannot be, or is found twice, is an error.
 */
function readArticles(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  parsed: Partial<SpecIR>,
): PatternOf<"articles"> | undefined {
  const at = `the articles of ${where}`;
  let modelName: string | undefined;
  let modelAt: At = node;
  const given: Record<string, { value: string; at: At }> = {};
  if (isMap(node)) {
    for (const { key, value } of checkKeys(ctx, mapEntries(ctx, node, at) ?? [], at, {
      allowed: ["model", ...ARTICLE_KEYS],
    })) {
      const text = readString(ctx, value, `"${key}" in ${at}`);
      if (text === undefined) continue;
      if (key === "model") {
        modelName = text;
        modelAt = value;
      } else given[key] = { value: text, at: value };
    }
    if (modelName === undefined) {
      ctx.error(node, "missing-key", `${capitalize(at)} needs "model".`);
      return undefined;
    }
  } else modelName = readString(ctx, node, `"articles" in ${where}`);
  if (modelName === undefined) return undefined;
  ctx.reference("model", modelName, modelAt);
  const model = parsed.models?.find((m) => m.name === modelName);
  if (!model) return { kind: "articles", model: modelName, title: "", body: "" };
  const stored = model.fields.filter((f) => !f.formula);
  const kindOf = (f: FieldIR) =>
    f.type.kind === "relation" && f.type.model === USER_MODEL && !f.type.many
      ? "user"
      : f.type.kind === "scalar"
        ? f.type.name
        : f.type.kind;
  // What each part may be (docs/design/inference.md: by the fields' types, never their names).
  // Unnamed, a part is the one field of its kind not taken by another part; the title is the
  // record's title field. Named, the field must be of the kind; "none" leaves an optional part out.
  const rules: Record<
    (typeof ARTICLE_KEYS)[number],
    { kinds: string[]; infer?: string[]; words: string; unique?: boolean }
  > = {
    title: { kinds: ["string"], words: "string" },
    body: { kinds: ["markdown"], words: "markdown" },
    picture: { kinds: ["picture"], words: "picture" },
    date: { kinds: DATES, words: "date or datetime" },
    address: { kinds: ["string"], words: "unique string", unique: true },
    summary: { kinds: ["string", "text"], infer: ["text"], words: "string or text" },
    author: { kinds: ["user"], words: "User" },
  };
  const result: PatternOf<"articles"> = { kind: "articles", model: modelName, title: "", body: "" };
  // A field named for one part is no candidate for another.
  const taken = new Set(Object.values(given).map((g) => g.value));
  for (const key of ARTICLE_KEYS) {
    const rule = rules[key];
    const fits = (f: FieldIR, kinds = rule.kinds) =>
      kinds.includes(kindOf(f) ?? "") && (!rule.unique || Boolean(f.unique));
    const named = given[key];
    let found: string | undefined;
    if (named) {
      const f = model.fields.find((x) => x.name === named.value);
      const also = ARTICLE_KEYS.find((k) => k !== key && given[k]?.value === named.value);
      if (named.value === "none" && key !== "title" && key !== "body") continue;
      if (!f)
        ctx.error(
          named.at,
          "unknown-field",
          `${modelName} has no field named "${named.value}".`,
          didYouMean(
            named.value,
            model.fields.map((x) => x.name),
          ),
        );
      else if (also)
        ctx.error(
          named.at,
          "invalid-value",
          `"${named.value}" is both the ${also} and the ${key} of ${at}: a field is one part.`,
        );
      else if (!fits(f))
        ctx.error(
          named.at,
          "invalid-value",
          `"${named.value}" is the ${key} of ${at}: it must be a ${rule.words} field.`,
        );
      else found = f.name;
    } else if (key === "title") {
      const title = stored.find((f) => f.name === titleField(model));
      found = title && fits(title) && !taken.has(title.name) ? title.name : undefined;
    } else {
      const candidates = stored.filter((f) => fits(f, rule.infer) && !taken.has(f.name));
      if (candidates.length > 1)
        ctx.error(
          modelAt,
          "missing-key",
          `${modelName} has several ${rule.infer ? rule.infer.join(" or ") : rule.words} fields (${candidates.map((f) => f.name).join(", ")}): name the ${key} of ${at}, or "${key}: none".`,
          `Write "articles: { model: ${modelName}, ${key}: ${candidates[0]?.name} }".`,
        );
      else found = candidates[0]?.name;
    }
    if (found) {
      result[key] = found;
      taken.add(found);
    }
  }
  for (const key of ["title", "body"] as const)
    if (!result[key] && !given[key])
      ctx.error(
        modelAt,
        "missing-key",
        key === "body"
          ? `${modelName} has no markdown field for the body of ${at}.`
          : `${modelName} has no stored string field for the title of ${at} (its records are named by ${titleField(model)}).`,
        key === "body"
          ? `Add one, e.g. "body: markdown!", or name it with "body".`
          : `Name a string field with "title" (or "namedBy" on ${modelName}).`,
      );
  return result;
}

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

/** The fields of a model that hold a stored amount of money. */
const moneyFields = (fields: FieldIR[]) =>
  fields.filter((f) => !f.formula && f.type.kind === "scalar" && f.type.name === "money");

/**
 * An order page (docs/design/orders.md §3): `from` and `into` named, and the fields the page
 * relies on found in them: the price, the one list of lines with its reference to `from` and
 * its unit price, the number counting up; what the customer is asked, and the hours.
 */
function readOrder(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  parsed: Partial<SpecIR>,
): PatternOf<"order"> | undefined {
  const orderWhere = `the order page of ${where}`;
  if (!isMap(node)) {
    ctx.error(
      node,
      "expected-map",
      `${capitalize(orderWhere)} names what is chosen and what an order is.`,
      'Write "order: { from: Dish, into: Order }".',
    );
    return undefined;
  }
  const entries = checkKeys(ctx, mapEntries(ctx, node, orderWhere) ?? [], orderWhere, {
    allowed: ORDER_KEYS,
  });
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const named = (key: "from" | "into") => {
    const entry = byKey.get(key);
    if (!entry) {
      ctx.error(node, "missing-key", `${capitalize(orderWhere)} needs "${key}".`);
      return undefined;
    }
    const name = readString(ctx, entry.value, `"${key}" in ${orderWhere}`);
    if (name !== undefined) ctx.reference("model", name, entry.value);
    return name === undefined ? undefined : { name, at: entry.value as At };
  };
  const from = named("from");
  const into = named("into");
  if (!from || !into) return undefined;
  const models = parsed.models ?? [];
  const fromModel = models.find((m) => m.name === from.name);
  const intoModel = models.find((m) => m.name === into.name);
  if (!fromModel || !intoModel) return undefined;
  const refuse = (at: At, message: string, hint?: string) => {
    ctx.error(at, "invalid-value", message, hint);
    return undefined;
  };
  const names = (fields: FieldIR[]) => fields.map((f) => f.name).join(", ");
  // A part the page names (price, quantity, available) must be of its kind; unnamed, it is the
  // one field of the kind, and two are an error naming the key (docs/design/inference.md: by the
  // fields' types, never their names).
  const part = (
    key: "price" | "quantity" | "available",
    model: ModelIR,
    at: At,
    fits: (f: FieldIR) => boolean,
    words: string,
    required: boolean,
  ): FieldIR | undefined => {
    const entry = byKey.get(key);
    if (entry) {
      const name = readString(ctx, entry.value, `"${key}" in ${orderWhere}`);
      if (name === undefined || (name === "none" && !required)) return undefined;
      const f = model.fields.find((x) => x.name === name);
      if (!f)
        ctx.error(
          entry.value,
          "unknown-field",
          `${model.name} has no field named "${name}".`,
          didYouMean(
            name,
            model.fields.map((x) => x.name),
          ),
        );
      else if (!fits(f))
        ctx.error(
          entry.value,
          "invalid-value",
          `"${name}" is the ${key} of ${orderWhere}: it must be a ${words} field of ${model.name}.`,
        );
      return f && fits(f) ? f : undefined;
    }
    const found = model.fields.filter(fits);
    if (found.length > 1)
      ctx.error(
        at,
        "missing-key",
        `${model.name} has several ${words} fields (${names(found)}): name the ${key} of ${orderWhere}${required ? "" : `, or "${key}: none"`}.`,
        `Write "${key}: ${found[0]?.name}" under the order page.`,
      );
    else if (!found.length && required)
      ctx.error(
        at,
        "invalid-value",
        `${model.name} has no ${words} field: the order page needs its ${key}.`,
      );
    return found.length === 1 ? found[0] : undefined;
  };
  const money = moneyFields(fromModel.fields);
  const price = part("price", fromModel, from.at, (f) => money.includes(f), "money", true);
  if (!price) return undefined;
  const lists = intoModel.fields.filter((f) => f.type.kind === "relation" && f.type.many);
  const lines = lists[0];
  if (lists.length !== 1 || !lines || lines.type.kind !== "relation")
    return refuse(
      into.at,
      lists.length
        ? `${into.name} has several lists (${names(lists)}): the order page fills one list of lines.`
        : `${into.name} has no list of lines for the order page to fill.`,
      lists.length ? undefined : `Give it one, e.g. "lines: ${into.name}Line[]".`,
    );
  const lineName = lines.type.model;
  const lineModel = models.find((m) => m.name === lineName);
  if (!lineModel) return undefined;
  const items = lineModel.fields.filter(
    (f) => f.type.kind === "relation" && !f.type.many && f.type.model === from.name,
  );
  if (items.length !== 1)
    return refuse(
      into.at,
      `${lineName} needs one reference to ${from.name} for the order page (it has ${items.length}).`,
    );
  const unitPrices = moneyFields(lineModel.fields);
  if (unitPrices.length !== 1)
    return refuse(
      into.at,
      `${lineName} needs one money field for the price when ordered (it has ${unitPrices.length ? names(unitPrices) : "none"}).`,
      'For example "unitPrice: money!", and the amount as a formula: "{ type: money, formula: quantity * unitPrice }".',
    );
  const number = intoModel.fields.find((f) => f.sequence);
  if (!number)
    return refuse(
      into.at,
      `${into.name} needs a number counting up for the order page, the one customers say.`,
      'For example "number: { type: int!, sequence: true }".',
    );
  const quantity = part(
    "quantity",
    lineModel,
    into.at,
    (f) => !f.formula && f.type.kind === "scalar" && f.type.name === "int",
    "whole number",
    false,
  );

  // What the customer is asked: the order's own values, never what the app or the page fills.
  const askable = (f: FieldIR) => !f.formula && !f.byApp && f.type.kind === "scalar";
  const ask: string[] = [];
  const askEntry = byKey.get("ask");
  if (askEntry)
    for (const { name, at } of readNameList(ctx, askEntry.value, `"ask" in ${orderWhere}`)) {
      const f = intoModel.fields.find((x) => x.name === name);
      if (!f)
        ctx.error(
          at,
          "unknown-field",
          `${into.name} has no field named "${name}".`,
          didYouMean(
            name,
            intoModel.fields.map((x) => x.name),
          ),
        );
      else if (!askable(f))
        ctx.error(
          at,
          "invalid-value",
          `The customer cannot be asked for "${name}": the app, a formula or the page fills it, or it is not a value of the order's own.`,
        );
      else ask.push(name);
    }
  else ask.push(...intoModel.fields.filter((f) => askable(f) && f.required).map((f) => f.name));
  const unasked = intoModel.fields.filter(
    (f) =>
      askable(f) &&
      f.required &&
      f.default === undefined &&
      !f.defaultFormula &&
      !ask.includes(f.name),
  );
  if (unasked.length)
    ctx.error(
      askEntry?.value ?? node,
      "missing-value",
      `An order needs ${names(unasked)}, but the order page does not ask for ${unasked.length > 1 ? "them" : "it"}.`,
      `Add ${unasked.length > 1 ? "them" : "it"} to "ask".`,
    );

  let hours: PatternOf<"order">["hours"];
  const hoursEntry = byKey.get("hours");
  if (hoursEntry) {
    const what = `"hours" in ${orderWhere}`;
    const pairs: [string, string | string[]][] = [];
    const keyAt = new Map<string, At>();
    for (const { key, keyNode, value } of mapEntries(ctx, hoursEntry.value, what) ?? []) {
      keyAt.set(key, keyNode);
      if (isSeq(value))
        pairs.push([key, readNameList(ctx, value, `"${key}" in ${what}`).map((n) => n.name)]);
      else {
        const span = readString(ctx, value, `"${key}" in ${what}`);
        if (span !== undefined) pairs.push([key, span]);
      }
    }
    const read = readHours(pairs);
    for (const problem of read.problems)
      ctx.error(keyAt.get(problem.key) ?? hoursEntry.value, "invalid-value", problem.message);
    hours = read.hours;
    // Hours are the business's clock: without the app's time zone the server's would decide.
    if (!parsed.app?.timezone)
      ctx.warning(
        hoursEntry.keyNode,
        "hours-without-timezone",
        `The hours of ${orderWhere} are read in the server's time zone, since the app names none.`,
        'Give the app one, e.g. "timezone: Europe/Mariehamn" under "app".',
      );
  }
  const leadEntry = byKey.get("lead");
  const lead = leadEntry ? readNumber(ctx, leadEntry.value, `"lead" in ${orderWhere}`) : undefined;
  if (lead !== undefined && (!Number.isInteger(lead) || lead < 0))
    ctx.error(leadEntry?.value ?? node, "invalid-value", `"lead" is a whole number of minutes.`);

  const available = part(
    "available",
    fromModel,
    from.at,
    (f) => f.type.kind === "scalar" && f.type.name === "bool",
    "yes/no",
    false,
  );
  return {
    kind: "order",
    from: from.name,
    into: into.name,
    ask,
    ...(hours ? { hours } : {}),
    ...(lead !== undefined ? { lead } : {}),
    price: price.name,
    ...(available ? { available: available.name } : {}),
    lines: lines.name,
    line: lineName,
    item: (items[0] as FieldIR).name,
    unitPrice: (unitPrices[0] as FieldIR).name,
    ...(quantity ? { quantity: quantity.name } : {}),
    number: number.name,
  };
}
