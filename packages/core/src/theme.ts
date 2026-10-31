// A theme is data (docs/design/look.md §3): a font, a corner radius, a shadow and the color
// tokens the app kit uses, in light and dark mode. The thirteen built-in presets are themes; a
// project's own live in themes/<name>.yml and are checked like the built-ins: every pair of
// text and background the kit puts together must read. A theme never ships CSS or code.
import { isScalar, LineCounter, parseDocument } from "yaml";
import { contrast, gamutMap, hexOf, hexToRgb, rgbToOklch } from "./color.js";
import { checkKeys, mapEntries, ParseContext, readString } from "./context.js";
import type { Diagnostic } from "./diagnostics.js";
import { didYouMean } from "./suggest.js";
import { THEME_LIBRARY } from "./theme-library.js";
import { PRESET_TOKENS } from "./theme-presets.js";
import { DEFAULT_STYLE, FONTS, readStyle, type ThemeStyle } from "./theme-style.js";

export { FONTS } from "./theme-style.js";

export type Mode = "light" | "dark";

/** The color tokens the app kit's styles use (shadcn/ui's names), each a CSS color. */
export const TOKEN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
export type Tokens = Record<TokenName, string>;

export interface ThemeIR {
  /** The name the ux file's `theme.preset` uses (kebab-case). */
  name: string;
  /** Where it comes from: built into Smithable, or the project's themes/ folder. */
  source: "built-in" | "project";
  font: string;
  radius: string;
  shadow: string;
  density: "comfortable" | "standard" | "compact";
  /** How much the app moves: none, subtle (short fades and slides) or lively (a little more). */
  motion: "none" | "subtle" | "lively";
  /** The most chroma a brand color keeps on this theme (quiet themes stay quiet). */
  chroma: number;
  /** Headings, labels, surfaces, buttons, pictures, tables and texture (theme-style.ts). */
  style: ThemeStyle;
  /**
   * Both modes, or one by design (docs/design/look-breadth.md §3): a one-mode theme carries that
   * mode's colours alone, the app shows it whatever the device says, and no mode switch is made.
   * Both `light` and `dark` are filled either way, so a reader needs no case.
   */
  modes: "both" | "light" | "dark";
  light: Tokens;
  dark: Tokens;
}

export const THEME_VERSION = "0.1";
export const SHADOWS = {
  none: "none",
  soft: "0 1px 3px rgb(0 0 0 / 0.08)",
  raised: "0 4px 12px rgb(0 0 0 / 0.12)",
  small: "0 1px 2px rgb(0 0 0 / 0.05)",
  /** A soft shadow tinted with the theme's primary color. */
  tinted: "0 4px 12px color-mix(in oklch, var(--primary) 15%, transparent)",
} as const;

/**
 * Each built-in preset's font, corner radius, shadow, chroma cap, density and motion (the design
 * delivery's, with the shapes that tell them apart at a glance, 2026-10-02).
 */
const FOUNDATIONS: Record<
  keyof typeof PRESET_TOKENS,
  {
    font: string;
    radius: string;
    shadow: string;
    chroma: number;
    density: ThemeIR["density"];
    motion: ThemeIR["motion"];
    style: ThemeStyle;
  }
> = {
  modern: {
    font: "Inter",
    radius: "10px",
    shadow: SHADOWS.small,
    chroma: 0.22,
    density: "comfortable",
    motion: "subtle",
    style: DEFAULT_STYLE,
  },
  minimal: {
    font: "Inter",
    radius: "6px",
    shadow: SHADOWS.none,
    chroma: 0.08,
    density: "comfortable",
    motion: "subtle",
    style: {
      ...DEFAULT_STYLE,
      headings: { ...DEFAULT_STYLE.headings, weight: 600, tracking: "normal" },
    },
  },
  playful: {
    font: "Nunito Sans",
    radius: "16px",
    shadow: SHADOWS.tinted,
    chroma: 0.22,
    density: "comfortable",
    motion: "lively",
    style: {
      ...DEFAULT_STYLE,
      headings: { ...DEFAULT_STYLE.headings, weight: 800, tracking: "normal" },
      surfaces: { ...DEFAULT_STYLE.surfaces, cards: "raised" },
      buttons: { ...DEFAULT_STYLE.buttons, shape: "pill" },
    },
  },
  corporate: {
    font: "Source Sans 3",
    radius: "4px",
    shadow: SHADOWS.none,
    chroma: 0.16,
    density: "compact",
    motion: "subtle",
    style: {
      ...DEFAULT_STYLE,
      headings: { ...DEFAULT_STYLE.headings, weight: 600, tracking: "normal" },
      tables: { ...DEFAULT_STYLE.tables, numbers: "tabular" },
    },
  },
};

/** A theme by name among the built-ins and the project's; the project's wins a clash. */
export function themeNamed(name: string, themes: readonly ThemeIR[] = []): ThemeIR | undefined {
  return themes.find((t) => t.name === name) ?? BUILT_IN_THEMES.find((t) => t.name === name);
}

/** The names a ux file may use, for checks and suggestions. */
export function themeNames(themes: readonly ThemeIR[] = []): string[] {
  return [...new Set([...BUILT_IN_THEMES.map((t) => t.name), ...themes.map((t) => t.name)])];
}

const COLOR = /^(?:#[0-9a-f]{6}|oklch\([\d.]+ [\d.]+ [\d.]+\))$/i;
const DARK_TEXT = "#101522";
const LIGHT_TEXT = "#ffffff";

/**
 * Parses a project's theme file. A theme can be as short as three colors per mode
 * (background, foreground, primary): the rest is derived as a brand color is, and every pair
 * the kit puts together is checked for contrast. Text that may not read is said in plain words,
 * never refused: the colours are the person's choice (Johan, 2026-10-24 and 2026-10-25).
 */
export function parseTheme(
  file: { path: string; text: string },
  /** "error": a theme that does not read is refused (the candidates script, which drops those). */
  options: { contrast?: "error" | "warning" } = {},
): {
  theme?: ThemeIR;
  diagnostics: Diagnostic[];
} {
  const counter = new LineCounter();
  const doc = parseDocument(file.text, { lineCounter: counter, keepSourceTokens: true });
  const ctx = new ParseContext(file.path, counter);
  for (const error of doc.errors) ctx.error(null, "yaml", error.message);
  if (doc.errors.length) return { diagnostics: ctx.diagnostics };
  const root = doc.contents;
  const entries = mapEntries(ctx, root, "the theme") ?? [];
  const known = checkKeys(ctx, entries, "the theme", {
    allowed: [
      "smithableTheme",
      "name",
      "font",
      "fonts",
      "headings",
      "labels",
      "surfaces",
      "buttons",
      "pictures",
      "tables",
      "texture",
      "radius",
      "shadow",
      "density",
      "motion",
      "chroma",
      "modes",
      "light",
      "dark",
    ],
  });
  const byKey = new Map(known.map((e) => [e.key, e]));
  const version = byKey.get("smithableTheme");
  if (!version) ctx.error(root, "missing-key", 'A theme starts with "smithableTheme: 0.1".');
  const fileName = file.path.replace(/^.*\//, "").replace(/\.ya?ml$/, "");
  const optional = (key: string) => {
    const entry = byKey.get(key);
    return entry ? readString(ctx, entry.value, `"${key}"`) : undefined;
  };
  const name = optional("name") ?? fileName;
  if (!/^[a-z][a-z0-9-]*$/.test(name))
    ctx.error(
      byKey.get("name")?.value ?? root,
      "invalid-value",
      `A theme's name is kebab-case, like "forest" or "warm-sand".`,
    );
  const named = optional("font");
  if (named !== undefined && !(FONTS as readonly string[]).includes(named))
    ctx.error(
      byKey.get("font")?.value ?? root,
      "invalid-value",
      `"font" must be one of ${FONTS.join(", ")}: fonts the app hosts itself.`,
    );
  const { body, style } = readStyle(ctx, byKey as never, named);
  const font = body ?? "Inter";
  const radius = optional("radius") ?? "12px";
  if (!/^\d+(?:\.\d+)?(?:px|rem)$/.test(radius))
    ctx.error(
      byKey.get("radius")?.value ?? root,
      "invalid-value",
      `"radius" is a length like 12px or 0.75rem.`,
    );
  const shadowName = optional("shadow") ?? "soft";
  if (!(shadowName in SHADOWS))
    ctx.error(
      byKey.get("shadow")?.value ?? root,
      "invalid-value",
      `"shadow" is none, soft or raised.`,
    );
  const density = optional("density") ?? "comfortable";
  if (density !== "comfortable" && density !== "standard" && density !== "compact")
    ctx.error(
      byKey.get("density")?.value ?? root,
      "invalid-value",
      `"density" is comfortable, standard or compact.`,
    );
  const motion = optional("motion") ?? "subtle";
  if (motion !== "none" && motion !== "subtle" && motion !== "lively")
    ctx.error(
      byKey.get("motion")?.value ?? root,
      "invalid-value",
      `"motion" is none, subtle or lively.`,
    );
  const chromaNode = byKey.get("chroma")?.value;
  const chroma =
    chromaNode && isScalar(chromaNode) && typeof chromaNode.value === "number"
      ? chromaNode.value
      : 0.22;
  if (chromaNode && (typeof chroma !== "number" || chroma < 0 || chroma > 0.4))
    ctx.error(chromaNode, "invalid-value", `"chroma" is a number between 0 and 0.4.`);
  const modesName = optional("modes") ?? "both";
  if (modesName !== "both" && modesName !== "light" && modesName !== "dark")
    ctx.error(
      byKey.get("modes")?.value ?? root,
      "invalid-value",
      `"modes" is both, light or dark.`,
    );
  const modes = {} as Record<Mode, Tokens>;
  for (const mode of ["light", "dark"] as const) {
    const given: Partial<Tokens> = {};
    const node = byKey.get(mode)?.value;
    if (modesName !== "both" && modesName !== mode) {
      // A one-mode theme: the other mode's colours would never show.
      if (node)
        ctx.error(
          byKey.get(mode)?.keyNode ?? node,
          "unknown-key",
          `"modes: ${modesName}" shows one mode: the "${mode}" colours would never be seen; take them out or say "modes: both".`,
        );
      continue;
    }
    if (!node) {
      ctx.error(
        root,
        "missing-key",
        `A theme needs "${mode}" colors: at least background, foreground and primary.`,
      );
      continue;
    }
    for (const entry of mapEntries(ctx, node, `"${mode}"`) ?? []) {
      if (!(TOKEN_NAMES as readonly string[]).includes(entry.key)) {
        ctx.error(
          entry.keyNode,
          "unknown-key",
          `Unknown color "${entry.key}" in "${mode}".`,
          didYouMean(entry.key, TOKEN_NAMES),
        );
        continue;
      }
      const value = readString(ctx, entry.value, `"${entry.key}" in "${mode}"`);
      if (value === undefined) continue;
      if (!COLOR.test(value)) {
        ctx.error(
          entry.value,
          "invalid-value",
          `"${entry.key}" in "${mode}" is a color like "#2f6b3a" or "oklch(0.51 0.23 277)".`,
        );
        continue;
      }
      given[entry.key as TokenName] = hexOf(value);
    }
    for (const needed of ["background", "foreground", "primary"] as const)
      if (!given[needed]) ctx.error(node, "missing-key", `"${mode}" needs at least "${needed}".`);
    if (given.background && given.foreground && given.primary) {
      modes[mode] = deriveTokens(
        given as Partial<Tokens> & Pick<Tokens, "background" | "foreground" | "primary">,
        mode,
      );
      for (const problem of hardToRead(modes[mode], mode))
        if (options.contrast === "error") ctx.error(node, "theme-contrast", problem);
        else ctx.warning(node, "theme-contrast", problem);
      // Text on a glass card is read on the card's tint at the kit's least opacity over a band.
      if (style.surfaces.cards === "glass") {
        const t = modes[mode];
        const tint = towards(t.muted, t.card, GLASS_OPACITY);
        if (contrast(t["card-foreground"], tint) < 4.5) {
          const problem = `In ${mode} mode, text on a glass card over a band may be hard to read.`;
          if (options.contrast === "error") ctx.error(node, "theme-contrast", problem);
          else ctx.warning(node, "theme-contrast", problem);
        }
      }
    }
  }
  // One mode by design: the other is the same colours, so every reader finds both.
  if (modesName === "light" && modes.light) modes.dark = { ...modes.light };
  if (modesName === "dark" && modes.dark) modes.light = { ...modes.dark };
  if (ctx.diagnostics.some((d) => d.severity === "error")) return { diagnostics: ctx.diagnostics };
  return {
    theme: {
      name,
      source: "project",
      font,
      radius,
      shadow: SHADOWS[shadowName as keyof typeof SHADOWS],
      density: density as ThemeIR["density"],
      motion: motion as ThemeIR["motion"],
      chroma,
      style,
      modes: modesName as ThemeIR["modes"],
      light: modes.light as Tokens,
      dark: modes.dark as Tokens,
    },
    diagnostics: ctx.diagnostics,
  };
}

/** The least opaque a glass card gets in the kit: what its text is checked against. */
const GLASS_OPACITY = 0.65;

/** A color moved towards another in OKLCH by a share of the way (0 stays, 1 arrives). */
function towards(from: string, to: string, share: number): string {
  const [l1, c1, h1] = rgbToOklch(hexToRgb(from));
  const [l2, c2, h2] = rgbToOklch(hexToRgb(to));
  return gamutMap([l1 + (l2 - l1) * share, c1 + (c2 - c1) * share, c1 < 0.02 ? h2 : h1]);
}

/** The text that reads best on a color. */
const bestText = (bg: string) =>
  contrast(LIGHT_TEXT, bg) >= contrast(DARK_TEXT, bg) ? LIGHT_TEXT : DARK_TEXT;

/** A color on `bg` moved towards `towardsColor` until it reads at `ratio`. */
function readable(color: string, bg: string, towardsColor: string, ratio: number): string {
  let out = color;
  for (let i = 0; i < 40 && contrast(out, bg) < ratio; i++) out = towards(out, towardsColor, 0.1);
  return out;
}

/** A hue-rotated color of the same lightness and chroma. */
function rotate(color: string, degrees: number): string {
  const [l, c, h] = rgbToOklch(hexToRgb(color));
  return gamutMap([l, Math.max(c, 0.08), (h + degrees) % 360]);
}

/**
 * Every token from the ones given, the way a brand color derives its colors: the "-foreground"
 * of a color is the text that reads on it, muted and secondary step the background towards
 * the foreground, borders a step further, the accent tints the background with the primary,
 * and the charts spread around the primary's hue.
 */
export function deriveTokens(
  given: Partial<Tokens> & Pick<Tokens, "background" | "foreground" | "primary">,
  mode: Mode,
): Tokens {
  const dark = mode === "dark";
  const { background, foreground, primary } = given;
  const card = given.card ?? (dark ? towards(background, foreground, 0.05) : LIGHT_TEXT);
  const muted = given.muted ?? towards(background, foreground, 0.06);
  const accent =
    given.accent ?? readable(towards(background, primary, 0.14), foreground, background, 4.5);
  const destructive = given.destructive ?? (dark ? "#f08a80" : "#b42318");
  const success = given.success ?? (dark ? "#7fd39a" : "#1e6b3a");
  const warning = given.warning ?? (dark ? "#f2c66d" : "#8a5a00");
  const t: Tokens = {
    background,
    foreground,
    card,
    "card-foreground": given["card-foreground"] ?? foreground,
    primary,
    "primary-foreground": given["primary-foreground"] ?? bestText(primary),
    secondary: given.secondary ?? towards(background, foreground, 0.08),
    "secondary-foreground": given["secondary-foreground"] ?? foreground,
    muted,
    "muted-foreground":
      given["muted-foreground"] ??
      readable(towards(foreground, background, 0.35), muted, foreground, 4.5),
    accent,
    "accent-foreground": given["accent-foreground"] ?? foreground,
    border: given.border ?? towards(background, foreground, 0.3),
    input: given.input ?? given.border ?? towards(background, foreground, 0.3),
    // The primary, or for a bright one a step towards the card's text, so the focus ring shows.
    ring: given.ring ?? readable(primary, card, given["card-foreground"] ?? foreground, 3),
    sidebar: given.sidebar ?? card,
    "sidebar-foreground": given["sidebar-foreground"] ?? foreground,
    destructive,
    "destructive-foreground": given["destructive-foreground"] ?? bestText(destructive),
    success,
    "success-foreground": given["success-foreground"] ?? bestText(success),
    warning,
    "warning-foreground": given["warning-foreground"] ?? bestText(warning),
    "chart-1": given["chart-1"] ?? primary,
    "chart-2": given["chart-2"] ?? rotate(primary, 60),
    "chart-3": given["chart-3"] ?? rotate(primary, 130),
    "chart-4": given["chart-4"] ?? rotate(primary, 200),
    "chart-5": given["chart-5"] ?? rotate(primary, 280),
  };
  return t;
}

/**
 * A theme with a background color of the owner's (smithable.ux.yml's `theme.background`): in
 * light mode a pale wash of it, in dark mode a deep one of the same hue, quiet enough for text,
 * with the colors that sit on the background derived again (cards, muted, borders, accent) and
 * the primary, the states and the charts kept. Undefined when the result would not read.
 */
export function withBackground(theme: ThemeIR, color: string): ThemeIR | undefined {
  const [, c, h] = rgbToOklch(hexToRgb(hexOf(color)));
  const chroma = Math.min(c, theme.chroma, 0.045);
  const mode = (m: Mode): Tokens => {
    const own = theme[m];
    const background = gamutMap([m === "dark" ? 0.17 : 0.965, chroma, h]);
    // The theme's text when it still reads, else the text that does.
    const foreground =
      contrast(hexOf(own.foreground), background) >= 7 ? own.foreground : bestText(background);
    return deriveTokens(
      {
        background,
        foreground,
        primary: own.primary,
        "primary-foreground": own["primary-foreground"],
        ring: own.ring,
        destructive: own.destructive,
        "destructive-foreground": own["destructive-foreground"],
        success: own.success,
        "success-foreground": own["success-foreground"],
        warning: own.warning,
        "warning-foreground": own["warning-foreground"],
        "chart-1": own["chart-1"],
        "chart-2": own["chart-2"],
        "chart-3": own["chart-3"],
        "chart-4": own["chart-4"],
        "chart-5": own["chart-5"],
      },
      m,
    );
  };
  const out = { ...theme, light: mode("light"), dark: mode("dark") };
  return checkContrast(out.light).length || checkContrast(out.dark).length ? undefined : out;
}

/** The pairs the kit puts together and the ratio each needs. */
const PAIRS: [text: TokenName, on: TokenName, ratio: number][] = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["sidebar-foreground", "sidebar", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  ["success-foreground", "success", 4.5],
  ["warning-foreground", "warning", 4.5],
  ["ring", "card", 3],
];

/** The pairs that may not read: the text's colour, the one it is on, their ratio and the one needed. */
export function lowContrast(
  tokens: Tokens,
): { text: TokenName; on: TokenName; got: number; needed: number }[] {
  return PAIRS.flatMap(([text, on, needed]) => {
    const got = contrast(hexOf(tokens[text]), hexOf(tokens[on]));
    return got < needed ? [{ text, on, got, needed }] : [];
  });
}

/** Where each colour pair is used, in words a non-designer knows (no colour names, no ratios). */
const WHERE: Partial<Record<TokenName, string>> = {
  background: "the text on the page",
  card: "the text on cards",
  primary: "the text on the main buttons",
  secondary: "the text on the other buttons",
  muted: "the quieter text, such as hints and dates,",
  accent: "the text on highlighted rows and menu items",
  sidebar: "the text in the side menu",
  destructive: "the text on delete buttons",
  success: "the text on the green badges",
  warning: "the text on the warning badges",
};

/**
 * What may be hard to read in a mode, one plain sentence each (no colour names, no ratios):
 * what the theme lab, the CLI and addTheme say, as a warning. Pairs on the same colour share one.
 */
export function hardToRead(tokens: Tokens, mode: "light" | "dark"): string[] {
  return [
    ...new Set(
      lowContrast(tokens).map(({ text, on }) =>
        text === "ring"
          ? `In ${mode} mode, the outline that shows where you are typing may be hard to see.`
          : `In ${mode} mode, ${WHERE[on] ?? "some text"} may be hard to read.`,
      ),
    ),
  ];
}

/**
 * The pairs a landing section's band puts together (the kit's styles.css): on a muted band the
 * page's text and its muted text on the muted surface; on an inverse band the background's color
 * as text on the foreground's; on a primary band the primary's own text color on it. Inside a band
 * every text, card and button takes the band's colors, so these are the ones that must read.
 */
const BAND_PAIRS: Record<string, [text: TokenName, on: TokenName][]> = {
  muted: [
    ["foreground", "muted"],
    ["muted-foreground", "muted"],
  ],
  inverse: [["background", "foreground"]],
  primary: [["primary-foreground", "primary"]],
};

/** A band's text that would not read on its surface (under 4.5:1), as lowContrast says it. */
export function bandLowContrast(
  tokens: Tokens,
  band: string,
): { text: TokenName; on: TokenName; got: number; needed: number }[] {
  return (BAND_PAIRS[band] ?? []).flatMap(([text, on]) => {
    const got = contrast(hexOf(tokens[text]), hexOf(tokens[on]));
    return got < 4.5 ? [{ text, on, got, needed: 4.5 }] : [];
  });
}

/** What does not read, as sentences naming the pair and its ratio; empty when all is well. */
export function checkContrast(tokens: Tokens): string[] {
  // Rounded down, so a ratio just under the one needed never reads as reaching it ("4.5 needs 4.5").
  return lowContrast(tokens).map(
    ({ text, on, got, needed }) =>
      `${text} on ${on} is ${(Math.floor(got * 10) / 10).toFixed(1)}:1; it needs ${needed}:1 to read.`,
  );
}

/**
 * A theme's picture, drawn from its tokens: light and dark halves with the background, a
 * card, a heading, a line of muted text, a primary button and a success badge, in the
 * theme's font and radius. The same for a built-in and a project theme, so nobody draws one.
 */
export function themeThumbnail(theme: ThemeIR): string {
  const half = (tokens: Tokens, x: number) => {
    const r = Number.parseFloat(theme.radius) * (theme.radius.endsWith("rem") ? 16 : 1);
    const radius = Math.min(r, 10);
    return `<g transform="translate(${x} 0)">
  <rect width="160" height="100" fill="${hexOf(tokens.background)}"/>
  <rect x="14" y="14" width="132" height="72" rx="${radius}" fill="${hexOf(tokens.card)}" stroke="${hexOf(tokens.border)}"/>
  <text x="26" y="36" font-family="${theme.font}, sans-serif" font-size="12" font-weight="700" fill="${hexOf(tokens["card-foreground"])}">${theme.name.replace(/-/g, " ")}</text>
  <rect x="26" y="44" width="80" height="5" rx="2.5" fill="${hexOf(tokens["muted-foreground"])}" opacity="0.6"/>
  <rect x="26" y="60" width="52" height="16" rx="${Math.min(radius, 8)}" fill="${hexOf(tokens.primary)}"/>
  <rect x="34" y="66" width="36" height="4" rx="2" fill="${hexOf(tokens["primary-foreground"])}"/>
  <rect x="88" y="62" width="40" height="12" rx="6" fill="${hexOf(tokens.success)}"/>
  <rect x="96" y="66" width="24" height="4" rx="2" fill="${hexOf(tokens["success-foreground"])}"/>
</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="100" viewBox="0 0 320 100" role="img" aria-label="The ${theme.name} theme in light and dark mode">
${half(theme.light, 0)}
${half(theme.dark, 160)}
</svg>
`;
}

/** The theme's colors in one mode as written, with a brand color's changes on top when given. */
export function tokensOf(theme: ThemeIR, mode: Mode, over: Partial<Tokens> = {}): Tokens {
  const out = {} as Tokens;
  for (const name of Object.keys(theme[mode]) as TokenName[])
    out[name] = over[name] ?? theme[mode][name];
  return out;
}

/**
 * The themes Smithable ships: the four from the design delivery's tokens, then the nine of the
 * theme library, read with the parser and the checks a project's own theme gets. (At the end
 * of the module: the parser's constants must exist before it runs.)
 */
export const BUILT_IN_THEMES: readonly ThemeIR[] = [
  ...(Object.keys(PRESET_TOKENS) as (keyof typeof PRESET_TOKENS)[]).map(
    (name): ThemeIR => ({
      name,
      source: "built-in",
      ...FOUNDATIONS[name],
      modes: "both",
      light: { ...PRESET_TOKENS[name].light },
      dark: { ...PRESET_TOKENS[name].dark },
    }),
  ),
  ...Object.entries(THEME_LIBRARY).map(([name, text]): ThemeIR => {
    const { theme, diagnostics } = parseTheme({ path: `themes/${name}.yml`, text });
    if (!theme)
      throw new Error(
        `The built-in theme "${name}" is not valid: ${diagnostics.map((d) => d.message).join(" ")}`,
      );
    return { ...theme, source: "built-in" };
  }),
];
