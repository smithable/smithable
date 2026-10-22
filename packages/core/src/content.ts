import { isScalar, isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
import {
  checkKeys,
  type Entry,
  mapEntries,
  ParseContext,
  readBoolean,
  readString,
} from "./context.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import type { SpecIR } from "./ir.js";
import { capitalize, humanize, plural } from "./naming.js";
import { patternInfo } from "./patterns.js";
import { didYouMean } from "./suggest.js";

/**
 * Visible text from smithable.content.yml (ARCHITECTURE §3.3). Everything is optional:
 * texts not listed here are derived from names.
 */
/** The languages the app kit has words for (docs/design/language.md §3); the first is the default. */
export const LANGUAGES = ["en", "sv"] as const;
export type Language = (typeof LANGUAGES)[number];

export interface ContentIR {
  /** The language of everything a person reads in the app: the kit's words follow it. */
  language: Language;
  /**
   * The other languages the app is offered in (docs/design/languages.md §2), each with its own
   * file, smithable.content.<language>.yml, of the same keys.
   */
  languages?: Language[];
  /** Each other language's texts, read from its file by the host; the app's own where one is empty. */
  translations?: Partial<Record<Language, ContentIR>>;
  /** The app's mark, before its name in the shell and the landing header, and its tab icon. */
  logo?: ContentImage;
  models: Record<string, ModelContent>;
  pages: Record<string, PageContent>;
  menus: Record<string, { label?: string }>;
  /** An action's button and page title (label, else its name in words) and what it does (help: its tooltip and its dialog's line), by its name in smithable.yml. */
  actions: Record<string, { label?: string; help?: string }>;
  /** An outgoing mail's subject and the text above the record (integrations.md §4.1b). */
  outgoing: Record<string, { subject?: string; text?: string }>;
  /** The consent bar's own words (docs/design/analytics.md §3), where the kit's are not wanted. */
  consent?: { text?: string; accept?: string; decline?: string };
  /**
   * Ask, the assistant in the app (docs/design/ask-defaults.md §2): the panel's name, the first
   * line it shows, the input's placeholder, and one sentence of what it is for (shown under the
   * greeting and given to the model). The kit's words where none is said.
   */
  assistant?: AssistantTexts;
}

export interface AssistantTexts {
  name?: string;
  greeting?: string;
  placeholder?: string;
  about?: string;
}

/** The assistant's texts, in the order the operation and the file give them. */
export const ASSISTANT_TEXTS = ["name", "greeting", "placeholder", "about"] as const;

export interface PageContent {
  title?: string;
  /** A line under the title, e.g. "Keep every relationship in view." */
  subtitle?: string;
  /** What search engines show under the page's name (its meta description); public pages. */
  description?: string;
  /** Texts of a landing page's sections and a dashboard's tiles, by name. */
  sections?: Record<string, SectionContent>;
  /** A calculator page's fields' labels and help. */
  fields?: Record<string, FieldContent>;
  /** The headings of a form's sections (smithable.ux.yml), by section name. */
  formSections?: Record<string, { title?: string }>;
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
  /** A privacy page's operator: who runs the app, their country, where it is hosted. */
  name?: string;
  country?: string;
  hosting?: string;
  /** Features, plans, testimonials or questions, depending on the section. */
  items?: Record<string, string | string[] | ContentImage>[];
  /** A calculator section's results heading, and its fields' labels and help. */
  results?: string;
  fields?: Record<string, FieldContent>;
  /** A hero's picture: a file in the app's public/images/, and what it shows. */
  image?: ContentImage;
}

export interface ContentImage {
  src: string;
  alt: string;
  /** Made by an AI (the image library's pictures): the app says so on pictures that could pass for photographs. */
  generated?: true;
}

/** A picture's file, relative to the app's public/ folder. */
const IMAGE_SRC = /^images\/([\w-][\w.-]*\/)*[\w-][\w.-]*\.(webp|avif|jpe?g|png)$/;
/** A mark's file: a picture's, or an SVG (a maker's own logo usually is one). */
export const LOGO_SRC = /^images\/([\w-][\w.-]*\/)*[\w-][\w.-]*\.(webp|avif|jpe?g|png|svg)$/;

/** The texts each kind of section takes, and the keys of its items. */
const SECTION_TEXTS: Record<
  string,
  { texts: string[]; items?: string[]; image?: true; fields?: true }
> = {
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
  // A calculator section: its heading, the results' heading, and its fields' labels and help.
  calculator: { texts: ["title", "text", "results"], fields: true },
  custom: { texts: ["title", "text"] },
  // A text section: a heading and its paragraphs.
  text: { texts: ["title", "text"] },
  // A calculator page's results heading.
  results: { texts: ["title"] },
  // A link is a page's address ("/pricing") or a full one ("https://…", "mailto:…").
  footer: { texts: ["text"], items: ["label", "link"] },
  tile: { texts: ["label"] },
  step: { texts: ["title", "text"] },
  // A privacy page's operator: who runs the app and how to reach them, and where it is hosted.
  operator: { texts: ["name", "address", "email", "country", "hosting"] },
};

export interface ModelContent {
  label?: string;
  pluralLabel?: string;
  fields: Record<string, FieldContent>;
  /** The reservation block's words, for a model with a capacity. */
  reserve?: Record<string, string>;
}

/** The reservation block's texts: the buttons, and what it says when full or booked. */
export const RESERVE_TEXTS = ["book", "cancel", "full", "booked"];

export interface FieldContent {
  label?: string;
  help?: string;
  values?: Record<string, string>;
}

export const CONTENT_VERSION = "0.1";

export function emptyContent(): ContentIR {
  return { language: LANGUAGES[0], models: {}, pages: {}, menus: {}, actions: {}, outgoing: {} };
}

/**
 * Keys of the content file whose values no person reads as words: a picture's file, an address
 * to go to, the operator's contact details, numbers. Not texts to translate, and not in a
 * language file (docs/design/languages.md §2).
 */
export const NOT_TEXT = new Set([
  "src",
  "link",
  "to",
  "href",
  "icon",
  "for",
  "generated",
  "email",
  "phone",
  "vatNumber",
  "paymentTermDays",
]);

/**
 * A key and its value that no person reads: a plain value under a NOT_TEXT key. A field named
 * email holds an object, and a choice's values (under `values`) are always texts.
 */
export const notText = (key: string, value: unknown, parent?: string) =>
  parent !== "values" && NOT_TEXT.has(key) && (value === null || typeof value !== "object");

/**
 * Every text of a content file by its path (pages.home.title), the app's languages and its
 * mark aside: what a language file has to say again.
 */
export function textPaths(content: ContentIR): Map<string, string> {
  const paths = new Map<string, string>();
  const walk = (value: unknown, at: string) => {
    if (typeof value === "string") paths.set(at, value);
    else if (value && typeof value === "object")
      for (const [key, inner] of Object.entries(value))
        if (!notText(key, inner, at.split(".").at(-1))) walk(inner, at ? `${at}.${key}` : key);
  };
  for (const [key, value] of Object.entries(content))
    if (!["language", "languages", "translations", "logo"].includes(key)) walk(value, key);
  return paths;
}

/**
 * Every text a person reads that a language file can say again, by its path: the content
 * file's own and those derived from names (a model's label and plural, a field's label, a
 * choice's values, a page's title, an action's button), each with the app's words for it.
 */
export function textsToTranslate(content: ContentIR, ir: SpecIR): Map<string, string> {
  const texts = derivedTexts(ir);
  for (const [path, text] of textPaths(content)) texts.set(path, text);
  return texts;
}

/** The texts the app derives from names, by their path in the content file, each in its words. */
export function derivedTexts(ir: SpecIR): Map<string, string> {
  const derived = new Map<string, string>();
  for (const model of ir.models) {
    const label = humanize(model.name);
    derived.set(`models.${model.name}.label`, label);
    derived.set(`models.${model.name}.pluralLabel`, plural(label));
    for (const field of model.fields) {
      derived.set(`models.${model.name}.fields.${field.name}.label`, humanize(field.name));
      if (field.type.kind === "choice")
        for (const value of field.type.values)
          derived.set(`models.${model.name}.fields.${field.name}.values.${value}`, humanize(value));
    }
  }
  for (const page of ir.pages) derived.set(`pages.${page.id}.title`, humanize(page.id));
  // A menu's heading in the navigation (the main menu has none).
  for (const menu of ir.navigation)
    if (menu.name !== "main") derived.set(`menus.${menu.name}.label`, humanize(menu.name));
  for (const action of ir.actions)
    derived.set(`actions.${action.name}.label`, humanize(action.name));
  return derived;
}

/**
 * A language's texts by the app's own (docs/design/languages.md §4, gettext's model): each text
 * of textsToTranslate the language file says, keyed by the text in the app's language, and in
 * lower case beside it for the words the kit puts in a sentence ("New customer"). An empty
 * translation is left out, so the app's own shows. Two texts alike with different translations
 * take the one whose path sorts first; `shared` names them.
 */
export function translationMap(
  content: ContentIR,
  translation: ContentIR,
  ir: SpecIR,
): { texts: Record<string, string>; shared: { text: string; paths: [string, string][] }[] } {
  const own = textsToTranslate(content, ir);
  const said = textPaths(translation);
  const texts: Record<string, string> = {};
  const from = new Map<string, [string, string][]>();
  for (const path of [...own.keys()].sort()) {
    const text = own.get(path) as string;
    const word = said.get(path)?.trim();
    if (!word) continue;
    from.set(text, [...(from.get(text) ?? []), [path, word]]);
    if (!(text in texts)) texts[text] = word;
  }
  // Then the lower-case variants, only where no text of its own is that already.
  for (const [text, word] of Object.entries({ ...texts })) {
    const lower = text.toLowerCase();
    if (!(lower in texts)) texts[lower] = word.toLowerCase();
  }
  const shared = [...from]
    .filter(([, ways]) => new Set(ways.map(([, w]) => w)).size > 1)
    .map(([text, paths]) => ({ text, paths }));
  return { texts, shared };
}

/** Parses smithable.content.yml and checks every reference against the spec. */
export function validateContent(
  file: { path: string; text: string },
  ir: SpecIR,
  /** A language file (smithable.content.<language>.yml): the content file it translates. */
  translation?: { of: ContentIR; language: Language },
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
    allowed: [
      "smithableContent",
      // A language file holds the texts only: the app's languages and its mark are the content file's.
      ...(translation ? [] : ["language", "languages", "logo"]),
      "models",
      "pages",
      "menus",
      "actions",
      "consent",
      "outgoing",
      "assistant",
    ],
  });

  if (translation) {
    content.language = translation.language;
    ctx.emptyTexts = true;
  }
  // Where each model's entry is, for a warning about the model.
  const modelKeys = new Map<string, ParsedNode>();
  for (const { key, value } of known) {
    if (key === "language") {
      const language = readString(ctx, value, '"language"');
      if (language === undefined) continue;
      if ((LANGUAGES as readonly string[]).includes(language))
        content.language = language as Language;
      else
        ctx.error(
          value,
          "unknown-language",
          `The app kit has no words in "${language}". Languages: ${LANGUAGES.join(", ")}.`,
        );
    }
    if (key === "languages") {
      const given = isSeq(value) ? value.items : [];
      if (!isSeq(value))
        ctx.error(
          value,
          "invalid-languages",
          '"languages" is a list of language codes, e.g. [sv].',
        );
      const languages: Language[] = [];
      for (const item of given as ParsedNode[]) {
        const code = isScalar(item) ? String(item.value) : "";
        if (!(LANGUAGES as readonly string[]).includes(code))
          ctx.error(
            item,
            "unknown-language",
            `The app kit has no words in "${code}". Languages: ${LANGUAGES.join(", ")}.`,
          );
        else if (languages.includes(code as Language))
          ctx.error(item, "invalid-languages", `"${code}" is in "languages" twice.`);
        else languages.push(code as Language);
      }
      content.languages = languages;
    }
    if (key === "logo") {
      const { src, alt, generated } = readPicture(ctx, value, '"logo"');
      if (!src || !LOGO_SRC.test(src))
        ctx.error(
          value,
          "logo-src",
          '"src" of "logo" must be a file in the app\'s public/images/ folder, e.g. images/logo.webp (webp, avif, jpg, png or svg).',
        );
      else if (!alt) ctx.error(value, "logo-alt", '"logo" needs "alt": what the mark shows.');
      else content.logo = { src, alt, ...(generated ? { generated } : {}) };
    }
    if (key === "consent")
      content.consent = readTexts(ctx, value, '"consent"', ["text", "accept", "decline"]);
    if (key === "assistant")
      content.assistant = readTexts(ctx, value, '"assistant"', [...ASSISTANT_TEXTS]);
    if (key === "models") readModels(ctx, value, ir, content, modelKeys);
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
    if (key === "actions") {
      for (const action of named(
        ctx,
        value,
        `"actions"`,
        ir.actions.map((a) => a.name),
        "action",
      )) {
        content.actions[action.key] = readTexts(ctx, action.value, `action "${action.key}"`, [
          "label",
          "help",
        ]);
      }
    }
    if (key === "outgoing") {
      for (const o of named(
        ctx,
        value,
        `"outgoing"`,
        ir.outgoing.map((x) => x.name),
        "outgoing",
      )) {
        content.outgoing[o.key] = readTexts(ctx, o.value, `outgoing "${o.key}"`, [
          "subject",
          "text",
        ]);
      }
    }
  }
  // The app's own language is not one of its others.
  if (content.languages?.includes(content.language))
    ctx.error(
      byKey.get("languages")?.value ?? root,
      "invalid-languages",
      `"${content.language}" is the app's own language ("language"), not one of "languages".`,
    );
  // A language file has the content file's texts and no others; one it lacks shows in the
  // app's language, said once with the count.
  if (translation) {
    // Texts only: what no person reads stays the content file's.
    const found: string[] = [];
    const walk = (value: unknown, at: string) => {
      if (value && typeof value === "object")
        for (const [key, inner] of Object.entries(value)) {
          const path = at ? `${at}.${key}` : key;
          if (notText(key, inner, at.split(".").at(-1))) found.push(path);
          else walk(inner, path);
        }
    };
    walk(doc.toJS(), "");
    if (found.length)
      ctx.error(
        root,
        "unknown-key",
        `A language file holds texts only, and ${found.slice(0, 3).join(", ")}${found.length > 3 ? ", …" : ""} ${found.length === 1 ? "is" : "are"} not one: ${found.length === 1 ? "it stays" : "they stay"} in smithable.content.yml.`,
      );
    const here = textPaths(content);
    const missing = [...textsToTranslate(translation.of, ir).keys()].filter(
      (path) => !here.get(path)?.trim(),
    );
    // One text, two translations: the app can show only one (languages.md §4).
    for (const { text, paths } of translationMap(translation.of, content, ir).shared)
      ctx.warning(
        root,
        "text-shared",
        `The text "${text}" has different words here (${paths.map(([p, w]) => `${p}: ${w}`).join(", ")}); the app shows "${paths[0]?.[1]}" for both.`,
      );
    if (missing.length)
      ctx.warning(
        root,
        "text-untranslated",
        `${missing.length} ${missing.length === 1 ? "text is" : "texts are"} not in ${file.path} yet (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ", …" : ""}): they show in the app's language until they are.`,
      );
    return done();
  }
  // In another language a plural made by an English rule reads wrong: each model says its own.
  // The warning sits on the model's entry when it has one, else on the language key.
  if (content.language !== "en")
    for (const model of ir.models)
      if (!content.models[model.name]?.pluralLabel)
        ctx.warning(
          modelKeys.get(model.name) ?? byKey.get("language")?.keyNode ?? root,
          "plural-in-english",
          `${model.name}: the plural would be made by an English rule ("${plural(content.models[model.name]?.label ?? humanize(model.name))}"); give it a pluralLabel.`,
        );
  // A privacy page says who runs the app: without the operator's name it says so to visitors.
  for (const page of ir.pages)
    if (page.pattern.kind === "legal" && !content.pages[page.id]?.sections?.operator?.name)
      ctx.warning(
        byKey.get("pages")?.value ?? byKey.get("language")?.keyNode ?? root,
        "operator-unknown",
        `The privacy page "${page.id}" does not say who runs the app: give the operator's name under pages.${page.id}.operator (name, address, email, country, hosting).`,
      );
  return done();
}

function readModels(
  ctx: ParseContext,
  node: ParsedNode | null,
  ir: SpecIR,
  content: ContentIR,
  modelKeys: Map<string, ParsedNode>,
): void {
  for (const model of named(
    ctx,
    node,
    `"models"`,
    ir.models.map((m) => m.name),
    "model",
  )) {
    modelKeys.set(model.key, model.keyNode);
    const spec = ir.models.find((m) => m.name === model.key);
    const where = `model "${model.key}"`;
    const entries = mapEntries(ctx, model.value, where) ?? [];
    const known = checkKeys(ctx, entries, where, {
      allowed: ["label", "pluralLabel", "fields", "reserve"],
    });
    const result: ModelContent = { fields: {} };
    for (const { key, value, keyNode } of known) {
      if (key === "label" || key === "pluralLabel") {
        const text = readString(ctx, value, `"${key}" of ${where}`);
        if (text !== undefined) result[key] = text;
      }
      if (key === "reserve") {
        if (spec && !spec.capacity)
          ctx.error(
            keyNode,
            "invalid-key",
            `${capitalize(where)} has no capacity, so nothing is reserved on it.`,
          );
        else result.reserve = readTexts(ctx, value, `"reserve" of ${where}`, RESERVE_TEXTS);
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
  const calculatorFields =
    page?.pattern.kind === "calculator" ? page.pattern.calculator.fields : undefined;
  for (const entry of mapEntries(ctx, node, where) ?? []) {
    if (entry.key === "title" || entry.key === "subtitle" || entry.key === "description") {
      const text = readString(ctx, entry.value, `"${entry.key}" of ${where}`);
      if (text !== undefined) result[entry.key] = text;
      continue;
    }
    if (entry.key === "fields" && calculatorFields) {
      result.fields = readFieldTexts(ctx, entry.value, `the fields of ${where}`, calculatorFields);
      continue;
    }
    if (
      entry.key === "form" &&
      (page?.pattern.kind === "crud" ||
        page?.pattern.kind === "settings" ||
        page?.pattern.kind === "onboarding")
    ) {
      // form: { sections: { contact: { title: How to reach them } } }
      const formWhere = `"form" of ${where}`;
      const form = checkKeys(ctx, mapEntries(ctx, entry.value, formWhere) ?? [], formWhere, {
        allowed: ["sections"],
      });
      const sections = form.find((e) => e.key === "sections");
      if (sections) {
        result.formSections = {};
        for (const section of mapEntries(ctx, sections.value, `"sections" of ${formWhere}`) ?? [])
          result.formSections[section.key] = readTexts(
            ctx,
            section.value,
            `section "${section.key}" of ${formWhere}`,
            ["title"],
          );
      }
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
        ...(rules.fields ? ["fields"] : []),
      ],
    });
    const section: SectionContent = readTexts(
      ctx,
      null,
      partWhere,
      [],
      known.filter((e) => e.key !== "items" && e.key !== "image" && e.key !== "fields"),
    );
    const fields = known.find((e) => e.key === "fields");
    const sectionFields =
      page?.pattern.kind === "landing"
        ? page.pattern.sections.find((s) => s.name === entry.key)?.calculator?.fields
        : undefined;
    if (fields && sectionFields)
      section.fields = readFieldTexts(
        ctx,
        fields.value,
        `the fields of ${partWhere}`,
        sectionFields,
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

/** Labels and help for a calculator's fields, by name. */
function readFieldTexts(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  fields: readonly { name: string }[],
): Record<string, FieldContent> {
  const result: Record<string, FieldContent> = {};
  for (const field of named(
    ctx,
    node,
    where,
    fields.map((f) => f.name),
    "field",
  )) {
    result[field.key] = readTexts(ctx, field.value, `field "${field.key}" of ${where}`, [
      "label",
      "help",
    ]);
  }
  return result;
}

/** A picture's texts, and whether an AI made it (`generated: true`). */
function readPicture(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
): { src?: string; alt?: string; generated?: true } {
  const entries = checkKeys(ctx, mapEntries(ctx, node, where) ?? [], where, {
    allowed: ["src", "alt", "generated"],
  });
  const flag = entries.find((e) => e.key === "generated");
  const texts = readTexts(
    ctx,
    node,
    where,
    ["src", "alt"],
    entries.filter((e) => e !== flag),
  );
  return flag && readBoolean(ctx, flag.value, `"generated" of ${where}`) === true
    ? { ...texts, generated: true }
    : texts;
}

/** A picture: `{ src: images/<file>, alt: <what it shows>, generated?: true }`. */
function readImage(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
): ContentImage | undefined {
  const { src, alt, generated } = readPicture(ctx, node, where);
  // In a language file a picture says what it shows only: its file is the content file's.
  if (ctx.emptyTexts) return { alt: alt ?? "" } as ContentImage;
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
  return { src, alt, ...(generated ? { generated } : {}) };
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
