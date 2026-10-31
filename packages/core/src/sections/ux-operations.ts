import { formatDiagnostic } from "../diagnostics.js";
import type { YamlEditor, YamlValue } from "../edit.js";
import type { SpecIR } from "../ir.js";
import { type AnyOperation, type Operation, OperationError, refTo } from "../operation.js";
import { pageModel } from "../patterns.js";
import { parseTheme } from "../theme.js";
import {
  CHROMES,
  CONTROLS,
  FONTS,
  HEADER_LOOKS,
  ICONS,
  NAVIGATIONS,
  notPickable,
  SECTION_LOOKS,
  THEME_PRESETS,
  TONES,
  VOICES,
  type Voice,
} from "../ux.js";
import { partText, readNamePart } from "./name-parts.js";

/** Sets `value` at `path` in smithable.ux.yml, creating what is missing, or removes it. */
export function put(ux: YamlEditor, path: string[], value: YamlValue | undefined): void {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    if (ux.has(path)) ux.removeAndPrune(path, 0);
  } else if (ux.has(path)) {
    ux.set(path, value);
  } else {
    ux.add(path.slice(0, -1), path[path.length - 1] as string, value);
  }
}

const setTheme: Operation<{
  preset?: string;
  primary?: string;
  background?: string;
  font?: string;
  density?: string;
  motion?: string;
  page?: string;
}> = {
  name: "setTheme",
  summary:
    'Choose the theme preset, brand color, background color, font, density or motion ("none" removes a color or the font; for motion it means no motion).',
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      preset: {
        type: "string",
        description: `A built-in theme (${THEME_PRESETS.join(", ")}) or one of the project's themes/<name>.yml.`,
      },
      primary: { type: "string", description: 'A color like "#2563eb", or "none".' },
      background: {
        type: "string",
        description:
          'A background color like "#f5efe6" (a wash in light and dark mode), or "none".',
      },
      font: { type: "string", description: `${FONTS.join(", ")}, or "none".` },
      density: {
        type: "string",
        enum: ["comfortable", "standard", "compact", "none"],
        description:
          'How much space the lists and forms take; on a page, "none" returns to the app\'s.',
      },
      motion: {
        type: "string",
        enum: ["none", "subtle", "lively"],
        description: "How much the app moves; a visitor's reduced-motion setting always wins.",
      },
      page: refTo(
        { ref: "page", label: "Landing page" },
        { description: "A landing page given its own theme; without it, the app's theme." },
      ),
    },
  },
  positional: [],
  // "Use the corporate theme", "Set the look: primary color #1d4ed8, compact density".
  describe: ({ page, ...args }) => {
    const { preset, ...rest } = args as Record<string, unknown>;
    const where = page ? ` on the ${page} page` : "";
    const WORDS: Record<string, string> = { primary: "primary color", background: "background" };
    const others = Object.entries(rest).map(([k, v]) =>
      k === "motion" && v === "none"
        ? "no motion"
        : k === "density" || k === "font" || k === "motion"
          ? `${v} ${k}`
          : `${WORDS[k] ?? k} ${v}`,
    );
    const named = String(preset);
    const theme =
      preset === undefined
        ? ""
        : `Use the ${named.charAt(0).toUpperCase()}${named.slice(1)} theme${where}`;
    if (!others.length) return theme || `Set the look${where}`;
    return theme
      ? `${theme}, with ${others.join(", ")}`
      : `Set the look${where}: ${others.join(", ")}`;
  },
  destructive: () => false,
  apply(editors, { page, ...args }, ir) {
    const ux = editors.ux;
    if (Object.keys(args).length === 0)
      throw new OperationError(
        "Say what to set: preset, primary, background, font, density or motion.",
      );
    // A landing page's own theme lives under the page, with the same keys as the app's.
    if (page !== undefined && ir.pages.find((p) => p.id === page)?.pattern.kind !== "landing")
      throw new OperationError(
        `Only a landing page has a theme of its own; there is no landing page "${page}".`,
      );
    const at = page === undefined ? ["theme"] : ["pages", page, "theme"];
    if (page === undefined && args.density === "none")
      throw new OperationError(
        "The app's density is comfortable, standard or compact; \"none\" returns a landing page's density to the app's.",
      );
    // On a page, "none" returns a key to the app's theme; for the app it removes a brand key.
    // For motion alone, "none" is a value: no motion.
    if (args.preset !== undefined)
      put(ux, [...at, "preset"], page && args.preset === "none" ? undefined : args.preset);
    if (args.density !== undefined)
      put(ux, [...at, "density"], page && args.density === "none" ? undefined : args.density);
    if (args.motion !== undefined) put(ux, [...at, "motion"], args.motion);
    for (const key of ["primary", "background", "font"] as const) {
      const value = args[key];
      if (value !== undefined) put(ux, [...at, "brand", key], value === "none" ? undefined : value);
    }
    return [];
  },
};

const setFrame: Operation<{ page: string; frame: "site" | "app" | "none" | "default" }> = {
  name: "setFrame",
  summary:
    "Which frame a page shows in: site (the public frame with the top menu), app (the workspace with the side menu) or none (the page alone); default returns to its kind's.",
  schema: {
    type: "object",
    required: ["page", "frame"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      frame: {
        type: "string",
        enum: ["site", "app", "none", "default"],
        description:
          "site: the public frame; app: the workspace; none: no menu and no header; default: the page kind's own.",
      },
    },
  },
  positional: ["page", "frame"],
  describe: ({ page, frame }) =>
    frame === "default"
      ? `Show the ${page} page in its usual frame`
      : `Show the ${page} page ${frame === "none" ? "alone, without a frame" : `in the ${frame} frame`}`,
  destructive: () => false,
  apply({ ux }, { page, frame }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(ux, ["pages", page, "frame"], frame === "default" ? undefined : frame);
    return [];
  },
};

/** A calendar's blocks coloured by a field (look-gap §4); none takes the colour away. */
const setCalendarColor: Operation<{ page: string; field: string }> = {
  name: "setCalendarColor",
  summary:
    "Colour a calendar's blocks by a choice field (its values' tones), a reference (each record its own colour) or a choice one reference away (classType.level); none takes it away.",
  schema: {
    type: "object",
    required: ["page", "field"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      field: {
        type: "string",
        description: "A field of the calendar's model, a.b one reference away, or none.",
      },
    },
  },
  positional: ["page", "field"],
  describe: ({ page, field }) =>
    field === "none"
      ? `Show the ${page} calendar in one colour`
      : `Colour the ${page} calendar by ${field}`,
  destructive: () => false,
  apply({ ux }, { page, field }, ir) {
    calendarPage(ir, page);
    put(ux, ["pages", page, "calendar", "colorBy"], field === "none" ? undefined : field);
    return [];
  },
};

/** The places left on each of a calendar's blocks (look-gap §4); none takes them away. */
const setCalendarCapacity: Operation<{ page: string; left: string; of?: string; look?: string }> = {
  name: "setCalendarCapacity",
  summary:
    "Show the places left on a calendar's blocks, from two number fields, as a number, pips or a bar; none takes it away.",
  schema: {
    type: "object",
    required: ["page", "left"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      left: {
        type: "string",
        description: "The number field of places left (placesLeft), or none.",
      },
      of: { type: "string", description: "The number field of places there are (capacity)." },
      look: {
        type: "string",
        enum: ["number", "pips", "bar"],
        description: "number (default), pips or bar.",
      },
    },
  },
  positional: ["page", "left", "of"],
  describe: ({ page, left, of }) =>
    left === "none"
      ? `Show no places left on the ${page} calendar`
      : `Show ${left} of ${of} on the ${page} calendar`,
  destructive: () => false,
  apply({ ux }, { page, left, of, look }, ir) {
    calendarPage(ir, page);
    if (left !== "none" && !of)
      throw new OperationError("Name both fields: the places left and the places there are.");
    put(
      ux,
      ["pages", page, "calendar", "capacity"],
      left === "none"
        ? undefined
        : { left, of: of as string, ...(look && look !== "number" ? { look } : {}) },
    );
    return [];
  },
};

/** A calendar page by its name, or the refusal that says what it is instead. */
function calendarPage(ir: SpecIR, page: string) {
  const found = ir.pages.find((p) => p.id === page);
  if (!found) throw new OperationError(`There is no page named "${page}".`);
  if (found.pattern.kind !== "calendar")
    throw new OperationError(`${page} is not a calendar page.`);
}

/** A list's mark before each title (look-gap §4); none takes it away. */
const setTableMark: Operation<{ page: string; mark: "initials" | "picture" | "none" }> = {
  name: "setTableMark",
  summary:
    "Put a round mark before each record's title in a list: its initials, or its picture; none takes it away.",
  schema: {
    type: "object",
    required: ["page", "mark"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      mark: {
        type: "string",
        enum: ["initials", "picture", "none"],
        description: "initials, picture or none.",
      },
    },
  },
  positional: ["page", "mark"],
  describe: ({ page, mark }) =>
    mark === "none"
      ? `Show no mark before the titles on ${page}`
      : `Mark each record on ${page} with its ${mark === "picture" ? "picture" : "initials"}`,
  destructive: () => false,
  apply({ ux }, { page, mark }, ir) {
    pageNamed(ir, page);
    put(ux, ["pages", page, "table", "mark"], mark === "none" ? undefined : mark);
    return [];
  },
};

/** A list's rows' actions: buttons (below) or a menu at the row's end (look-gap §4). */
const setRowActions: Operation<{ page: string; actions: "below" | "menu" }> = {
  name: "setRowActions",
  summary:
    "Show each row's actions as buttons (below, the default) or in a … menu at the row's end.",
  schema: {
    type: "object",
    required: ["page", "actions"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      actions: { type: "string", enum: ["below", "menu"], description: "below or menu." },
    },
  },
  positional: ["page", "actions"],
  describe: ({ page, actions }) =>
    actions === "menu"
      ? `Put each row's actions on ${page} in a menu`
      : `Show each row's actions on ${page} as buttons`,
  destructive: () => false,
  apply({ ux }, { page, actions }, ir) {
    pageNamed(ir, page);
    put(ux, ["pages", page, "table", "actions"], actions === "menu" ? "menu" : undefined);
    return [];
  },
};

const setColumns: Operation<{ page: string; columns?: string[] }> = {
  name: "setColumns",
  summary: "Choose which fields a page's table shows, in order (none: back to the default).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      columns: refTo({ ref: "field", page: "page", label: "Columns" }, {}, true),
    },
  },
  positional: ["page", "...columns"],
  describe: ({ page, columns }) =>
    columns?.length
      ? `Show ${columns.join(", ")} in the ${page} table`
      : `Show the default columns in the ${page} table`,
  destructive: () => false,
  apply(editors, { page, columns }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(editors.ux, ["pages", page, "table", "columns"], columns);
    return [];
  },
};

/** The field types a totals row adds up. */
const NUMBERS = ["int", "decimal", "money"];

const setTotals: Operation<{ page: string; totals?: string[] }> = {
  name: "setTotals",
  summary:
    "Give a page's table a last row with the sum of these number or amount fields, and the count, over every record the viewer may see that fits the filters (none: no totals row).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      totals: refTo({ ref: "field", page: "page", label: "Totals" }, {}, true),
    },
  },
  positional: ["page", "...totals"],
  describe: ({ page, totals }) =>
    totals?.length
      ? `Total ${totals.join(", ")} under the ${page} table`
      : `No totals under the ${page} table`,
  destructive: () => false,
  apply(editors, { page, totals }, ir) {
    const found = ir.pages.find((p) => p.id === page);
    if (!found) throw new OperationError(`There is no page named "${page}".`);
    const model = ir.models.find((m) => m.name === pageModel(found));
    for (const name of totals ?? []) {
      const field = model?.fields.find((f) => f.name === name);
      if (!field) throw new OperationError(`${model?.name ?? page} has no field named "${name}".`);
      if (!(field.type.kind === "scalar" && NUMBERS.includes(field.type.name)))
        throw new OperationError(`"${name}" is not a number or an amount, so it has no total.`);
      if (field.formula)
        throw new OperationError(
          `"${name}" is computed per record, so the list has no total of it.`,
        );
    }
    const once = [...new Set(totals ?? [])];
    put(editors.ux, ["pages", page, "table", "totals"], once.length ? once : undefined);
    return [];
  },
};

/** No detail parts: none given, or the one word "none". */
const noDetail = (detail?: string[]) =>
  !detail?.length || (detail.length === 1 && detail[0] === "none");

const setRecordLines: Operation<{ page: string; subtitle?: string; detail?: string[] }> = {
  name: "setRecordLines",
  summary:
    'What a page shows under a record\'s name on cards and in pickers (docs/design/record-names.md §3): a subtitle and detail parts, each a field, a reference or a field one reference away; "none" takes the subtitle away, an empty detail list the details.',
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      subtitle: {
        type: "string",
        description: 'The line under the name, e.g. instructor.name; "none" removes it.',
      },
      detail: {
        type: "array",
        items: { type: "string" },
        description:
          "Smaller parts after it, e.g. classType.level capacity; none (or no parts) removes them.",
      },
    },
  },
  positional: ["page", "subtitle"],
  describe: ({ page, subtitle, detail }) =>
    subtitle === "none" && noDetail(detail)
      ? `Show only the name on the ${page} page's records`
      : `Under a record's name on the ${page} page, show ${[subtitle && subtitle !== "none" ? subtitle : "", ...(noDetail(detail) ? [] : (detail ?? []))].filter(Boolean).join(", ")}`,
  destructive: () => false,
  apply(editors, { page, subtitle, detail }, ir) {
    const found = ir.pages.find((p) => p.id === page);
    if (!found) throw new OperationError(`There is no page named "${page}".`);
    const model = ir.models.find((m) => m.name === pageModel(found));
    if (!model) throw new OperationError(`The ${page} page shows no records to name.`);
    if (subtitle === undefined && detail === undefined)
      throw new OperationError("Say what to show: a subtitle, detail parts, or none.");
    const check = (text: string) => {
      const read = readNamePart(text, model, ir.models);
      if ("problem" in read)
        throw new OperationError(`${read.problem}${read.hint ? ` ${read.hint}` : ""}`);
      return partText(read.part);
    };
    if (subtitle !== undefined)
      put(
        editors.ux,
        ["pages", page, "record", "subtitle"],
        subtitle === "none" ? undefined : check(subtitle),
      );
    if (detail !== undefined) {
      const parts = noDetail(detail) ? undefined : detail.map(check);
      const line =
        subtitle === undefined ? editors.ux.get(["pages", page, "record", "subtitle"]) : subtitle;
      const twice = parts?.find((p, i) => parts.indexOf(p) !== i || p === line);
      if (twice) throw new OperationError(`The ${page} page would show ${twice} twice.`);
      put(editors.ux, ["pages", page, "record", "detail"], parts);
    }
    return [];
  },
};

const setRecordList: Operation<{ page: string; field: string; look: "thread" | "table" }> = {
  name: "setRecordList",
  summary:
    "Show a list of related records on a page's record as a thread (a conversation with a reply box) or a table (the default).",
  schema: {
    type: "object",
    required: ["page", "field", "look"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      field: refTo({ ref: "field", page: "page", label: "List" }),
      look: { enum: ["thread", "table"], description: "thread or table." },
    },
  },
  positional: ["page", "field", "look"],
  describe: ({ page, field, look }) =>
    look === "thread"
      ? `Show ${field} on the ${page} page's records as a conversation`
      : `Show ${field} on the ${page} page's records as a table`,
  destructive: () => false,
  apply(editors, { page, field, look }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    // A table is the default: setting it takes the key away, and an empty record block with it.
    put(
      editors.ux,
      ["pages", page, "record", "lists", field],
      look === "thread" ? look : undefined,
    );
    return [];
  },
};

const setFieldOrder: Operation<{ page: string; fields?: string[] }> = {
  name: "setFieldOrder",
  summary: "Order the fields of a page's form; fields not listed follow (none: the spec's order).",
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      fields: refTo({ ref: "field", page: "page", label: "Fields" }, {}, true),
    },
  },
  positional: ["page", "...fields"],
  describe: ({ page, fields }) =>
    fields?.length
      ? `Order the ${page} form: ${fields.join(", ")}`
      : `Use the spec's field order in the ${page} form`,
  destructive: () => false,
  apply(editors, { page, fields }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(editors.ux, ["pages", page, "form", "fieldOrder"], fields);
    return [];
  },
};

const setTone: Operation<{ model: string; field: string; value: string; tone: string }> = {
  name: "setTone",
  summary:
    "Give a choice value a color by meaning, e.g. paid: success, overdue: warning (neutral: the default).",
  schema: {
    type: "object",
    required: ["model", "field", "value", "tone"],
    additionalProperties: false,
    properties: {
      model: refTo({ ref: "model", label: "Kind of record" }),
      field: refTo({ ref: "field", model: "model", label: "Field" }),
      value: refTo({ ref: "choiceValue", model: "model", field: "field", label: "Value" }),
      tone: { type: "string", enum: [...TONES] },
    },
  },
  positional: ["model", "field", "value", "tone"],
  describe: ({ model, field, value, tone }) => `Show ${model}.${field} ${value} as ${tone}`,
  destructive: () => false,
  apply(editors, { model, field, value, tone }, ir) {
    const type = ir.models
      .find((m) => m.name === model)
      ?.fields.find((f) => f.name === field)?.type;
    if (type?.kind !== "choice")
      throw new OperationError(`${model}.${field} is not a choice field.`);
    if (!type.values.includes(value))
      throw new OperationError(`${model}.${field} has no value "${value}".`);
    put(editors.ux, ["tones", `${model}.${field}`, value], tone === "neutral" ? undefined : tone);
    return [];
  },
};

const setIcon: Operation<{ page: string; icon: string }> = {
  name: "setIcon",
  summary: 'Choose the icon a page has in navigation ("auto": chosen from its model\'s name).',
  schema: {
    type: "object",
    required: ["page", "icon"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      icon: { type: "string", enum: [...ICONS, "auto"] },
    },
  },
  positional: ["page", "icon"],
  describe: ({ page, icon }) => `Show the ${page} page with the ${icon} icon`,
  destructive: () => false,
  apply(editors, { page, icon }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(editors.ux, ["pages", page, "icon"], icon === "auto" ? undefined : icon);
    return [];
  },
};

const setBelow: Operation<{ page: string; column: string; field: string }> = {
  name: "setBelow",
  summary:
    'Show a second field under a table column\'s value, e.g. phone under email ("none" removes it).',
  schema: {
    type: "object",
    required: ["page", "column", "field"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      column: refTo({ ref: "field", page: "page", label: "Column" }),
      field: refTo({ ref: "field", page: "page", label: "Under it" }),
    },
  },
  positional: ["page", "column", "field"],
  describe: ({ page, column, field }) =>
    field === "none"
      ? `Show nothing under ${column} in the ${page} table`
      : `Show ${field} under ${column} in the ${page} table`,
  destructive: () => false,
  apply(editors, { page, column, field }, ir) {
    if (!ir.pages.some((p) => p.id === page))
      throw new OperationError(`There is no page named "${page}".`);
    put(
      editors.ux,
      ["pages", page, "table", "below", column],
      field === "none" ? undefined : field,
    );
    return [];
  },
};

/** A landing section's look (docs/design/look.md §1.4), e.g. a split hero or a carousel. */
const setSectionLook: Operation<{ page: string; section: string; key: string; value: string }> = {
  name: "setSectionLook",
  summary:
    'Choose how a landing section looks, e.g. hero layout split|centered|plain|cover|photo, records layout cards|list|grid, features/records/gallery columns 2-6, faq layout accordion|list and columns 1|2, any section but the hero and footer band none|muted|inverse|primary; and a landing page\'s header (section "header": the top bar with the app\'s name and menu) position sticky (the default: the menu sticks and stays at the top when the page scrolls) or scrolling, away with the page ("default" removes it).',
  schema: {
    type: "object",
    required: ["page", "section", "key", "value"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      section: {
        type: "string",
        description: "The section's name, e.g. hero, or \"header\" for the page's header.",
      },
      key: {
        type: "string",
        description:
          "layout, image, columns, highlight or band, as the section takes; position for the header.",
      },
      value: { type: "string", description: 'A value the key allows, or "default".' },
    },
  },
  positional: ["page", "section", "key", "value"],
  describe: ({ page, section, key, value }) =>
    section === "header"
      ? value === "default"
        ? `Show the header of ${page} with its own ${key}`
        : `Show the header of ${page} with ${key} ${value}`
      : value === "default"
        ? `Show the ${section} section of ${page} with its own ${key}`
        : `Show the ${section} section of ${page} with ${key} ${value}`,
  destructive: () => false,
  apply(editors, { page, section, key, value }, ir) {
    const found = ir.pages.find((p) => p.id === page);
    if (!found) throw new OperationError(`There is no page named "${page}".`);
    // The header is the landing page's frame's, beside its sections (unless a section has its name).
    if (section === "header" && !found.sections.some((s) => s.name === section && !s.own)) {
      if (found.pattern.kind !== "landing")
        throw new OperationError(`A header's look is for a landing page; ${page} is not one.`);
      const values = HEADER_LOOKS[key];
      if (!values)
        throw new OperationError(
          `A header has no "${key}": it takes ${Object.keys(HEADER_LOOKS).join(", ")}.`,
        );
      if (value !== "default" && !values.includes(value))
        throw new OperationError(`"${key}" of a header is one of ${values.join(", ")}.`);
      put(editors.ux, ["pages", page, "header", key], value === "default" ? undefined : value);
      return [];
    }
    const kind = found.sections.find((s) => s.name === section && !s.own)?.kind;
    if (!kind) throw new OperationError(`${page} has no section named "${section}".`);
    const allowed = SECTION_LOOKS[kind]?.[key];
    if (!allowed)
      throw new OperationError(
        `A ${kind} section has no "${key}"${SECTION_LOOKS[kind] ? `: it takes ${Object.keys(SECTION_LOOKS[kind] ?? {}).join(", ")}` : ""}.`,
      );
    const number = Number(value);
    const typed = allowed !== "text" && typeof allowed[0] === "number" ? number : value;
    if (value !== "default" && allowed !== "text" && !allowed.includes(typed))
      throw new OperationError(`"${key}" of a ${kind} section is one of ${allowed.join(", ")}.`);
    put(
      editors.ux,
      ["pages", page, "sections", section, key],
      value === "default" ? undefined : typed,
    );
    return [];
  },
};

const pageNamed = (ir: SpecIR, page: string) => {
  if (!ir.pages.some((p) => p.id === page))
    throw new OperationError(`There is no page named "${page}".`);
};

const setControl: Operation<{ page: string; field: string; control: string }> = {
  name: "setControl",
  summary:
    'How a field is entered on a page\'s form: slider, stepper, radio, select, combobox, textarea or switch ("input" is the default for its kind).',
  schema: {
    type: "object",
    required: ["page", "field", "control"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      field: refTo({ ref: "field", page: "page", label: "Field" }),
      control: { type: "string", enum: [...CONTROLS], description: "The control." },
    },
  },
  positional: ["page", "field", "control"],
  describe: ({ page, field, control }) =>
    control === "input"
      ? `Enter ${field} the usual way on the ${page} form`
      : `Enter ${field} with a ${control} on the ${page} form`,
  destructive: () => false,
  apply(editors, { page, field, control }, ir) {
    pageNamed(ir, page);
    put(
      editors.ux,
      ["pages", page, "form", "control", field],
      control === "input" ? undefined : control,
    );
    return [];
  },
};

const setFormSections: Operation<{ page: string; sections?: string[] }> = {
  name: "setFormSections",
  summary:
    'Group a page\'s form into sections with headings, each "name:field,field"; fields in none follow at the end (none: one form).',
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      sections: {
        type: "array",
        items: { type: "string" },
        description: 'Each "name:field,field", e.g. "contact:name,email,phone".',
      },
    },
  },
  positional: ["page", "...sections"],
  describe: ({ page, sections }) =>
    sections?.length
      ? `Group the ${page} form into ${sections.map((s) => s.split(":")[0]).join(", ")}`
      : `Show the ${page} form as one`,
  destructive: () => false,
  apply(editors, { page, sections }, ir) {
    pageNamed(ir, page);
    const groups = (sections ?? []).map((text) => {
      const [name, fields] = text.split(":");
      if (!name || !fields)
        throw new OperationError(`A section is written "name:field,field", not "${text}".`);
      return { name, fields: fields.split(",").map((f) => f.trim()) };
    });
    if (groups.length && editors.ux.has(["pages", page, "form", "fieldOrder"]))
      editors.ux.removeAndPrune(["pages", page, "form", "fieldOrder"], 0);
    put(
      editors.ux,
      ["pages", page, "form", "sections"],
      groups.length ? (groups as never) : undefined,
    );
    return [];
  },
};

const setFormColumns: Operation<{ page: string; columns: number }> = {
  name: "setFormColumns",
  summary:
    "Short fields of a page's form one under the other (1) or two abreast on wide screens (2).",
  schema: {
    type: "object",
    required: ["page", "columns"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      columns: { type: "integer", enum: [1, 2] },
    },
  },
  positional: ["page", "columns"],
  describe: ({ page, columns }) =>
    `${columns === 2 ? "Two columns" : "One column"} on the ${page} form`,
  destructive: () => false,
  apply(editors, { page, columns }, ir) {
    pageNamed(ir, page);
    put(editors.ux, ["pages", page, "form", "columns"], columns === 2 ? 2 : undefined);
    return [];
  },
};

const setView: Operation<{ page: string; view: "table" | "cards" }> = {
  name: "setView",
  summary:
    "Show a page's list as a table or as cards on wide screens (a phone shows cards anyway).",
  schema: {
    type: "object",
    required: ["page", "view"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      view: { type: "string", enum: ["table", "cards"] },
    },
  },
  positional: ["page", "view"],
  describe: ({ page, view }) =>
    `Show the ${page} list as ${view === "cards" ? "cards" : "a table"}`,
  destructive: () => false,
  apply(editors, { page, view }, ir) {
    pageNamed(ir, page);
    put(editors.ux, ["pages", page, "table", "view"], view === "cards" ? "cards" : undefined);
    return [];
  },
};

/**
 * Whether the app marks the pictures an AI made (the AI-generated badge, on by default). The
 * app's owner decides whether their audience needs it; the engine has one default everywhere.
 */
const setAiBadge: Operation<{ shown?: "true" | "false" }> = {
  name: "setAiBadge",
  summary:
    'Mark pictures an AI made with "AI-generated" or "AI" (true, the default) or not (false): whether your audience needs it is your responsibility.',
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      shown: { type: "string", enum: ["true", "false"], description: "true (default) or false." },
    },
  },
  positional: ["shown"],
  describe: ({ shown = "true" }) =>
    shown === "false"
      ? "Show no badge on pictures an AI made"
      : "Mark pictures an AI made with a badge",
  destructive: () => false,
  apply(editors, { shown = "true" }) {
    // On is the default, so it is written only when off.
    put(editors.ux, ["aiBadge"], shown === "false" ? false : undefined);
    return [];
  },
};

/** Where the app's menu sits (look-gap.md §4); default removes the key, back to the sidebar. */
const setMenuLayout: Operation<{ navigation: string }> = {
  name: "setMenuLayout",
  summary:
    "Put the app's menu in a sidebar (the default), a bar across the top (topbar) or a bar with the name centred between the links (topbar-centered).",
  schema: {
    type: "object",
    required: ["navigation"],
    additionalProperties: false,
    properties: {
      navigation: {
        type: "string",
        enum: [...NAVIGATIONS, "default"],
        description: "sidebar, topbar, topbar-centered, or default.",
      },
    },
  },
  positional: ["navigation"],
  describe: ({ navigation }) =>
    navigation === "default" || navigation === "sidebar"
      ? "Put the menu in a sidebar"
      : navigation === "topbar"
        ? "Put the menu in a bar across the top"
        : "Put the menu in a bar across the top, the name centred",
  destructive: () => false,
  apply(editors, { navigation }) {
    // The sidebar is the default, so it is written as nothing.
    put(
      editors.ux,
      ["navigation"],
      navigation === "default" || navigation === "sidebar" ? undefined : navigation,
    );
    return [];
  },
};

/** The menu's surface (look-gap.md §4); default removes the key, back to the theme's colours. */
const setChrome: Operation<{ chrome: string }> = {
  name: "setChrome",
  summary:
    "Give the menu a light surface (the page's colours) or a dark one (the text colour as its surface); default returns to the theme's own menu colours.",
  schema: {
    type: "object",
    required: ["chrome"],
    additionalProperties: false,
    properties: {
      chrome: {
        type: "string",
        enum: [...CHROMES, "default"],
        description: "light, dark, or default.",
      },
    },
  },
  positional: ["chrome"],
  describe: ({ chrome }) =>
    chrome === "default"
      ? "Give the menu the theme's own colours"
      : `Give the menu a ${chrome} surface`,
  destructive: () => false,
  apply(editors, { chrome }) {
    put(editors.ux, ["chrome"], chrome === "default" ? undefined : chrome);
    return [];
  },
};

/** Ask's manner (docs/design/ask-defaults.md §2): plain, the default, is written as nothing. */
const setAssistantVoice: Operation<{ voice: Voice }> = {
  name: "setAssistantVoice",
  summary:
    "Set the manner of Ask, the assistant in the app: plain (the default: short, no pleasantries), friendly or formal.",
  schema: {
    type: "object",
    required: ["voice"],
    additionalProperties: false,
    properties: {
      voice: { type: "string", enum: [...VOICES], description: "plain, friendly or formal." },
    },
  },
  positional: ["voice"],
  describe: ({ voice }) => `Ask answers ${voice === "plain" ? "plainly" : `in a ${voice} voice`}`,
  destructive: () => false,
  apply(editors, { voice }) {
    put(editors.ux, ["assistant", "voice"], voice === "plain" ? undefined : voice);
    return [];
  },
};

const setSort: Operation<{ page: string; field: string }> = {
  name: "setSort",
  summary:
    'The order of a page\'s list until someone sorts it: a field, or "-field" for the largest or latest first ("none": newest first).',
  schema: {
    type: "object",
    required: ["page", "field"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      field: {
        type: "string",
        description: 'A field, or "-field" descending; "none" for the default.',
      },
    },
  },
  positional: ["page", "field"],
  describe: ({ page, field }) =>
    field === "none"
      ? `Show the newest ${page} first`
      : `Sort the ${page} list by ${field.replace(/^-/, "")}${field.startsWith("-") ? ", largest or latest first" : ""}`,
  destructive: () => false,
  apply(editors, { page, field }, ir) {
    pageNamed(ir, page);
    put(editors.ux, ["pages", page, "table", "sort"], field === "none" ? undefined : field);
    return [];
  },
};

const setFiltersShown: Operation<{ page: string; fields?: string[] }> = {
  name: "setFiltersShown",
  summary:
    'Which of a page\'s filters show when the list is first reached; the rest fold behind "More filters" (no fields: every filter shows).',
  schema: {
    type: "object",
    required: ["page"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Filters of the page (smithable.yml's filters), in the order shown.",
      },
    },
  },
  positional: ["page", "...fields"],
  describe: ({ page, fields }) =>
    fields?.length
      ? `Show the ${fields.join(", ")} ${fields.length > 1 ? "filters" : "filter"} of ${page} first`
      : `Show every filter of ${page}`,
  destructive: () => false,
  apply(editors, { page, fields = [] }, ir) {
    pageNamed(ir, page);
    const offered = ir.pages.find((p) => p.id === page)?.filters ?? [];
    const wrong = fields.find((f) => !offered.includes(f));
    if (wrong !== undefined)
      throw new OperationError(
        `${page} has no filter named "${wrong}"; its filters are ${offered.length ? offered.join(", ") : "none"}.`,
      );
    put(editors.ux, ["pages", page, "filters", "shown"], [...new Set(fields)]);
    return [];
  },
};

/** How a page's filters show (look-gap §4): today's controls (default) or a row of chips. */
const setFiltersLook: Operation<{ page: string; look: "default" | "chips" }> = {
  name: "setFiltersLook",
  summary:
    "Show a page's filters as today's controls (default: chips up to eight values, a list to pick from above) or every choice and reference as a row of chips (chips).",
  schema: {
    type: "object",
    required: ["page", "look"],
    additionalProperties: false,
    properties: {
      page: refTo({ ref: "page", label: "Page" }),
      look: { type: "string", enum: ["default", "chips"], description: "default or chips." },
    },
  },
  positional: ["page", "look"],
  describe: ({ page, look }) =>
    look === "chips"
      ? `Show the filters of ${page} as chips`
      : `Show the filters of ${page} as they are by default`,
  destructive: () => false,
  apply(editors, { page, look }, ir) {
    pageNamed(ir, page);
    if (look === "chips" && !ir.pages.find((p) => p.id === page)?.filters?.length)
      throw new OperationError(
        `${page} has no filters (smithable.yml's filters) to show as chips.`,
      );
    put(editors.ux, ["pages", page, "filters", "look"], look === "chips" ? look : undefined);
    return [];
  },
};

/** How a filter on a reference is picked (backlog A 208): list, search, or by the count (auto). */
const setFilterPick: Operation<{ page: string; filter: string; pick: "list" | "search" | "auto" }> =
  {
    name: "setFilterPick",
    summary:
      "How a list page's filter on a reference is picked: list (every related record as a choice), search (found as you type), or auto (by the count: a search from 200 records).",
    schema: {
      type: "object",
      required: ["page", "filter", "pick"],
      additionalProperties: false,
      properties: {
        page: refTo({ ref: "page", label: "Page" }),
        filter: { type: "string", description: "A filter of the page on a reference field." },
        pick: { enum: ["list", "search", "auto"], description: "auto leaves it to the count." },
      },
    },
    positional: ["page", "filter", "pick"],
    describe: ({ page, filter, pick }) =>
      pick === "auto"
        ? `Pick the ${filter} filter of ${page} by the count`
        : `Pick the ${filter} filter of ${page} ${pick === "search" ? "by searching" : "from a list"}`,
    destructive: () => false,
    apply(editors, { page, filter, pick }, ir) {
      pageNamed(ir, page);
      const found = ir.pages.find((p) => p.id === page) as SpecIR["pages"][number];
      const offered = found.filters ?? [];
      if (!offered.includes(filter))
        throw new OperationError(
          `${page} has no filter named "${filter}"; its filters are ${offered.length ? offered.join(", ") : "none"}.`,
        );
      const model = ir.models.find((m) => m.name === pageModel(found));
      const field = model?.fields.find((x) => x.name === filter);
      const refused = notPickable(filter, field);
      if (refused) throw new OperationError(refused);
      put(
        editors.ux,
        ["pages", page, "filters", "pick", filter],
        pick === "auto" ? undefined : pick,
      );
      return [];
    },
  };

const addTheme: Operation<{ name: string; text: string; use?: boolean }> = {
  name: "addTheme",
  summary: "Add a theme of the project's own (themes/<name>.yml), and use it with --use.",
  schema: {
    type: "object",
    required: ["name", "text"],
    additionalProperties: false,
    properties: {
      name: { type: "string", description: 'The theme\'s name, kebab-case, like "forest".' },
      text: {
        type: "string",
        description:
          "The theme file's text: smithableTheme: 0.1, a font, at least three colors per mode (see the spec, Themes). On the command line, --text @path reads a file.",
      },
      use: { type: "boolean", description: "Also make it the app's theme." },
    },
  },
  positional: ["name"],
  describe: ({ name, use }) => `Add theme ${name}${use ? " and use it" : ""}`,
  destructive: () => false,
  apply(editors, { name, text, use }) {
    const path = `themes/${name}.yml`;
    const parsed = parseTheme({ path, text });
    if (!parsed.theme)
      throw new OperationError(
        `The theme is refused:\n${parsed.diagnostics.map((d) => `  ${formatDiagnostic(d)}`).join("\n")}`,
      );
    if (parsed.theme.name !== name)
      throw new OperationError(
        `The file says "name: ${parsed.theme.name}": add it as that, or change the name in the file.`,
      );
    if (editors.themes.names.includes(name))
      throw new OperationError(
        `There is already a theme "${name}"${THEME_PRESETS.includes(name as never) ? ", built in" : ` (${path})`}: choose another name.`,
      );
    editors.themes.add(parsed.theme, text.endsWith("\n") ? text : `${text}\n`);
    if (use) put(editors.ux, ["theme", "preset"], name);
    return [];
  },
};

export const uxOperations: AnyOperation[] = [
  addTheme,
  setTheme,
  setSectionLook,
  setFrame,
  setColumns,
  setTotals,
  setRecordList,
  setRecordLines,
  setFieldOrder,
  setTone,
  setIcon,
  setBelow,
  setControl,
  setFormSections,
  setFormColumns,
  setView,
  setAiBadge,
  setAssistantVoice,
  setSort,
  setFiltersShown,
  setFilterPick,
  setFiltersLook,
  setMenuLayout,
  setChrome,
  setCalendarColor,
  setCalendarCapacity,
  setTableMark,
  setRowActions,
];
