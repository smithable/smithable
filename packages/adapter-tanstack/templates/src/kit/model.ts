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
  /** A stored picture with its description: { file, alt, width, height }. */
  | "picture"
  /** Several stored pictures, the first the cover: a list of { file, alt, width, height }. */
  | "pictures"
  /** A stored document: { file, name, type, size }. */
  | "file"
  /** Several stored documents, in order: a list of { file, name, type, size }. */
  | "files"
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
  /** A choice's tone colors its badge by meaning; without one it is neutral. */
  choices?: { value: string; label: string; tone?: "success" | "warning" | "danger" }[];
  /** For a reference: the related record's key in a row, and the field that names it. */
  relation?: { key: string; titleField: string };
  default?: string | number | boolean;
  /** Bounds for numbers (a slider or stepper needs them). */
  min?: number;
  max?: number;
  /** How the field is entered, when the ux file chose one (docs/design/look.md §1.1). */
  control?: "slider" | "stepper" | "radio" | "select" | "combobox" | "textarea" | "switch";
  /** Filled by the app (its default, an action, code): the form never shows it (record-rules.md §1). */
  byApp?: boolean;
  /** Read-only once the record is made (true), or while it fits the condition (record-rules.md §2). */
  locked?: true | Condition;
  /** Required while the record fits the condition (record-rules.md §3). */
  requiredWhen?: Condition;
  /** The field's own input control, when a plain one does not do (a Markdown editor). */
  input?: (props: FieldControlProps) => React.ReactNode;
  /** How someone who may only read sees its text, when plain text does not do (Markdown). */
  view?: (props: { text: string }) => React.ReactNode;
}

/** A condition on a record, as an action's `when` writes it: a choice's value or values, a yes/no. */
export type Condition = Record<string, string | boolean | string[]>;

/** Whether a record (or the values entered for one) fits a condition. */
export function fits(condition: Condition, row: Record<string, unknown>): boolean {
  return Object.entries(condition).every(([key, wanted]) =>
    typeof wanted === "boolean"
      ? Boolean(row[key]) === wanted
      : (Array.isArray(wanted) ? wanted : [wanted]).includes(String(row[key] ?? "")),
  );
}

/** What a field's own input control gets from the form. */
export interface FieldControlProps {
  id: string;
  name: string;
  value: string;
  /** The record being edited, when it exists. */
  record?: number;
  onChange: (value: string) => void;
  /** The form's other inputs, by field name, for a control that depends on them (a time picker). */
  values?: Record<string, string | boolean>;
  /** Sets another field of the form. */
  set?: (name: string, value: string) => void;
  /** The app's time zone, for a control that shows times. */
  timeZone?: string;
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
  /** The long text a card shows under the record's name, e.g. its description. */
  descriptionField?: string;
  /** Fields shown as table columns, in order. */
  columns: string[];
  fields: FieldUi[];
  /** The form's groups with headings; fields in none follow (docs/design/look.md §1.2). */
  sections?: { name: string; title: string; fields: string[] }[];
  /** Short fields two abreast on wide screens. */
  formColumns?: 1 | 2;
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
/** Each field's choices; null for a field not the viewer's to fill (an owner they cannot choose). */
export type Options = Record<string, { value: number | string; label: string }[] | null>;

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

/** Rows ordered by a field (empty values last), descending when asked; a new list, the given one untouched. */
export function sortRows<R extends Record<string, unknown>>(
  rows: R[],
  field: string,
  descending = false,
): R[] {
  const value = (row: R) => {
    const v = row[field];
    if (v instanceof Date) return v.getTime();
    if (v && typeof v === "object") return String((v as { name?: unknown }).name ?? "");
    return v;
  };
  const compare = (a: unknown, b: unknown) => {
    if (a == null || a === "") return b == null || b === "" ? 0 : 1;
    if (b == null || b === "") return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  };
  return [...rows].sort((a, b) => {
    const order = compare(value(a), value(b));
    return descending && order !== 0 && value(a) != null && value(b) != null ? -order : order;
  });
}
