import type { Expr } from "./formula.js";

/**
 * The Smithable IR: a normalized, technology-independent model of an application.
 * Defaults are applied and references resolved; declaration order is preserved.
 */
export interface SpecIR {
  specVersion: string;
  app: AppIR;
  models: ModelIR[];
  actions: ActionIR[];
  queries: QueryIR[];
  pages: PageIR[];
  navigation: MenuIR[];
  /** The values of plugin sections, by key (ARCHITECTURE §5.1). */
  extensions?: Record<string, unknown>;
}

/** Semantic free text: meaning for AI and developers, never shown to visitors. */
export interface SemanticText {
  description?: string;
  intent?: string;
  rules?: Rule[];
}

export interface Rule {
  /** Stable ID, assigned once something implements the rule. */
  id?: string;
  text: string;
}

export interface AppIR extends SemanticText {
  name: string;
  /** ISO 4217 code, e.g. "EUR". */
  currency?: string;
  /** IANA time zone, e.g. "Europe/Mariehamn". */
  timezone?: string;
}

export interface ModelIR extends SemanticText {
  name: string;
  fields: FieldIR[];
  /** A `User` field that owns the record instead of the automatic owner. */
  ownedBy?: string;
  /** Exceptions to the default access in smithable.auth.yml: roles, or "owner". */
  access?: ModelAccessIR;
  /** At most `max` records per record `per` refers to (a booking's places in a session). */
  capacity?: CapacityIR;
}

export interface CapacityIR {
  /** A required reference of the model. */
  per: string;
  /** A whole number, or a whole-number field of the referenced record ("session.capacity"). */
  max: number | string;
  /** Only records with these choice or yes/no values count. */
  where?: Record<string, string | boolean>;
}

export const ACCESS_OPERATIONS = ["read", "create", "write", "delete"] as const;
export type AccessOperation = (typeof ACCESS_OPERATIONS)[number];
export type ModelAccessIR = Partial<Record<AccessOperation, string[]>>;

/** The users who sign in; a field of this type refers to one of them. */
export const USER_MODEL = "User";

export const SCALAR_TYPES = [
  "string",
  "text",
  "markdown",
  "int",
  "decimal",
  "money",
  "bool",
  "date",
  "datetime",
  "email",
  "phone",
  "url",
  "picture",
  "pictures",
] as const;

export type ScalarType = (typeof SCALAR_TYPES)[number];

export type FieldType =
  | { kind: "scalar"; name: ScalarType }
  | { kind: "choice"; values: string[] }
  /**
   * A relation to another model. `many: false` stores a reference (a foreign key column);
   * `many: true` lists the records of `model` that refer back to this one, and stores nothing.
   */
  | { kind: "relation"; model: string; many: boolean };

export type FieldValue = string | number | boolean;

/** An example of a computed field: stored-field values in, the expected value out. */
export interface FieldExample {
  input: Record<string, FieldValue | null>;
  expected: FieldValue | null;
}

/**
 * How a field is stored: a plain column, a reference column (`customer` → `customerId`),
 * or not at all (a list of records that refer back).
 */
export type Storage = "value" | "reference" | "none";

export function storageOf(field: Pick<FieldIR, "type" | "formula">): Storage {
  if (field.formula) return "none";
  if (field.type.kind !== "relation") return "value";
  return field.type.many ? "none" : "reference";
}

/** A comparable name for a field's type, ignoring "!", "unique" and defaults. */
export function typeKey(type: FieldType): string {
  if (type.kind === "scalar") return type.name;
  if (type.kind === "choice") return "choice";
  return `${type.model}${type.many ? "[]" : ""}`;
}

export interface FieldIR extends SemanticText {
  name: string;
  type: FieldType;
  /** A choice field with a default is always required: it can never be empty. */
  required: boolean;
  unique: boolean;
  default?: FieldValue;
  min?: number;
  max?: number;
  /** A computed field: its value comes from this formula and is not stored. */
  formula?: Expr;
  /** A default computed when a record is created, e.g. TODAY(). */
  defaultFormula?: Expr;
  examples?: FieldExample[];
}

export interface PageIR extends SemanticText {
  id: string;
  route: string;
  pattern:
    | { kind: "crud"; model: string }
    | { kind: "landing"; sections: LandingSection[] }
    | { kind: "dashboard"; items: DashboardItem[] }
    | { kind: "settings"; model: string }
    | { kind: "onboarding"; model: string; steps: OnboardingStep[] }
    | { kind: "users"; mode: "manage" }
    /**
     * A model's records by date: `starts` places them; `ends` (a field) or `duration` (minutes, a
     * field or "reference.field") sizes them; `title` (a field or a reference) names the blocks.
     */
    | {
        kind: "calendar";
        model: string;
        starts: string;
        ends?: string;
        duration?: string;
        title?: string;
      }
    /** An admin view of models: `data: all` (every model, in spec order) or a list of them. */
    | { kind: "data"; models: string[]; all: boolean }
    /** Inputs and results computed as you type, stored nowhere (docs/design/calculator.md). */
    | { kind: "calculator"; calculator: CalculatorIR }
    /** A page of your own: the component in src/custom/pages/, in a route Smithable owns. */
    | { kind: "custom"; component: string }
    /**
     * A model's records as articles (a blog, news): `title` and `body` (a markdown field) always;
     * a `picture`, a `date`, an `address` (a unique string for the article's address) and a
     * `summary` when the model has them.
     */
    | {
        kind: "articles";
        model: string;
        title: string;
        body: string;
        picture?: string;
        date?: string;
        address?: string;
        summary?: string;
      };
  /** Actions offered on the page, e.g. a "Merge customers" button. */
  actions?: string[];
  /** Only these roles may open the page (admins always can). */
  access?: string[];
  /** Fields of the model a list can be searched by. */
  search?: string[];
  /** Fields of the model the list can be filtered by: choices and references as chips, numbers and dates as a range, yes/no as a toggle. */
  filters?: string[];
  /** Fields of the model the list can be sorted by, either way, from a "Sort by" control. */
  sortable?: string[];
  /** A heart on each record and a "Saved" view of the list ("all"), or a list of only the viewer's saved records ("only"). */
  favourites?: "all" | "only";
  /** The page lists only the viewer's own records (my items, my orders); it needs sign-in. */
  mine?: true;
  /** A "contact" block on the record page that mails the record's owner, or the user a field of the model names; `keep` names a model a copy of each message is stored in. */
  contact?: { to: string; keep?: string };
}

/**
 * A calculator: fields written as a model's, the entered ones its inputs and the formula
 * fields its results; examples check several results at once.
 */
export interface CalculatorIR {
  fields: FieldIR[];
  examples: CalculatorExample[];
}

export interface CalculatorExample {
  input: Record<string, FieldValue>;
  expected: Record<string, FieldValue>;
}

/** One step of an onboarding: some fields of the record it fills in. */
export interface OnboardingStep {
  name: string;
  fields: string[];
}

export const SECTION_KINDS = [
  "hero",
  "features",
  "records",
  "pricing",
  "testimonials",
  "faq",
  "callToAction",
  "contact",
  "gallery",
  "footer",
  "calculator",
  "custom",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** A section of a landing page; its texts are in smithable.content.yml under its name. */
export interface LandingSection {
  name: string;
  kind: SectionKind;
  /** The page a hero's or call to action's button opens. */
  button?: string;
  /** A hero's shortcuts: up to four pages, shown as round icons over its lower edge. */
  shortcuts?: string[];
  /** A records section shows this model's records as cards. */
  model?: string;
  /** A records section with a search box, leading to the model's list page with the text. */
  search?: boolean;
  /** A records section's filters, leading to the model's list page with them set. */
  filters?: string[];
  /** A contact section's form: visitors add a record of this model (e.g. Message). */
  form?: string;
  limit?: number;
  /** A calculator section's inputs and results. */
  calculator?: CalculatorIR;
  /** A section of your own: the component in src/custom/sections/ (calculator.md §4). */
  component?: string;
}

/**
 * One tile of a dashboard, over the records the viewer may read: a number (count, sum or
 * average), the same by month when `by` names a date field, or the latest records.
 */
export interface DashboardItem {
  name: string;
  kind: "stat" | "chart" | "list";
  model: string;
  measure?: "count" | "sum" | "average";
  /** The number field summed or averaged. */
  field?: string;
  /** A custom query whose records a list shows, instead of the latest ones. */
  query?: string;
  /** Only records whose fields have these values (choice values or yes/no). */
  where?: Record<string, string | boolean>;
  /** A date field: the chart has one bar per month. */
  by?: string;
  limit?: number;
}

/**
 * A custom query: records of a model chosen or ordered by code in src/custom/queries/, e.g.
 * the customers most likely to churn. The code starts from the records the viewer may read.
 */
export interface QueryIR extends SemanticText {
  name: string;
  custom: true;
  /** The model whose records the query returns. */
  returns: string;
}

/** An action beyond create, edit and delete; in spec version 0.1 always custom code. */
export interface ActionIR extends SemanticText {
  name: string;
  custom: true;
  input: FieldIR[];
  output?: FieldIR[];
  /** Only these roles may run the action (admins always can). */
  allow?: string[];
}

export interface MenuIR {
  name: string;
  pages: string[];
}

export type PatternKind = PageIR["pattern"]["kind"];
export type PatternOf<K extends PatternKind> = Extract<PageIR["pattern"], { kind: K }>;

/**
 * Whether a record condition can be checked on the model: `field` is a choice field of it
 * with `wanted` one of its values, or a yes/no field with true or false.
 */
export function conditionFits(model: ModelIR, field: string, wanted: string | boolean): boolean {
  const f = model.fields.find((x) => x.name === field);
  return Boolean(
    f &&
      ((f.type.kind === "choice" && typeof wanted === "string" && f.type.values.includes(wanted)) ||
        (f.type.kind === "scalar" && f.type.name === "bool" && typeof wanted === "boolean")),
  );
}

/** A field that stores a picture (a file with its description and size). */
export const isPicture = (f: FieldIR): boolean =>
  f.type.kind === "scalar" && f.type.name === "picture";

/** A field that stores several pictures (up to PICTURES_MAX; the first is the cover). */
export const isPictures = (f: FieldIR): boolean =>
  f.type.kind === "scalar" && f.type.name === "pictures";

/** A field that stores one picture or several. */
export const storesPictures = (f: FieldIR): boolean => isPicture(f) || isPictures(f);

/** How many pictures a `pictures` field holds at most. */
export const PICTURES_MAX = 10;
