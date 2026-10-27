// What an app offers an AI assistant (docs/design/assistant.md §3): a few tools, the same for
// every app, and a short summary of the app in place of a schema per model and verb. Pure and
// framework-neutral, like apiOffers: the adapter generates what runs the tools.
import { type Allowed, actionAccess, modelAccess } from "./access.js";
import { type AuthIR, apiOffers } from "./auth.js";
import { conditionText } from "./condition.js";
import { type ContentIR, emptyContent } from "./content.js";
import { type FieldIR, type ModelIR, type SpecIR, storageOf, USER_MODEL } from "./ir.js";
import { humanize, plural } from "./naming.js";
import { titleField } from "./samples.js";
import type { JsonSchema } from "./section.js";

/** Who asks: someone (or a key) with a role, or a visitor without a key. */
export type AssistantCaller = { role: string } | "visitor";

/** How a field can be matched in `where`. Long texts and pictures are found by `search` only. */
export type FieldFilter =
  /** One of a choice field's values, or a list of them; `labels` are the words people see. */
  | { field: string; by: "value"; values: string[]; labels?: Record<string, string> }
  | { field: string; by: "yesNo" }
  /** A number or date: the value itself, or `{ from, to }`. */
  | { field: string; by: "number" | "date" }
  /** A short text (a name, an order number, an email address), matched exactly. */
  | { field: string; by: "text" }
  /** A reference: the referred record's id or its title; for a user also "me". */
  | { field: string; by: "reference"; model: string };

/** One kind of record as an assistant may use it. */
export interface AssistantKind {
  model: string;
  label: string;
  pluralLabel: string;
  /** The field a record is known by. */
  title: string;
  may: { read: boolean; add: boolean; change: boolean; delete: boolean };
  /** The stored fields with the labels people see, for reading a question by its words. */
  fields: { name: string; label: string }[];
  filters: FieldFilter[];
  /** Stored number fields: what `measure` can add up or average. */
  numbers: string[];
  /** Fields `measure` can split by: choices, yes/no, references, and dates (by month). */
  by: string[];
  /** What `describe` answers: the fields' meanings, the rules, the actions. */
  description: string;
}

export interface AssistantTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** The Model Context Protocol's marks, which assistants that ask their user go by. */
  annotations: { readOnlyHint: boolean; destructiveHint: boolean };
}

export interface AssistantOffer {
  /** Sent with every request: one line per kind of record the caller may reach. */
  summary: string;
  tools: AssistantTool[];
  kinds: AssistantKind[];
  /** The standard actions the caller may run. */
  actions: string[];
}

const may = (allowed: Allowed, caller: AssistantCaller) =>
  caller === "visitor"
    ? allowed.public
    : allowed.public || allowed.owner || allowed.roles.includes(caller.role);

const NUMBERS = ["int", "decimal", "money"];
const DATES = ["date", "datetime"];
const SHORT_TEXTS = ["string", "email", "phone", "url"];

/** How a stored field is matched, or nothing when it is found by `search` only. */
function filterOf(field: FieldIR, labels?: Record<string, string>): FieldFilter | undefined {
  if (storageOf(field) === "none") return undefined;
  const { type, name } = field;
  if (type.kind === "choice")
    return { field: name, by: "value", values: type.values, ...(labels ? { labels } : {}) };
  if (type.kind === "relation") return { field: name, by: "reference", model: type.model };
  if (type.name === "bool") return { field: name, by: "yesNo" };
  if (NUMBERS.includes(type.name)) return { field: name, by: "number" };
  if (DATES.includes(type.name)) return { field: name, by: "date" };
  if (SHORT_TEXTS.includes(type.name)) return { field: name, by: "text" };
  return undefined;
}

/** A field in the summary: its name, "*" when required, and what it holds when not a text. */
function fieldWord(field: FieldIR): string {
  const { type } = field;
  const name = `${field.name}${field.required && !field.formula ? "*" : ""}`;
  if (type.kind === "relation") return `${name} -> ${type.model}${type.many ? "[]" : ""}`;
  // What the field holds goes in parentheses, so it is never read as part of the name ("link
  // url" was taken for a field called "link url").
  const holds =
    type.kind === "choice"
      ? type.values.join(" | ")
      : type.name === "bool"
        ? "yes/no"
        : type.name === "money"
          ? "money"
          : NUMBERS.includes(type.name)
            ? "number"
            : DATES.includes(type.name) || ["email", "phone", "url"].includes(type.name)
              ? // "email (email)" says nothing twice.
                type.name === field.name
                ? ""
                : type.name
              : type.name === "picture" || type.name === "pictures"
                ? "picture"
                : type.name === "file" || type.name === "files"
                  ? "document"
                  : "";
  const notes = [holds, field.formula ? "computed" : ""].filter(Boolean);
  return `${name}${notes.length ? ` (${notes.join(", ")})` : ""}`;
}

/** The one rule the summary gives every caller's model. */
export const ANSWER_RULE =
  'Answer with what a tool returned; a number, a name or "none" you did not get from a tool is not an answer.';

/**
 * The tools and the summary for one caller. `scope: "api"` (the default) is what programs from
 * outside may reach: the `api` block's models and actions, and for a visitor what `public`
 * opens of them. `scope: "app"` is everything the role may read in the app, for the assistant
 * inside it, which never deletes.
 */
export function assistantOffer(
  ir: SpecIR,
  auth: AuthIR,
  caller: AssistantCaller,
  options: { scope?: "api" | "app"; content?: ContentIR } = {},
): AssistantOffer {
  const scope = options.scope ?? "api";
  const content = options.content ?? emptyContent();
  const offered = apiOffers(auth, ir);
  const reachable =
    scope === "app"
      ? ir.models.map((m) => m.name)
      : caller === "visitor"
        ? [...new Set([...offered.visitors.read, ...offered.visitors.create])]
        : offered.models;
  const deletes = scope === "api" && caller !== "visitor" && auth.api?.assistants?.delete === true;
  // Inside the app "Ask" only reads, unless the auth file's assistant block says it may change;
  // a visitor's "Ask" only ever reads (a public contact form is theirs to send, not its to fill in).
  const changes = scope === "api" || (auth.assistant?.may === "change" && caller !== "visitor");

  const actions = ir.actions.filter(
    (a) =>
      !a.custom &&
      changes &&
      caller !== "visitor" &&
      (scope === "app" || offered.actions.includes(a.name)) &&
      reachable.includes(a.on) &&
      may(actionAccess(a, auth, ir.models), caller),
  );
  // A custom action on rows runs on the ids given, with its other inputs.
  const onRows = ir.actions.filter(
    (a) =>
      a.custom &&
      a.rows !== undefined &&
      changes &&
      caller !== "visitor" &&
      (scope === "app" || offered.rowsActions.includes(a.name)) &&
      reachable.includes(a.rows.model) &&
      may(actionAccess(a, auth, ir.models), caller),
  );

  const kinds: AssistantKind[] = [];
  for (const model of ir.models) {
    if (!reachable.includes(model.name)) continue;
    const access = modelAccess(model, auth);
    const can = {
      read: may(access.read, caller),
      add: changes && may(access.create, caller),
      change: changes && caller !== "visitor" && may(access.write, caller),
      delete: deletes && may(access.delete, caller),
    };
    if (!can.read && !can.add) continue;
    const text = content.models[model.name];
    const label = text?.label ?? humanize(model.name);
    const pluralLabel = text?.pluralLabel ?? humanize(plural(model.name));
    const filters = can.read
      ? model.fields.flatMap((f) => filterOf(f, text?.fields[f.name]?.values) ?? [])
      : [];
    kinds.push({
      model: model.name,
      label,
      pluralLabel,
      title: titleField(model),
      may: can,
      fields: model.fields
        .filter((f) => storageOf(f) !== "none")
        .map((f) => ({ name: f.name, label: text?.fields[f.name]?.label ?? humanize(f.name) })),
      filters,
      numbers: filters.filter((f) => f.by === "number").map((f) => f.field),
      by: filters
        .filter((f) => ["value", "yesNo", "reference", "date"].includes(f.by))
        .map((f) => f.field),
      description: describeKind(model, actions, content),
    });
  }

  const readable = kinds.filter((k) => k.may.read).map((k) => k.model);
  const addable = kinds.filter((k) => k.may.add).map((k) => k.model);
  const changeable = kinds.filter((k) => k.may.change).map((k) => k.model);
  const deletable = kinds.filter((k) => k.may.delete).map((k) => k.model);
  // Kinds with a trash (docs/design/trash.md): find looks in it, run restores from it.
  const trashing = deletable.filter((m) => ir.models.find((x) => x.name === m)?.trash);
  const kind = (names: string[]) => ({ type: "string", enum: names });
  const id = { type: "integer" };
  const where = {
    type: "object",
    description:
      'Field values to match, e.g. {"status":"open"}; a list means any of them; a number or date takes {"from":…,"to":…}; a reference takes an id or the record\'s title ("me" for a user); {"mine":true} is the caller\'s own records.',
  };
  const search = { type: "string", description: "Words to look for in the records' texts." };
  const reading = { readOnlyHint: true, destructiveHint: false };
  const changing = { readOnlyHint: false, destructiveHint: true };

  const tools: AssistantTool[] = [];
  if (readable.length)
    tools.push(
      {
        name: "find",
        description:
          "Records of one kind the caller may read, newest first, as {columns, rows, total}. Ask only for the fields needed; id and title always come.",
        inputSchema: {
          type: "object",
          required: ["kind"],
          properties: {
            kind: kind(readable),
            where,
            search,
            fields: { type: "array", items: { type: "string" } },
            sort: { type: "string", description: 'A field; "-field" for the largest first.' },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            page: { type: "integer", minimum: 1 },
            ...(trashing.length
              ? {
                  trashed: {
                    type: "boolean",
                    description: `true: the records in the trash the caller may delete, with when they were deleted (${trashing.join(", ")}).`,
                  },
                }
              : {}),
          },
        },
        annotations: reading,
      },
      {
        name: "measure",
        description:
          "A number worked out by the app, never by reading rows: how many records, or the sum, average, min or max of a number field, optionally per value of a field or per month of a date. A min or max names the record that holds it; per reference, each group carries its title, the largest first.",
        inputSchema: {
          type: "object",
          required: ["kind"],
          properties: {
            kind: kind(readable),
            of: {
              type: "string",
              description:
                'count (the default), or "sum total", "average total", "min …", "max …".',
            },
            where,
            search,
            by: { type: "string", description: "A choice, yes/no, reference or date field." },
          },
        },
        annotations: reading,
      },
      {
        name: "read",
        description: "One record with all its fields.",
        inputSchema: {
          type: "object",
          required: ["kind", "id"],
          properties: { kind: kind(readable), id },
        },
        annotations: reading,
      },
    );
  if (addable.length)
    tools.push({
      name: "add",
      description:
        'Add a record. Amounts as decimal texts ("12.50"), dates as ISO texts. A refusal says why, in the app\'s words.',
      inputSchema: {
        type: "object",
        required: ["kind", "values"],
        properties: { kind: kind(addable), values: { type: "object" } },
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    });
  if (changeable.length)
    tools.push({
      name: "change",
      description: "Change a record: only the fields given.",
      inputSchema: {
        type: "object",
        required: ["kind", "id", "values"],
        properties: { kind: kind(changeable), id, values: { type: "object" } },
      },
      annotations: changing,
    });
  if (actions.length || onRows.length || trashing.length)
    tools.push({
      name: "run",
      description: `Run one of the app's actions on a record; \`input\` holds what it asks for.${onRows.length ? ` ${onRows.map((a) => a.name).join(", ")} run on the rows given as \`ids\` instead of one \`id\`.` : ""}${trashing.length ? ` ${trashing.map((m) => `restore${m}`).join(", ")} takes a record out of the trash.` : ""}`,
      inputSchema: {
        type: "object",
        required: ["action"],
        // A record's action takes id; a rows action takes ids.
        ...(onRows.length
          ? { anyOf: [{ required: ["id"] }, { required: ["ids"] }] }
          : { required: ["action", "id"] }),
        properties: {
          action: {
            type: "string",
            enum: [
              ...actions.map((a) => a.name),
              ...onRows.map((a) => a.name),
              ...trashing.map((m) => `restore${m}`),
            ],
          },
          id,
          ...(onRows.length ? { ids: { type: "array", items: id, minItems: 1 } } : {}),
          input: { type: "object" },
        },
      },
      annotations: changing,
    });
  if (deletable.length)
    tools.push({
      name: "delete",
      description: `${
        trashing.length === deletable.length
          ? "Delete a record: it goes to the trash for thirty days."
          : trashing.length
            ? `Delete a record. ${trashing.join(", ")} go to the trash for thirty days; the others cannot be undone.`
            : "Delete a record. It cannot be undone."
      } A record that others point to is refused with what points to it; ask the person before passing together: true, which moves them all to the trash with it.`,
      inputSchema: {
        type: "object",
        required: ["kind", "id"],
        properties: {
          kind: kind(deletable),
          id,
          together: {
            type: "boolean",
            description:
              "Move the records that point to it to the trash with it. Only after the person agreed.",
          },
        },
      },
      annotations: changing,
    });
  if (kinds.length)
    tools.push({
      name: "describe",
      description:
        "What a kind of record means: its fields, rules and actions in full. Only when the summary is not enough.",
      inputSchema: {
        type: "object",
        required: ["kind"],
        properties: { kind: kind(kinds.map((k) => k.model)) },
      },
      annotations: reading,
    });

  const lines = kinds.map((k) => {
    const model = ir.models.find((m) => m.name === k.model) as ModelIR;
    const fields = model.fields
      .filter((f) => !(f.type.kind === "relation" && f.type.many))
      .map(fieldWord)
      .join(", ");
    const only = k.may.read ? "" : " Adding only.";
    return `${k.model} (${k.pluralLabel.toLowerCase()}): ${fields}. Title: ${k.title}.${only}`;
  });
  const actionLine =
    actions.length || onRows.length
      ? [
          `Actions: ${[...actions, ...onRows]
            .map((a) => {
              if (a.custom) {
                const inputs = a.input.filter((f) => f.name !== a.rows?.field).map((f) => f.name);
                return `${a.name} (${a.rows?.model ?? ""} rows, by ids${inputs.length ? `; input: ${inputs.join(", ")}` : ""})`;
              }
              const when = a.when ? `, when ${conditionText(a.when)}` : "";
              return `${a.name} (${a.on}${when})`;
            })
            .join(", ")}.`,
        ]
      : [];
  const who =
    caller === "visitor" ? "a visitor, without a key" : `someone with the role ${caller.role}`;
  const summary = kinds.length
    ? [
        `${ir.app.name}${ir.app.description ? `: ${ir.app.description}` : ""}`,
        ...lines,
        ...actionLine,
        `* required. You act as ${who}.`,
        // An answer stands on what the tools said (docs/design/ask-checks.md §2).
        ANSWER_RULE,
      ].join("\n")
    : `${ir.app.name}: nothing is offered to ${who}.`;
  return { summary, tools, kinds, actions: actions.map((a) => a.name) };
}

/** What `describe` answers for a kind: more words than the summary has room for. */
function describeKind(model: ModelIR, actions: SpecIR["actions"], content: ContentIR): string {
  const text = content.models[model.name];
  const meaning = [model.description, model.intent].filter(Boolean).join(" ");
  const fields = model.fields
    .filter((f) => !(f.type.kind === "relation" && f.type.many))
    .map((f) => {
      const words = text?.fields[f.name];
      const label = words?.label ?? humanize(f.name);
      const values =
        f.type.kind === "choice" && words?.values
          ? ` Values: ${f.type.values.map((v) => `${v} = ${words.values?.[v] ?? humanize(v)}`).join(", ")}.`
          : "";
      const about = [f.description, words?.help].filter(Boolean).join(" ");
      const filled =
        f.default !== undefined ? ` Starts as ${String(f.default)}.` : f.unique ? " Unique." : "";
      return `- ${fieldWord(f)}: ${label}.${about ? ` ${about}` : ""}${values}${filled}`;
    });
  const rules = (model.rules ?? []).map((r) => `- ${r.text}`);
  const on = actions.flatMap((a) =>
    !a.custom && a.on === model.name
      ? [
          `- ${a.name}: ${[a.intent ?? a.description ?? humanize(a.name), ...(a.rules ?? []).map((r) => r.text)].join(" ")}${a.when ? ` Only when ${conditionText(a.when)}.` : ""}`,
        ]
      : [],
  );
  // What the caller may do is said by its tools and their kinds, not here: a description is
  // the same for every caller, so it can be kept once.
  return [
    `${model.name}${meaning ? `: ${meaning}` : ""}`,
    "Fields:",
    ...fields,
    ...(rules.length ? ["Rules:", ...rules] : []),
    ...(on.length ? ["Actions:", ...on] : []),
    ...(model.ownedBy ? [`A record belongs to its ${model.ownedBy}.`] : []),
  ].join("\n");
}

/** Marks which reference fields may take "me": those that refer to a user. */
export const refersToUser = (filter: FieldFilter) =>
  filter.by === "reference" && filter.model === USER_MODEL;

/**
 * Whether a caller gets "Ask" in the app (the auth file's `assistant` block), and with what: a
 * model as well, or the wording rules only, which is all a visitor ever gets.
 */
export function asksWith(auth: AuthIR, caller: AssistantCaller): "nothing" | "rules" | "model" {
  const who = auth.assistant?.for;
  if (!who) return "nothing";
  if (caller === "visitor") return who === "anyone" ? "rules" : "nothing";
  return who === "anyone" || who === "signed-in" || who.includes(caller.role) ? "model" : "nothing";
}
