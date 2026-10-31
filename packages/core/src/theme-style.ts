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
  "Outfit",
  // The twelve of docs/design/look-breadth.md §2, for the catalogs' character.
  "Hanken Grotesk",
  "Instrument Sans",
  "Mona Sans",
  "Bricolage Grotesque",
  "Oswald",
  "Big Shoulders Display",
  "Instrument Serif",
  "Young Serif",
  "Newsreader",
  "Bodoni Moda",
  "Zilla Slab",
  "JetBrains Mono",
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
  Outfit: [100, 900],
  "Hanken Grotesk": [100, 900],
  "Instrument Sans": [400, 700],
  "Mona Sans": [200, 900],
  "Bricolage Grotesque": [200, 800],
  Oswald: [200, 700],
  "Big Shoulders Display": [100, 900],
  "Instrument Serif": [400, 400],
  "Young Serif": [400, 400],
  Newsreader: [200, 800],
  "Bodoni Moda": [400, 900],
  "Zilla Slab": [300, 700],
  "JetBrains Mono": [100, 800],
};

/**
 * Faces made for large type: fine for a page title, a note at a small scale (theme-fit.ts), and
 * refused as the body face, since long text at 16px in them does not read.
 */
export const DISPLAY_FONTS: readonly string[] = [
  "Fraunces",
  "Archivo Narrow",
  "Bricolage Grotesque",
  "Oswald",
  "Big Shoulders Display",
  "Instrument Serif",
  "Young Serif",
  "Bodoni Moda",
];

export interface ThemeStyle {
  /** The headings' font; without it, the body font. */
  headingFont?: string;
  /** The face of column labels, eyebrows, tags and small figures; without it, the body font. */
  labelsFont?: string;
  headings: {
    /** 300 to 900, in hundreds, within the heading font's own range. */
    weight: number;
    tracking: "tight" | "normal" | "wide";
    /** The size steps from body text to a page title; huge is display-led. */
    scale: "small" | "regular" | "large" | "huge";
    /** Section titles and labels in capitals. */
    case: "none" | "upper";
    /** A section's heading block (the line over the title, the title, its lead): at the start, or centered. */
    align: "start" | "center";
  };
  /**
   * Column labels, eyebrows, tags and small figures. Left out, they follow the headings: their
   * case, and wide tracking with capitals (what decided labels before the group existed).
   */
  labels: { case: "none" | "upper"; tracking: "normal" | "wide" };
  surfaces: {
    /** A card: the background alone, a border, a shadow, or translucent glass with a lit top edge. */
    cards: "flat" | "bordered" | "raised" | "glass";
    /** How far a band's paper steps from the background; soft is the one step of before. */
    bands: "soft" | "strong";
    /**
     * A landing page's sections: open, each in a box, or banded (every second one after the hero,
     * the second first, across the width on the muted surface, unless it says its own band).
     */
    sections: "open" | "boxed" | "banded";
    /** The lines between rows and sections. */
    dividers: "light" | "strong" | "none";
  };
  buttons: { shape: "rounded" | "pill" | "square"; weight: "regular" | "bold" };
  pictures: {
    /** The theme's radius, none, or a circle (for marks and portraits). */
    corners: "theme" | "square" | "round";
    frame: "none" | "border";
    /** What the theme does to every photograph; duotone is the primary over the background. */
    treatment: "natural" | "muted" | "warm" | "mono" | "duotone";
  };
  tables: { numbers: "tabular" | "normal"; rows: "lined" | "zebra" | "plain" };
  /** A quiet noise or a paper fibre on the page's surfaces, drawn by the kit's stylesheet alone. */
  texture: "none" | "grain" | "paper";
}

/** Today's modern shape: what a theme that says nothing looks like. */
export const DEFAULT_STYLE: ThemeStyle = {
  headings: { weight: 700, tracking: "tight", scale: "regular", case: "none", align: "start" },
  labels: { case: "none", tracking: "normal" },
  surfaces: { cards: "bordered", sections: "open", dividers: "light", bands: "soft" },
  buttons: { shape: "rounded", weight: "regular" },
  pictures: { corners: "theme", frame: "none", treatment: "natural" },
  tables: { numbers: "normal", rows: "lined" },
  texture: "none",
};

/** The values of each field, for checking and for the lab's controls. */
export const STYLE_VALUES = {
  headings: {
    tracking: ["tight", "normal", "wide"],
    scale: ["small", "regular", "large", "huge"],
    case: ["none", "upper"],
    align: ["start", "center"],
  },
  labels: { case: ["none", "upper"], tracking: ["normal", "wide"] },
  surfaces: {
    cards: ["flat", "bordered", "raised", "glass"],
    sections: ["open", "boxed", "banded"],
    dividers: ["light", "strong", "none"],
    bands: ["soft", "strong"],
  },
  buttons: { shape: ["rounded", "pill", "square"], weight: ["regular", "bold"] },
  pictures: {
    corners: ["theme", "square", "round"],
    frame: ["none", "border"],
    treatment: ["natural", "muted", "warm", "mono", "duotone"],
  },
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
    ...(base.labelsFont ? { labelsFont: base.labelsFont } : {}),
    headings: { ...base.headings },
    labels: { ...base.labels },
    surfaces: { ...base.surfaces },
    buttons: { ...base.buttons },
    pictures: { ...base.pictures },
    tables: { ...base.tables },
    texture: base.texture,
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
    for (const e of checkKeys(ctx, entries, `"fonts"`, {
      allowed: ["body", "heading", "labels"],
    })) {
      const name = fontOf(e.value, `"fonts.${e.key}"`);
      if (e.key === "heading") style.headingFont = name;
      else if (e.key === "labels") style.labelsFont = name;
      else if (name !== undefined && DISPLAY_FONTS.includes(name))
        ctx.error(
          e.value as never,
          "invalid-value",
          `${name} is a display face, made for titles: long text in it does not read. Name it under "fonts.heading" or "fonts.labels".`,
        );
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
  const labelsGiven = new Set<string>();
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
        if (typeof value !== "number" || value < 300 || value > 900 || value % 100 !== 0)
          ctx.error(
            e.value as never,
            "invalid-value",
            `"headings.weight" is 300 to 900, in hundreds.`,
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
      else {
        target[e.key] = value;
        if (group === "labels") labelsGiven.add(e.key);
      }
    }
  }
  // Labels left unsaid follow the headings, as they did before the group existed.
  if (!labelsGiven.has("case")) style.labels.case = style.headings.case;
  if (!labelsGiven.has("tracking"))
    style.labels.tracking = style.labels.case === "upper" ? "wide" : "normal";
  const texture = byKey.get("texture");
  if (texture) {
    const value = readString(ctx, texture.value as never, `"texture"`);
    if (value === "none" || value === "grain" || value === "paper") style.texture = value;
    else if (value !== undefined)
      ctx.error(texture.value as never, "invalid-value", `"texture" is none, grain or paper.`);
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
