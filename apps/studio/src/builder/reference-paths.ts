import type { JsonSchema } from "@smithable/core";
import { type AuthIR, type Channel, humanize, type SpecIR, validateSpec } from "@smithable/core";
import { stringify } from "yaml";
import {
  type FieldUse,
  type ReferenceOption,
  type ReferenceSource,
  referenceOptions,
} from "./reference-options";
import { alternativeFor } from "./spec-form";

export type ReferencePath = (string | number)[];
type MapValue = Record<string, unknown>;
const object = (value: unknown): MapValue =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as MapValue) : {};
const articleModels = new WeakMap<SpecIR, string[]>();
/** Short articles use core's inference, including ambiguity among optional parts. */
function inferredArticles(document: unknown, ir: SpecIR) {
  const cached = articleModels.get(ir);
  if (cached) return cached;
  const base = { ...object(document) };
  delete base.navigation;
  const values = ir.models
    .filter((model) => {
      const result = validateSpec({
        path: "smithable.yml",
        text: stringify({ ...base, pages: { referenceCandidate: { articles: model.name } } }),
      });
      return result.ir && !result.diagnostics.some((item) => item.severity === "error");
    })
    .map((model) => model.name);
  articleModels.set(ir, values);
  return values;
}
export const referenceAt = (document: unknown, path: ReferencePath): unknown =>
  path.reduce<unknown>(
    (value, key) => (value && typeof value === "object" ? (value as MapValue)[key] : undefined),
    document,
  );

/** A copy for a local form draft; the manifest is still written only by its existing Writer. */
export function referenceWith(document: unknown, path: ReferencePath, value: unknown): unknown {
  if (!path.length) return value;
  const [key = "", ...rest] = path;
  const copy = Array.isArray(document) ? [...document] : { ...object(document) };
  if (rest.length)
    (copy as MapValue)[key] = referenceWith(referenceAt(document, [key]), rest, value);
  else if (value === undefined) {
    if (Array.isArray(copy)) copy.splice(Number(key), 1);
    else delete copy[key];
  } else (copy as MapValue)[key] = value;
  return copy;
}

export interface ReferenceControl {
  options: ReferenceOption[];
  multiple?: boolean;
  /** A literal alternative to the list, such as all or none. */
  word?: string;
  create?: "model" | "page" | "action";
}

/** Dependent references change together. The complete group uses the original writer on Save. */
export function referenceGroup(path: ReferencePath): boolean {
  if (path.length === 2 && ["pages", "outgoing", "incoming", "payments"].includes(String(path[0])))
    return true;
  return (
    path[0] === "models" &&
    path.length === 3 &&
    ["thread", "capacity", "schedule", "occupies", "unique"].includes(String(path[2]))
  );
}

/** Exact manifest paths, deliberately independent of field spelling and schema prose. */
export function referenceControl(
  path: ReferencePath,
  value: unknown,
  document: unknown,
  ir: SpecIR,
  auth?: Pick<AuthIR, "roles">,
): ReferenceControl | undefined {
  const [area, entry, key, part, leaf] = path;
  const own = object(referenceAt(document, [String(area), String(entry)]));
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const offer = (source: ReferenceSource, multiple = false, word?: string): ReferenceControl => ({
    options: referenceOptions(source, ir, auth),
    multiple,
    ...(word ? { word } : {}),
    ...(["model", "page", "action"].includes(source.kind) &&
    !(source.kind === "model" && source.list)
      ? { create: source.kind as "model" | "page" | "action" }
      : {}),
  });
  const field = (model: unknown, use: FieldUse, multiple = false, oneHop = false) =>
    offer({ kind: "field", model: text(model), use, oneHop } as ReferenceSource, multiple);
  const models = (multiple = false, word?: string) => offer({ kind: "model" }, multiple, word);
  const withWords = (control: ReferenceControl, ...words: string[]) => ({
    ...control,
    options: [...words.map((value) => ({ value, label: humanize(value) })), ...control.options],
  });
  const model = ir.models.find((model) => model.name === entry);
  if (
    area === "navigation" &&
    ((path.length === 1 && (Array.isArray(value) || value === undefined)) || path.length === 2)
  )
    return offer({ kind: "page" }, true);
  if (area === "models" && model) {
    if (path.length === 3) {
      if (key === "ownedBy") return field(entry, "owner");
      if (key === "namedBy") return field(entry, "name", true, true);
      if (key === "review") return { ...field(entry, "upload", true), word: "all" };
    }
    if (key === "thread") {
      if (path.length === 4 && part === "body") return field(entry, "thread-body");
      if (path.length === 4 && part === "author") return field(entry, "author");
      if (part === "side" && path.length === 5) {
        if (leaf === "field") return field(entry, "two-choices");
        if (leaf === "ours")
          return offer({
            kind: "choice",
            model: text(entry),
            field: text(object(object(own.thread).side).field),
          });
      }
    }
    if (
      key === "unique" &&
      ((path.length === 4 && (Array.isArray(value) || value === undefined)) ||
        (path.length === 5 && leaf === "fields"))
    )
      return field(entry, "unique", true);
    if (key === "capacity") {
      if (part === "per" && path.length === 4) return field(entry, "capacity-reference");
      // The maximum may also be a literal integer: its composed control chooses that mode.
      if (part === "max" && typeof value === "string") {
        const per = text(object(own.capacity).per);
        const target = model.fields.find((f) => f.name === per)?.type;
        return {
          options:
            target?.kind === "relation"
              ? field(target.model, "integer").options.map((option) => ({
                  value: `${per}.${option.value}`,
                  label: `${humanize(per)} → ${option.label}`,
                }))
              : [],
        };
      }
    }
    if (key === "occupies" && path.length === 4) {
      if (part === "resource") return field(entry, "scheduled-reference");
      if (part === "starts") return field(entry, "datetime");
      if (part === "duration") return field(entry, "integer", false, true);
      if (part === "cancelTo") {
        const whileValue = object(object(own.occupies).while);
        const choices = model.fields.filter(
          (f) => f.type.kind === "choice" && whileValue[f.name] !== undefined,
        );
        return {
          options: choices.flatMap(
            (f) =>
              offer({
                kind: "choice",
                model: model.name,
                field: f.name,
                exclude: [whileValue[f.name]].flat().map(String),
              }).options,
          ),
        };
      }
    }
    if (key === "schedule" && part === "away") {
      const away = object(object(own.schedule).away);
      if (path.length === 4 && (typeof value === "string" || value === undefined))
        return offer({ kind: "away-model", model: model.name, short: true });
      if (path.length === 5) {
        if (leaf === "model") return offer({ kind: "away-model", model: model.name });
        if (leaf === "from" || leaf === "until") return field(away.model, "datetime");
        if (leaf === "resource")
          return {
            options:
              ir.models
                .find((m) => m.name === away.model)
                ?.fields.filter(
                  (f) => f.type.kind === "relation" && !f.type.many && f.type.model === model.name,
                )
                .map((f) => ({ value: f.name, label: humanize(f.name) })) ?? [],
          };
      }
    }
  }
  if (area === "queries" && path.length === 3 && key === "returns")
    return offer({ kind: "model", list: true });
  if (area === "payments") {
    if (path.length === 3 && key === "on") return models();
    if (path.length === 3 && key === "amount") return field(own.on, "money");
    if (path.length === 4 && key === "refund" && part === "by")
      return offer({ kind: "role" }, true);
  }
  if (area === "incoming") {
    if (path.length === 3 && key === "create") return models();
    if (path.length === 3 && key === "as") return offer({ kind: "role" });
    if (path.length === 4 && key === "reply" && part === "create")
      return offer({ kind: "reply-model", model: text(own.create) });
    const mailKey =
      key === "fields" && path.length === 4
        ? part
        : key === "reply" && part === "fields" && path.length === 5
          ? leaf
          : undefined;
    const mailUses: Record<string, FieldUse> = {
      from: "mail-from",
      subject: "mail-subject",
      body: "mail-body",
      attachments: "mail-attachments",
    };
    if (typeof mailKey === "string" && mailUses[mailKey])
      return field(key === "reply" ? object(own.reply).create : own.create, mailUses[mailKey]);
  }
  if (area === "outgoing") {
    const trigger = text(own.when);
    const timer = ir.timers.find((t) => t.name === trigger);
    const action = ir.actions.find((a) => a.name === trigger);
    const payment = ir.payments.find((p) => p.name === trigger);
    const eventModel =
      timer?.on ??
      (action && !action.custom
        ? action.on
        : (payment?.on ?? trigger.match(/^([A-Z]\w*) (?:created|changed|deleted)$/)?.[1]));
    const list = object(own.list);
    const query = ir.queries.find((q) => q.name === list.query);
    const listModel = list.model ?? query?.returns;
    if (path.length === 3) {
      if (key === "when") return offer({ kind: "event" });
      if (key === "fields")
        return field(trigger.endsWith(" changed") ? eventModel : undefined, "stored", true);
      if (key === "show") return { ...field(eventModel, "sendable", true), word: "none" };
      if (key === "to")
        return {
          options: [
            "mail",
            "push",
            "sms",
            ...ir.outgoing
              .filter((entry) => !["mail", "push", "sms"].includes(entry.to))
              .map((entry) => entry.to),
          ].map((value) => ({ value, label: humanize(value) })),
          multiple: Array.isArray(value),
        };
      if (key === "recipient")
        return offer({
          kind: "recipient",
          model: (timer && !timer.on) || action?.custom ? undefined : eventModel,
          channels: [own.to]
            .flat()
            .filter((value): value is Channel => ["mail", "push", "sms"].includes(String(value))),
        });
    }
    if (key === "list" && path.length === 4) {
      if (part === "model") return models();
      if (part === "query") return offer({ kind: "query" });
      if (part === "when") return field(listModel, "date", false, true);
      if (part === "columns") return field(listModel, "sendable", true);
    }
  }
  if (area === "pages") {
    const pageModel =
      own.crud ??
      own.settings ??
      object(own.calendar).model ??
      (typeof own.calendar === "string" ? own.calendar : undefined) ??
      object(own.articles).model ??
      (typeof own.articles === "string" ? own.articles : undefined) ??
      object(own.onboarding).model;
    if (path.length === 3) {
      if (["crud", "settings"].includes(String(key))) return models();
      if (
        ["calendar", "articles"].includes(String(key)) &&
        (typeof value === "string" || value === undefined)
      ) {
        const control = models();
        control.options = control.options.filter((option) =>
          key === "calendar"
            ? field(option.value, "date").options.length === 1
            : inferredArticles(document, ir).includes(option.value),
        );
        return control;
      }
      if (key === "data") return models(true, "all");
      if (key === "review")
        return {
          ...models(true, "all"),
          options: ir.models
            .filter((model) => model.review?.length)
            .map((model) => ({ value: model.name, label: humanize(model.name) })),
        };
      if (key === "actions")
        return own.crud
          ? offer({ kind: "action", model: text(own.crud) }, true)
          : { options: [], multiple: true };
      if (key === "search") return field(own.crud, "search", true);
      if (key === "filters") {
        const control = field(
          own.crud ?? (own.calendar ? pageModel : undefined),
          "filter",
          true,
          Boolean(own.crud),
        );
        if (own.calendar)
          control.options = control.options.filter((option) => {
            if (option.value === "owner") return true;
            const type = ir.models
              .find((model) => model.name === pageModel)
              ?.fields.find((field) => field.name === option.value)?.type;
            return (
              type?.kind === "choice" ||
              type?.kind === "relation" ||
              (type?.kind === "scalar" && type.name === "bool")
            );
          });
        return control;
      }
      if (key === "sortable") return field(own.crud, "sort", true);
      if (key === "period" && (typeof value === "string" || value === undefined)) {
        const models = Object.values(object(own.dashboard))
          .map((tile) => {
            const config = object(tile);
            return text(config.count ?? config.sum ?? config.average).split(".")[0];
          })
          .filter(Boolean);
        return {
          options: models.length
            ? field(models[0], "date").options.filter((option) =>
                models.every((model) =>
                  field(model, "date").options.some((other) => other.value === option.value),
                ),
              )
            : [],
        };
      }
      if (key === "contact" && (typeof value === "string" || value === undefined))
        return own.crud ? withWords(field(own.crud, "user"), "owner") : { options: [] };
    }
    if (key === "period" && path.length === 4) return field(part, "date");
    if (key === "contact" && path.length === 4) {
      if (part === "to") return withWords(field(pageModel, "user"), "owner");
      if (part === "keep")
        return {
          ...models(),
          options: ir.models
            .filter(
              (model) =>
                !model.fields.some(
                  (field) => !field.formula && field.type.kind === "relation" && !field.type.many,
                ),
            )
            .map((model) => ({ value: model.name, label: humanize(model.name) })),
        };
    }
    if ((key === "calendar" || key === "articles") && path.length === 4) {
      const config = object(own[key]);
      if (part === "model") {
        const control = models();
        control.options = control.options.filter((option) =>
          key === "calendar"
            ? field(option.value, "date").options.length > 0
            : ir.models
                .find((model) => model.name === option.value)
                ?.fields.some(
                  (field) => field.type.kind === "scalar" && field.type.name === "markdown",
                ) &&
              ir.models
                .find((model) => model.name === option.value)
                ?.fields.some(
                  (field) => field.type.kind === "scalar" && field.type.name === "string",
                ),
        );
        return control;
      }
      if (key === "calendar") {
        if (part === "starts") return field(config.model, "calendar-date");
        if (part === "ends") {
          const control = field(config.model, "calendar-date");
          const fields = ir.models.find((model) => model.name === config.model)?.fields ?? [];
          const starts = fields.find((field) => field.name === config.starts)?.type;
          control.options = config.duration
            ? []
            : control.options.filter((option) => {
                const type = fields.find((field) => field.name === option.value)?.type;
                return (
                  !starts ||
                  (starts.kind === "scalar" && type?.kind === "scalar" && starts.name === type.name)
                );
              });
          return control;
        }
        if (part === "duration")
          return config.ends
            ? { options: [] }
            : field(config.model, "calendar-duration", false, true);
        if (part === "title") return field(config.model, "calendar-title");
      } else {
        const kinds: Record<string, string[]> = {
          title: ["string"],
          body: ["markdown"],
          picture: ["picture"],
          date: ["date", "datetime"],
          address: ["string"],
          summary: ["string", "text"],
        };
        const used = Object.entries(config)
          .filter(([name]) => name !== part && name !== "model")
          .map(([, value]) => value);
        const options =
          ir.models
            .find((m) => m.name === config.model)
            ?.fields.filter(
              (f) =>
                !used.includes(f.name) &&
                (part === "author"
                  ? f.type.kind === "relation" && !f.type.many && f.type.model === "User"
                  : f.type.kind === "scalar" &&
                    (kinds[String(part)] ?? []).includes(f.type.name) &&
                    (part !== "address" || Boolean(f.unique))),
            )
            .map((f) => ({ value: f.name, label: humanize(f.name) })) ?? [];
        return {
          options: [
            ...(!["title", "body"].includes(String(part))
              ? [{ value: "none", label: "None" }]
              : []),
            ...options,
          ],
        };
      }
    }
    if (key === "order" && path.length === 4) {
      const order = object(own.order);
      if (part === "from" || part === "into") return models();
      if (part === "price") return field(order.from, "money");
      if (part === "available") return withWords(field(order.from, "boolean"), "none");
      if (part === "quantity") {
        const list = ir.models
          .find((m) => m.name === order.into)
          ?.fields.find((f) => f.type.kind === "relation" && f.type.many)?.type;
        return withWords(field(list?.kind === "relation" ? list.model : "", "integer"), "none");
      }
      if (part === "ask")
        return {
          options:
            ir.models
              .find((m) => m.name === order.into)
              ?.fields.filter((f) => !f.formula && !f.byApp && f.type.kind === "scalar")
              .map((f) => ({ value: f.name, label: humanize(f.name) })) ?? [],
          multiple: true,
        };
    }
    if (key === "onboarding") {
      if (path.length === 4 && part === "model") return models();
      if (path.length === 5 && part === "steps")
        return field(object(own.onboarding).model, "stored", true);
    }
    if (key === "dashboard" && path.length === 5) {
      const tile = object(object(own.dashboard)[String(part)]);
      const tileModel = tile.count ?? tile.list ?? text(tile.sum ?? tile.average).split(".")[0];
      if (leaf === "count" || leaf === "list") return models();
      if (leaf === "query") return offer({ kind: "query" });
      if (leaf === "sum" || leaf === "average")
        return {
          options: ir.models.flatMap((m) =>
            field(m.name, "measure").options.map((option) => ({
              value: `${m.name}.${option.value}`,
              label: `${humanize(m.name)} → ${option.label}`,
            })),
          ),
        };
      if (leaf === "when") return field(tile.list, "date");
      if (leaf === "by") return field(tileModel, "group", false, true);
    }
    if ((key === "landing" || key === "sections") && path.length === 5) {
      const section = object(object(own[key])[String(part)]);
      if (leaf === "records" || leaf === "form") return models();
      if (leaf === "starts") return field(section.records, "date");
      if (leaf === "filters") return field(section.records, "filter", true);
      if (leaf === "button" || leaf === "secondButton" || leaf === "shortcuts")
        return offer({ kind: "page" }, leaf === "shortcuts");
    }
  }
  return undefined;
}

/** Keys whose spelling names a reference, rather than defining a new entry. */
export function referenceKeys(
  path: ReferencePath,
  document: unknown,
  ir: SpecIR,
): ReferenceOption[] | undefined {
  const [area, name, key, part] = path;
  const own = object(referenceAt(document, [String(area), String(name)]));
  if (area === "incoming") {
    const model =
      path.length === 3 && key === "set"
        ? own.create
        : path.length === 4 && key === "reply" && part === "set"
          ? object(own.reply).create
          : path.length === 4 && key === "reply" && part === "then"
            ? own.create
            : undefined;
    if (typeof model === "string")
      return referenceOptions({ kind: "field", model, use: "incoming" }, ir);
    if (
      (path.length === 3 && key === "set") ||
      (path.length === 4 && key === "reply" && (part === "set" || part === "then"))
    )
      return [];
  }
  if (area === "pages" && key === "defaultFilter" && path.length === 3)
    return (Array.isArray(own.filters) ? own.filters : [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => ({ value, label: humanize(value) }));
  if (area === "pages" && key === "period" && path.length === 3) {
    const models = Object.values(object(own.dashboard)).flatMap((tile) => {
      const config = object(tile);
      const name = config.count ?? config.sum ?? config.average;
      return typeof name === "string" ? [name.split(".")[0]] : [];
    });
    return [...new Set(models)].map((value) => ({ value, label: humanize(value) }));
  }
  return undefined;
}

/** Required dependent parts and minimum list sizes must be complete before an atomic Save. */
export function referenceComplete(schema: JsonSchema, value: unknown): boolean {
  const alternatives = (schema.oneOf ?? schema.anyOf) as JsonSchema[] | undefined;
  if (alternatives && !schema.properties) {
    const chosen = alternativeFor(alternatives, value);
    if (chosen) return referenceComplete(chosen, value);
  }
  if (value === undefined) return true;
  if (Array.isArray(value))
    return (
      value.length >= (typeof schema.minItems === "number" ? schema.minItems : 0) &&
      value.every((item) => referenceComplete((schema.items ?? {}) as JsonSchema, item))
    );
  if (value && typeof value === "object") {
    const own = value as Record<string, unknown>;
    if (
      Array.isArray(schema.required) &&
      schema.required.some((key) => own[String(key)] === undefined || own[String(key)] === "")
    )
      return false;
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    return Object.entries(own).every(([key, value]) =>
      referenceComplete(
        properties[key] ??
          ((typeof schema.additionalProperties === "object"
            ? schema.additionalProperties
            : {}) as JsonSchema),
        value,
      ),
    );
  }
  return true;
}
