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

export async function openSettings(page) {
  const settings = await toolbarAction(page, "All settings");
  if ((await settings.getAttribute("aria-pressed")) !== "true") await settings.click();
}

export async function openStudioGuide(page) {
  await (await toolbarAction(page, "Help")).click();
  await page.getByRole("button", { name: "Tour Studio", exact: true }).click();
}

export async function checkAppOwnsPhoneSwipe(page) {
  const frame = 'iframe[title="App preview"]';
  const arrow = (name) => page.getByRole("button", { name, exact: true });
  const showApp = arrow("Show the app");
  if (await showApp.isVisible()) await showApp.click();
  await page.waitForFunction((selector) => {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    return box && Math.abs(box.left) < 2;
  }, frame);
  await page.evaluate((selector) => {
    const previewWindow = document.querySelector(selector)?.contentWindow;
    delete document.documentElement.dataset.previewSwipeFixture;
    const receive = (event) => {
      if (event.source !== previewWindow || event.data?.type !== "swipe") return;
      document.documentElement.dataset.previewSwipeFixture = "seen";
      window.removeEventListener("message", receive);
    };
    window.addEventListener("message", receive);
  }, frame);
  // Deliver the app's legacy swipe message from the frame without relying on its editor state.
  const studioOrigin = new URL(page.url()).origin;
  await page
    .frameLocator(frame)
    .locator("body")
    .evaluate((_, origin) => {
      parent.postMessage({ source: "smithable-preview", type: "swipe", direction: 1 }, origin);
    }, studioOrigin);
  await page.locator('html[data-preview-swipe-fixture="seen"]').waitFor({ state: "attached" });
  await page.locator("main").evaluate(async (row) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(row.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
  const appBounds = await page.locator(frame).boundingBox();
  if (
    !appBounds ||
    Math.abs(appBounds.x) > 2 ||
    !(await arrow("Show settings").isVisible()) ||
    !(await arrow("Show Smith").isVisible())
  )
    throw new Error("a swipe inside the app switched Studio away from its preview");
}

export async function openSmith(page) {
  const face = page
    .locator("[data-studio-header]")
    .getByRole("button", { name: /^Smith(?:, a question is waiting)?$/ });
  await face.waitFor();
  if ((await face.getAttribute("aria-pressed")) === "false") await face.click();
  return face;
}
