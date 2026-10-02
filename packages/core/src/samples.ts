// Sample data a project gives itself: samples/<Model>.yml at the project root, beside themes/,
// a YAML list of records with the model's field names as keys. The seed uses a model's rows
// instead of generated ones (docs/spec/v0.1.md, Sample data). Data, not grammar: nothing here
// changes what the app does. References name the referenced record by its title, choices by
// value or label, pictures by a file under public/images/samples/.
import { isMap, isScalar, isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
import type { ContentIR } from "./content.js";
import { ParseContext } from "./context.js";
import type { Diagnostic } from "./diagnostics.js";
import { type FieldIR, type ModelIR, PICTURES_MAX, type SpecIR } from "./ir.js";
import { humanize } from "./naming.js";
import { didYouMean } from "./suggest.js";

/** A sample picture: a file under public/images/samples/ and its description. */
export interface SamplePicture {
  picture: string;
  alt: string;
}
/**
 * A sample record's values as the seed writes them: money in cents, a reference as the
 * referenced record's number (from 1, in its file's order), a choice as its value.
 */
export type SampleRecordValue = string | number | boolean | null | SamplePicture | SamplePicture[];
export type SamplesIR = Record<string, Record<string, SampleRecordValue>[]>;

/** The field that names a record: the first text field called like a name or title. */
export function titleField(model: ModelIR): string {
  const strings = model.fields.filter((f) => f.type.kind === "scalar" && f.type.name === "string");
  return (strings.find((f) => /name|title/i.test(f.name)) ?? strings[0])?.name ?? "id";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/;

/**
 * The project's sample files, checked against the spec: each file a model's, each record's
 * keys its fields, each value of its field's kind, each reference to a record that exists.
 */
export function validateSamples(
  files: readonly { path: string; text: string }[],
  ir: SpecIR,
  content?: ContentIR,
): { samples: SamplesIR; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const parsed: { model: ModelIR; ctx: ParseContext; items: ParsedNode[] }[] = [];
  for (const file of files) {
    const counter = new LineCounter();
    const doc = parseDocument(file.text, { lineCounter: counter, keepSourceTokens: true });
    const ctx = new ParseContext(file.path, counter);
    for (const error of doc.errors) ctx.error(null, "yaml", error.message);
    const name = file.path.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "");
    const model = ir.models.find((m) => m.name === name);
    // A file or field that names what is no longer there (renamed, removed) is stale data: said,
    // and left out, so it never blocks a change to the spec.
    if (!doc.errors.length && !model)
      ctx.warning(
        null,
        "unknown-model",
        `There is no model "${name}" for samples/${name}.yml.`,
        didYouMean(
          name,
          ir.models.map((m) => m.name),
        ) ?? "Name a sample file after its model, e.g. samples/Customer.yml.",
      );
    else if (!doc.errors.length && !isSeq(doc.contents))
      ctx.error(doc.contents, "expected-list", `samples/${name}.yml must be a list of records.`);
    else if (model && isSeq(doc.contents))
      parsed.push({ model, ctx, items: doc.contents.items as ParsedNode[] });
    diagnostics.push(...ctx.diagnostics);
  }
  // Titles first, so a record may name one in a file read later.
  const titles = new Map<string, string[]>();
  for (const { model, items } of parsed) {
    const key = titleField(model);
    titles.set(
      model.name,
      items.map((item) => {
        const value = isMap(item) ? item.get(key) : undefined;
        return typeof value === "string" ? value : "";
      }),
    );
  }
  const samples: SamplesIR = {};
  for (const { model, ctx, items } of parsed) {
    const fields = model.fields.filter(
      (f) => !f.formula && !(f.type.kind === "relation" && f.type.many),
    );
    samples[model.name] = items.flatMap((item, i) => {
      if (!isMap(item)) {
        ctx.error(
          item,
          "expected-mapping",
          `Record ${i + 1} must be a mapping of fields to values.`,
        );
        return [];
      }
      const row: Record<string, SampleRecordValue> = {};
      // A field given with a wrong value is reported as wrong, not also as missing.
      const given = new Set<string>();
      for (const pair of item.items) {
        const keyNode = pair.key as ParsedNode;
        const key = isScalar(keyNode) ? String(keyNode.value) : "";
        const field = fields.find((f) => f.name === key);
        if (!field) {
          ctx.warning(
            keyNode,
            "unknown-field",
            `${model.name} has no field "${key}" a sample can set.`,
            didYouMean(
              key,
              fields.map((f) => f.name),
            ) ?? `Its fields: ${fields.map((f) => f.name).join(", ")}.`,
          );
          continue;
        }
        given.add(field.name);
        const value = sampleValue(
          ctx,
          model,
          field,
          pair.value as ParsedNode,
          titles,
          content,
          row,
        );
        if (value !== undefined) row[field.name] = value;
      }
      for (const field of fields)
        if (field.required && field.default === undefined && !given.has(field.name))
          ctx.error(
            item,
            "missing-field",
            `Record ${i + 1} of ${model.name} needs "${field.name}".`,
          );
      return [row];
    });
    diagnostics.push(...ctx.diagnostics.filter((d) => !diagnostics.includes(d)));
  }
  return { samples, diagnostics };
}

function sampleValue(
  ctx: ParseContext,
  model: ModelIR,
  field: FieldIR,
  node: ParsedNode,
  titles: Map<string, string[]>,
  content: ContentIR | undefined,
  row: Record<string, SampleRecordValue>,
): SampleRecordValue | undefined {
  const value = isScalar(node) ? node.value : undefined;
  const wrong = (kind: string) => {
    ctx.error(node, "invalid-value", `"${field.name}" of ${model.name} is ${kind}.`);
    return undefined;
  };
  if (value === null) return null;
  if (field.type.kind === "relation") {
    // The referenced record by its title, or by its number among the generated ones.
    const target = field.type.model;
    if (target === "User") {
      ctx.error(
        node,
        "invalid-value",
        `"${field.name}" is a person who signs in; leave it empty in samples.`,
      );
      return undefined;
    }
    const known = titles.get(target);
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      if (!known || value <= known.length) return value;
      ctx.error(
        node,
        "unknown-record",
        `samples/${target}.yml has ${known.length} records, not ${value}.`,
      );
      return undefined;
    }
    const at = typeof value === "string" ? (known?.indexOf(value) ?? -1) : -1;
    if (at >= 0) return at + 1;
    ctx.error(
      node,
      "unknown-record",
      known
        ? `samples/${target}.yml has no record called "${String(value)}".`
        : `${target} has no samples/${target}.yml; refer to a generated ${humanize(target).toLowerCase()} by its number (1 for the first).`,
      known && typeof value === "string" ? didYouMean(value, known.filter(Boolean)) : undefined,
    );
    return undefined;
  }
  if (field.type.kind === "choice") {
    const labels = content?.models?.[model.name]?.fields?.[field.name]?.values ?? {};
    const choice = field.type.values.find(
      (v) => v === value || labels[v] === value || humanize(v) === value,
    );
    return choice ?? wrong(`one of ${field.type.values.join(", ")}`);
  }
  switch (field.type.name) {
    case "int":
      return typeof value === "number" && Number.isInteger(value) ? value : wrong("a whole number");
    case "decimal":
      return typeof value === "number" ? value : wrong("a number");
    case "money":
      return typeof value === "number" ? Math.round(value * 100) : wrong("an amount, like 12.50");
    case "bool":
      return typeof value === "boolean" ? value : wrong("true or false");
    case "date":
      return typeof value === "string" && DATE.test(value)
        ? value
        : wrong("a date, like 2026-10-05");
    case "datetime":
      return typeof value === "string" && DATETIME.test(value)
        ? value.replace(" ", "T")
        : wrong("a date and time, like 2026-10-05 08:00");
    case "picture":
      return (
        samplePicture(node, model, row) ??
        wrong("a picture: a file name under public/images/samples/, or { file, alt }")
      );
    case "pictures": {
      // Several pictures: a list of them, at most the field's maximum.
      const items = isSeq(node) ? (node.items as ParsedNode[]) : undefined;
      const pictures = items?.map((item) => samplePicture(item, model, row));
      if (!pictures || pictures.some((p) => !p))
        return wrong(
          "a list of pictures: file names under public/images/samples/, or { file, alt }",
        );
      if (pictures.length > (field.max ?? PICTURES_MAX))
        return wrong(`at most ${field.max ?? PICTURES_MAX} pictures`);
      return pictures as SamplePicture[];
    }
    default:
      return typeof value === "string" ? value : wrong("a text");
  }
}

/** A sample picture: a file under public/images/samples/, with a description (or the title). */
function samplePicture(
  node: ParsedNode,
  model: ModelIR,
  row: Record<string, SampleRecordValue>,
): SamplePicture | undefined {
  const title = row[titleField(model)];
  if (isScalar(node) && typeof node.value === "string")
    return {
      picture: node.value,
      alt: `A picture of ${typeof title === "string" ? title : model.name.toLowerCase()}`,
    };
  if (isMap(node)) {
    const file = node.get("file");
    const alt = node.get("alt");
    if (typeof file === "string" && typeof alt === "string") return { picture: file, alt };
  }
  return undefined;
}
