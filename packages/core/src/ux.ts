import { isScalar, LineCounter, type ParsedNode, parseDocument } from "yaml";
import { checkKeys, mapEntries, ParseContext, readNameList, readString } from "./context.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import { type PageIR, pageModel, type SpecIR } from "./ir.js";
import { didYouMean } from "./suggest.js";

/**
 * How the app looks, from smithable.ux.yml (ARCHITECTURE §3.2). Technology-neutral:
 * presets and choices, never CSS. Everything is optional.
 */
export interface UxIR {
  theme: {
    preset: ThemePreset;
    /** A colour like "#2563eb"; the preset derives its colours from it. */
    primary?: string;
    font?: string;
    density: "comfortable" | "compact";
  };
  pages: Record<string, PageUx>;
  /** Colours of choice values by meaning, by "Model.field"; values not listed are neutral. */
  tones: Record<string, Record<string, Tone>>;
}

export interface PageUx {
  /** The page's icon in navigation; without it one is chosen from the model's name. */
  icon?: Icon;
  /** The table's columns, in order. */
  columns?: string[];
  /** The form's fields in this order; fields not listed follow. */
  fieldOrder?: string[];
}

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
  if (page.pattern.kind === "landing") return "home";
  if (page.pattern.kind === "dashboard") return "chart";
  const model = page.pattern.model;
  return ICON_WORDS.find(([words]) => words.test(model))?.[1] ?? "list";
}
export const THEME_PRESETS = ["modern", "minimal", "playful", "corporate"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

/** Open-licence fonts the generated apps can host themselves. */
export const FONTS = ["Inter", "Nunito Sans", "Source Sans 3"] as const;

export function emptyUx(): UxIR {
  return { theme: { preset: "modern", density: "comfortable" }, pages: {}, tones: {} };
}

/** Parses smithable.ux.yml and checks every page and field it names against the spec. */
export function validateUx(
  file: { path: string; text: string },
  ir: SpecIR,
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
    allowed: ["smithableUx", "theme", "pages", "tones"],
    later: ["menus", "sections"],
  });

  for (const { key, value } of known) {
    if (key === "theme") {
      const where = `"theme"`;
      for (const entry of checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
        allowed: ["preset", "brand", "density"],
        later: ["radius", "darkMode"],
      })) {
        if (entry.key === "preset") {
          const preset = readString(ctx, entry.value, `"preset"`);
          if (preset !== undefined && !(THEME_PRESETS as readonly string[]).includes(preset)) {
            ctx.error(
              entry.value,
              "unknown-preset",
              `There is no theme preset "${preset}".`,
              didYouMean(preset, THEME_PRESETS) ?? `Available: ${THEME_PRESETS.join(", ")}.`,
            );
          } else if (preset !== undefined) ux.theme.preset = preset as ThemePreset;
        } else if (entry.key === "density") {
          const density = readString(ctx, entry.value, `"density"`);
          if (density === "comfortable" || density === "compact") ux.theme.density = density;
          else if (density !== undefined)
            ctx.error(entry.value, "invalid-value", `"density" must be comfortable or compact.`);
        } else {
          for (const brand of checkKeys(
            ctx,
            mapEntries(ctx, entry.value, `"brand"`) ?? [],
            `"brand"`,
            {
              allowed: ["primary", "font"],
            },
          )) {
            const text = readString(ctx, brand.value, `"${brand.key}"`);
            if (text === undefined) continue;
            if (brand.key === "primary") {
              if (/^#[0-9a-fA-F]{6}$/.test(text)) ux.theme.primary = text.toLowerCase();
              else
                ctx.error(
                  brand.value,
                  "invalid-color",
                  `"primary" must be a colour like "#2563eb".`,
                );
            } else if ((FONTS as readonly string[]).includes(text)) {
              ux.theme.font = text;
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
        const fields = (model?.fields ?? []).filter(
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
                `${model?.name} has no field named "${name}" to show.`,
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
          allowed: ["icon", "table", "form"],
          later: ["detail", "calendar"],
        })) {
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
              allowed: part.key === "table" ? ["columns"] : ["fieldOrder"],
              later: part.key === "table" ? ["sort", "pageSize"] : ["groups"],
            },
          )) {
            if (option.key === "columns")
              result.columns = names(option.value, `the columns of ${where}`, true);
            else result.fieldOrder = names(option.value, `the field order of ${where}`, false);
          }
        }
        ux.pages[page.key] = result;
      }
    }
  }
  return done();
}
