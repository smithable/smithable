// A crud page's record as a document (docs/design/record-documents.md §4): blocks that each name
// their fields, printed on /<page>/<id>/document. Nothing is taken over from another page's
// columns or a model's title, so the document holds exactly the named fields.
import type { ParsedNode } from "yaml";
import {
  type At,
  checkKeys,
  mapEntries,
  type ParseContext,
  readNameList,
  readString,
} from "../context.js";
import type { YamlEditor } from "../edit.js";
import type { Expr } from "../formula.js";
import {
  type DocumentIR,
  type FieldIR,
  isUpload,
  type ModelIR,
  type PageIR,
  type SpecIR,
} from "../ir.js";
import type { Refusal } from "../operation.js";
import { sensitiveKind } from "../sensitive.js";
import { didYouMean } from "../suggest.js";

/** The blocks, in the order a document prints them. */
export const DOCUMENT_BLOCKS = ["from", "to", "show", "lines", "totals", "note"] as const;

/** The words a document's page takes from the content file (pages.<page>.document). */
export const DOCUMENT_TEXTS = ["title", "from", "to", "lines", "totals", "note", "print"] as const;

const fieldList = { type: "array", items: { type: "string" } } as const;

export const documentSchema = {
  type: "object",
  required: ["show"],
  additionalProperties: false,
  description:
    "The record as a document, printed or saved as PDF from its page: each block names its fields, and nothing else is on it. One per model.",
  properties: {
    from: {
      ...fieldList,
      description: "Fields of the app's settings model: who the document is from.",
    },
    to: {
      type: "object",
      required: ["ref", "show"],
      additionalProperties: false,
      description: "Who it is for: a reference of the record and fields of its model.",
      properties: {
        ref: {
          type: "string",
          description: "A reference of the record to one record, e.g. client.",
        },
        show: {
          ...fieldList,
          description: "Fields of the referenced record, e.g. [name, address].",
        },
      },
    },
    show: { ...fieldList, description: "Fields of the record, e.g. [number, issued, due]." },
    lines: {
      type: "object",
      required: ["list", "show"],
      additionalProperties: false,
      description: "A list field of the record and the listed model's fields, as a table.",
      properties: {
        list: { type: "string", description: "A list field of the record, e.g. lines." },
        show: { ...fieldList, description: "Fields of each listed record: the table's columns." },
      },
    },
    totals: { ...fieldList, description: "Fields of the record under the lines, e.g. [total]." },
    note: { type: "string", description: "A text field of the record printed at the end." },
  },
} as const;

/** Why a field cannot be on a document, or undefined when it can. */
function notPrintable(f: FieldIR): string | undefined {
  if (isUpload(f)) return "holds files or pictures";
  if (sensitiveKind(f)) return "looks like a card number, a password or an identity number";
  if (f.type.kind === "relation" && f.type.many) return "lists other records";
  return undefined;
}

/**
 * Why a worked-out field cannot be on a document: one of the fields it is worked out from,
 * directly or through other worked-out fields and the lists it adds up, could not be.
 */
function inputRefused(
  expr: Expr,
  model: ModelIR,
  models: readonly ModelIR[],
  seen: Set<string>,
): string | undefined {
  const field = (m: ModelIR, name: string): string | undefined => {
    const f = m.fields.find((x) => x.name === name);
    if (!f || seen.has(`${m.name}.${name}`)) return undefined;
    seen.add(`${m.name}.${name}`);
    if (isUpload(f) || sensitiveKind(f))
      return `is worked out from ${m.name}.${name}, which ${notPrintable(f)}`;
    return f.formula ? inputRefused(f.formula, m, models, seen) : undefined;
  };
  switch (expr.kind) {
    case "field":
      return field(model, expr.name);
    case "unary":
      return inputRefused(expr.operand, model, models, seen);
    case "binary":
      return (
        inputRefused(expr.left, model, models, seen) ??
        inputRefused(expr.right, model, models, seen)
      );
    case "call":
      for (const arg of expr.args) {
        const why = inputRefused(arg, model, models, seen);
        if (why) return why;
      }
      return undefined;
    case "aggregate": {
      const type = model.fields.find((x) => x.name === expr.list)?.type;
      const listed =
        type?.kind === "relation" ? models.find((m) => m.name === type.model) : undefined;
      if (!listed) return undefined;
      return (
        (expr.field ? field(listed, expr.field) : undefined) ??
        (expr.value ? inputRefused(expr.value, listed, models, seen) : undefined)
      );
    }
    default:
      return undefined;
  }
}

/** Fields of `model` named in a block: each one there and printable. Reports and drops the rest. */
function checkFields(
  ctx: ParseContext,
  names: { name: string; at: At }[],
  model: ModelIR,
  models: readonly ModelIR[],
  what: string,
): string[] {
  const kept: string[] = [];
  for (const { name, at } of names) {
    const f = model.fields.find((x) => x.name === name);
    if (!f) {
      ctx.error(
        at,
        "invalid-document",
        `${what} names "${name}", which is no field of ${model.name}.`,
        didYouMean(
          name,
          model.fields.map((x) => x.name),
        ),
      );
      continue;
    }
    const why =
      notPrintable(f) ??
      (f.formula ? inputRefused(f.formula, model, models, new Set()) : undefined);
    if (why) {
      ctx.error(
        at,
        "invalid-document",
        `${model.name}.${name} ${why}, so it cannot be on a document.`,
      );
      continue;
    }
    if (!kept.includes(name)) kept.push(name);
  }
  return kept;
}

/** A document's `from`, kept with where it was written until the settings page is known. */
export interface PendingFrom {
  page: string;
  names: { name: string; at: At }[];
  at: At;
}

/**
 * A crud page's `document`: the blocks of `model`, checked against it. `from` is checked once
 * every page is read (checkDocuments), since it names fields of the settings page's model.
 */
export function readDocument(
  ctx: ParseContext,
  node: ParsedNode | null,
  keyNode: At,
  page: string,
  modelName: string,
  parsed: Partial<SpecIR>,
  pending: PendingFrom[],
): DocumentIR | undefined {
  const where = `"document" of page "${page}"`;
  const models = parsed.models ?? [];
  const model = models.find((m) => m.name === modelName);
  const entries = mapEntries(ctx, node, where);
  if (!entries || !model) return undefined;
  const known = checkKeys(ctx, entries, where, {
    allowed: [...DOCUMENT_BLOCKS],
    content: ["title", "heading"],
  });
  const byKey = new Map(known.map((e) => [e.key, e]));
  const list = (value: At, of: ModelIR, what: string) =>
    checkFields(ctx, readNameList(ctx, value, what), of, models, what);
  const doc: DocumentIR = { show: [] };
  const show = byKey.get("show");
  if (!show)
    ctx.error(keyNode, "missing-key", `${where} needs "show": the record's fields it prints.`);
  else doc.show = list(show.value, model, `"show" of ${where}`);
  const totals = byKey.get("totals");
  if (totals) {
    const names = list(totals.value, model, `"totals" of ${where}`);
    if (names.length) doc.totals = names;
  }
  const note = byKey.get("note");
  if (note) {
    const name = readString(ctx, note.value, `"note" of ${where}`);
    const f = name === undefined ? undefined : model.fields.find((x) => x.name === name);
    if (
      name !== undefined &&
      (f?.type.kind !== "scalar" || !["string", "text", "markdown"].includes(f.type.name))
    )
      ctx.error(
        note.value,
        "invalid-document",
        `"note" of ${where} is one text field of ${model.name}${f ? `; ${name} is not text` : `, and it has no field "${name}"`}.`,
      );
    else if (
      name !== undefined &&
      f &&
      checkFields(ctx, [{ name, at: note.value }], model, models, `"note" of ${where}`).length
    )
      doc.note = name;
  }
  const to = byKey.get("to");
  if (to) {
    const what = `"to" of ${where}`;
    const parts = new Map(
      checkKeys(ctx, mapEntries(ctx, to.value, what) ?? [], what, { allowed: ["ref", "show"] }).map(
        (e) => [e.key, e],
      ),
    );
    const refEntry = parts.get("ref");
    const ref = refEntry ? readString(ctx, refEntry.value, `"ref" of ${what}`) : undefined;
    const f = ref === undefined ? undefined : model.fields.find((x) => x.name === ref);
    const target =
      f?.type.kind === "relation" && !f.type.many && !f.formula
        ? models.find((m) => m.name === (f.type.kind === "relation" ? f.type.model : ""))
        : undefined;
    if (!refEntry || !parts.get("show"))
      ctx.error(
        to.value,
        "missing-key",
        `${what} is { ref: <a reference of ${model.name}>, show: [fields] }.`,
      );
    else if (ref !== undefined && !target)
      ctx.error(
        refEntry.value,
        "invalid-document",
        `${what} names "${ref}", which is no reference of ${model.name} to one record.`,
      );
    else if (ref !== undefined && target) {
      const names = list(parts.get("show")?.value ?? null, target, `"show" of ${what}`);
      if (names.length) doc.to = { ref, show: names };
    }
  }
  const lines = byKey.get("lines");
  if (lines) {
    const what = `"lines" of ${where}`;
    const parts = new Map(
      checkKeys(ctx, mapEntries(ctx, lines.value, what) ?? [], what, {
        allowed: ["list", "show"],
      }).map((e) => [e.key, e]),
    );
    const listEntry = parts.get("list");
    const name = listEntry ? readString(ctx, listEntry.value, `"list" of ${what}`) : undefined;
    const f = name === undefined ? undefined : model.fields.find((x) => x.name === name);
    const listed =
      f?.type.kind === "relation" && f.type.many
        ? models.find((m) => m.name === (f.type.kind === "relation" ? f.type.model : ""))
        : undefined;
    if (!listEntry || !parts.get("show"))
      ctx.error(
        lines.value,
        "missing-key",
        `${what} is { list: <a list field of ${model.name}>, show: [fields] }.`,
      );
    else if (name !== undefined && !listed)
      ctx.error(
        listEntry.value,
        "invalid-document",
        `${what} names "${name}", which is no list field of ${model.name}.`,
      );
    else if (name !== undefined && listed) {
      const names = list(parts.get("show")?.value ?? null, listed, `"show" of ${what}`);
      if (names.length) doc.lines = { list: name, show: names };
    }
  }
  const from = byKey.get("from");
  if (from)
    pending.push({
      page,
      names: readNameList(ctx, from.value, `"from" of ${where}`),
      at: from.value,
    });
  return doc;
}

/**
 * Once every page is read: `from` names fields of the settings page's model (refused without
 * one), and a model has at most one document, so a link to "the document" means one page.
 */
export function checkDocuments(
  ctx: ParseContext,
  pages: PageIR[],
  pending: PendingFrom[],
  parsed: Partial<SpecIR>,
  at: (page: string) => At,
): void {
  const models = parsed.models ?? [];
  const settings = pages.find((p) => p.pattern.kind === "settings");
  const settingsModel =
    settings?.pattern.kind === "settings"
      ? models.find(
          (m) => settings.pattern.kind === "settings" && m.name === settings.pattern.model,
        )
      : undefined;
  for (const p of pending) {
    const page = pages.find((x) => x.id === p.page);
    if (!page?.document) continue;
    if (!settingsModel) {
      ctx.error(
        p.at,
        "invalid-document",
        `"from" of page "${p.page}"'s document names fields of the app's settings, and the app has no settings page.`,
        "Add a settings page (a page with settings: <Model>), or leave out from: the app's name is printed.",
      );
      continue;
    }
    const names = checkFields(
      ctx,
      p.names,
      settingsModel,
      models,
      `"from" of page "${p.page}"'s document`,
    );
    if (names.length) page.document.from = names;
  }
  const byModel = new Map<string, string>();
  for (const page of pages) {
    if (!page.document || page.pattern.kind !== "crud") continue;
    const other = byModel.get(page.pattern.model);
    if (other)
      ctx.error(
        at(page.id),
        "invalid-document",
        `Pages "${other}" and "${page.id}" both give ${page.pattern.model} a document; a model has one.`,
      );
    else byModel.set(page.pattern.model, page.id);
  }
}

/**
 * A document follows a renamed field and loses a removed one: a block left with no fields goes,
 * and so do `to` and `lines` when their reference or list goes, and `note` with its field. The
 * record's own fields cannot all go: that is refused, so the document is not lost unasked.
 */
export function followDocument(
  spec: YamlEditor,
  page: PageIR,
  f: { model: string; from: string; to?: string },
  ir: SpecIR,
): Refusal | undefined {
  const doc = page.document;
  if (!doc || page.pattern.kind !== "crud") return undefined;
  const own = page.pattern.model;
  const base = ["pages", page.id, "document"];
  if (f.model === own && !f.to && doc.show.length === 1 && doc.show[0] === f.from)
    return {
      refusal: `The ${page.id} page's document shows only ${own}.${f.from}; give its "show" another field first, or remove the document.`,
    };
  const model = ir.models.find((m) => m.name === own);
  const target = (name: string) => {
    const type = model?.fields.find((x) => x.name === name)?.type;
    return type?.kind === "relation" ? type.model : undefined;
  };
  const settings = ir.pages.find((p) => p.pattern.kind === "settings")?.pattern;
  const lists: [string[], string | undefined, string[] | undefined][] = [
    [["show"], own, doc.show],
    [["totals"], own, doc.totals],
    [["from"], settings?.kind === "settings" ? settings.model : undefined, doc.from],
    [["to", "show"], doc.to && target(doc.to.ref), doc.to?.show],
    [["lines", "show"], doc.lines && target(doc.lines.list), doc.lines?.show],
  ];
  for (const [path, of, names] of lists) {
    if (of !== f.model || !names?.includes(f.from)) continue;
    const next = f.to
      ? names.map((n) => (n === f.from ? (f.to as string) : n))
      : names.filter((n) => n !== f.from);
    // An emptied `to` or `lines` goes whole; an emptied list of the record's goes alone.
    if (next.length) spec.set([...base, ...path], next);
    else spec.removeAndPrune([...base, ...(path.length > 1 ? path.slice(0, 1) : path)], 3);
  }
  if (f.model !== own) return undefined;
  for (const [key, name] of [
    ["to", doc.to?.ref],
    ["lines", doc.lines?.list],
  ] as const) {
    if (name !== f.from) continue;
    const path = [...base, key, key === "to" ? "ref" : "list"];
    if (f.to) spec.set(path, f.to);
    else spec.removeAndPrune([...base, key], 3);
  }
  if (doc.note === f.from) {
    if (f.to) spec.set([...base, "note"], f.to);
    else spec.removeAndPrune([...base, "note"], 3);
  }
  return undefined;
}
