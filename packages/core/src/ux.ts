import { isScalar, isSeq, LineCounter, type ParsedNode, parseDocument } from "yaml";
import {
  checkKeys,
  mapEntries,
  ParseContext,
  readBoolean,
  readNameList,
  readString,
} from "./context.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import type { FieldIR, ModelIR, NamePartIR, PageIR, SpecIR } from "./ir.js";
import { capitalize, humanize } from "./naming.js";
import { pageModel, patternInfo } from "./patterns.js";
import { readNamePart } from "./sections/name-parts.js";
import { didYouMean } from "./suggest.js";
import {
  bandLowContrast,
  FONTS,
  type ThemeIR,
  themeNamed,
  themeNames,
  tokensOf,
  withBackground,
} from "./theme.js";
import { threadBindings } from "./thread.js";

/**
 * How the app looks, from smithable.ux.yml (ARCHITECTURE §3.2). Technology-neutral:
 * presets and choices, never CSS. Everything is optional.
 */
/** The field types a table's totals row adds up. */
const NUMBERS = ["int", "decimal", "money"];

export interface UxIR {
  theme: {
    /** A built-in preset's name, or one of the project's themes (themes/<name>.yml). */
    preset: string;
    /** A color like "#2563eb"; the preset derives its colors from it. */
    primary?: string;
    /** A background color like "#f5efe6": a pale wash in light mode, a deep one in dark. */
    background?: string;
    font?: string;
    density: "comfortable" | "standard" | "compact";
    /** How much the app moves; a visitor's reduced-motion setting always wins. */
    motion: "none" | "subtle" | "lively";
  };
  pages: Record<string, PageUx>;
  /** Colors of choice values by meaning, by "Model.field"; values not listed are neutral. */
  tones: Record<string, Record<string, Tone>>;
  /** Whether pictures an AI made carry the badge (AiMark.tsx); on unless the owner switches it off. */
  aiBadge: boolean;
  /**
   * Where the app's menu sits on a wide screen (docs/design/look-gap.md §4): the sidebar, or a bar
   * across the top with the name at the start or centred between the links. Unsaid, the sidebar.
   */
  navigation?: (typeof NAVIGATIONS)[number];
  /**
   * The menu's surface, apart from where it sits: light (the page's own colours) or dark (the
   * text colour as its surface). Unsaid, the theme's own menu colours.
   */
  chrome?: (typeof CHROMES)[number];
  /** Ask's manner (docs/design/ask-defaults.md §2): a fixed set of prompt lines each, plain by default. */
  assistant: { voice: Voice };
}

/** Where the menu sits, and its surface (look-gap.md §4). */
export const NAVIGATIONS = ["sidebar", "topbar", "topbar-centered"] as const;
export const CHROMES = ["light", "dark"] as const;

/** The assistant's voices: plain (short, no pleasantries), friendly, formal. */
export const VOICES = ["plain", "friendly", "formal"] as const;
export type Voice = (typeof VOICES)[number];

export interface PageUx {
  /** The page's icon in navigation; without it one is chosen from the model's name. */
  icon?: Icon;
  /** The table's columns, in order. */
  columns?: string[];
  /**
   * A last row with the sum of each of these number or amount fields, and the count, over every
   * record the viewer may see that fits the filters and the search (docs/design/intents.md §5).
   */
  totals?: string[];
  /**
   * The filters shown when the list is first reached; the rest fold behind "More filters" (one
   * with a value in the address shows anyway). Without it, every filter shows.
   */
  filtersShown?: string[];
  /**
   * How a filter on a reference is picked, by the filter's name: `list`, every related record the
   * viewer may read as a choice, or `search`, a field that finds them as the person types. A filter
   * not named here is picked by the count: a search from 200 readable related records, else the
   * list (backlog A 208).
   */
  filterPick?: Record<string, "list" | "search">;
  /**
   * A calendar page's blocks (docs/design/look-gap.md §4): coloured by a choice's tone, the model's
   * own or one a reference away, or by the referenced record itself, each record a chart hue by
   * its order among its model's (`colorBy`); and showing the places left of the places there are.
   */
  calendar?: {
    colorBy?:
      | { kind: "choice"; model: string; field: string; reference?: string }
      | { kind: "record"; model: string; reference: string };
    capacity?: { left: string; of: string; look: "number" | "pips" | "bar" };
  };
  /**
   * How the page's filters show (docs/design/look-gap.md §4): unsaid, today's controls (chips up to
   * eight values, a list to pick from above); `chips`, every choice and reference as a row of
   * chips, a referenced record's picture on its chip when it has one.
   */
  filtersLook?: "chips";
  /** A second field shown under a column's value, e.g. { email: "phone" }. */
  below?: Record<string, string>;
  /** The list's order until someone sorts it: a field, or "-field" for descending. */
  sort?: string;
  /** How the list looks on a wide screen; a phone shows cards anyway. */
  view?: "table" | "cards";
  /**
   * A round mark before each record's title (look-gap §4): its initials on a colour of their own,
   * or the model's first picture. Unsaid, none.
   */
  mark?: "initials" | "picture";
  /** Each row's actions as buttons (unsaid) or in a "…" menu at the row's end. */
  rowActions?: "menu";
  /** The form's fields in this order; fields not listed follow. */
  fieldOrder?: string[];
  /** A calculator's results beside its inputs on a wide screen (the default), or below them. */
  results?: "beside" | "below";
  /** A landing page's own theme: the keys it changes from the app's (docs/design/look.md §1.5). */
  theme?: Partial<UxIR["theme"]>;
  /**
   * The frame the page shows in (docs/design/page-sections.md §4): site (the public frame with
   * the top menu), app (the workspace with the side menu) or none (the page alone). Without it,
   * the page kind's own: landing and articles pages site, the rest app.
   */
  frame?: "site" | "app" | "none";
  /** A landing page's sections' looks, by section name (docs/design/look.md §1.4); the ux file's
   * page-level `sections`, not the form's. */
  looks?: Record<string, SectionLook>;
  /** A landing page's header's look (HEADER_LOOKS): whether it stays at the top as the page
   * scrolls. The frame's, not a section's. */
  header?: HeaderLook;
  /** The form's groups, each with a heading; fields in none follow at the end. */
  sections?: { name: string; fields: string[] }[];
  /** Short fields two abreast on wide screens. */
  formColumns?: 1 | 2;
  /** How a field is entered, when not the default for its kind (docs/design/look.md §1.1). */
  control?: Record<string, Control>;
  /**
   * How the record page shows a list of related records, by its field: a table (the default) or
   * a conversation with a reply box (docs/design/conversation.md).
   */
  lists?: Record<string, "thread" | "table">;
  /** The line under a record's name on cards and in pickers (record-names.md §3): a name part. */
  subtitle?: NamePartIR;
  /** Smaller parts after the subtitle. */
  detail?: NamePartIR[];
}

/** The ways a field can be entered, chosen by name in the ux file. */
export const CONTROLS = [
  "input",
  "slider",
  "stepper",
  "radio",
  "select",
  "combobox",
  "textarea",
  "switch",
] as const;
export type Control = (typeof CONTROLS)[number];

/** Why a control does not fit a field, or undefined when it does. */
export function controlUnfit(field: FieldIR, control: Control): string | undefined {
  const scalar = field.type.kind === "scalar" ? field.type.name : undefined;
  const number = scalar === "int" || scalar === "decimal" || scalar === "money";
  switch (control) {
    case "input":
      return undefined;
    case "slider":
      return number && field.min !== undefined && field.max !== undefined
        ? undefined
        : "a slider needs a number field with both min and max";
    case "stepper":
      return scalar === "int" ? undefined : "a stepper needs a whole-number field";
    case "radio":
      return (field.type.kind === "choice" && field.type.values.length <= 5) || scalar === "bool"
        ? undefined
        : "radio buttons need a choice of at most five values, or a yes/no";
    case "select":
      return field.type.kind === "choice" || (field.type.kind === "relation" && !field.type.many)
        ? undefined
        : "a select needs a choice or a reference";
    case "combobox":
      return field.type.kind === "relation" && !field.type.many
        ? undefined
        : "a combobox needs a reference";
    case "textarea":
      return scalar === "string" || scalar === "text" || scalar === "markdown"
        ? undefined
        : "a textarea needs a text field";
    case "switch":
      return scalar === "bool" ? undefined : "a switch needs a yes/no field";
  }
}

/** How a landing section looks; which keys a section takes depends on its kind (SECTION_LOOKS). */
export interface SectionLook {
  layout?: string;
  image?: "left" | "right";
  columns?: number;
  highlight?: string;
  band?: Band;
}

/**
 * A section's band (docs/design/look-references.md §3, gap 5): the section across the page's
 * width on one of the theme's surfaces, its text in that surface's own color. none (the default)
 * is today's open section. Not on a hero (its layouts are its own) or a footer (the frame's).
 */
export const BANDS = ["none", "muted", "inverse", "primary"] as const;
export type Band = (typeof BANDS)[number];

/**
 * The looks each section kind has: a key's allowed values, or "text" for any (a pricing plan's
 * name). The first value of a layout is the kind's own look, used when none is given.
 */
export const SECTION_LOOKS: Partial<
  Record<string, Record<string, readonly (string | number)[] | "text">>
> = {
  hero: { layout: ["split", "centered", "plain", "cover", "photo"], image: ["right", "left"] },
  features: { columns: [3, 2, 4, 5, 6], band: BANDS },
  // Records' columns: the first (3) is for cards; a grid's own is 4 (RECORD_GRID_COLUMNS), a list has none.
  records: { layout: ["cards", "list", "grid"], columns: [3, 2, 4, 5, 6], band: BANDS },
  testimonials: { layout: ["cards", "carousel", "one"], band: BANDS },
  pricing: { highlight: "text", band: BANDS },
  // An FAQ's columns are its list's (every answer shown); the accordion is one column.
  faq: { layout: ["accordion", "list"], columns: [1, 2], band: BANDS },
  gallery: { columns: [3, 2, 4, 5, 6], band: BANDS },
  callToAction: { band: BANDS },
  contact: { band: BANDS },
  text: { band: BANDS },
  calculator: { band: BANDS },
};

/** How a landing page's header looks; HEADER_LOOKS has its keys and values. */
export interface HeaderLook {
  position?: "sticky" | "scrolling";
}

/**
 * The looks of a landing page's header, as SECTION_LOOKS has a section's: the first value is the
 * header's own. Its position: sticky (kept at the top as the page scrolls) or scrolling (away with it).
 */
export const HEADER_LOOKS: Record<string, readonly string[]> = {
  position: ["sticky", "scrolling"],
};

/** A records section's columns in the grid layout when the ux file does not say (today's four). */
export const RECORD_GRID_COLUMNS = 4;

export const UX_VERSION = "0.1";
export const TONES = ["neutral", "success", "warning", "danger"] as const;
export type Tone = (typeof TONES)[number];

/** Navigation icons, named by what they show. */
export const ICONS = [
  "users",
  "user",
  "file",
  "receipt",
  "cart",
  "package",
  "calendar",
  "layers",
  "book",
  "briefcase",
  "building",
  "chart",
  "clipboard",
  "home",
  "mail",
  "settings",
  "star",
  "tag",
  "truck",
  "list",
] as const;
export type Icon = (typeof ICONS)[number];

/** Words in a model's name and the icon they suggest; the first match wins. */
const ICON_WORDS: [RegExp, Icon][] = [
  [
    /customer|client|contact|member|people|person|user|staff|team|instructor|teacher|employee|student|author|coach/i,
    "users",
  ],
  [/invoice|document|contract|quote/i, "file"],
  [/payment|receipt|expense|transaction/i, "receipt"],
  [/order|purchase|cart/i, "cart"],
  [/product|item|inventory|stock|asset/i, "package"],
  [/session|booking|event|appointment|schedule|shift|meeting|reservation/i, "calendar"],
  [/type|category|class|group|kind/i, "layers"],
  [/shipment|delivery/i, "truck"],
  [/task|todo|ticket|issue/i, "clipboard"],
  [/project|deal|opportunity/i, "briefcase"],
  [/company|organi[sz]ation|supplier|vendor|account/i, "building"],
  [/article|post|page|lesson|course/i, "book"],
  [/message|email|mail/i, "mail"],
  [/report|metric|stat/i, "chart"],
  [/tag|label/i, "tag"],
];

/** A page's navigation icon: the one set in smithable.ux.yml, or one suggested by its kind or model. */
export function pageIcon(ux: UxIR, page: PageIR): Icon {
  const set = ux.pages[page.id]?.icon;
  if (set) return set;
  const { icon, manages } = patternInfo(page);
  if (icon) return icon as Icon;
  const model = manages() ?? "";
  return ICON_WORDS.find(([words]) => words.test(model))?.[1] ?? "list";
}
/** The built-in themes' names: the design delivery's four, then the theme library's nine and the theme lab's three. */
export const THEME_PRESETS = [
  "modern",
  "minimal",
  "playful",
  "corporate",
  "coastal",
  "navy",
  "editorial",
  "woodland",
  "contrast",
  "nordic",
  "pastel",
  "midnight",
  "craft",
  "restaurant",
  "street-food",
  "cafe",
  "warm-service",
  "quiet-workspace",
  "ink-and-brass",
  "workbench",
  "stillwater",
] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export { FONTS };

export function emptyUx(): UxIR {
  return {
    theme: { preset: "modern", density: "comfortable", motion: "subtle" },
    pages: {},
    tones: {},
    aiBadge: true,
    assistant: { voice: "plain" },
  };
}

/**
 * `record.lists` of a page (docs/design/conversation.md): each a list field of the page's model,
 * shown as a table or a thread. A thread reads its text from the listed model's first long text
 * field, so a model without one cannot be a thread; a required field the reply box cannot fill
 * (no default, not filled by the app, not the reference back) is warned about.
 */
function readRecord(
  ctx: ParseContext,
  node: ParsedNode | null,
  ir: SpecIR,
  model: ModelIR | undefined,
  where: string,
): { lists: Record<string, "thread" | "table">; subtitle?: NamePartIR; detail?: NamePartIR[] } {
  const lists: Record<string, "thread" | "table"> = {};
  let subtitle: NamePartIR | undefined;
  let detail: NamePartIR[] | undefined;
  // A line under the name: a part as namedBy takes them, checked against the page's model.
  const part = (text: string, at: ParsedNode): NamePartIR | undefined => {
    if (!model) {
      ctx.error(at, "invalid-key", `${where} shows no records to name.`);
      return undefined;
    }
    const read = readNamePart(text, model, ir.models);
    if ("problem" in read) {
      ctx.error(
        at,
        read.code ?? "invalid-value",
        `The record of ${where}: ${read.problem}`,
        read.hint,
      );
      return undefined;
    }
    return read.part;
  };
  for (const option of checkKeys(
    ctx,
    mapEntries(ctx, node, `the record of ${where}`) ?? [],
    `the record of ${where}`,
    {
      allowed: ["lists", "subtitle", "detail"],
    },
  )) {
    if (option.key === "subtitle") {
      const text = readString(ctx, option.value, `"subtitle" of the record of ${where}`);
      if (text !== undefined) subtitle = part(text, option.value as ParsedNode);
      continue;
    }
    if (option.key === "detail") {
      detail = [];
      for (const { name, at } of readNameList(
        ctx,
        option.value,
        `"detail" of the record of ${where}`,
      )) {
        const p = part(name, at as ParsedNode);
        if (!p) continue;
        if (detail.some((d) => d.field === p.field && d.through === p.through))
          ctx.error(at, "duplicate-name", `The record of ${where} shows ${name} twice.`);
        else detail.push(p);
      }
      continue;
    }
    for (const pair of mapEntries(ctx, option.value, `"lists" of ${where}`) ?? []) {
      const field = model?.fields.find((f) => f.name === pair.key);
      const look = readString(ctx, pair.value, `"${pair.key}" in "lists"`);
      if (!field || field.type.kind !== "relation" || !field.type.many) {
        ctx.error(
          pair.keyNode,
          "unknown-field",
          `${model?.name ?? where} has no list named "${pair.key}".`,
          didYouMean(
            pair.key,
            (model?.fields ?? [])
              .filter((f) => f.type.kind === "relation" && f.type.many)
              .map((f) => f.name),
          ),
        );
        continue;
      }
      if (look !== "thread" && look !== "table") {
        if (look !== undefined)
          ctx.error(pair.value, "invalid-value", `"${pair.key}" in "lists" is thread or table.`);
        continue;
      }
      const target = ir.models.find((m) => m.name === (field.type as { model: string }).model);
      if (look === "thread" && target) {
        const bindings = threadBindings(target);
        const text = bindings.body;
        if (!text) {
          ctx.error(
            pair.value,
            "invalid-value",
            `${target.name} cannot be a thread: it has no long text field (text or markdown) to show as the message.`,
          );
          continue;
        }
        // Where the rule had to pick one of several fields, the model should say which
        // (docs/design/conversation.md §2, `thread`).
        if (bindings.ambiguous.length)
          ctx.warning(
            pair.value,
            "thread-ambiguous",
            `${target.name} has several fields that could be the thread's ${bindings.ambiguous.join(", ")}: the first is used (${bindings.ambiguous.map((p) => (p === "side" ? bindings.side?.field.name : bindings[p]?.name) ?? "?").join(", ")}).`,
            `Say which in smithable.yml: ${target.name}: { thread: { ${bindings.ambiguous.map((p) => (p === "side" ? `side: { field: ${bindings.side?.field.name}, ours: ${bindings.side?.ours} }` : `${p}: ${bindings[p]?.name}`)).join(", ")} } } (setThread).`,
          );
        // What the reply box cannot fill: it asks for the text and the attachments, fixes the
        // reference back, and leaves the rest to defaults and the app.
        for (const f of target.fields) {
          const filled =
            f === text ||
            !f.required ||
            f.formula ||
            f.default !== undefined ||
            f.defaultMe ||
            f.defaultFormula ||
            (f.type.kind === "relation" && f.type.model === model?.name && !f.type.many) ||
            (f.type.kind === "scalar" &&
              ["file", "files", "picture", "pictures"].includes(f.type.name));
          if (!filled)
            ctx.warning(
              pair.value,
              "thread-needs-form",
              `${target.name}.${f.name} is required and the reply box does not ask for it: give it a default, or \`by: app\`, or the thread shows Add ${humanize(target.name).toLowerCase()} instead.`,
            );
        }
      }
      lists[pair.key] = look;
    }
  }
  return { lists, ...(subtitle ? { subtitle } : {}), ...(detail ? { detail } : {}) };
}

/** Parses smithable.ux.yml and checks every page and field it names against the spec. */
/**
 * Why a page's filter cannot be picked by `filters.pick` (A 208), in the words the ux file's check
 * and setFilterPick both give; undefined for a filter on a reference to a record.
 */
export function notPickable(name: string, field: FieldIR | undefined): string | undefined {
  if (field?.type.kind === "relation" && field.type.model === "User")
    return `${name} refers to a person; its filter is Mine, Unassigned and the people by name, never a search.`;
  if (field?.type.kind === "relation" && !field.type.many) return undefined;
  const kind =
    field?.type.kind === "choice"
      ? "a choice"
      : field
        ? `a ${field.type.kind === "scalar" ? field.type.name : "list"}`
        : "not a field";
  return `${name} is ${kind}; only a filter on a reference can be a search.`;
}

export function validateUx(
  file: { path: string; text: string },
  ir: SpecIR,
  /** The project's own themes (themes/<name>.yml), which `theme.preset` may name too. */
  themes: readonly ThemeIR[] = [],
): { ux?: UxIR; diagnostics: Diagnostic[] } {
  const lines = new LineCounter();
  const doc = parseDocument(file.text, {
    lineCounter: lines,
    uniqueKeys: true,
    prettyErrors: false,
  });
  const ctx = new ParseContext(file.path, lines);
  const ux = emptyUx();
  const bands: BandAt[] = [];
  const done = () => ({
    ...(hasErrors(ctx.diagnostics) ? {} : { ux }),
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
  const entries = mapEntries(ctx, root, "smithable.ux.yml") ?? [];
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const version = byKey.get("smithableUx");
  const versionText = isScalar(version?.value)
    ? (version.value.source ?? String(version.value.value))
    : undefined;
  if (versionText !== UX_VERSION) {
    ctx.error(
      version?.value ?? root,
      "invalid-version",
      `The ux file must start with "smithableUx: ${UX_VERSION}".`,
    );
    return done();
  }
  const known = checkKeys(ctx, entries, "smithable.ux.yml", {
    allowed: [
      "smithableUx",
      "theme",
      "pages",
      "tones",
      "aiBadge",
      "assistant",
      "navigation",
      "chrome",
    ],
    later: ["menus", "sections"],
  });

  for (const { key, value } of known) {
    if (key === "theme") readTheme(ctx, value, `"theme"`, themes, ux.theme);
    if (key === "aiBadge") ux.aiBadge = readBoolean(ctx, value, '"aiBadge"') ?? true;
    if (key === "navigation" || key === "chrome") {
      const allowed: readonly string[] = key === "navigation" ? NAVIGATIONS : CHROMES;
      const said = readString(ctx, value, `"${key}"`);
      if (said !== undefined && allowed.includes(said)) ux[key] = said as never;
      else if (said !== undefined)
        ctx.error(
          value,
          "invalid-value",
          `"${key}" is ${allowed.join(", ").replace(/, ([^,]*)$/, " or $1")}.`,
        );
    }
    if (key === "assistant")
      for (const option of checkKeys(
        ctx,
        mapEntries(ctx, value, '"assistant"') ?? [],
        '"assistant"',
        {
          allowed: ["voice"],
        },
      )) {
        const voice = readString(ctx, option.value, '"voice" of "assistant"');
        if ((VOICES as readonly string[]).includes(voice ?? ""))
          ux.assistant.voice = voice as Voice;
        else if (voice !== undefined)
          ctx.error(option.value, "invalid-value", `"voice" is ${VOICES.join(", ")}.`);
      }
    if (key === "tones") {
      for (const entry of mapEntries(ctx, value, `"tones"`) ?? []) {
        const [modelName = "", fieldName = ""] = entry.key.split(".");
        const model = ir.models.find((m) => m.name === modelName);
        const field = model?.fields.find((f) => f.name === fieldName);
        if (!model || !field) {
          ctx.error(
            entry.keyNode,
            "unknown-field",
            `There is no field "${entry.key}"; name a choice field as Model.field.`,
          );
          continue;
        }
        if (field.type.kind !== "choice") {
          ctx.error(entry.keyNode, "invalid-field", `${entry.key} is not a choice field.`);
          continue;
        }
        const values = field.type.values;
        const tones: Record<string, Tone> = {};
        for (const choice of mapEntries(ctx, entry.value, `"${entry.key}"`) ?? []) {
          const tone = readString(ctx, choice.value, `"${choice.key}"`);
          if (!values.includes(choice.key)) {
            ctx.error(
              choice.keyNode,
              "unknown-value",
              `${entry.key} has no value "${choice.key}".`,
              didYouMean(choice.key, values) ?? `Its values: ${values.join(", ")}.`,
            );
          } else if (tone !== undefined && !(TONES as readonly string[]).includes(tone)) {
            ctx.error(
              choice.value,
              "unknown-tone",
              `"${tone}" is not a tone.`,
              didYouMean(tone, TONES) ?? `Available: ${TONES.join(", ")}.`,
            );
          } else if (tone !== undefined) tones[choice.key] = tone as Tone;
        }
        ux.tones[entry.key] = tones;
      }
    }
    if (key === "pages") {
      for (const page of mapEntries(ctx, value, `"pages"`) ?? []) {
        const spec = ir.pages.find((p) => p.id === page.key);
        if (!spec) {
          ctx.error(
            page.keyNode,
            "unknown-page",
            `There is no page named "${page.key}" in smithable.yml.`,
            didYouMean(
              page.key,
              ir.pages.map((p) => p.id),
            ),
          );
          continue;
        }
        const model = ir.models.find((m) => m.name === pageModel(spec));
        // A calculator's fields are the page's own (docs/design/calculator.md).
        const calculator = spec.pattern.kind === "calculator" ? spec.pattern.calculator : undefined;
        const owner = model?.name ?? (calculator ? page.key : undefined);
        const fields = (model?.fields ?? calculator?.fields ?? []).filter(
          (f) => !(f.type.kind === "relation" && f.type.many),
        );
        const where = `page "${page.key}"`;
        const result: PageUx = {};
        const names = (node: ParsedNode | null, what: string, allowComputed: boolean) =>
          readNameList(ctx, node, what).flatMap(({ name, at }) => {
            const field = fields.find((f) => f.name === name);
            if (!field) {
              ctx.error(
                at,
                "unknown-field",
                `${owner} has no field named "${name}" to show.`,
                didYouMean(
                  name,
                  fields.map((f) => f.name),
                ),
              );
              return [];
            }
            if (field.formula && !allowComputed) {
              ctx.error(
                at,
                "invalid-field",
                `"${name}" is computed, so it is not entered in the form.`,
              );
              return [];
            }
            return [name];
          });
        for (const part of checkKeys(ctx, mapEntries(ctx, page.value, where) ?? [], where, {
          allowed: [
            "icon",
            "table",
            "form",
            "record",
            "sections",
            "header",
            "theme",
            "filters",
            "frame",
            "calendar",
          ],
          later: ["detail"],
        })) {
          if (part.key === "calendar") {
            if (spec.pattern.kind !== "calendar") {
              ctx.error(
                part.keyNode,
                "invalid-key",
                `"calendar" belongs to a calendar page; ${page.key} is not one.`,
              );
              continue;
            }
            const calendar: NonNullable<PageUx["calendar"]> = {};
            // The calendar's own model (its pattern names it).
            const model = ir.models.find(
              (m) => m.name === (spec.pattern as { model?: string }).model,
            );
            const own = model?.fields ?? [];
            for (const option of checkKeys(
              ctx,
              mapEntries(ctx, part.value, `the calendar of ${where}`) ?? [],
              `the calendar of ${where}`,
              { allowed: ["colorBy", "capacity"] },
            )) {
              if (option.key === "colorBy") {
                // A choice of the model, or of the record a reference points to (classType.level).
                const said = readString(ctx, option.value, `"colorBy" of the calendar of ${where}`);
                if (said === undefined) continue;
                const [first = "", second, third] = said.split(".");
                const field = own.find((f) => f.name === first);
                const through =
                  field?.type.kind === "relation" && !field.type.many && field.type.model !== "User"
                    ? ir.models.find((m) => m.name === (field.type as { model: string }).model)
                    : undefined;
                const choice =
                  second === undefined ? field : through?.fields.find((f) => f.name === second);
                if (!field)
                  ctx.error(
                    option.value,
                    "unknown-field",
                    `${model?.name} has no field named "${first}".`,
                    didYouMean(
                      first,
                      own.map((f) => f.name),
                    ),
                  );
                else if (second === undefined && through)
                  // The referenced record itself: a stable hue for each (classType).
                  calendar.colorBy = { kind: "record", model: through.name, reference: first };
                else if (third !== undefined || (second !== undefined && !through))
                  ctx.error(
                    option.value,
                    "invalid-value",
                    `"colorBy" is a choice of ${model?.name}, a reference (each record its own colour), or a choice one reference away, as in classType.level.`,
                  );
                else if (!choice)
                  ctx.error(
                    option.value,
                    "unknown-field",
                    `${through?.name} has no field named "${second}".`,
                    didYouMean(second ?? "", through?.fields.map((f) => f.name) ?? []),
                  );
                else if (choice.type.kind !== "choice" || choice.formula)
                  ctx.error(
                    option.value,
                    "invalid-value",
                    `"colorBy" needs a stored choice: ${said} is not one.`,
                  );
                else
                  calendar.colorBy = {
                    kind: "choice",
                    model: through?.name ?? (model?.name as string),
                    field: choice.name,
                    ...(second !== undefined ? { reference: first } : {}),
                  };
              } else {
                // The places left of the places there are: two number fields of the model.
                const parts = checkKeys(
                  ctx,
                  mapEntries(ctx, option.value, `"capacity" of the calendar of ${where}`) ?? [],
                  `"capacity" of the calendar of ${where}`,
                  { allowed: ["left", "of", "look"] },
                );
                const number = (key: string) => {
                  const entry = parts.find((p) => p.key === key);
                  if (!entry) {
                    if (key !== "look")
                      ctx.error(
                        option.keyNode,
                        "invalid-value",
                        `"capacity" of the calendar of ${where} names "left" and "of", two number fields.`,
                      );
                    return undefined;
                  }
                  const name = readString(ctx, entry.value, `"${key}" of the capacity`);
                  const field = own.find((f) => f.name === name);
                  if (name !== undefined && !field)
                    ctx.error(
                      entry.value,
                      "unknown-field",
                      `${model?.name} has no field named "${name}".`,
                      didYouMean(
                        name,
                        own.map((f) => f.name),
                      ),
                    );
                  else if (
                    field &&
                    !(field.type.kind === "scalar" && ["int", "decimal"].includes(field.type.name))
                  )
                    ctx.error(
                      entry.value,
                      "invalid-value",
                      `"${key}" of the capacity needs a number field: ${name} is not one.`,
                    );
                  else return name;
                  return undefined;
                };
                const left = number("left");
                const of = number("of");
                const lookEntry = parts.find((p) => p.key === "look");
                const look = lookEntry
                  ? readString(ctx, lookEntry.value, `"look" of the capacity`)
                  : "number";
                if (look !== undefined && look !== "number" && look !== "pips" && look !== "bar")
                  ctx.error(
                    lookEntry?.value ?? null,
                    "invalid-value",
                    `"look" of the capacity is number, pips or bar.`,
                  );
                else if (left && of)
                  calendar.capacity = {
                    left,
                    of,
                    look: (look ?? "number") as "number" | "pips" | "bar",
                  };
              }
            }
            if (calendar.colorBy || calendar.capacity) result.calendar = calendar;
            continue;
          }
          if (part.key === "frame") {
            const frame = readString(ctx, part.value, `"frame" of ${where}`);
            if (frame === "site" || frame === "app" || frame === "none") result.frame = frame;
            else if (frame !== undefined)
              ctx.error(part.value, "invalid-value", `"frame" of ${where} is site, app or none.`);
            continue;
          }
          if (part.key === "filters") {
            // How the page's filters are shown and picked; which fields filter is the spec's
            // (smithable.yml's filters), so the two never mix.
            const offered = spec.filters ?? [];
            for (const option of checkKeys(
              ctx,
              mapEntries(ctx, part.value, `the filters of ${where}`) ?? [],
              `the filters of ${where}`,
              { allowed: ["shown", "pick", "look"] },
            )) {
              if (option.key === "look") {
                const look = readString(ctx, option.value, `"look" of the filters of ${where}`);
                if (look === "chips") result.filtersLook = look;
                else if (look !== undefined && look !== "default")
                  ctx.error(
                    option.value,
                    "invalid-value",
                    `"look" of the filters of ${where} is default or chips.`,
                  );
                continue;
              }
              if (option.key === "pick") {
                const model = ir.models.find((m) => m.name === pageModel(spec));
                const pick: Record<string, "list" | "search"> = {};
                for (const entry of mapEntries(
                  ctx,
                  option.value,
                  `"pick" of the filters of ${where}`,
                ) ?? []) {
                  const name = entry.key;
                  const field = model?.fields.find((x) => x.name === name);
                  if (!offered.includes(name)) {
                    ctx.error(
                      entry.keyNode,
                      "unknown-filter",
                      `${page.key} has no filter named "${name}" to pick; its filters are ${offered.length ? offered.join(", ") : "none"} (smithable.yml).`,
                      didYouMean(name, offered),
                    );
                    continue;
                  }
                  const refused = notPickable(name, field);
                  if (refused) {
                    ctx.error(entry.keyNode, "invalid-value", refused);
                    continue;
                  }
                  const how = readString(ctx, entry.value, `"pick" of ${name} in ${where}`);
                  if (how === "list" || how === "search") pick[name] = how;
                  else if (how !== undefined)
                    ctx.error(
                      entry.value,
                      "invalid-value",
                      `"pick" of ${name} in ${where} is list or search.`,
                    );
                }
                if (Object.keys(pick).length) result.filterPick = pick;
                continue;
              }
              const names = readNameList(ctx, option.value, `"shown" of the filters of ${where}`);
              const shown: string[] = [];
              for (const { name, at } of names) {
                if (!offered.includes(name))
                  ctx.error(
                    at,
                    "unknown-filter",
                    `${page.key} has no filter named "${name}" to show first; its filters are ${offered.length ? offered.join(", ") : "none"} (smithable.yml).`,
                    didYouMean(name, offered),
                  );
                else if (!shown.includes(name)) shown.push(name);
              }
              // An empty list is no choice: every filter shows.
              if (shown.length) result.filtersShown = shown;
            }
            continue;
          }
          if (part.key === "sections") {
            result.looks = readSectionLooks(ctx, part.value, spec, where, bands);
            continue;
          }
          if (part.key === "header") {
            // The header is a landing page's own frame's; other pages' frames are the app's.
            if (spec.pattern.kind !== "landing")
              ctx.error(
                part.keyNode,
                "invalid-key",
                `A header's look is for a landing page; ${page.key} is not one.`,
              );
            else {
              const header = readHeaderLook(ctx, part.value, where);
              if (Object.keys(header).length) result.header = header;
            }
            continue;
          }
          if (part.key === "theme") {
            // Only a landing page, which has its own frame: a crud page in another theme would
            // look like another app.
            if (spec.pattern.kind !== "landing")
              ctx.error(
                part.keyNode,
                "invalid-key",
                `A theme of its own is for a landing page; ${page.key} is not one.`,
              );
            else {
              result.theme = {};
              readTheme(ctx, part.value, `the theme of ${where}`, themes, result.theme);
            }
            continue;
          }
          if (part.key === "record") {
            const record = readRecord(ctx, part.value, ir, model, where);
            if (Object.keys(record.lists).length) result.lists = record.lists;
            if (record.subtitle) result.subtitle = record.subtitle;
            if (record.detail?.length) result.detail = record.detail;
            continue;
          }
          if (part.key === "icon") {
            const icon = readString(ctx, part.value, `"icon"`);
            if (icon !== undefined && !(ICONS as readonly string[]).includes(icon))
              ctx.error(
                part.value,
                "unknown-icon",
                `There is no icon "${icon}".`,
                didYouMean(icon, ICONS) ?? `Available: ${ICONS.join(", ")}.`,
              );
            else if (icon !== undefined) result.icon = icon as Icon;
            continue;
          }
          const partWhere = `the ${part.key} of ${where}`;
          for (const option of checkKeys(
            ctx,
            mapEntries(ctx, part.value, partWhere) ?? [],
            partWhere,
            {
              allowed:
                part.key === "table"
                  ? ["columns", "below", "sort", "view", "totals", "mark", "actions"]
                  : ["fieldOrder", "sections", "columns", "control", "results"],
              later: part.key === "table" ? ["pageSize"] : [],
            },
          )) {
            if (part.key === "form" && option.key === "columns") {
              const n = isScalar(option.value) ? option.value.value : undefined;
              if (n === 1 || n === 2) result.formColumns = n;
              else ctx.error(option.value, "invalid-value", `"columns" of a form is 1 or 2.`);
            } else if (option.key === "sort") {
              const sort = readString(ctx, option.value, `"sort" of ${where}`);
              if (sort === undefined) continue;
              const name = sort.replace(/^-/, "");
              if (fields.some((f) => f.name === name)) result.sort = sort;
              else
                ctx.error(
                  option.value,
                  "unknown-field",
                  `${owner} has no field named "${name}" to sort by.`,
                  didYouMean(
                    name,
                    fields.map((f) => f.name),
                  ),
                );
            } else if (option.key === "view") {
              const view = readString(ctx, option.value, `"view" of ${where}`);
              if (view === "table" || view === "cards") result.view = view;
              else if (view !== undefined)
                ctx.error(option.value, "invalid-value", `"view" is table or cards.`);
            } else if (option.key === "mark") {
              // A picture mark needs a picture to show: the model's first picture field.
              const mark = readString(ctx, option.value, `"mark" of ${where}`);
              const picture = fields.some(
                (f) => !f.formula && f.type.kind === "scalar" && f.type.name === "picture",
              );
              if (mark === "initials" || (mark === "picture" && picture)) result.mark = mark;
              else if (mark === "picture")
                ctx.error(
                  option.value,
                  "invalid-value",
                  `${owner} has no picture field to show; "initials" works for any model.`,
                );
              else if (mark !== undefined)
                ctx.error(
                  option.value,
                  "invalid-value",
                  `"mark" of ${where} is initials or picture.`,
                );
            } else if (option.key === "actions") {
              const actions = readString(ctx, option.value, `"actions" of ${where}`);
              if (actions === "menu") result.rowActions = "menu";
              else if (actions !== undefined && actions !== "below")
                ctx.error(
                  option.value,
                  "invalid-value",
                  `"actions" of ${where} is below (buttons in the row) or menu.`,
                );
            } else if (option.key === "sections") {
              result.sections = readSections(ctx, option.value, where, names);
            } else if (option.key === "control") {
              result.control = {};
              for (const pair of mapEntries(ctx, option.value, `"control" of ${where}`) ?? []) {
                const field = fields.find((f) => f.name === pair.key);
                const control = readString(ctx, pair.value, `"${pair.key}" in "control"`);
                if (!field) {
                  ctx.error(
                    pair.keyNode,
                    "unknown-field",
                    `${owner} has no field named "${pair.key}".`,
                    didYouMean(
                      pair.key,
                      fields.map((f) => f.name),
                    ),
                  );
                  continue;
                }
                if (control === undefined) continue;
                if (!(CONTROLS as readonly string[]).includes(control)) {
                  ctx.error(
                    pair.value,
                    "unknown-control",
                    `"${control}" is not a control.`,
                    didYouMean(control, CONTROLS) ?? `Available: ${CONTROLS.join(", ")}.`,
                  );
                  continue;
                }
                const unfit = field.formula
                  ? "a computed field is shown, not entered"
                  : controlUnfit(field, control as Control);
                if (unfit)
                  ctx.error(
                    pair.value,
                    "invalid-control",
                    `${pair.key} cannot be a ${control}: ${unfit}.`,
                  );
                else if (control !== "input") result.control[pair.key] = control as Control;
              }
            } else if (option.key === "columns")
              result.columns = names(option.value, `the columns of ${where}`, true);
            else if (option.key === "totals") {
              const totals: string[] = [];
              for (const { name, at } of readNameList(
                ctx,
                option.value,
                `the totals of ${where}`,
              )) {
                const field = fields.find((f) => f.name === name);
                if (!field) {
                  ctx.error(
                    at,
                    "unknown-field",
                    `${owner} has no field named "${name}" to total.`,
                    didYouMean(
                      name,
                      fields.map((f) => f.name),
                    ),
                  );
                  continue;
                }
                if (!(field.type.kind === "scalar" && NUMBERS.includes(field.type.name)))
                  ctx.error(
                    at,
                    "invalid-field",
                    `"${name}" is not a number or an amount, so it has no total.`,
                  );
                else if (field.formula)
                  ctx.error(
                    at,
                    "invalid-field",
                    `"${name}" is computed per record, so the list has no total of it.`,
                  );
                else if (!totals.includes(name)) totals.push(name);
              }
              if (totals.length) result.totals = totals;
            } else if (option.key === "below") {
              result.below = {};
              for (const pair of mapEntries(ctx, option.value, `"below" of ${where}`) ?? []) {
                const known = (name: string, at: ParsedNode | null) => {
                  if (fields.some((f) => f.name === name)) return true;
                  ctx.error(
                    at,
                    "unknown-field",
                    `${model?.name} has no field named "${name}" to show.`,
                    didYouMean(
                      name,
                      fields.map((f) => f.name),
                    ),
                  );
                  return false;
                };
                const second = readString(ctx, pair.value, `"${pair.key}" in "below"`);
                if (
                  known(pair.key, pair.keyNode) &&
                  second !== undefined &&
                  known(second, pair.value)
                )
                  result.below[pair.key] = second;
              }
            } else if (option.key === "results") {
              // Where a calculator's results go on a wide screen; a phone shows them below.
              const results = readString(ctx, option.value, `"results" of ${where}`);
              if (!calculator)
                ctx.error(
                  option.keyNode,
                  "invalid-key",
                  `"results" is for a calculator page; ${page.key} is not one.`,
                );
              else if (results !== "beside" && results !== "below")
                ctx.error(
                  option.value,
                  "invalid-value",
                  `"results" of ${where} is "beside" or "below".`,
                );
              else result.results = results;
            } else result.fieldOrder = names(option.value, `the field order of ${where}`, false);
          }
        }
        if (result.sections && result.fieldOrder)
          ctx.error(
            page.keyNode,
            "conflict",
            `${capitalize(where)} has both "sections" and "fieldOrder"; sections order the fields.`,
          );
        ux.pages[page.key] = result;
      }
    }
  }
  checkBands(ctx, ux, bands, themes);
  return done();
}

/** A band a section's look gives, where it is written. */
type BandAt = { page: string; section: string; band: Band; node: ParsedNode | null };

/**
 * A band whose text would not read on its surface, in the page's theme (the app's, or the
 * landing page's own, with the brand's background) in light or dark mode: a warning, as the
 * theme's own colors are checked (checkContrast), not a silent result.
 */
function checkBands(
  ctx: ParseContext,
  ux: UxIR,
  bands: BandAt[],
  themes: readonly ThemeIR[] | undefined,
): void {
  for (const b of bands) {
    const own = { ...ux.theme, ...ux.pages[b.page]?.theme };
    const named = themeNamed(own.preset ?? "modern", themes);
    if (!named) continue;
    const theme = (own.background && withBackground(named, own.background)) || named;
    for (const mode of ["light", "dark"] as const)
      if (bandLowContrast(tokensOf(theme, mode), b.band).length)
        ctx.warning(
          b.node,
          "band-contrast",
          // Plain words, as a theme's own contrast is said (hardToRead): no colour names, no ratios.
          `On the ${b.band} band of ${b.section} (page "${b.page}"), in ${mode} mode, the text may be hard to read.`,
          `Choose another band (setSectionLook ${b.page} ${b.section} band muted|inverse|primary|none), or a theme whose colours read on that surface.`,
        );
  }
}

/** A landing page's `header:` in the ux file, checked against HEADER_LOOKS. */
function readHeaderLook(ctx: ParseContext, node: ParsedNode | null, where: string): HeaderLook {
  const at = `the header of ${where}`;
  const look: HeaderLook = {};
  for (const option of checkKeys(ctx, mapEntries(ctx, node, at) ?? [], at, {
    allowed: Object.keys(HEADER_LOOKS),
  })) {
    const values = HEADER_LOOKS[option.key] ?? [];
    const value = isScalar(option.value) ? option.value.value : undefined;
    if (typeof value !== "string" || !values.includes(value)) {
      ctx.error(
        option.value,
        "invalid-value",
        `"${option.key}" of ${at} is one of ${values.join(", ")}.`,
      );
      continue;
    }
    (look as Record<string, unknown>)[option.key] = value;
  }
  return look;
}

/** A landing page's `sections:` in the ux file: each named section's look, checked by its kind. */
function readSectionLooks(
  ctx: ParseContext,
  node: ParsedNode | null,
  page: PageIR,
  where: string,
  /** The bands given, for their contrast once the themes are read. */
  bands: BandAt[],
): Record<string, SectionLook> {
  const looks: Record<string, SectionLook> = {};
  const sections = page.sections.filter((s) => !s.own);
  if (sections.length === 0) {
    ctx.error(
      node,
      "invalid-key",
      `"sections" are looks of a page's sections; ${page.id} has none.`,
    );
    return looks;
  }
  for (const entry of mapEntries(ctx, node, `"sections" of ${where}`) ?? []) {
    const section = sections.find((s) => s.name === entry.key);
    if (!section) {
      ctx.error(
        entry.keyNode,
        "unknown-section",
        `${page.id} has no section named "${entry.key}".`,
        didYouMean(
          entry.key,
          sections.map((s) => s.name),
        ),
      );
      continue;
    }
    const allowed = SECTION_LOOKS[section.kind] ?? {};
    const at = `the look of ${entry.key} on ${where}`;
    const look: SectionLook = {};
    for (const option of checkKeys(ctx, mapEntries(ctx, entry.value, at) ?? [], at, {
      allowed: Object.keys(allowed),
    })) {
      const values = allowed[option.key];
      const value = isScalar(option.value) ? option.value.value : undefined;
      if (
        values === "text"
          ? typeof value !== "string" || !value.trim()
          : !values?.includes(value as string | number)
      ) {
        ctx.error(
          option.value,
          "invalid-value",
          values === "text"
            ? `"${option.key}" of ${at} is a text.`
            : `"${option.key}" of ${at} is one of ${values?.join(", ")}.`,
        );
        continue;
      }
      (look as Record<string, unknown>)[option.key] = value;
    }
    // Columns a layout does not have: an FAQ's accordion is one column, records as a list rows.
    if (section.kind === "faq" && look.columns !== undefined && look.layout !== "list")
      ctx.warning(
        entry.value,
        "invalid-value",
        `"columns" of ${at} is for the list layout; the accordion is one column.`,
        `Add layout: list (setSectionLook ${page.id} ${entry.key} layout list).`,
      );
    if (section.kind === "records" && look.columns !== undefined && look.layout === "list")
      ctx.warning(
        entry.value,
        "invalid-value",
        `"columns" of ${at} is for cards and a grid; a list is one row per record.`,
      );
    if (look.band && look.band !== "none")
      bands.push({ page: page.id, section: entry.key, band: look.band, node: entry.value });
    looks[entry.key] = look;
  }
  return looks;
}

/** A theme's keys (preset, brand, density, motion) into `target`: the app's, or a landing page's own. */
function readTheme(
  ctx: ParseContext,
  value: ParsedNode | null,
  where: string,
  themes: readonly ThemeIR[] | undefined,
  target: Partial<UxIR["theme"]>,
): void {
  let densityGiven = false;
  let motionGiven = false;
  let backgroundAt: ParsedNode | null = null;
  for (const entry of checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
    allowed: ["preset", "brand", "density", "motion"],
    later: ["radius", "darkMode"],
  })) {
    if (entry.key === "preset") {
      const preset = readString(ctx, entry.value, `"preset"`);
      const names = themeNames(themes);
      if (preset !== undefined && !names.includes(preset)) {
        ctx.error(
          entry.value,
          "unknown-preset",
          `There is no theme "${preset}".`,
          didYouMean(preset, names) ?? `Available: ${names.join(", ")}.`,
        );
      } else if (preset !== undefined) target.preset = preset;
    } else if (entry.key === "density") {
      const density = readString(ctx, entry.value, `"density"`);
      densityGiven = true;
      if (density === "comfortable" || density === "standard" || density === "compact")
        target.density = density;
      else if (density !== undefined)
        ctx.error(
          entry.value,
          "invalid-value",
          `"density" must be comfortable, standard or compact.`,
        );
    } else if (entry.key === "motion") {
      const motion = readString(ctx, entry.value, `"motion"`);
      motionGiven = true;
      if (motion === "none" || motion === "subtle" || motion === "lively") target.motion = motion;
      else if (motion !== undefined)
        ctx.error(entry.value, "invalid-value", `"motion" must be none, subtle or lively.`);
    } else {
      for (const brand of checkKeys(ctx, mapEntries(ctx, entry.value, `"brand"`) ?? [], `"brand"`, {
        allowed: ["primary", "background", "font"],
      })) {
        const text = readString(ctx, brand.value, `"${brand.key}"`);
        if (text === undefined) continue;
        if (brand.key === "primary" || brand.key === "background") {
          if (/^#[0-9a-fA-F]{6}$/.test(text)) target[brand.key] = text.toLowerCase();
          else
            ctx.error(
              brand.value,
              "invalid-color",
              `"${brand.key}" must be a color like "#2563eb".`,
            );
          if (brand.key === "background") backgroundAt = brand.value;
        } else if ((FONTS as readonly string[]).includes(text)) {
          target.font = text;
        } else {
          ctx.error(
            brand.value,
            "unknown-font",
            `"${text}" is not one of the available fonts.`,
            didYouMean(text, FONTS) ?? `Available: ${FONTS.join(", ")}.`,
          );
        }
      }
    }
  }
  // A background the theme cannot keep readable (a color too loud for text) is said, not used.
  const theme = themeNamed(target.preset ?? "modern", themes);
  if (target.background && theme && !withBackground(theme, target.background)) {
    ctx.warning(
      backgroundAt,
      "unreadable-background",
      `On the background ${target.background}, the ${theme.name} theme's text would not read; it keeps its own background.`,
    );
    delete target.background;
  }
  // Without a density of its own, a theme's own (corporate is compact).
  const own = target.preset ? themeNamed(target.preset, themes)?.density : undefined;
  if (!densityGiven && own) target.density = own;
  // The same for motion (playful is lively).
  const moves = target.preset ? themeNamed(target.preset, themes)?.motion : undefined;
  if (!motionGiven && moves) target.motion = moves;
}

/** A form's groups: a list of { name, fields }, no field in two of them. */
function readSections(
  ctx: ParseContext,
  node: ParsedNode | null,
  where: string,
  names: (node: ParsedNode | null, what: string, allowComputed: boolean) => string[],
): { name: string; fields: string[] }[] {
  if (!isSeq(node)) {
    ctx.error(node, "expected-list", `"sections" of ${where} is a list of { name, fields }.`);
    return [];
  }
  const sections: { name: string; fields: string[] }[] = [];
  const seen = new Set<string>();
  for (const item of node.items as ParsedNode[]) {
    const entries = checkKeys(
      ctx,
      mapEntries(ctx, item, `a section of ${where}`) ?? [],
      `a section of ${where}`,
      {
        allowed: ["name", "fields"],
      },
    );
    const name = readString(
      ctx,
      entries.find((e) => e.key === "name")?.value ?? null,
      `"name" of a section of ${where}`,
    );
    if (name === undefined) continue;
    if (!/^[a-z][A-Za-z0-9-]*$/.test(name) || sections.some((s) => s.name === name)) {
      ctx.error(
        item,
        "invalid-value",
        `A section's name is camelCase or kebab-case and used once: "${name}".`,
      );
      continue;
    }
    const fields = names(
      entries.find((e) => e.key === "fields")?.value ?? null,
      `the fields of section "${name}" of ${where}`,
      false,
    );
    for (const f of fields)
      if (seen.has(f)) ctx.error(item, "conflict", `"${f}" is in two sections of ${where}.`);
      else seen.add(f);
    sections.push({ name, fields });
  }
  return sections;
}
