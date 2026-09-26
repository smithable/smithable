/**
 * The Smithable IR: a normalized, technology-independent model of an application.
 * Defaults are applied and references resolved; declaration order is preserved.
 */
export interface SpecIR {
  specVersion: string;
  app: AppIR;
  models: ModelIR[];
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
}

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

export type FieldType = { kind: "scalar"; name: ScalarType } | { kind: "choice"; values: string[] };

export type FieldValue = string | number | boolean;

export interface FieldIR extends SemanticText {
  name: string;
  type: FieldType;
  /** A choice field with a default is always required: it can never be empty. */
  required: boolean;
  unique: boolean;
  default?: FieldValue;
  min?: number;
  max?: number;
}

export interface PageIR extends SemanticText {
  id: string;
  route: string;
  pattern: { kind: "crud"; model: string };
}

export interface MenuIR {
  name: string;
  pages: string[];
}
