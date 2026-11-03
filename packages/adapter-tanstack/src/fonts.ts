// Authoritative hosted font metadata shared by generation, preview and static export.
import { FONT_WEIGHTS, FONTS } from "@smithable/core";

/** Fonts hosted by the app itself (Fontsource, OFL); the package is added to package.json. */
export const FONT_PACKAGES: Record<(typeof FONTS)[number], string> = {
  Inter: "@fontsource-variable/inter",
  "Nunito Sans": "@fontsource-variable/nunito-sans",
  "Source Sans 3": "@fontsource-variable/source-sans-3",
  "Source Serif 4": "@fontsource-variable/source-serif-4",
  Fraunces: "@fontsource-variable/fraunces",
  "Archivo Narrow": "@fontsource-variable/archivo-narrow",
  "DM Sans": "@fontsource-variable/dm-sans",
  Outfit: "@fontsource-variable/outfit",
  // The twelve of docs/design/look-breadth.md §2; a one-weight face is a plain package.
  "Hanken Grotesk": "@fontsource-variable/hanken-grotesk",
  "Instrument Sans": "@fontsource-variable/instrument-sans",
  "Mona Sans": "@fontsource-variable/mona-sans",
  "Bricolage Grotesque": "@fontsource-variable/bricolage-grotesque",
  Oswald: "@fontsource-variable/oswald",
  "Big Shoulders Display": "@fontsource-variable/big-shoulders-display",
  "Instrument Serif": "@fontsource/instrument-serif",
  "Young Serif": "@fontsource/young-serif",
  Newsreader: "@fontsource-variable/newsreader",
  "Bodoni Moda": "@fontsource-variable/bodoni-moda",
  "Zilla Slab": "@fontsource/zilla-slab",
  "JetBrains Mono": "@fontsource-variable/jetbrains-mono",
};

/**
 * The faces with a true italic, by the file their package keeps it in (look-breadth.md §2): the
 * app imports it beside the roman; the others fall back to the browser's slanted roman.
 */
export const FONT_ITALICS: Record<string, string> = {
  Inter: "wght-italic.css",
  "Nunito Sans": "wght-italic.css",
  "Source Sans 3": "wght-italic.css",
  "Source Serif 4": "wght-italic.css",
  Fraunces: "wght-italic.css",
  "Archivo Narrow": "wght-italic.css",
  "DM Sans": "wght-italic.css",
  "Hanken Grotesk": "wght-italic.css",
  "Instrument Sans": "wght-italic.css",
  "Mona Sans": "wght-italic.css",
  "Instrument Serif": "400-italic.css",
  Newsreader: "wght-italic.css",
  "Bodoni Moda": "wght-italic.css",
  "Zilla Slab": "400-italic.css",
  "JetBrains Mono": "wght-italic.css",
};

export const FONT_ASSET_VERSION = 1;
export interface FontAsset {
  font: string;
  package: string;
  family: string;
  weights: readonly [number, number];
  variants: { import: string; file: string }[];
}
export const FONT_ASSETS: readonly FontAsset[] = FONTS.map((font) => {
  const pkg = FONT_PACKAGES[font];
  const italic = FONT_ITALICS[font];
  const weights = FONT_WEIGHTS[font];
  const fixed = !pkg.startsWith("@fontsource-variable/");
  const extra = fixed
    ? Array.from({ length: (weights[1] - weights[0]) / 100 + 1 }, (_, i) => weights[0] + i * 100)
        .filter((weight) => weight !== 400)
        .flatMap((weight) => [
          { import: `${pkg}/${weight}.css`, file: `${weight}.css` },
          ...(italic
            ? [{ import: `${pkg}/${weight}-italic.css`, file: `${weight}-italic.css` }]
            : []),
        ])
    : [];
  return {
    font,
    package: pkg,
    weights,
    family: pkg.startsWith("@fontsource-variable/") ? `${font} Variable` : font,
    variants: [
      { import: pkg, file: "index.css" },
      ...(italic ? [{ import: `${pkg}/${italic}`, file: italic }] : []),
      ...extra,
    ],
  };
});

/** Only known package/variant imports have a preview URL; never accept arbitrary URLs. */
export function fontImportUrls(target: "local" | "static"): Record<string, string> {
  return Object.fromEntries(
    FONT_ASSETS.flatMap((asset) =>
      asset.variants.map((variant) => [
        variant.import,
        `${target === "local" ? "/node_modules" : "../fonts"}/${asset.package}/${variant.file}`,
      ]),
    ),
  );
}

/** Keep font sheets stable across token edits: replacing @imports aborts in-flight loads. */
export function fontImportRuntime(target: "local" | "static"): string {
  return `(css) => {
    const urls = ${JSON.stringify(fontImportUrls(target))};
    return css.replace(/@import\\s+(?:"([^"]+)"|'([^']+)'|url\\([^)]*\\))[^;]*;/gi, (_, quoted, single) => {
      const name = quoted ?? single;
      const url = Object.hasOwn(urls, name) ? urls[name] : undefined;
      if (url) {
        const id = "sm-font:" + name;
        if (!document.getElementById(id)) {
          const link = document.createElement("link");
          link.id = id;
          link.rel = "stylesheet";
          link.href = url;
          document.head.append(link);
        }
      }
      return "";
    });
  }`;
}
