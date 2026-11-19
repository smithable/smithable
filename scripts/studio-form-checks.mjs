export async function openFormEntry(page, scope, name) {
  const summary = `summary:text-is("${name}")`;
  const entry = scope.locator("details", { has: page.locator(summary) }).first();
  if (!(await entry.evaluate((details) => details.open)))
    await entry.locator(summary).first().click();
  return entry;
}
