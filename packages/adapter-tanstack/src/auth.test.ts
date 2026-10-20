import { type AuthIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = import.meta.glob("../../../examples/crm/smithable.yml", {
  query: "?raw",
  import: "default",
  eager: true,
});
const authYml = import.meta.glob("../../../examples/crm/smithable.auth.yml", {
  query: "?raw",
  import: "default",
  eager: true,
});

function crm() {
  const ir = validateSpec({ path: "smithable.yml", text: Object.values(spec)[0] as string }).ir;
  const auth = validateAuth({
    path: "smithable.auth.yml",
    text: Object.values(authYml)[0] as string,
  }).auth as AuthIR;
  if (!ir) throw new Error("the CRM example is invalid");
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth });
  return (path: string) => files.find((f) => f.path === path)?.content ?? "";
}

// The hosted service's export scrubs these by name (smithable-cloud, the one-file download), so a
// rename here must fail here first. Columns are snake_case in SQLite (the db's casing).
test("the sign-in tables and their credential columns keep their names", () => {
  const schema = crm()("src/db/schema.ts");
  for (const table of ["user", "session", "account", "verification"])
    expect(schema).toMatch(new RegExp(`sqliteTable\\(\\s*"${table}",`));

  expect(schema).toMatch(/"session",[\s\S]*?token: text\(\)\.notNull\(\)\.unique\(\)/);
  expect(schema).toMatch(/"verification",[\s\S]*?value: text\(\)\.notNull\(\)/);
  for (const column of ["accessToken", "refreshToken", "idToken", "password"])
    expect(schema).toMatch(new RegExp(`"account",[\\s\\S]*?${column}: text\\(\\)`));
});

test("a provider's tokens are never stored: the account hooks null them on create and update", () => {
  const auth = crm()("src/lib/auth.ts");
  expect(auth).toContain(
    "create: { before: async (account) => ({ data: { ...account, ...NO_TOKENS } }) }",
  );
  expect(auth).toContain(
    "update: { before: async (account) => ({ data: { ...account, ...NO_TOKENS } }) }",
  );
  expect(auth).toMatch(
    /const NO_TOKENS = \{\n {2}accessToken: null,\n {2}refreshToken: null,\n {2}idToken: null,/,
  );
});

// A demo (DEMO_SIGN_IN=1) offers the role buttons in production too; nothing else changes.
test("the demo sign-in is gated by DEMO_SIGN_IN at run time, beside the development gate", () => {
  const files = crm();
  const lib = files("src/lib/auth.ts");
  expect(lib).toContain('export const demoSignIn = process.env.DEMO_SIGN_IN === "1";');
  // Nobody signs up with a password; the role buttons make their users with a new one each time.
  expect(lib).toContain(
    "emailAndPassword: { enabled: import.meta.env.DEV || demoSignIn, disableSignUp: true }",
  );
  expect(lib).toContain('!(demoSignIn && email.startsWith("demo-"))');
  const route = files("src/routes/sign-in.tsx");
  expect(route).toContain("if (!import.meta.env.DEV && !demoSignIn)");
  expect(route).toContain("const password = crypto.randomUUID() + crypto.randomUUID();");
  expect(route).not.toContain("-password");
  expect(route).toContain("devRoles={import.meta.env.DEV || demo ? [...ROLES] : undefined}");
  expect(files("src/routes/__root.tsx")).toContain('demo: process.env.DEMO_SIGN_IN === "1"');
});
