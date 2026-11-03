import { FONTS } from "@smithable/core";
import { expect, test } from "vitest";
import { FONT_ASSETS, fontImportRuntime, fontImportUrls } from "./fonts.js";
import { STACK_PROFILE } from "./stack.js";

test("every offered face has pinned, allowlisted local and static variants", () => {
  expect(FONT_ASSETS.map((a) => a.font)).toEqual([...FONTS]);
  for (const asset of FONT_ASSETS) {
    expect(STACK_PROFILE.fonts[asset.package as keyof typeof STACK_PROFILE.fonts]).toMatch(
      /^\d+\.\d+\.\d+$/,
    );
    for (const variant of asset.variants) {
      expect(fontImportUrls("local")[variant.import]).toBe(
        `/node_modules/${asset.package}/${variant.file}`,
      );
      expect(fontImportUrls("static")[variant.import]).toBe(
        `../fonts/${asset.package}/${variant.file}`,
      );
    }
  }
  expect(fontImportUrls("local")["https://example.com/font.css"]).toBeUndefined();
  expect(fontImportUrls("local")["@fontsource/instrument-serif/400-italic.css"]).toBeTruthy();
  expect(fontImportUrls("static")["@fontsource-variable/fraunces/wght-italic.css"]).toBeTruthy();
});

test("font runtime strips unknown import syntaxes and never duplicates a registered sheet", () => {
  const head: { id: string; href?: string }[] = [];
  const document = {
    getElementById: (id: string) => head.find((link) => link.id === id),
    createElement: () => ({ id: "" }),
    head: { append: (link: { id: string }) => head.push(link) },
  };
  const apply = new Function("document", `return (${fontImportRuntime("local")});`)(document);
  expect(
    apply(
      "@import \"https://example.com/font.css\"; @import url(https://example.com/x.css); @import 'toString'; :root {}",
    ),
  ).toBe("   :root {}");
  expect(head).toEqual([]);
  apply('@import "@fontsource/instrument-serif/400-italic.css";');
  apply('@import "@fontsource/instrument-serif/400-italic.css";');
  expect(head).toEqual([
    {
      id: "sm-font:@fontsource/instrument-serif/400-italic.css",
      href: "/node_modules/@fontsource/instrument-serif/400-italic.css",
      rel: "stylesheet",
    },
  ]);
});
