// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import { type AuthIR, pageAccess, type SpecIR } from "@smithable/core";
import { hasSignIn } from "./auth.js";
import { HEADER, type Texts } from "./shared.js";

/**
 * Smoke tests generated from the pages (ARCHITECTURE §12): public pages open for a visitor,
 * protected ones send a visitor to sign-in, and every role opens each page it may, without
 * errors, through the development sign-in.
 */
export function smokeTests(ir: SpecIR, t: Texts, auth: AuthIR): string {
  const signIn = hasSignIn(auth);
  const pages = ir.pages.map((p) => {
    const access = pageAccess(p, auth);
    return {
      route: p.route,
      title: t.pageTitle(p.id),
      public: access.public || !signIn,
      roles: access.roles,
    };
  });
  const roles = signIn ? auth.roles.map((r) => r.name) : [];
  return `${HEADER}import { expect, type Page, test } from "@playwright/test";

/** Opens a page and fails on any error in the browser, e.g. a script the policy blocked. */
async function visit(page: Page, route: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1").first()).toBeVisible();
  expect(errors).toEqual([]);
}
${pages
  .filter((p) => p.public)
  .map(
    (p) => `
test(${JSON.stringify(`${p.title} opens for a visitor`)}, async ({ page }) => {
  await visit(page, ${JSON.stringify(p.route)});
});`,
  )
  .join("")}${pages
  .filter((p) => !p.public)
  .map(
    (p) => `
test(${JSON.stringify(`${p.title} needs sign-in`)}, async ({ page }) => {
  await page.goto(${JSON.stringify(p.route)});
  await expect(page).toHaveURL(/sign-in/);
});`,
  )
  .join("")}${roles
  .map(
    (role) => `

test.describe(${JSON.stringify(`signed in as ${role}`)}, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: ${JSON.stringify(`Sign in as ${role}`)} }).click();
    await page.waitForURL((url) => url.pathname !== "/sign-in");
  });
${pages
  .filter((p) => !p.public && p.roles.includes(role))
  .map(
    (p) => `
  test(${JSON.stringify(`${p.title} opens`)}, async ({ page }) => {
    await visit(page, ${JSON.stringify(p.route)});
  });`,
  )
  .join("")}
});`,
  )
  .join("")}
`;
}
