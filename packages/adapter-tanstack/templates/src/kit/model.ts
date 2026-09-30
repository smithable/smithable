// Smithable app kit: describes models to the generic table and form components.
// Each model's description is in src/generated/<model>.ts.

export type FieldKind =
  | "string"
  | "text"
  /** Long text with formatting (headings, lists, links), written as Markdown. */
  | "markdown"
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
  /** A choice's tone colours its badge by meaning; without one it is neutral. */
  choices?: { value: string; label: string; tone?: "success" | "warning" | "danger" }[];
  /** For a reference: the related record's key in a row, and the field that names it. */
  relation?: { key: string; titleField: string };
  default?: string | number | boolean;
  /** The field's own input control, when a plain one does not do (a Markdown editor). */
  input?: (props: FieldControlProps) => React.ReactNode;
}

/** What a field's own input control gets from the form. */
export interface FieldControlProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export interface ModelUi {
  /** The model's name in the spec, e.g. "Customer"; none for an action's form. */
  model?: string;
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

/** A stored field: also how to read it from a record, typed where its model is generated. */
export interface RecordFieldUi<R> extends FieldUi {
  /** Its value in a record; for a reference, the related record's title. */
  get: (row: R) => unknown;
}

/** A stored model's description (src/generated/<model>.ts): its fields read records of type R. */
export interface RecordUi<R> extends ModelUi {
  model: string;
  fields: RecordFieldUi<R>[];
}

export interface AppUi {
  name: string;
  currency: string;
  timeZone?: string;
}

export type Row = { id: number } & Record<string, unknown>;

/** Choices for a reference field, keyed by the field's name, e.g. { customerId: [...] }. */
export type Options = Record<string, { value: number | string; label: string }[]>;

/**
 * Marks a visible text with where its wording is kept, e.g. "pages.customers.title", so the
 * preview editor can change it in place. Only in development.
 */
export function textMarker(path: string) {
  return import.meta.env.DEV ? { "data-sm-text": path } : {};
}

/**
 * Marks an element with the part of the app description it shows, for the preview editor
 * (select a field, drag a column). Only in development: production builds leave it out.
 */
export function editorMarker(
  ui: ModelUi,
  field?: FieldUi,
  part?: "field" | "column",
  page?: string,
) {
  if (!import.meta.env.DEV || !ui.model) return {};
  const name = field ? (field.relation?.key ?? field.name) : undefined;
  return {
    "data-sm-concept": name ? `field:${ui.model}.${name}` : `model:${ui.model}`,
    ...(part ? { "data-sm-part": part } : {}),
    ...(page ? { "data-sm-page": page } : {}),
  };
}
