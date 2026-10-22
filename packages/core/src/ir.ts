import type { Expr } from "./formula.js";
import type { Hours } from "./hours.js";

/**
 * The Smithable IR: a normalized, technology-independent model of an application.
 * Defaults are applied and references resolved; declaration order is preserved.
 */
export interface SpecIR {
  specVersion: string;
  app: AppIR;
  models: ModelIR[];
  actions: ActionIR[];
  /** Mails and calls the app makes when something happens to a record (integrations.md §4). */
  outgoing: OutgoingIR[];
  /** Addresses other services call, each making a record or handing the call to code (integrations.md §3). */
  incoming: IncomingIR[];
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

/** Where a unique value is unique: among one owner's records, or in the whole app. */
export type UniqueScope = "owner" | "app";

/** Fields unique together (`unique: [[customer, number]]`, docs/design/uniqueness.md). */
export interface UniqueIR {
  fields: string[];
  /** `true` as a field's `unique: true`: per owner or app-wide as the access says. */
  scope: true | UniqueScope;
}

/**
 * What a model's records are when shown as a conversation (docs/design/conversation.md §2):
 * which field is the message's body, who wrote it, and which side is ours. Each part optional;
 * what is left out is read from the fields' types and order (core's threadBindings).
 */
export interface ThreadIR {
  body?: string;
  author?: string;
  side?: { field: string; ours: string };
}

export interface ModelIR extends SemanticText {
  name: string;
  fields: FieldIR[];
  /** Fields that are unique together, each list two or more of them. */
  unique?: UniqueIR[];
  /** The model's records as messages of a conversation, where the inference should not guess. */
  thread?: ThreadIR;
  /** A `User` field that owns the record instead of the automatic owner. */
  ownedBy?: string;
  /**
   * The field that names a record (`namedBy: company`): its title wherever one record is shown or
   * referred to. Left out, the rule picks it from the fields' types and order (core's titleField).
   */
  namedBy?: string;
  /** At most `max` records per record `per` refers to (a booking's places in a session). */
  capacity?: CapacityIR;
  /** Its records are people (or rooms, chairs) whose time is booked (docs/design/appointments.md). */
  schedule?: ScheduleIR;
  /** Each record takes a scheduled record's time (an appointment its barber's). */
  occupies?: OccupiesIR;
  /**
   * Deleted records go to a trash for thirty days, where whoever may delete them can restore
   * them; the app's readers skip them (docs/design/trash.md).
   */
  trash?: boolean;
  /**
   * The picture and file fields whose uploads wait for a reviewer before others see them
   * (docs/design/file-review.md), `all` already read as every such field. A required one holds
   * the record; an optional one only the file.
   */
  review?: string[];
}

export interface CapacityIR {
  /** A required reference of the model. */
  per: string;
  /** A whole number, or a whole-number field of the referenced record ("session.capacity"). */
  max: number | string;
  /** Only records with these choice or yes/no values count. */
  where?: Condition;
  /** Until when a record may be added (docs/design/booking.md §6): a date-time of the referenced record, with a notice period before it. */
  closes?: DeadlineIR;
  /** Until when a record's owner may delete it; roles that delete everyone's pass. */
  cancelUntil?: DeadlineIR;
}

/** A deadline: a date-time field of the referenced record ("session.startsAt"), as it is or a period before it. */
export interface DeadlineIR {
  field: string;
  before?: { amount: number; unit: "minutes" | "hours" | "days" };
}

export interface ScheduleIR {
  /** The weekly hours, in the app's time zone; a day not named is closed. */
  hours: Hours;
  /** Spans kept free every open day. */
  breaks: [number, number][];
  /** Minutes kept free after each booking. */
  gap: number;
  /** A model whose records block time: a reference to this model and a start and an end. */
  away?: { model: string; resource: string; from: string; until: string };
}

export interface OccupiesIR {
  /** A required reference to a model with a schedule. */
  resource: string;
  /** A date-and-time field. */
  starts: string;
  /** Minutes: a whole-number field, or one of a referenced record ("service.minutes"). */
  duration: string;
  /** Only records with these choice or yes/no values take the time. */
  while?: Condition;
  /** How long before the start the record's owner may cancel it, written "12h" (30m, 2d). */
  cancelUntil?: string;
  /** The owner's Cancel: the choice field it sets and the value, outside `while`. */
  cancel?: { field: string; to: string };
}

export const ACCESS_OPERATIONS = ["read", "create", "write", "delete"] as const;
export type AccessOperation = (typeof ACCESS_OPERATIONS)[number];

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
  "file",
  "files",
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
  /**
   * No two records hold the same value: `true` among an owner's records when the model's records
   * are read by their owners only, else in the whole app (access.ts uniquePerOwner); `owner` or
   * `app` says which outright, so a change of roles never moves the index (docs/design/uniqueness.md).
   */
  unique: boolean | UniqueScope;
  default?: FieldValue;
  min?: number;
  max?: number;
  /** A computed field: its value comes from this formula and is not stored. */
  formula?: Expr;
  /** A default computed when a record is created, e.g. TODAY(). */
  defaultFormula?: Expr;
  /** A reference to User whose default is who makes the record (`default: ME()`). */
  defaultMe?: true;
  examples?: FieldExample[];
  /**
   * `by: app`: the form never shows it; its value comes from its default, an action, an
   * incoming entry, an import or custom code (record-rules.md §1).
   */
  byApp?: true;
  /**
   * `sequence: true` on an `int!`: the app gives each new record the next number from the
   * field's counter, never one given before (an order's, an invoice's); never entered, so it is
   * also `byApp`, and unique (orders.md §4).
   */
  sequence?: true;
  /**
   * `locked`: read-only while the record fits the condition (as it is before the change), and
   * after it is made for `true`; an action's `set` may still change it (record-rules.md §2).
   */
  locked?: true | Condition;
  /** `required: <condition>`: must have a value while the record fits it (record-rules.md §3). */
  requiredWhen?: Condition;
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
    /**
     * What waits for review, to approve or reject (docs/design/file-review.md): `review: all`
     * (every model with `review`) or a list of them. For admins and the roles granted review.
     */
    | { kind: "review"; models: string[]; all: boolean }
    /** Inputs and results computed as you type, stored nowhere (docs/design/calculator.md). */
    | { kind: "calculator"; calculator: CalculatorIR }
    /** A page of your own: the component in src/custom/pages/, in a route Smithable owns. */
    | { kind: "custom"; component: string }
    /**
     * A privacy page written from the app itself (docs/design/legal-page.md): who runs it, what it
     * stores and why, cookies, mail, logs, rights; the operator's details are texts.
     */
    | { kind: "legal"; legal: "privacy" }
    /**
     * Visitors compose an order (docs/design/orders.md §3): records of `from` chosen with
     * quantities make one `into` record and its lines in one write, the prices read on the
     * server. The keys after `lead` are what validation found in the models, for the generator.
     */
    | {
        kind: "order";
        from: string;
        into: string;
        /** into's fields the customer fills, in this order. */
        ask: string[];
        /** When orders are taken; without hours, always. */
        hours?: Hours;
        /** Minutes from now to the earliest time a customer may want the order. */
        lead?: number;
        /** from's price (its one money field) and, if it has one, its yes/no field `available`. */
        price: string;
        available?: string;
        /** into's list of lines, the lines' model, its reference to from and its unit price. */
        lines: string;
        line: string;
        item: string;
        unitPrice: string;
        /** The line's whole-number field for how many, if it has one. */
        quantity?: string;
        /** into's `sequence: true` field: the order's number. */
        number: string;
      }
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
        /** The field that refers to the user who wrote it, shown with the article. */
        author?: string;
      };
  /** Actions offered on the page, e.g. a "Merge customers" button. */
  actions?: string[];
  /** Fields of the model a list can be searched by. */
  search?: string[];
  /** Fields of the model the list can be filtered by: choices and references as chips, numbers and dates as a range, yes/no as a toggle. */
  filters?: string[];
  /**
   * Filter values applied when the address says nothing, by filter, as the address writes them
   * (`{ startsAt: "upcoming", status: "open,pending" }`); "all" in the address clears one.
   */
  defaultFilter?: Record<string, string>;
  /** Fields of the model the list can be sorted by, either way, from a "Sort by" control. */
  sortable?: string[];
  /** A heart on each record and a "Saved" view of the list ("all"), or a list of only the viewer's saved records ("only"). */
  favorites?: "all" | "only";
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
  /** A records section shows only the records these values fit (e.g. open incidents). */
  where?: Condition;
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
  where?: Condition;
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

/**
 * An action beyond create, edit and delete: custom code with its input and output, or a
 * standard action that sets fields of one record (docs/design/actions.md).
 */
export type ActionIR = CustomActionIR | StandardActionIR;

interface ActionBase extends SemanticText {
  name: string;
}

export interface CustomActionIR extends ActionBase {
  custom: true;
  input: FieldIR[];
  output?: FieldIR[];
}

/** Changes one record of `on`, offered and allowed only when `when` fits it. */
export interface StandardActionIR extends ActionBase {
  custom: false;
  /** Standard actions ask for nothing (yet): no input, no output. */
  input: [];
  output?: undefined;
  on: string;
  when?: Condition;
  /** The new values, in the order written: a literal, a formula on the record as it was, or asked for. */
  set: ActionValueIR[];
  /**
   * Fields the change makes required (record-rules.md §3), asked in its dialog with the record's
   * value filled in.
   */
  asksRequired?: string[];
  /** Related records created with the change, one per model (docs/design/actions.md §7). */
  add?: ActionAddIR[];
  /**
   * A copy instead of a change (§8): a new record of `on` from this one, with these values
   * different; `set` and `add` are then empty.
   */
  copy?: ActionValueIR[];
  /** Lists of the model whose records the copy takes along (§8). */
  with?: string[];
}

export type ActionValueIR =
  | { field: string; value: FieldValue }
  | { field: string; formula: Expr; text: string }
  /** The person is asked for it when they press the button (§6). */
  | { field: string; asked: true }
  /** The person who pressed the button, for a field that refers to User (§10). */
  | { field: string; me: true };

/** A record of `model` created by a standard action, its `reference` filled with the action's record. */
export interface ActionAddIR {
  model: string;
  reference: string;
  values: ActionValueIR[];
}

/**
 * Something happens to a record and the app tells someone: a mail, or (later) a signed call to a
 * named target whose address is a setting. docs/design/integrations.md §4.
 */
export interface IncomingIR {
  name: string;
  /** One record of this model per call, with `set`'s values; absent when `custom`. */
  create?: string;
  set: IncomingValueIR[];
  /** The call is handed to src/custom/incoming/<name>.ts after it is verified. */
  custom: boolean;
  /** "sha256": a signature of the body made with the secret; else the secret itself is sent. */
  signed?: "sha256";
  /** The header the secret or the signature comes in. */
  header?: string;
  /** A template of the call's own id ("{event.id}"): a call seen in the last day is not acted on again. */
  id?: string;
  /** The role the call acts as (its record goes through that role's create rule). */
  as: string;
  /**
   * A mail that becomes a record (backlog Fable 29): the call's body is the fixed mail payload,
   * and these name the fields its sender, subject, text and attachments go to.
   */
  mail?: IncomingMailIR;
  /**
   * A mail of the thread of a record this entry made (docs/design/mail-threads.md §2): one
   * record of `create`, referring to that record by `ref`, instead of a new one. `then` sets
   * fields of the record it joins (the spec's `then`: a reply reopens a closed request).
   */
  reply?: {
    create: string;
    ref: string;
    mail: IncomingMailIR;
    set: IncomingValueIR[];
    update: IncomingValueIR[];
  };
}

/** Which field each part of a mail goes to. */
export type IncomingMailIR = {
  from?: string;
  subject?: string;
  body?: string;
  attachments?: string;
};

/** A value an incoming call sets: a literal, a formula, or a text with {path} placeholders from its JSON. */
export type IncomingValueIR =
  | { field: string; value: FieldValue }
  | { field: string; formula: Expr; text: string }
  | { field: string; template: string };

export interface OutgoingIR {
  name: string;
  /** A record of `model` created, changed or deleted; or the standard action `action` (on `model`) ran. */
  when:
    | { model: string; event: "created" | "changed" | "deleted" }
    | { model: string; action: string };
  /**
   * Only for records that fit: a creation or deletion when the record fits, a change when the
   * record fits after it and did not before.
   */
  where?: Condition;
  /** "mail", or the name of a target (camelCase) whose address and secret are settings. */
  to: string;
  /** For mail: who gets it. */
  recipient?: RecipientIR;
}

export type RecipientIR =
  /** The record's owner. */
  | { kind: "owner" }
  /** Every user with the role. */
  | { kind: "role"; role: string }
  /**
   * An address on the record: an `email` field or a field that refers to User, on the record
   * itself (one name) or one reference away (two: `customer.email`).
   */
  | { kind: "field"; path: string[]; via: "email" | "user" };

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
/**
 * Field values a record must have: a choice field's value (or a list of them), or a yes/no
 * field's true or false.
 */
export type Condition = Record<string, string | boolean | string[]>;

export function conditionFits(
  model: ModelIR,
  field: string,
  wanted: Condition[string],
  /**
   * Whether a computed field may be named: read on the record as it is loaded (an action's
   * `when`, a field's `locked` and `required`), never in a query (record-rules.md §5).
   */
  computed = false,
): boolean {
  const f = model.fields.find((x) => x.name === field);
  if (!f) return false;
  // A computed field as its kind says: yes/no takes true or false, a text a value or a list of
  // them; a number or a date is never a condition (a computed field compares it instead).
  if (f.formula) {
    if (!computed || f.type.kind !== "scalar") return false;
    if (f.type.name === "bool") return typeof wanted === "boolean";
    if (f.type.name === "string" || f.type.name === "text")
      return Array.isArray(wanted)
        ? wanted.length > 0 && wanted.every((v) => typeof v === "string")
        : typeof wanted === "string";
    return false;
  }
  if (f.type.kind === "choice") {
    const values = Array.isArray(wanted) ? wanted : [wanted];
    return (
      values.length > 0 &&
      new Set(values).size === values.length &&
      values.every(
        (v) => typeof v === "string" && (f.type as { values: string[] }).values.includes(v),
      )
    );
  }
  return f.type.kind === "scalar" && f.type.name === "bool" && typeof wanted === "boolean";
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

/** A field that stores one document (a file with its name, kind and size). */
export const isFile = (f: FieldIR): boolean => f.type.kind === "scalar" && f.type.name === "file";

/** A field that stores several documents (up to FILES_MAX). */
export const isFiles = (f: FieldIR): boolean => f.type.kind === "scalar" && f.type.name === "files";

/** A field that stores one document or several. */
export const storesFiles = (f: FieldIR): boolean => isFile(f) || isFiles(f);

/** How many documents a `files` field holds at most. */
export const FILES_MAX = 10;

/** A field whose value is an uploaded file: a picture or a document, one or several. */
export const isUpload = (f: FieldIR): boolean => storesPictures(f) || storesFiles(f);
