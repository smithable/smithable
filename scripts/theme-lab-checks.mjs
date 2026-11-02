// Shared by the Studio gate and the focused standalone lab check.

import assert from "node:assert/strict";
import { FONT_ASSETS, themeCss } from "../packages/adapter-tanstack/dist/index.js";
import {
  BUILT_IN_THEMES,
  emptyUx,
  parseTheme,
  TOKEN_NAMES,
  validateUx,
} from "../packages/core/dist/index.js";
import { checkLookResponsive } from "./look-responsive-checks.mjs";

export async function checkThemeLab(page, context) {
  const start = context ?? (await page.evaluate(() => fetch("/api/start").then((r) => r.json())));
  const select = page.getByLabel("Start from theme", { exact: true });
  const source = page.locator("textarea");
  await page.locator("iframe[data-frame]").first().waitFor({ timeout: 90000 });
  const frame = await (
    await page.locator("iframe[data-frame]").first().elementHandle()
  ).contentFrame();
  await frame.waitForSelector("body[data-hydrated=true]", { timeout: 90000 });
  await checkLookResponsive(page);
  for (const name of ["modern", "corporate", "brass"]) {
    const theme = BUILT_IN_THEMES.find((t) => t.name === name);
    if (!theme) continue;
    await select.selectOption(name);
    await page.getByLabel("radius", { exact: true }).fill("19px");
    for (const mode of ["light", "dark"]) {
      if (theme.modes !== "both" && theme.modes !== mode) continue;
      await page
        .getByRole("button", { name: mode === "light" ? "Light" : "Dark", exact: true })
        .click();
      await frame.waitForFunction(
        ({ mode }) =>
          document.documentElement.dataset.appearance === mode &&
          document.getElementById("sm-theme")?.textContent.includes("--radius: 19px"),
        { mode },
      );
      // The independent baseline is generated directly from the original preset, not its YAML.
      let expectedUx = {
        ...emptyUx(),
        theme: { preset: name, density: theme.density, motion: theme.motion },
      };
      let expectedThemes = [theme];
      if (start.look) {
        const original = validateUx(
          { path: "smithable.ux.yml", text: start.look.uxText },
          start.look.ir,
          start.look.themes,
          start.look.auth,
        ).ux;
        const target = original.pages[start.look.page]?.theme?.preset ?? original.theme.preset;
        expectedThemes = [
          ...start.look.themes.filter((t) => t.name !== target),
          { ...theme, name: target },
        ];
        expectedUx = validateUx(
          { path: "smithable.ux.yml", text: start.look.uxText },
          start.look.ir,
          expectedThemes,
          start.look.auth,
        ).ux;
      }
      const css = themeCss(expectedUx, expectedThemes);
      const pairs = await frame.evaluate(
        ({ css, tokens }) => {
          const probe = document.createElement("span");
          (document.querySelector("[data-page]") ?? document.body).append(probe);
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          const read = () =>
            Object.fromEntries(
              tokens.map((token) => {
                probe.style.color = `var(--${token})`;
                ctx.clearRect(0, 0, 1, 1);
                ctx.fillStyle = getComputedStyle(probe).color;
                ctx.fillRect(0, 0, 1, 1);
                return [token, [...ctx.getImageData(0, 0, 1, 1).data]];
              }),
            );
          const edited = read();
          const baseline = document.createElement("style");
          baseline.textContent = css.replace(/@import[^;]+;/g, "");
          document.head.append(baseline);
          const generated = read();
          baseline.remove();
          probe.remove();
          return { edited, generated };
        },
        { css, tokens: TOKEN_NAMES },
      );
      assert.deepEqual(
        pairs.edited,
        pairs.generated,
        `${name} ${mode}: editor differs from generated preset`,
      );
    }
  }
  await select.selectOption("corporate");
  const authored = await source.inputValue();
  await page.getByLabel("modes", { exact: true }).selectOption("light");
  assert(!/^dark:/m.test(await source.inputValue()));
  assert(await page.getByRole("button", { name: "Dark", exact: true }).isDisabled());
  await page.getByLabel("modes", { exact: true }).selectOption("both");
  assert.deepEqual(
    parseTheme({ path: "draft.yml", text: await source.inputValue() }).theme,
    parseTheme({ path: "draft.yml", text: authored }).theme,
  );
  await page.getByRole("button", { name: "Undo draft", exact: true }).click();
  assert(!/^dark:/m.test(await source.inputValue()));
  await page.getByRole("button", { name: "Redo draft", exact: true }).click();
  assert.deepEqual(
    parseTheme({ path: "draft.yml", text: await source.inputValue() }).theme,
    parseTheme({ path: "draft.yml", text: authored }).theme,
  );
  // FontFaceSet.load returns actual matching faces; check widths against a fallback too.
  const failures = [];
  page.on("requestfailed", (request) => {
    if (/fontsource|woff2/.test(request.url())) failures.push(request.url());
  });
  page.on("response", (response) => {
    if (/fontsource|woff2/.test(response.url()) && response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  for (const asset of FONT_ASSETS) {
    console.log(`  checking font ${asset.font}`);
    await page.getByLabel("Heading font", { exact: true }).selectOption(asset.font);
    await frame.waitForFunction(
      (family) =>
        document.getElementById("sm-theme")?.textContent.includes(`--font-heading: "${family}"`),
      asset.family,
    );
    await checkLoadedFont(frame, asset);
  }
  assert.deepEqual(failures, [], "font requests failed");
  console.log(
    "  ✓ theme tokens match generated presets in both modes; palette undo/redo; every offered font loads",
  );
}

/** Wait for imported CSS to register real matching faces, then load supported edge weights.
 * A requested family string or a synthesized browser weight is not a passing result. */
export async function checkLoadedFont(frame, asset) {
  await frame.waitForFunction(
    async ({ family, weights, italic }) => {
      const sample = "ÅÄÖ åäö Wide letters iii WWW 0123";
      for (const style of italic ? ["normal", "italic"] : ["normal"]) {
        for (const weight of new Set([400, ...weights])) {
          const faces = await document.fonts.load(`${style} ${weight} 24px "${family}"`, sample);
          if (
            !faces.length ||
            faces.some(
              (face) =>
                face.status !== "loaded" ||
                face.style !== style ||
                face.family.replace(/["']/g, "") !== family,
            )
          )
            return false;
          if (
            !faces.some((face) => {
              const range = face.weight.split(" ").map(Number);
              return weight >= range[0] && weight <= (range[1] ?? range[0]);
            })
          )
            return false;
        }
      }
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `24px "${family}", monospace`;
      const actual = ctx.measureText(sample).width;
      ctx.font = "24px monospace";
      return actual !== ctx.measureText(sample).width;
    },
    {
      family: asset.family,
      weights: asset.weights,
      italic: asset.variants.some((v) => v.file.includes("italic")),
    },
    { timeout: 20000 },
  );
}
