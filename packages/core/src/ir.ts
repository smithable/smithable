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
  pages: PageIR[];
  navigation: MenuIR[];
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
}

export const ACCESS_OPERATIONS = ["read", "create", "write", "delete"] as const;
export type AccessOperation = (typeof ACCESS_OPERATIONS)[number];
export type ModelAccessIR = Partial<Record<AccessOperation, string[]>>;

/** The users who sign in; a field of this type refers to one of them. */
export const USER_MODEL = "User";

export const SCALAR_TYPES = [
  "string",
  "text",
  "int",
  "decimal",
  "money",
  "bool",
  "date",
  "datetime",
  "email",
  "phone",
  "url",
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
    | { kind: "dashboard"; items: DashboardItem[] };
  /** Actions offered on the page, e.g. a "Merge customers" button. */
  actions?: string[];
  /** Only these roles may open the page (admins always can). */
  access?: string[];
  /** Fields of the model a list can be searched by. */
  search?: string[];
}

export const SECTION_KINDS = [
  "hero",
  "features",
  "records",
  "pricing",
  "testimonials",
  "faq",
  "callToAction",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** A section of a landing page; its texts are in smithable.content.yml under its name. */
export interface LandingSection {
  name: string;
  kind: SectionKind;
  /** The page a hero's or call to action's button opens. */
  button?: string;
  /** A records section shows this model's records as cards. */
  model?: string;
  limit?: number;
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
  /** Only records whose fields have these values (choice values or yes/no). */
  where?: Record<string, string | boolean>;
  /** A date field: the chart has one bar per month. */
  by?: string;
  limit?: number;
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

/** The model a crud page manages; landing pages and dashboards have none. */
export function pageModel(page: PageIR): string | undefined {
  return page.pattern.kind === "crud" ? page.pattern.model : undefined;
}

/** Every model a page shows: a crud page's, a landing page's records, a dashboard's tiles. */
export function pageModels(page: PageIR): string[] {
  const { pattern } = page;
  const models =
    pattern.kind === "crud"
      ? [pattern.model]
      : pattern.kind === "landing"
        ? pattern.sections.flatMap((s) => (s.model ? [s.model] : []))
        : pattern.items.map((i) => i.model);
  return [...new Set(models)];
}
