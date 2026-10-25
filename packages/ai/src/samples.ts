// Sample records for a first build: a few plausible rows for each model, drafted with the app in
// one small request after the draft, so its first preview shows "Grilled sea bass, €24" rather
// than "Dish 8, €640". They become samples/<Model>.yml (docs/spec/v0.1.md, Sample data); a
// model the answer leaves out, or whose rows do not fit, keeps the generated rows.
import {
  type ContentIR,
  type FieldIR,
  humanize,
  type ModelIR,
  type SpecIR,
  titleField,
  USER_MODEL,
} from "@smithable/core";
import { completeJson, type Provider, type Usage } from "./provider.js";

/** Rows by model name, each a mapping of field names to values as a sample file writes them. */
export type DraftedSamples = Record<string, Record<string, string | number | boolean>[]>;

const SYSTEM = `You write sample records for a new web app, so its first preview looks like the real thing.
For each model you get its fields, write plausible records a real business of this kind would have: real-sounding names, prices, dates and descriptions, varied, never numbered placeholders ("Item 1", "Dish 8").
Write every text in the language of the app's texts (its name and labels, else the description's).
A reference names a record of the other model by the field its description names, exactly as you wrote it there. Dates are YYYY-MM-DD, dates with times YYYY-MM-DD HH:MM, money is an amount (24.5).
Answer with JSON only.`;

/** A field the sample file can hold that a person would fill in; undefined when it cannot. */
function fieldSchema(field: FieldIR, models: Map<string, ModelIR>): object | undefined {
  if (field.formula) return undefined;
  const t = field.type;
  if (t.kind === "choice") return { enum: t.values };
  if (t.kind === "relation")
    return !t.many && models.has(t.model)
      ? {
          type: "string",
          description: `The ${titleField(models.get(t.model) as ModelIR)} of a ${t.model} record you wrote.`,
        }
      : undefined;
  switch (t.name) {
    case "int":
      return { type: "integer" };
    case "decimal":
    case "money":
      return { type: "number" };
    case "bool":
      return { type: "boolean" };
    case "date":
      return { type: "string", description: "YYYY-MM-DD" };
    case "datetime":
      return { type: "string", description: "YYYY-MM-DD HH:MM" };
    case "picture":
    case "pictures":
    case "file":
    case "files":
      return undefined;
    default:
      return { type: "string" };
  }
}

/**
 * The models a first build's seed fills with records: not one that needs a user (a person's
 * booking), nor a place or a time someone takes (they stay free), nor one that needs those.
 */
export function sampledModels(ir: SpecIR): ModelIR[] {
  const skipped = new Set(ir.models.filter((m) => m.capacity || m.occupies).map((m) => m.name));
  for (let changed = true; changed; ) {
    changed = false;
    for (const model of ir.models)
      if (
        !skipped.has(model.name) &&
        model.fields.some(
          (f) =>
            f.required &&
            f.type.kind === "relation" &&
            (f.type.model === USER_MODEL || skipped.has(f.type.model)),
        )
      ) {
        skipped.add(model.name);
        changed = true;
      }
  }
  return ir.models.filter((m) => !skipped.has(m.name)).slice(0, 6);
}

/**
 * The rows without those that repeat a unique field's value, or the values of fields unique
 * together, of a row before them: the database would refuse the whole seed (a padel club's
 * eight courts at one address).
 */
export function uniqueRows<T extends Record<string, unknown>>(model: ModelIR, rows: T[]): T[] {
  const keys = [
    ...model.fields.filter((f) => f.unique).map((f) => [f.name]),
    ...(model.unique ?? []).map((u) => u.fields),
  ];
  const seen = keys.map(() => new Set<string>());
  return rows.filter((row) => {
    const values = keys.map((key) =>
      key.every((k) => row[k] !== undefined && row[k] !== null && row[k] !== "")
        ? JSON.stringify(key.map((k) => row[k]))
        : undefined,
    );
    if (values.some((v, i) => v !== undefined && seen[i]?.has(v))) return false;
    values.forEach((v, i) => {
      if (v !== undefined) seen[i]?.add(v);
    });
    return true;
  });
}

/**
 * Up to `count` rows for each model the seed fills, from the cheapest allowed model in one
 * request. Without a model, or when it fails, none: the generated rows stay.
 */
export async function draftSamples(options: {
  description: string;
  ir: SpecIR;
  content?: ContentIR;
  /** Allowed by the AI policy, cheapest first; the cheapest writes them. */
  providers: Provider[];
  count?: number;
}): Promise<{ samples: DraftedSamples; usage: Usage[] }> {
  const usage: Usage[] = [];
  const count = options.count ?? 8;
  const models = sampledModels(options.ir);
  const provider = options.providers[0];
  if (!provider || models.length === 0) return { samples: {}, usage };
  const names = new Map(models.map((m) => [m.name, m]));
  const shapes = models.flatMap((model) => {
    const fields = Object.fromEntries(
      model.fields.flatMap((f) => {
        const schema = fieldSchema(f, names);
        return schema ? [[f.name, schema]] : [];
      }),
    );
    return Object.keys(fields).length ? [{ model, fields }] : [];
  });
  if (shapes.length === 0) return { samples: {}, usage };
  const schema = {
    type: "object",
    additionalProperties: false,
    required: shapes.map((s) => s.model.name),
    properties: Object.fromEntries(
      shapes.map(({ model, fields }) => [
        model.name,
        {
          type: "array",
          maxItems: count,
          items: {
            type: "object",
            additionalProperties: false,
            required: model.fields.filter((f) => f.required && f.name in fields).map((f) => f.name),
            properties: fields,
          },
        },
      ]),
    ),
  };
  const label = (model: ModelIR) =>
    options.content?.models[model.name]?.label ?? humanize(model.name);
  const lines = shapes.map(({ model, fields }) => {
    const texts = options.content?.models[model.name]?.fields ?? {};
    const described = Object.keys(fields).map((name) => {
      const field = model.fields.find((f) => f.name === name) as FieldIR;
      const kind =
        field.type.kind === "scalar"
          ? field.type.name
          : field.type.kind === "choice"
            ? field.type.values.join(" | ")
            : `a ${field.type.model}`;
      const shown = texts[name]?.label;
      return `${name} (${kind}${field.required ? ", required" : ""}${field.unique ? ", unique" : ""}${shown ? `, shown as "${shown}"` : ""})`;
    });
    return `- ${model.name}, shown as "${label(model)}"${model.description ? `: ${model.description}` : ""}\n  fields: ${described.join(", ")}`;
  });
  const user = `The app: ${options.ir.app.name}${options.ir.app.description ? `, ${options.ir.app.description}` : ""}
What it was made from: ${options.description}

Write ${count} records for each of these models. A unique field, and fields unique together, differ in every record. Dates fall in the weeks around ${new Date().toISOString().slice(0, 10)}.
${lines.join("\n")}`;
  try {
    const answer = (await completeJson(
      provider,
      { system: SYSTEM, user, schema },
      usage,
    )) as Record<string, unknown>;
    const samples: DraftedSamples = {};
    for (const { model, fields } of shapes) {
      const rows = answer?.[model.name];
      if (!Array.isArray(rows)) continue;
      const kept = rows
        .slice(0, count)
        .flatMap((row) =>
          row && typeof row === "object" && !Array.isArray(row)
            ? [
                Object.fromEntries(
                  Object.entries(row as Record<string, unknown>).filter(
                    ([k, v]) =>
                      k in fields &&
                      (typeof v === "string" || typeof v === "number" || typeof v === "boolean"),
                  ),
                ) as Record<string, string | number | boolean>,
              ]
            : [],
        );
      const unique = uniqueRows(model, kept);
      if (unique.length) samples[model.name] = unique;
    }
    return { samples, usage };
  } catch {
    return { samples: {}, usage };
  }
}
