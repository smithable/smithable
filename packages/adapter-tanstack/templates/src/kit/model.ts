// Smithable app kit: describes models to the generic table and form components.
// Each model's description is generated into src/generated/<model>.ts from smithable.yml.

export type FieldKind =
  | "string"
  | "text"
  | "int"
  | "decimal"
  | "money"
  | "bool"
  | "date"
  | "datetime"
  | "email"
  | "phone"
  | "url"
  | "choice";

export interface FieldUi {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  help?: string;
  choices?: { value: string; label: string }[];
  default?: string | number | boolean;
}

export interface ModelUi {
  label: string;
  pluralLabel: string;
  /** The field that names a record, e.g. "name". */
  titleField: string;
  /** Fields shown as table columns, in order. */
  columns: string[];
  fields: FieldUi[];
}

export interface AppUi {
  name: string;
  currency: string;
  timeZone?: string;
}

export type Row = { id: number } & Record<string, unknown>;
