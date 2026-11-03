import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FONT_ASSETS } from "@smithable/adapter-tanstack";
import { expect, test } from "vitest";
import { exportThemeFonts } from "./theme-fonts.js";

test("partial font refresh repairs missing faces/variants, keeps languages and licenses, omits unused files", () => {
  const root = mkdtempSync(join(tmpdir(), "smithable-font-refresh-"));
  try {
    for (const asset of FONT_ASSETS) {
      const from = join(root, "node_modules", asset.package);
      mkdirSync(join(from, "files"), { recursive: true });
      writeFileSync(join(from, "LICENSE"), "OFL fixture");
      writeFileSync(join(from, "files", "unused.woff2"), "unused");
      for (const variant of asset.variants) {
        const file = variant.file.replace(".css", "-latin-ext.woff2");
        writeFileSync(join(from, "files", file), "fixture font bytes");
        writeFileSync(join(from, variant.file), `@font-face { src: url(./files/${file}); }`);
      }
    }
    const out = join(root, "export");
    mkdirSync(out);
    writeFileSync(join(out, "old-font.txt"), "existing export");
    exportThemeFonts(root, out);
    const asset = FONT_ASSETS.find((a) => a.font === "Zilla Slab");
    if (!asset) throw new Error("missing test face");
    const missing = join(out, asset.package, "700-italic.css");
    rmSync(missing);
    exportThemeFonts(root, out);
    expect(existsSync(missing)).toBe(true);
    expect(readFileSync(join(out, asset.package, "LICENSE"), "utf8")).toBe("OFL fixture");
    expect(existsSync(join(out, asset.package, "files", "700-italic-latin-ext.woff2"))).toBe(true);
    expect(existsSync(join(out, asset.package, "files", "unused.woff2"))).toBe(false);
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    expect(manifest.fonts.map((a: { font: string }) => a.font)).toEqual(
      FONT_ASSETS.map((a) => a.font),
    );
    expect(manifest.fonts.every((a: { version: string }) => /^\d+\.\d+\d*/.test(a.version))).toBe(
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
