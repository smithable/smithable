import { isScalar, LineCounter, type ParsedNode, parseDocument } from "yaml";
import { checkKeys, type Entry, mapEntries, ParseContext, readString } from "./context.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import type { SpecIR } from "./ir.js";
import { didYouMean } from "./suggest.js";

/**
 * Visible text from smithable.content.yml (ARCHITECTURE §3.3). Everything is optional:
 * texts not listed here are derived from names.
 */
export interface ContentIR {
  models: Record<string, ModelContent>;
  pages: Record<string, { title?: string }>;
  menus: Record<string, { label?: string }>;
}

export interface ModelContent {
  label?: string;
  pluralLabel?: string;
  fields: Record<string, FieldContent>;
}

export interface FieldContent {
  label?: string;
  help?: string;
  values?: Record<string, string>;
}

export const CONTENT_VERSION = "0.1";

export function emptyContent(): ContentIR {
  return { models: {}, pages: {}, menus: {} };
}

/** Parses smithable.content.yml and checks every reference against the spec. */
export function validateContent(
  file: { path: string; text: string },
  ir: SpecIR,
): { content?: ContentIR; diagnostics: Diagnostic[] } {
  const lines = new LineCounter();
  const doc = parseDocument(file.text, {
    lineCounter: lines,
    uniqueKeys: true,
    prettyErrors: false,
  });
  const ctx = new ParseContext(file.path, lines);
  const content = emptyContent();
  const done = () => ({
    ...(hasErrors(ctx.diagnostics) ? {} : { content }),
    diagnostics: [...ctx.diagnostics].sort((a, b) => a.line - b.line || a.column - b.column),
  });

  for (const error of doc.errors) {
    ctx.errorAtOffset(
      error.pos[0],
      error.code === "DUPLICATE_KEY" ? "duplicate-key" : "yaml-syntax",
      error.message.split("\n")[0] ?? "",
    );
  }
  if (hasErrors(ctx.diagnostics)) return done();

  const root = doc.contents as ParsedNode | null;
  const entries = mapEntries(ctx, root, "smithable.content.yml") ?? [];
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const version = byKey.get("smithableContent");
  const versionText = isScalar(version?.value)
    ? (version.value.source ?? String(version.value.value))
    : undefined;
  if (versionText !== CONTENT_VERSION) {
    ctx.error(
      version?.value ?? root,
      "invalid-version",
      `The content file must start with "smithableContent: ${CONTENT_VERSION}".`,
    );
    return done();
  }
  const known = checkKeys(ctx, entries, "smithable.content.yml", {
    allowed: ["smithableContent", "models", "pages", "menus"],
    later: ["actions"],
  });

  for (const { key, value } of known) {
    if (key === "models") readModels(ctx, value, ir, content);
    if (key === "pages") {
      for (const page of named(
        ctx,
        value,
        `"pages"`,
        ir.pages.map((p) => p.id),
        "page",
      )) {
        const texts = readTexts(ctx, page.value, `page "${page.key}"`, ["title"]);
        content.pages[page.key] = texts;
      }
    }
    if (key === "menus") {
      for (const menu of named(
        ctx,
        value,
        `"menus"`,
        ir.navigation.map((m) => m.name),
        "menu",
      )) {
        content.menus[menu.key] = readTexts(ctx, menu.value, `menu "${menu.key}"`, ["label"]);
      }
    }
  }
  return done();
}

function readModels(
  ctx: ParseContext,
  node: ParsedNode | null,
  ir: SpecIR,
  content: ContentIR,
): void {
  for (const model of named(
    ctx,
    node,
    `"models"`,
    ir.models.map((m) => m.name),
    "model",
  )) {
    const spec = ir.models.find((m) => m.name === model.key);
    const where = `model "${model.key}"`;
    const entries = mapEntries(ctx, model.value, where) ?? [];
    const known = checkKeys(ctx, entries, where, { allowed: ["label", "pluralLabel", "fields"] });
    const result: ModelContent = { fields: {} };
    for (const { key, value } of known) {
      if (key === "label" || key === "pluralLabel") {
        const text = readString(ctx, value, `"${key}" of ${where}`);
        if (text !== undefined) result[key] = text;
      }
      if (key !== "fields" || !spec) continue;
      for (const field of named(
        ctx,
        value,
        `the fields of ${where}`,
        spec.fields.map((f) => f.name),
        "field",
      )) {
        const fieldWhere = `field "${model.key}.${field.key}"`;
        const specField = spec.fields.find((f) => f.name === field.key);
        const fieldEntries = mapEntries(ctx, field.value, fieldWhere) ?? [];
        const fieldKnown = checkKeys(ctx, fieldEntries, fieldWhere, {
          allowed: ["label", "help", "values"],
        });
        const texts: FieldContent = readTexts(
          ctx,
          null,
          fieldWhere,
          [],
          fieldKnown.filter((e) => e.key !== "values"),
        );
        const values = fieldKnown.find((e) => e.key === "values");
        if (values) {
          const choices = specField?.type.kind === "choice" ? specField.type.values : [];
          if (choices.length === 0) {
            ctx.error(
              values.keyNode,
              "invalid-key",
              `${capitalize(fieldWhere)} is not a choice field, so it has no values.`,
            );
          } else {
            texts.values = {};
            for (const choice of named(
              ctx,
              values.value,
              `the values of ${fieldWhere}`,
              choices,
              "value",
            )) {
              const text = readString(ctx, choice.value, `The text for "${choice.key}"`);
              if (text !== undefined) texts.values[choice.key] = text;
            }
          }
        }
        result.fields[field.key] = texts;
      }
    }
    content.models[model.key] = result;
  }
}

/** Entries of a mapping whose keys must name things that exist in the spec. */
function named(
  ctx: ParseContext,
  node: ParsedNode | null,
  what: string,
  known: string[],
  kind: string,
): Entry[] {
  const entries = mapEntries(ctx, node, what) ?? [];
  return entries.filter((entry) => {
    if (known.includes(entry.key)) return true;
    ctx.error(
      entry.keyNode,
      `unknown-${kind}`,
      `There is no ${kind} named "${entry.key}" in smithable.yml.`,
      didYouMean(entry.key, known),
    );
    return false;
  });
}

/** Reads plain text keys of a mapping (or the given entries). */
function readTexts(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  allowed: string[],
  given?: Entry[],
): Record<string, string> {
  const entries = given ?? checkKeys(ctx, mapEntries(ctx, node, where) ?? [], where, { allowed });
  const texts: Record<string, string> = {};
  for (const { key, value } of entries) {
    const text = readString(ctx, value, `"${key}" of ${where}`);
    if (text !== undefined) texts[key] = text;
  }
  return texts;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
