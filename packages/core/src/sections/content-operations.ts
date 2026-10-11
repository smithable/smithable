import { ASSISTANT_TEXTS, LANGUAGES, LOGO_SRC } from "../content.js";
import type { YamlEditor } from "../edit.js";
import { humanize, plural } from "../naming.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { pageModel } from "../patterns.js";

/**
 * Sets one visible text in smithable.content.yml, e.g. a page's subtitle or a field's label,
 * as clicking a text in the preview and retyping it does. An empty text removes it, so the
 * text Smithable derives from names comes back. Which paths exist is the content file's own
 * validation, run after every operation.
 */
const setText: Operation<{ path: string[]; text: string }> = {
  name: "setText",
  summary:
    'Change a visible text, e.g. path [pages, customers, subtitle] or [models, Customer, fields, email, label] ("" restores the default).',
  schema: {
    type: "object",
    required: ["path", "text"],
    additionalProperties: false,
    properties: {
      path: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        description: "Where in smithable.content.yml, e.g. [pages, customers, title].",
      },
      text: { type: "string", description: 'The new text; "" restores the default.' },
    },
  },
  positional: ["text", "...path"],
  describe: ({ path, text }) =>
    text ? `Change the text ${path.join(".")} to "${text}"` : `Restore the text ${path.join(".")}`,
  destructive: () => false,
  apply(editors, { path, text }) {
    const content = editors.content;
    const parent = path.slice(0, -1);
    // An item of a plain list, e.g. one of a plan's features.
    if (Array.isArray(content.get(parent)) && typeof content.get(path) === "string") {
      if (text === "") throw new OperationError("A list's item has no default text.");
      content.setItem(parent, Number(path[path.length - 1]), text);
    } else if (text === "") {
      if (!content.has(path)) throw new OperationError(`${path.join(".")} has no text of its own.`);
      content.removeAndPrune(path, 0);
    } else put(content, path, text);
    // Another file is not known to be made by an AI: the picture loses its mark.
    if (path[path.length - 1] === "src" && content.has([...parent, "generated"]))
      content.remove([...parent, "generated"]);
    return [];
  },
};

/**
 * Ask's visible texts (docs/design/ask-defaults.md §2): its name, greeting, placeholder and the
 * sentence of what it is for. Each one given is set; "" clears it, so the kit's words come back.
 */
const setAssistantTexts: Operation<{
  name?: string;
  greeting?: string;
  placeholder?: string;
  about?: string;
}> = {
  name: "setAssistantTexts",
  summary:
    'Set the texts of Ask, the assistant in the app: its name ("Ask" by default), the first line it shows, the question box\'s placeholder, and one sentence of what it is for (shown and given to the model); "" clears one.',
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: 'The panel\'s name, e.g. Nova; "" for "Ask".' },
      greeting: { type: "string", description: "The first line it shows." },
      placeholder: { type: "string", description: "The question box's placeholder." },
      about: { type: "string", description: "One sentence of what it is for." },
    },
  },
  positional: [],
  describe: (args) =>
    `Ask's texts: ${ASSISTANT_TEXTS.filter((k) => args[k] !== undefined)
      .map((k) => (args[k] ? `${k} "${args[k]}"` : `${k} as the app says it`))
      .join(", ")}`,
  destructive: () => false,
  apply(editors, args) {
    const given = ASSISTANT_TEXTS.filter((k) => args[k] !== undefined);
    if (!given.length)
      throw new OperationError("Give one of name, greeting, placeholder or about.");
    for (const key of given) {
      const text = (args[key] as string).trim();
      const path = ["assistant", key];
      if (text) put(editors.content, path, text);
      else if (editors.content.has(path)) editors.content.removeAndPrune(path, 0);
    }
    return [];
  },
};

/** Sets a text, creating missing parents (e.g. a page with no texts yet), but not list items. */
function put(content: YamlEditor, path: string[], text: string) {
  if (content.has(path)) return content.set(path, text);
  const parent = path.slice(0, -1);
  let found = parent;
  while (found.length > 0 && !content.has(found)) found = found.slice(0, -1);
  if (Array.isArray(content.get(found))) throw new OperationError(`There is no ${path.join(".")}.`);
  content.add(parent, path[path.length - 1] as string, text);
}

/**
 * Calls a kind of record by other names in one change: its names for one and for several, and
 * the title (and so the menu entry) of each of its list pages that carried the old name for
 * several, so the app never says "New job" under "Orders".
 */
const nameRecords: Operation<{ model: string; one: string; several?: string }> = {
  name: "nameRecords",
  summary:
    "Call a kind of record by other names, for one and for several, and retitle its list pages that carried the old name.",
  schema: {
    type: "object",
    required: ["model", "one"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      one: { type: "string", description: 'The name for one, e.g. "Job".' },
      several: {
        type: "string",
        description:
          'The name for several, e.g. "Jobs"; without it, the plural of the name for one.',
      },
    },
  },
  positional: ["model", "one", "several"],
  describe: ({ model, one, several }) =>
    `Call ${model} records "${one.trim()}" and "${several?.trim() || plural(one.trim())}"`,
  destructive: () => false,
  apply({ content }, { model, one, several }, ir) {
    if (!ir.models.some((m) => m.name === model))
      throw new OperationError(`There is no kind of record named "${model}".`);
    const single = one.trim();
    if (!single) throw new OperationError("Give the name for one.");
    const many = several?.trim() || plural(single);
    const own = (path: string[]) => {
      const text = content.get(path);
      return typeof text === "string" ? text : undefined;
    };
    const label = own(["models", model, "label"]);
    const beforeOne = label ?? humanize(model);
    const before =
      own(["models", model, "pluralLabel"]) ?? (label ? plural(label) : humanize(plural(model)));
    put(content, ["models", model, "label"], single);
    put(content, ["models", model, "pluralLabel"], many);
    for (const page of ir.pages)
      if (
        page.pattern.kind === "crud" &&
        pageModel(page) === model &&
        (own(["pages", page.id, "title"]) ?? humanize(page.id)) === before
      )
        put(content, ["pages", page.id, "title"], many);
    // The fields that point at it, where they carried its old name: Order.customer "Customer",
    // Customer.orders "Orders".
    for (const m of ir.models)
      for (const f of m.fields) {
        if (f.type.kind !== "relation" || f.type.model !== model) continue;
        const path = ["models", m.name, "fields", f.name, "label"];
        if ((own(path) ?? humanize(f.name)) === (f.type.many ? before : beforeOne))
          put(content, path, f.type.many ? many : single);
      }
    // A menu with a label of its own that was the old name.
    const menus = content.get(["menus"]);
    if (menus && typeof menus === "object" && !Array.isArray(menus))
      for (const key of Object.keys(menus))
        if (own(["menus", key, "label"]) === before) put(content, ["menus", key, "label"], many);
    return [];
  },
};

/** The app's language (docs/design/language.md §2): the kit's words follow it. */
const setLanguage: Operation<{ language: string }> = {
  name: "setLanguage",
  summary: `The language of everything a person reads in the app: ${LANGUAGES.join(", ")}.`,
  schema: {
    type: "object",
    required: ["language"],
    additionalProperties: false,
    properties: {
      language: {
        enum: [...LANGUAGES],
        description: "A language the app kit has words in. The maker's own texts stay as written.",
      },
    },
  },
  positional: ["language"],
  describe: ({ language }) => `Set the app's language to ${language}`,
  destructive: () => false,
  apply(editors, { language }) {
    if (language === LANGUAGES[0]) {
      if (editors.content.has(["language"])) editors.content.remove(["language"]);
    } else put(editors.content, ["language"], language);
    return [];
  },
};

/**
 * The app's mark (docs/design/app-logo.md §1): a file under public/images/, shown before the
 * name in the shell and the landing header and linked as the tab icon. An empty src removes it.
 */
const setLogo: Operation<{ src?: string; alt?: string }> = {
  name: "setLogo",
  summary:
    'The app\'s mark, a file under public/images/ shown before its name and as its tab icon ("" removes it).',
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      src: {
        type: "string",
        description:
          "The file, e.g. images/logo.webp (webp, avif, jpg, png or svg); none removes it.",
      },
      alt: {
        type: "string",
        description: "What the mark shows; without it, the one it has, else the app's name.",
      },
    },
  },
  positional: ["src"],
  describe: ({ src }) => (src ? `Use ${src} as the app's logo` : "Remove the app's logo"),
  destructive: () => false,
  apply({ content }, { src, alt }, ir) {
    if (!src) {
      if (!content.has(["logo"])) throw new OperationError("The app has no logo.");
      content.remove(["logo"]);
      return [];
    }
    if (!LOGO_SRC.test(src))
      throw new OperationError(
        `"${src}" is not a file under public/images/: give it as images/<file> (webp, avif, jpg, png or svg).`,
      );
    const had = content.get(["logo", "alt"]);
    const text = alt?.trim() || (typeof had === "string" ? had : `The ${ir.app.name} logo`);
    if (content.has(["logo"])) content.set(["logo"], { src, alt: text });
    else content.add([], "logo", { src, alt: text });
    return [];
  },
};

export const contentOperations: AnyOperation[] = [
  setText,
  nameRecords,
  setLanguage,
  setLogo,
  setAssistantTexts,
];
