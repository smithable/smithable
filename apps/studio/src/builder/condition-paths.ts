import type { ModelIR, SpecIR } from "@smithable/core";
import { whenable } from "./action-rows";
import { referenceEventModel } from "./reference-options";
import { type ReferencePath, referenceAt } from "./reference-paths";

export interface ConditionContext {
  model: ModelIR | undefined;
  computed: boolean;
  references: boolean;
  person: boolean;
  mode?: "required" | "locked" | "created";
  fixed?: "calculated" | "required" | "choice";
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Only manifest positions whose validators read a record condition. */
export function conditionContext(
  path: ReferencePath,
  document: unknown,
  ir: SpecIR,
): ConditionContext | undefined {
  const [area, name, key, part, leaf] = path;
  const own = object(referenceAt(document, path.slice(0, 2)));
  let model: unknown;
  let computed = false;
  let references = false;
  let person = false;
  let mode: ConditionContext["mode"];
  let fixed: ConditionContext["fixed"];
  if (area === "models") {
    if (
      path.length === 4 &&
      ((key === "capacity" && part === "where") || (key === "occupies" && part === "while"))
    )
      model = name;
    else if (path.length === 5 && key === "fields" && (leaf === "required" || leaf === "locked")) {
      model = name;
      computed = true;
      mode = leaf;
      const field = ir.models
        .find((item) => item.name === name)
        ?.fields.find((f) => f.name === part);
      const written = object(referenceAt(document, path.slice(0, 4)));
      if (field?.formula) fixed = "calculated";
      else if (leaf === "required") {
        if (field?.type.kind === "choice") {
          if (written.default !== "none") fixed = "choice";
        } else if (typeof written.type === "string" && written.type.split(/\s/)[0]?.endsWith("!"))
          fixed = "required";
      }
    } else return undefined;
  } else if (area === "actions" && path.length === 3 && key === "when") {
    model = own.on;
    computed = references = person = true;
  } else if (area === "timers" && path.length === 3 && key === "where") model = own.on;
  else if (
    area === "payments" &&
    ((path.length === 3 && key === "when") ||
      (path.length === 4 && key === "refund" && part === "when"))
  ) {
    model = own.on;
    computed = references = true;
    if (path.length === 3) mode = "created";
  } else if (area === "outgoing") {
    if (path.length === 3 && key === "where")
      model = typeof own.when === "string" ? referenceEventModel(own.when, ir) : undefined;
    else if (path.length === 4 && key === "list" && part === "where") {
      const list = object(own.list);
      model = list.query
        ? ir.queries.find((query) => query.name === list.query)?.returns
        : list.model;
    } else return undefined;
  } else if (area === "pages" && path.length === 5 && leaf === "where") {
    const config = object(referenceAt(document, path.slice(0, -1)));
    if (key === "landing" || key === "sections") model = config.records;
    else if (key === "dashboard") {
      const target = config.count ?? config.sum ?? config.average ?? config.list;
      model = typeof target === "string" ? target.split(".")[0] : undefined;
    } else return undefined;
  } else return undefined;
  return {
    model: ir.models.find((item) => item.name === model),
    computed,
    references,
    person,
    ...(mode ? { mode } : {}),
    ...(fixed ? { fixed } : {}),
  };
}

/** Local drafts retain incomplete rows; a parent Save waits until they fit its current model. */
export function conditionReady(value: unknown, context: ConditionContext): boolean {
  if (value === undefined) return context.mode !== "created";
  if (context.mode === "created" && value === "created") return true;
  if ((context.mode === "required" || context.mode === "locked") && typeof value === "boolean")
    return (
      context.fixed === "choice" ||
      !context.fixed ||
      (context.fixed === "required" && value === true)
    );
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !context.model ||
    context.fixed
  )
    return false;
  const entries = Object.entries(value);
  if (context.mode && !entries.length) return false;
  const fields = whenable(context.model, context);
  return entries.every(([name, wanted]) => {
    const field = fields.find((field) => field.name === name);
    if (!field) return false;
    if (field.type.kind === "choice") {
      const values = Array.isArray(wanted) ? wanted : [wanted];
      return (
        values.length > 0 &&
        new Set(values).size === values.length &&
        values.every(
          (value) =>
            typeof value === "string" &&
            field.type.kind === "choice" &&
            field.type.values.includes(value),
        )
      );
    }
    if (field.type.kind === "relation") {
      if (typeof wanted !== "string") return false;
      const value = wanted.replace(/\s/g, "");
      return (
        value === "none" ||
        value === "any" ||
        (context.person && field.type.model === "User" && ["ME()", "notME()"].includes(value))
      );
    }
    if (field.type.kind !== "scalar") return false;
    return field.type.name === "bool"
      ? typeof wanted === "boolean"
      : typeof wanted === "string" ||
          (Array.isArray(wanted) &&
            wanted.length > 0 &&
            wanted.every((v) => typeof v === "string"));
  });
}

export function conditionTreeReady(
  path: ReferencePath,
  value: unknown,
  document: unknown,
  ir: SpecIR,
): boolean {
  const context = conditionContext(path, document, ir);
  if (context) return conditionReady(value, context);
  return (
    !value ||
    typeof value !== "object" ||
    Object.entries(value).every(([key, child]) =>
      conditionTreeReady([...path, Array.isArray(value) ? Number(key) : key], child, document, ir),
    )
  );
}
