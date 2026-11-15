import {
  type AuthIR,
  type Channel,
  type FieldIR,
  filterable,
  filterThrough,
  humanize,
  isUpload,
  type ModelIR,
  notSendable,
  readNamePart,
  type SpecIR,
  searchableFields,
  sortableBy,
} from "@smithable/core";

export interface ReferenceOption {
  value: string;
  label: string;
}

/** Each use names a validator rule, never a guess based on the field's name. */
export type FieldUse =
  | "stored"
  | "unique"
  | "name"
  | "owner"
  | "upload"
  | "text"
  | "thread-body"
  | "mail-from"
  | "mail-subject"
  | "mail-body"
  | "mail-attachments"
  | "markdown"
  | "email"
  | "user"
  | "author"
  | "choice"
  | "two-choices"
  | "date"
  | "datetime"
  | "number"
  | "integer"
  | "money"
  | "boolean"
  | "required-reference"
  | "capacity-reference"
  | "scheduled-reference"
  | "sendable"
  | "incoming"
  | "search"
  | "filter"
  | "sort"
  | "group";

type OneHopUse = "name" | "date" | "datetime" | "integer" | "filter" | "group";
type FieldSource = { kind: "field"; model: string } & (
  | { use: OneHopUse; oneHop?: boolean }
  | { use: Exclude<FieldUse, OneHopUse>; oneHop?: false }
);

export type ReferenceSource =
  | { kind: "model"; includeUser?: boolean; list?: boolean }
  | { kind: "page" | "query" | "timer" | "outgoing" | "role" }
  | { kind: "action"; model?: string; timer?: boolean }
  | FieldSource
  | { kind: "choice"; model: string; field: string; exclude?: readonly string[] }
  | { kind: "event" }
  | { kind: "recipient"; model?: string; channels: readonly Channel[] }
  | { kind: "reply-model"; model: string }
  | { kind: "away-model"; model: string; short?: boolean };

const scalar = (field: FieldIR, ...names: string[]) =>
  field.type.kind === "scalar" && names.includes(field.type.name);
const single = (field: FieldIR) => field.type.kind === "relation" && !field.type.many;
const stored = (field: FieldIR) =>
  !field.formula && !(field.type.kind === "relation" && field.type.many);
const modelOf = (ir: SpecIR, name: string) => ir.models.find((model) => model.name === name);

function eligible(field: FieldIR, use: FieldUse, model: ModelIR, ir: SpecIR): boolean {
  switch (use) {
    case "stored":
      return stored(field);
    case "unique":
      return stored(field) && !isUpload(field) && !field.unique && !field.sequence;
    case "owner": {
      if (scalar(field, "email")) return true;
      if (field.type.kind !== "relation" || field.type.many) return false;
      if (field.type.model === "User") return true;
      const target = modelOf(ir, field.type.model);
      // The owner may be one reference away, never another reference chain.
      return target?.ownerKind === "user" || target?.ownerKind === "address";
    }
    case "upload":
      return isUpload(field);
    case "text":
      return scalar(field, "string", "text", "markdown");
    case "thread-body":
      return scalar(field, "text", "markdown", "string");
    case "mail-from":
      return !field.formula && scalar(field, "email", "string");
    case "mail-subject":
      return !field.formula && scalar(field, "string", "text");
    case "mail-body":
      return !field.formula && scalar(field, "string", "text", "markdown");
    case "mail-attachments":
      return !field.formula && scalar(field, "file", "files");
    case "markdown":
      return scalar(field, "markdown");
    case "email":
      return scalar(field, "email");
    case "user":
      return field.type.kind === "relation" && !field.type.many && field.type.model === "User";
    case "author":
      return scalar(field, "email") || eligible(field, "user", model, ir);
    case "choice":
      return field.type.kind === "choice";
    case "two-choices":
      return field.type.kind === "choice" && field.type.values.length === 2;
    case "date":
      return !field.formula && scalar(field, "date", "datetime");
    case "datetime":
      return !field.formula && scalar(field, "datetime");
    case "number":
      return !field.formula && scalar(field, "int", "decimal", "money");
    case "integer":
      return !field.formula && scalar(field, "int");
    case "money":
      return !field.formula && scalar(field, "money");
    case "boolean":
      return !field.formula && scalar(field, "bool");
    case "required-reference":
      return single(field) && field.required;
    case "capacity-reference":
      return (
        field.type.kind === "relation" &&
        !field.type.many &&
        field.required &&
        field.type.model !== "User"
      );
    case "scheduled-reference":
      return (
        field.type.kind === "relation" &&
        !field.type.many &&
        field.required &&
        Boolean(modelOf(ir, field.type.model)?.schedule)
      );
    case "sendable":
      return !field.formula && !notSendable(field);
    case "incoming":
      return !field.formula && field.type.kind !== "relation" && !isUpload(field);
    case "search": {
      if (searchableFields(model).includes(field.name)) return true;
      if (field.formula || field.type.kind !== "relation" || field.type.many) return false;
      return (
        field.type.model === "User" ||
        Boolean(modelOf(ir, field.type.model)?.fields.some((f) => scalar(f, "string")))
      );
    }
    case "filter":
      return filterable(field);
    case "sort":
      return sortableBy(field);
    case "group":
      return !field.formula && (field.type.kind === "choice" || scalar(field, "date", "datetime"));
    case "name":
      return "part" in readNamePart(field.name, model, ir.models);
  }
}

/** Field paths stop after one single relation. A list never becomes a dot-path shortcut. */
function fields(source: Extract<ReferenceSource, { kind: "field" }>, ir: SpecIR): string[] {
  const model = modelOf(ir, source.model);
  if (!model) return [];
  const result = model.fields
    .filter((field) => eligible(field, source.use, model, ir))
    .map((f) => f.name);
  if (!source.oneHop) return result;
  for (const through of model.fields) {
    if (through.formula || through.type.kind !== "relation" || through.type.many) continue;
    const target = modelOf(ir, through.type.model);
    if (!target) continue;
    for (const field of target.fields) {
      const path = `${through.name}.${field.name}`;
      if (source.use === "name") {
        if ("part" in readNamePart(path, model, ir.models)) result.push(path);
      } else if (source.use === "filter") {
        if (!("problem" in filterThrough(model, path, ir.models))) result.push(path);
      } else if (source.use === "group") {
        // A grouping one reference away is a choice; the date-period form is local.
        if (!field.formula && field.type.kind === "choice") result.push(path);
      } else if (!single(field) && eligible(field, source.use, target, ir)) {
        result.push(path);
      }
    }
  }
  return result;
}

function recipients(
  source: Extract<ReferenceSource, { kind: "recipient" }>,
  ir: SpecIR,
  roles: string[],
): string[] {
  if (!source.channels.length) return [];
  // Clock list mail has no record to own or address; its recipient must be a role.
  if (!source.model) return roles;
  const model = modelOf(ir, source.model);
  if (!model || !source.channels.length) return [];
  const address = (field: FieldIR) =>
    !field.formula &&
    (eligible(field, "user", model, ir) ||
      (source.channels.every((channel) => channel === "mail") && scalar(field, "email")) ||
      (source.channels.every((channel) => channel === "sms") && scalar(field, "phone")));
  const result = ["owner", ...roles.filter((role) => !model.fields.some((f) => f.name === role))];
  for (const field of model.fields) {
    if (address(field)) result.push(field.name);
    if (field.formula || field.type.kind !== "relation") continue;
    const target = modelOf(ir, field.type.model);
    if (!target) continue;
    if (field.type.many) result.push(`${field.name}.owner`);
    for (const other of target.fields.filter(address)) result.push(`${field.name}.${other.name}`);
  }
  return result;
}

/** Pure candidate lists. The caller chooses the source from the exact schema/validator context. */
export function referenceOptions(
  source: ReferenceSource,
  ir: SpecIR,
  auth?: Pick<AuthIR, "roles">,
): ReferenceOption[] {
  const roles = auth?.roles.map((role) => role.name) ?? [];
  let values: string[];
  switch (source.kind) {
    case "model":
      values = [...ir.models.map((m) => m.name), ...(source.includeUser ? ["User"] : [])].map(
        (name) => `${name}${source.list ? "[]" : ""}`,
      );
      break;
    case "page":
      values = ir.pages.map((page) => page.id);
      break;
    case "query":
      values = ir.queries.map((query) => query.name);
      break;
    case "timer":
      values = ir.timers.map((timer) => timer.name);
      break;
    case "outgoing":
      values = ir.outgoing.map((entry) => entry.name);
      break;
    case "role":
      values = roles;
      break;
    case "action":
      values = ir.actions
        .filter((action) => {
          if (!source.timer) return !source.model || (!action.custom && action.on === source.model);
          if (action.custom) return !source.model;
          return (
            action.on === source.model &&
            !action.merge &&
            !action.split &&
            !Object.values(action.when ?? {}).some((v) => v === "ME()" || v === "not ME()")
          );
        })
        .map((action) => action.name);
      break;
    case "field":
      values = fields(source, ir);
      break;
    case "choice": {
      const field = modelOf(ir, source.model)?.fields.find((f) => f.name === source.field);
      values =
        field?.type.kind === "choice"
          ? field.type.values.filter((v) => !source.exclude?.includes(v))
          : [];
      break;
    }
    case "event": {
      const actions = ir.actions.map((a) => a.name);
      const timers = ir.timers.map((t) => t.name);
      values = [
        ...ir.models.flatMap((m) =>
          ["created", "changed", "deleted"].map((event) => `${m.name} ${event}`),
        ),
        ...actions.filter((name) => !timers.includes(name)),
        ...timers.filter((name) => !actions.includes(name)),
        ...ir.payments.map((payment) => payment.name),
      ];
      break;
    }
    case "recipient":
      values = recipients(source, ir, roles);
      break;
    case "reply-model":
    case "away-model":
      values = ir.models
        .filter((model) => {
          const references = model.fields.filter(
            (f) => f.type.kind === "relation" && !f.type.many && f.type.model === source.model,
          );
          return source.kind === "reply-model"
            ? references.length === 1
            : (source.short ? references.length === 1 : references.length > 0) &&
                model.fields.filter((f) => !f.formula && scalar(f, "datetime")).length >= 2;
        })
        .map((model) => model.name);
      break;
  }
  return [...new Set(values)].map((value) => ({ value, label: humanize(value) }));
}
