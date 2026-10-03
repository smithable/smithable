// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import { type AuthIR, pageAccess, type SpecIR } from "@smithable/core";
import { devDomain, hasSignIn } from "./auth.js";
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
  // The warm-up: public pages as a visitor, then each other page as the first role that may open it.
  const warmed = new Set(pages.filter((p) => p.public).map((p) => p.route));
  const list = (routes: string[]) => `[${routes.map((r) => JSON.stringify(r)).join(", ")}]`;
  const warmups = [
    ...(warmed.size ? [`  await warm(undefined, ${list([...warmed])});`] : []),
    ...roles.flatMap((role) => {
      const routes = pages
        .filter((p) => !p.public && p.roles.includes(role) && !warmed.has(p.route))
        .map((p) => p.route);
      for (const r of routes) warmed.add(r);
      return routes.length ? [`  await warm(${JSON.stringify(role)}, ${list(routes)});`] : [];
    }),
  ].join("\n");
  const email = auth.signIn !== "none" && auth.signIn.providers.includes("email");
  return `${HEADER}${email ? 'import { readdirSync, readFileSync } from "node:fs";\nimport { join } from "node:path";\n' : ""}import { expect, type Page, test } from "@playwright/test";

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

${
  roles.length
    ? `/**
 * Signs in through the development sign-in. A click before the page has hydrated reaches no
 * handler, and the development server may reload the page for a library it just found: try again.
 */
async function signIn(page: Page, role: string) {
  for (let attempt = 1; ; attempt++) {
    await page.goto("/sign-in");
    await page.locator('body[data-hydrated="true"]').waitFor();
    await page.getByRole("button", { name: \`Sign in as \${role}\` }).click();
    try {
      await page.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 15_000 });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

`
    : ""
}// Every page once before the tests: the development server compiles a page on its first visit
// (and may reload for a new library), which on a busy machine takes most of a test's minute.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  const slow: string[] = [];
  const warm = async (role: string | undefined, routes: string[]) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const open = async (route: string) => {
      try {
        await page.goto(route, { timeout: 90_000 });
        await page.waitForLoadState("networkidle", { timeout: 45_000 });
      } catch {
        slow.push(role ? \`\${route} (as \${role})\` : route);
      }
    };
${roles.length ? "    if (role) await signIn(page, role).catch(() => {});\n" : ""}    for (const route of routes) await open(route);
    await context.close();
  };
${warmups}
  if (slow.length) throw new Error(\`Pages that did not open while warming up: \${slow.join(", ")}\`);
});
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
    await signIn(page, ${JSON.stringify(role)});
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
  .join("")}${
  email
    ? `

/** The sign-in code mailed to an address, from the smoke tests' outbox (no mail is sent). */
function codeFor(address: string): string | undefined {
  const outbox = join("data", "smoke", "mail", "outbox");
  let files: string[] = [];
  try {
    files = readdirSync(outbox).sort().reverse();
  } catch {}
  for (const file of files) {
    const mail = readFileSync(join(outbox, file), "utf8").replace(/=\\r?\\n/g, "");
    if (mail.includes(\`To: \${address}\`)) return /is (\\d{3} \\d{3})\\./.exec(mail)?.[1];
  }
  return undefined;
}

test("signing in with a code from the outbox", async ({ page }) => {
  const address = \`dev-code-\${Date.now()}@${devDomain(auth)}\`;
  await page.goto("/sign-in");
  await page.locator('body[data-hydrated="true"]').waitFor();
  await page.getByLabel("Email address").fill(address);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText("a code is on its way")).toBeVisible();
  await expect.poll(() => codeFor(address), { timeout: 15_000 }).toBeTruthy();
  await page.getByLabel("Code").fill(codeFor(address) as string);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/sign-in");
});`
    : ""
}
`;
}
