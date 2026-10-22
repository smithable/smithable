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
import type { FieldIR, ModelIR, PageIR, SpecIR } from "./ir.js";
import { capitalize, humanize } from "./naming.js";
import { pageModel, patternInfo } from "./patterns.js";
import { didYouMean } from "./suggest.js";
import { FONTS, type ThemeIR, themeNamed, themeNames, withBackground } from "./theme.js";
import { threadBindings } from "./thread.js";

/**
 * How the app looks, from smithable.ux.yml (ARCHITECTURE §3.2). Technology-neutral:
 * presets and choices, never CSS. Everything is optional.
 */
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
  /** Ask's manner (docs/design/ask-defaults.md §2): a fixed set of prompt lines each, plain by default. */
  assistant: { voice: Voice };
}

/** The assistant's voices: plain (short, no pleasantries), friendly, formal. */
export const VOICES = ["plain", "friendly", "formal"] as const;
export type Voice = (typeof VOICES)[number];

export interface PageUx {
  /** The page's icon in navigation; without it one is chosen from the model's name. */
  icon?: Icon;
  /** The table's columns, in order. */
  columns?: string[];
  /** A second field shown under a column's value, e.g. { email: "phone" }. */
  below?: Record<string, string>;
  /** The list's order until someone sorts it: a field, or "-field" for descending. */
  sort?: string;
  /** How the list looks on a wide screen; a phone shows cards anyway. */
  view?: "table" | "cards";
  /** The form's fields in this order; fields not listed follow. */
  fieldOrder?: string[];
  /** A calculator's results beside its inputs on a wide screen (the default), or below them. */
  results?: "beside" | "below";
  /** A landing page's own theme: the keys it changes from the app's (docs/design/look.md §1.5). */
  theme?: Partial<UxIR["theme"]>;
  /** A landing page's sections' looks, by section name (docs/design/look.md §1.4); the ux file's
   * page-level `sections`, not the form's. */
  looks?: Record<string, SectionLook>;
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
}

/**
 * The looks each section kind has: a key's allowed values, or "text" for any (a pricing plan's
 * name). The first value of a layout is the kind's own look, used when none is given.
 */
export const SECTION_LOOKS: Partial<
  Record<string, Record<string, readonly (string | number)[] | "text">>
> = {
  hero: { layout: ["split", "centered", "plain", "cover"], image: ["right", "left"] },
  features: { columns: [3, 2, 4] },
  records: { layout: ["cards", "list", "grid"] },
  testimonials: { layout: ["cards", "carousel", "one"] },
  pricing: { highlight: "text" },
  faq: { layout: ["accordion", "list"] },
};

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
function readRecordLists(
  ctx: ParseContext,
  node: ParsedNode | null,
  ir: SpecIR,
  model: ModelIR | undefined,
  where: string,
): Record<string, "thread" | "table"> {
  const lists: Record<string, "thread" | "table"> = {};
  for (const option of checkKeys(
    ctx,
    mapEntries(ctx, node, `the record of ${where}`) ?? [],
    `the record of ${where}`,
    {
      allowed: ["lists"],
    },
  )) {
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
  return lists;
}

/** Parses smithable.ux.yml and checks every page and field it names against the spec. */
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
    allowed: ["smithableUx", "theme", "pages", "tones", "aiBadge", "assistant"],
    later: ["menus", "sections"],
  });

  for (const { key, value } of known) {
    if (key === "theme") readTheme(ctx, value, `"theme"`, themes, ux.theme);
    if (key === "aiBadge") ux.aiBadge = readBoolean(ctx, value, '"aiBadge"') ?? true;
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
          allowed: ["icon", "table", "form", "record", "sections", "theme"],
          later: ["detail", "calendar"],
        })) {
          if (part.key === "sections") {
            result.looks = readSectionLooks(ctx, part.value, spec, where);
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
            result.lists = readRecordLists(ctx, part.value, ir, model, where);
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
                  ? ["columns", "below", "sort", "view"]
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
            else if (option.key === "below") {
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
  return done();
}

/** A landing page's `sections:` in the ux file: each named section's look, checked by its kind. */
function readSectionLooks(
  ctx: ParseContext,
  node: ParsedNode | null,
  page: PageIR,
  where: string,
): Record<string, SectionLook> {
  const looks: Record<string, SectionLook> = {};
  if (page.pattern.kind !== "landing") {
    ctx.error(node, "invalid-key", `"sections" is for a landing page; ${page.id} is not one.`);
    return looks;
  }
  const sections = page.pattern.sections;
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
