// Smithable app kit: describes models to the generic table and form components.
// Each model's description is in src/generated/<model>.ts.

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
  | "choice"
  | "relation"
  /** A reference to a user who signs in. */
  | "user";

export interface FieldUi {
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** Computed by a formula: shown, never entered. */
  computed?: boolean;
  help?: string;
  choices?: { value: string; label: string }[];
  /** For a reference: the related record's key in a row, and the field that names it. */
  relation?: { key: string; titleField: string };
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
  /** Adds the computed fields to a record. */
  compute?: (row: Record<string, unknown>) => Record<string, unknown>;
  /** Values suggested for a new record, computed from the values entered so far. */
  defaults?: Record<string, (row: Record<string, unknown>) => unknown>;
}

export interface AppUi {
  name: string;
  currency: string;
  timeZone?: string;
}

export type Row = { id: number } & Record<string, unknown>;

/** Choices for a reference field, keyed by the field's name, e.g. { customerId: [...] }. */
export type Options = Record<string, { value: number | string; label: string }[]>;
