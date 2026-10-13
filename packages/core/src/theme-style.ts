// A theme's style layer (docs/design/theme-lab.md §2): the fonts, the headings, the surfaces, the
// buttons, the pictures and the tables, each a field with a fixed set of values, never CSS. The
// defaults are today's modern shape, so a theme that says nothing renders as before.
import type { Scalar } from "yaml";
import { checkKeys, mapEntries, type ParseContext, readString } from "./context.js";

/** Open-licence fonts the generated apps host themselves (the stack profile pins each). */
export const FONTS = [
  "Inter",
  "Nunito Sans",
  "Source Sans 3",
  "Source Serif 4",
  "Fraunces",
  "Archivo Narrow",
  "DM Sans",
] as const;

/** Each font's weights, lightest and heaviest (its variable axis): a heading weight outside them is
 *  clamped by the browser, so a theme that asks for it is refused. */
export const FONT_WEIGHTS: Record<(typeof FONTS)[number], readonly [number, number]> = {
  Inter: [100, 900],
  "Nunito Sans": [200, 1000],
  "Source Sans 3": [200, 900],
  "Source Serif 4": [200, 900],
  Fraunces: [100, 900],
  "Archivo Narrow": [400, 700],
  "DM Sans": [100, 1000],
};

/** Faces made for large type: fine for a page title, a note at a small scale (theme-fit.ts). */
export const DISPLAY_FONTS: readonly string[] = ["Fraunces", "Archivo Narrow"];

export interface ThemeStyle {
  /** The headings' font; without it, the body font. */
  headingFont?: string;
  headings: {
    /** 400 to 800, in hundreds. */
    weight: number;
    tracking: "tight" | "normal" | "wide";
    /** The size steps from body text to a page title. */
    scale: "small" | "regular" | "large";
    /** Section titles and labels in capitals. */
    case: "none" | "upper";
  };
  surfaces: {
    /** A card: the background alone, a border, or a shadow. */
    cards: "flat" | "bordered" | "raised";
    /** A page's sections: rules between them, or each in a box. */
    sections: "open" | "boxed";
    /** The lines between rows and sections. */
    dividers: "light" | "strong" | "none";
  };
  buttons: { shape: "rounded" | "pill" | "square"; weight: "regular" | "bold" };
  pictures: {
    /** The theme's radius, none, or a circle (for marks and portraits). */
    corners: "theme" | "square" | "round";
    frame: "none" | "border";
  };
  tables: { numbers: "tabular" | "normal"; rows: "lined" | "zebra" | "plain" };
}

/** Today's modern shape: what a theme that says nothing looks like. */
export const DEFAULT_STYLE: ThemeStyle = {
  headings: { weight: 700, tracking: "tight", scale: "regular", case: "none" },
  surfaces: { cards: "bordered", sections: "open", dividers: "light" },
  buttons: { shape: "rounded", weight: "regular" },
  pictures: { corners: "theme", frame: "none" },
  tables: { numbers: "normal", rows: "lined" },
};

/** The values of each field, for checking and for the lab's controls. */
export const STYLE_VALUES = {
  headings: {
    tracking: ["tight", "normal", "wide"],
    scale: ["small", "regular", "large"],
    case: ["none", "upper"],
  },
  surfaces: {
    cards: ["flat", "bordered", "raised"],
    sections: ["open", "boxed"],
    dividers: ["light", "strong", "none"],
  },
  buttons: { shape: ["rounded", "pill", "square"], weight: ["regular", "bold"] },
  pictures: { corners: ["theme", "square", "round"], frame: ["none", "border"] },
  tables: { numbers: ["tabular", "normal"], rows: ["lined", "zebra", "plain"] },
} as const;

type Entry = { key: string; keyNode: unknown; value: unknown };

/**
 * The style fields of a theme file, over `base` (the defaults, or a preset's shape). `font` is
 * the body font the file named the old way, if any; `fonts.body` says the same. Problems are
 * reported on `ctx`.
 */
export function readStyle(
  ctx: ParseContext,
  byKey: Map<string, Entry>,
  font: string | undefined,
  base: ThemeStyle = DEFAULT_STYLE,
): { body: string | undefined; style: ThemeStyle } {
  const style: ThemeStyle = {
    ...(base.headingFont ? { headingFont: base.headingFont } : {}),
    headings: { ...base.headings },
    surfaces: { ...base.surfaces },
    buttons: { ...base.buttons },
    pictures: { ...base.pictures },
    tables: { ...base.tables },
  };
  const fontOf = (node: unknown, what: string) => {
    const name = readString(ctx, node as never, what);
    if (name !== undefined && !(FONTS as readonly string[]).includes(name)) {
      ctx.error(
        node as never,
        "invalid-value",
        `${what} must be one of ${FONTS.join(", ")}: fonts the app hosts itself.`,
      );
      return undefined;
    }
    return name;
  };
  let body = font;
  const fonts = byKey.get("fonts");
  if (fonts) {
    const entries = mapEntries(ctx, fonts.value as never, `"fonts"`) ?? [];
    for (const e of checkKeys(ctx, entries, `"fonts"`, { allowed: ["body", "heading"] })) {
      const name = fontOf(e.value, `"fonts.${e.key}"`);
      if (e.key === "heading") style.headingFont = name;
      else if (font !== undefined && name !== undefined && name !== font)
        ctx.error(
          e.value as never,
          "invalid-value",
          `"font" and "fonts.body" name two fonts: say the body font once.`,
        );
      else body = name;
    }
  }
  // Each group of choices: its keys, each one of its values (the heading weight a number).
  for (const group of Object.keys(STYLE_VALUES) as (keyof typeof STYLE_VALUES)[]) {
    const node = byKey.get(group);
    if (!node) continue;
    const allowed = [
      ...Object.keys(STYLE_VALUES[group]),
      ...(group === "headings" ? ["weight"] : []),
    ];
    const entries = mapEntries(ctx, node.value as never, `"${group}"`) ?? [];
    for (const e of checkKeys(ctx, entries, `"${group}"`, { allowed })) {
      const target = style[group] as Record<string, unknown>;
      if (group === "headings" && e.key === "weight") {
        const value = (e.value as Scalar | undefined)?.value;
        if (typeof value !== "number" || value < 400 || value > 800 || value % 100 !== 0)
          ctx.error(
            e.value as never,
            "invalid-value",
            `"headings.weight" is 400, 500, 600, 700 or 800.`,
          );
        else target.weight = value;
        continue;
      }
      const values = (STYLE_VALUES[group] as Record<string, readonly string[]>)[e.key] ?? [];
      const value = readString(ctx, e.value as never, `"${group}.${e.key}"`);
      if (value === undefined) continue;
      if (!values.includes(value))
        ctx.error(
          e.value as never,
          "invalid-value",
          `"${group}.${e.key}" is ${values.join(", ")}.`,
        );
      else target[e.key] = value;
    }
  }
  // A weight the headings' font does not have would be clamped: the file would say what no one sees.
  const heading = style.headingFont ?? body ?? "Inter";
  const [lightest, heaviest] = FONT_WEIGHTS[heading as (typeof FONTS)[number]] ?? [100, 900];
  const weight = style.headings.weight;
  if (weight < lightest || weight > heaviest)
    ctx.error(
      (byKey.get("headings")?.value ?? byKey.get("fonts")?.value ?? null) as never,
      "invalid-value",
      `${heading} goes from ${lightest} to ${heaviest}: "headings.weight" ${weight} is outside it.`,
    );
  // Capitals set tight run together: refused, as unreadable.
  if (style.headings.case === "upper" && style.headings.tracking === "tight")
    ctx.error(
      (byKey.get("headings")?.value ?? null) as never,
      "invalid-value",
      `Headings in capitals need normal or wide tracking: tight capitals run together.`,
    );
  return { body, style };
}
