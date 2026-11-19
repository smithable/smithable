export async function openFormEntry(page, scope, name) {
  const summary = `summary:text-is("${name}")`;
  const entry = scope.locator("details", { has: page.locator(summary) }).first();
  if (!(await entry.evaluate((details) => details.open)))
    await entry.locator(summary).first().click();
  return entry;
}

export async function openPreviewAddress(page) {
  const pageName = page.locator("[data-preview-page]");
  await pageName.waitFor();
  if ((await pageName.getAttribute("aria-expanded")) !== "true") await pageName.click();
  return page.getByRole("combobox", { name: "Preview address", exact: true });
}

export async function toolbarAction(page, name) {
  const header = page.locator("[data-studio-header]");
  await header.waitFor();
  const action = header.getByRole("button", { name, exact: true });
  if (!(await action.isVisible())) {
    const more = header.getByRole("button", { name: "More", exact: true });
    if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
  }
  return action;
}

export async function showWorkspaceControls(page) {
  if (!(await page.locator("[data-workspace-controls]").isVisible()))
    await (await toolbarAction(page, "Workspace layout")).click();
}

export async function openSmith(page) {
  const face = page
    .locator("[data-studio-header]")
    .getByRole("button", { name: /^Smith(?:, a question is waiting)?$/ });
  await face.waitFor();
  if ((await face.getAttribute("aria-pressed")) === "false") await face.click();
  return face;
}
