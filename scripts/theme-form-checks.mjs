import assert from "node:assert/strict";
import { FONT_ASSETS } from "../packages/adapter-tanstack/dist/index.js";
import { checkLoadedFont } from "./theme-lab-checks.mjs";

export async function checkRenderedFonts(page) {
  await page.evaluate(() => document.fonts.ready);
  const families = await page.evaluate(() => [
    ...new Set(
      [document.body, document.querySelector("h1")]
        .filter(Boolean)
        .map((el) => getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/["']/g, "")),
    ),
  ]);
  for (const family of families) {
    const asset = FONT_ASSETS.find((asset) => asset.family === family);
    assert.ok(asset, `the rendered font ${family} has no hosted asset metadata`);
    await checkLoadedFont(page, asset);
  }
}

/** Embedded contact forms keep the submit row after every field, even below the viewport. */
export async function checkContactForm(page) {
  const form = page.locator('[data-section="contact"] [data-kit="model-form"] form');
  if (!(await form.count())) return;
  const bounds = await form.evaluate((form) => {
    const fields = form.querySelector("fieldset").getBoundingClientRect();
    const actions = form.querySelector('[data-part="actions"]');
    return {
      end: fields.bottom,
      actions: actions.getBoundingClientRect().top,
      position: getComputedStyle(actions).position,
    };
  });
  assert.notEqual(bounds.position, "sticky", "an embedded contact form has a sticky submit row");
  assert.ok(bounds.actions >= bounds.end, "the contact submit row covers its fields");
  const fields = await form.evaluate((form) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const rgba = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const over = (front, back) => {
      const alpha = front[3] / 255;
      return front.slice(0, 3).map((channel, i) => channel * alpha + back[i] * (1 - alpha));
    };
    const background = (el) => {
      if (!el) return [255, 255, 255];
      const color = rgba(getComputedStyle(el).backgroundColor);
      return over(color, color[3] === 255 ? [0, 0, 0] : background(el.parentElement));
    };
    const luminance = (rgb) =>
      rgb
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    return [...form.querySelectorAll('input:not([type="hidden"]), textarea, select')].map(
      (field) => {
        const style = getComputedStyle(field);
        const paper = background(field);
        const edge = over(rgba(style.borderTopColor), paper);
        const a = luminance(paper),
          b = luminance(edge);
        return {
          name: field.getAttribute("name") ?? field.id,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          width: Number.parseFloat(style.borderTopWidth),
          border: style.borderTopStyle,
        };
      },
    );
  });
  for (const field of fields) {
    assert.ok(
      field.width > 0 && field.border !== "none",
      `contact field ${field.name} has no visible edge`,
    );
    // Canvas converts CSS colors to 8-bit sRGB; allow the small quantization around 3:1.
    assert.ok(
      field.ratio >= 2.98,
      `contact field ${field.name} edge contrast is ${field.ratio.toFixed(2)}:1`,
    );
  }
}
