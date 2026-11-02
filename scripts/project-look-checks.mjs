// Current-project browser checks shared by the integrated Studio gate and focused lab runner.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git, ownRepository } from "../packages/cli/dist/git.js";
import { projectRevision } from "../packages/cli/dist/project-revision.js";
import { parseTheme, sameLookTheme, TOKEN_NAMES } from "../packages/core/dist/index.js";

export async function checkProjectLookApply(page, dir) {
  await page.getByRole("button", { name: "Discard draft and open this page’s saved look" }).click();
  await page
    .getByRole("button", { name: "Discard draft and open this page’s saved look", exact: true })
    .waitFor();
  const before = ownRepository(dir) ? git(dir, ["rev-parse", "HEAD"]).out : undefined;
  const revision = projectRevision(dir);
  const initial = await page.getByLabel("Name", { exact: true }).inputValue();
  assert.equal(
    await page
      .getByLabel("Start from theme", { exact: true })
      .evaluate((s) => s.selectedOptions[0].textContent.trim()),
    initial,
  );
  assert(await page.getByRole("button", { name: "Apply look", exact: true }).isDisabled());
  // Reset is a draft operation, even when the project's app/page overrides mask the control.
  const reset = page.getByRole("button", { name: "Reset primary override in draft", exact: true });
  if (await reset.count()) await reset.click();
  const light = page.getByRole("button", { name: "Light", exact: true });
  if (!(await light.isDisabled())) await light.click();
  await page.getByLabel("Primary", { exact: true }).evaluate((input) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "#284a83");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByLabel("Heading font", { exact: true }).selectOption("Fraunces");
  const copy = page.getByRole("button", { name: "Make a project copy", exact: true });
  if (await copy.count()) await copy.click();
  const name = await page.getByLabel("Name", { exact: true }).inputValue();
  assert.notEqual(name, initial);
  const drafted = await page.locator("textarea").inputValue();
  assert.equal(ownRepository(dir) ? git(dir, ["rev-parse", "HEAD"]).out : undefined, before);
  assert.equal(projectRevision(dir), revision, "draft editing wrote project source");
  const answer = page.waitForResponse(
    (r) => r.url().endsWith("/api/apply") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Apply look", exact: true }).click();
  const response = await answer;
  const result = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(result));
  assert(result.ok, result.output);
  await page
    .getByRole("status")
    .filter({ hasText: /^Applied:/ })
    .waitFor();
  assert.equal(
    git(dir, ["rev-list", "--count", before ? `${before}..HEAD` : "HEAD"]).out,
    before ? "1" : "2",
  );
  assert(existsSync(join(dir, "themes", `${name}.yml`)));
  const saved = readFileSync(join(dir, "themes", `${name}.yml`), "utf8");
  assert(
    sameLookTheme(
      parseTheme({ path: "draft.yml", text: drafted }).theme,
      parseTheme({ path: "saved.yml", text: saved }).theme,
    ),
  );
  await page.reload();
  await page.getByLabel("Name", { exact: true }).waitFor();
  await page.waitForFunction(
    (name) => document.querySelector('input[aria-label="Name"]')?.value === name,
    name,
  );
  assert(await page.getByRole("button", { name: "Apply look", exact: true }).isDisabled());
  const start = await page.evaluate(() => fetch("/api/start").then((r) => r.json()));
  await page.locator("iframe[data-frame]").first().waitFor({ timeout: 90000 });
  const frame = await (
    await page.locator("iframe[data-frame]").first().elementHandle()
  ).contentFrame();
  await frame.waitForSelector("body[data-hydrated=true]", { timeout: 90000 });
  const direct = await page.context().newPage();
  const colors = (tokens) => {
    const parent = document.querySelector("[data-page]") ?? document.body;
    const probe = document.createElement("span");
    parent.append(probe);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const values = Object.fromEntries(
      tokens.map((token) => {
        probe.style.color = `var(--${token})`;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = getComputedStyle(probe).color;
        ctx.fillRect(0, 0, 1, 1);
        return [token, [...ctx.getImageData(0, 0, 1, 1).data]];
      }),
    );
    probe.remove();
    return values;
  };
  try {
    await direct.emulateMedia({ colorScheme: "light" });
    await direct.goto(`${start.preview}${start.frames[0].path}`);
    await direct.locator("body[data-hydrated=true]").waitFor({ timeout: 90000 });
    assert.equal(
      await direct.locator("#sm-theme").count(),
      0,
      "direct reload unexpectedly has a transient theme",
    );
    assert.deepEqual(
      await frame.evaluate(colors, TOKEN_NAMES),
      await direct.evaluate(colors, TOKEN_NAMES),
      "saved app reload differs from editor",
    );
  } finally {
    await direct.close();
  }
  console.log(
    "  ✓ current source/provenance; draft has no source write; atomic Apply; saved reload matches every token",
  );
  return { name, before };
}
