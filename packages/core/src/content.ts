import { isScalar, isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
import { checkKeys, type Entry, mapEntries, ParseContext, readString } from "./context.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import { patternInfo, type SpecIR } from "./ir.js";
import { capitalize } from "./naming.js";
import { didYouMean } from "./suggest.js";

/**
 * Visible text from smithable.content.yml (ARCHITECTURE §3.3). Everything is optional:
 * texts not listed here are derived from names.
 */
export interface ContentIR {
  models: Record<string, ModelContent>;
  pages: Record<string, PageContent>;
  menus: Record<string, { label?: string }>;
}

export interface PageContent {
  title?: string;
  /** A line under the title, e.g. "Keep every relationship in view." */
  subtitle?: string;
  /** Texts of a landing page's sections and a dashboard's tiles, by name. */
  sections?: Record<string, SectionContent>;
}

export interface SectionContent {
  title?: string;
  subtitle?: string;
  text?: string;
  button?: string;
  label?: string;
  /** A contact section's details; hours one per line, thanks once the form is sent. */
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
  thanks?: string;
  /** Features, plans, testimonials or questions, depending on the section. */
  items?: Record<string, string | string[] | ContentImage>[];
  /** A hero's picture: a file in the app's public/images/, and what it shows. */
  image?: ContentImage;
}

export interface ContentImage {
  src: string;
  alt: string;
}

/** A picture's file, relative to the app's public/ folder. */
const IMAGE_SRC = /^images\/([\w-][\w.-]*\/)*[\w-][\w.-]*\.(webp|avif|jpe?g|png)$/;

/** The texts each kind of section takes, and the keys of its items. */
const SECTION_TEXTS: Record<string, { texts: string[]; items?: string[]; image?: true }> = {
  hero: { texts: ["title", "subtitle", "button"], image: true },
  features: { texts: ["title", "text"], items: ["title", "text"] },
  records: { texts: ["title", "text"] },
  pricing: {
    texts: ["title", "text"],
    items: ["name", "price", "period", "text", "features", "button"],
  },
  testimonials: { texts: ["title"], items: ["quote", "name", "role"] },
  faq: { texts: ["title"], items: ["question", "answer"] },
  callToAction: { texts: ["title", "text", "button"] },
  // Opening hours one per line; "thanks" is shown once a visitor has sent the form.
  contact: {
    texts: ["title", "text", "address", "phone", "email", "hours", "button", "thanks"],
  },
  gallery: { texts: ["title", "text"], items: ["image", "caption"] },
  // A link is a page's address ("/pricing") or a full one ("https://…", "mailto:…").
  footer: { texts: ["text"], items: ["label", "link"] },
  tile: { texts: ["label"] },
  step: { texts: ["title", "text"] },
};

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
        content.pages[page.key] = readPage(ctx, page.value, page.key, ir);
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

/** A page's title, and the texts of its landing sections or dashboard tiles. */
function readPage(ctx: ParseContext, node: ParsedNode | null, id: string, ir: SpecIR): PageContent {
  const where = `page "${id}"`;
  const page = ir.pages.find((p) => p.id === id);
  const parts = page ? patternInfo(page).parts() : {};
  const result: PageContent = {};
  for (const entry of mapEntries(ctx, node, where) ?? []) {
    if (entry.key === "title" || entry.key === "subtitle") {
      const text = readString(ctx, entry.value, `"${entry.key}" of ${where}`);
      if (text !== undefined) result[entry.key] = text;
      continue;
    }
    const kind = parts[entry.key];
    const rules = kind === undefined ? undefined : SECTION_TEXTS[kind];
    if (!rules) {
      ctx.error(
        entry.keyNode,
        "unknown-key",
        `${capitalize(where)} has no title, subtitle, section or tile named "${entry.key}".`,
        didYouMean(entry.key, ["title", "subtitle", ...Object.keys(parts)]),
      );
      continue;
    }
    const partWhere = `"${entry.key}" of ${where}`;
    const known = checkKeys(ctx, mapEntries(ctx, entry.value, partWhere) ?? [], partWhere, {
      allowed: [
        ...rules.texts,
        ...(rules.items ? ["items"] : []),
        ...(rules.image ? ["image"] : []),
      ],
    });
    const section: SectionContent = readTexts(
      ctx,
      null,
      partWhere,
      [],
      known.filter((e) => e.key !== "items" && e.key !== "image"),
    );
    const items = known.find((e) => e.key === "items");
    if (items && rules.items) section.items = readItems(ctx, items.value, partWhere, rules.items);
    const image = known.find((e) => e.key === "image");
    if (image) {
      const read = readImage(ctx, image.value, `the image of ${partWhere}`);
      if (read) section.image = read;
    }
    result.sections = { ...result.sections, [entry.key]: section };
  }
  return result;
}

/** A picture: `{ src: images/<file>, alt: <what it shows> }`. */
function readImage(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
): ContentImage | undefined {
  const { src, alt } = readTexts(ctx, node, where, ["src", "alt"]);
  if (!src || !IMAGE_SRC.test(src)) {
    ctx.error(
      node,
      "invalid-value",
      `"src" of ${where} must be a file in the app's public/images/ folder, e.g. images/hero.webp (webp, avif, jpg or png).`,
    );
    return undefined;
  }
  if (!alt) {
    ctx.error(
      node,
      "invalid-value",
      `${capitalize(where)} needs "alt": what it shows, for people who cannot see it.`,
    );
    return undefined;
  }
  return { src, alt };
}

/** A list of items, each a mapping of texts; a pricing plan's features are a list of texts. */
function readItems(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  allowed: string[],
): Record<string, string | string[] | ContentImage>[] {
  if (!isSeq(node)) {
    ctx.error(node, "invalid-value", `"items" of ${where} must be a list.`);
    return [];
  }
  return node.items.map((item, i) => {
    const itemWhere = `item ${i + 1} of ${where}`;
    const texts: Record<string, string | string[] | ContentImage> = {};
    for (const { key, value } of checkKeys(
      ctx,
      mapEntries(ctx, item as ParsedNode, itemWhere) ?? [],
      itemWhere,
      { allowed },
    )) {
      if (key === "image") {
        const image = readImage(ctx, value, `the image of ${itemWhere}`);
        if (image) texts[key] = image;
      } else if (key === "link") {
        const link = readString(ctx, value, `"link" of ${itemWhere}`);
        if (link !== undefined && !/^(\/|https?:\/\/|mailto:|tel:)/.test(link))
          ctx.error(
            value,
            "invalid-value",
            `"link" of ${itemWhere} must be a page's address like /pricing, or start with https://, mailto: or tel:.`,
          );
        else if (link !== undefined) texts[key] = link;
      } else if (key === "features" && isSeq(value)) {
        texts[key] = value.items.flatMap((f) => {
          const text = readString(ctx, f as ParsedNode, `a feature of ${itemWhere}`);
          return text === undefined ? [] : [text];
        });
      } else {
        const text = readString(ctx, value, `"${key}" of ${itemWhere}`);
        if (text !== undefined) texts[key] = text;
      }
    }
    return texts;
  });
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
