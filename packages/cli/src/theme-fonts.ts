// Static lab fonts: refresh each offered face, even when an earlier export already exists.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_ASSET_VERSION, FONT_ASSETS, STACK_PROFILE } from "@smithable/adapter-tanstack";

export function exportThemeFonts(app: string, out: string): void {
  for (const asset of FONT_ASSETS) {
    const from = join(app, "node_modules", asset.package);
    const to = join(out, asset.package);
    mkdirSync(join(to, "files"), { recursive: true });
    for (const variant of asset.variants) {
      const css = readFileSync(join(from, variant.file), "utf8");
      // Retain every declared language subset and supported weight/style, not just Latin roman.
      for (const [, file] of css.matchAll(/url\(\.\/files\/([a-zA-Z0-9-]+\.woff2?)\)/g))
        if (file) cpSync(join(from, "files", file), join(to, "files", file));
      writeFileSync(join(to, variant.file), css);
    }
    cpSync(join(from, "LICENSE"), join(to, "LICENSE"));
  }
  writeFileSync(
    join(out, "manifest.json"),
    `${JSON.stringify(
      {
        version: FONT_ASSET_VERSION,
        fonts: FONT_ASSETS.map((asset) => ({
          ...asset,
          version: STACK_PROFILE.fonts[asset.package as keyof typeof STACK_PROFILE.fonts],
        })),
      },
      null,
      2,
    )}\n`,
  );
}
