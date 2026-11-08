import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = `smithable: 0.1
app: { name: Shop, description: Sells things. }
models:
  Customer:
    fields: { name: string!, email: email! }
pages:
  customers: { crud: Customer }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const auth = (text: string) =>
  validateAuth({ path: "smithable.auth.yml", text }, ir).auth as AuthIR;

test("an app with sign-in serves its card to the administrators at /app-card, in each language", () => {
  const signedIn = auth(
    "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles:\n  admin:\n    description: Runs it.\n  staff:\n    pages: all\n",
  );
  const files = generateApp(ir, {
    smithableVersion: "0.0.0",
    auth: signedIn,
    cardFiles: [{ name: "smithable.yml", text: spec }],
  });
  const card = files.find((f) => f.path === "src/generated/card.server.ts")?.content ?? "";
  const fn = files.find((f) => f.path === "src/generated/card.ts")?.content ?? "";
  const route = files.find((f) => f.path === "src/routes/app-card.tsx")?.content ?? "";
  expect(card).toContain('name: "Shop"');
  expect(card).toContain('export const MAIN = "en"');
  // The app imports no Smithable package: the facts are data, the renderer the kit's.
  expect(`${card}${fn}${route}`).not.toContain("@smithable/");
  expect(route).toContain('roles: ["admin"]');
  // The facts reach a browser only through the server function, for an administrator.
  expect(route).not.toContain("card.server");
  expect(fn).toContain('if (viewer?.role !== "admin") throw new AccessDenied');
});

test("an app without sign-in has no card, and a spec page cannot take its route", () => {
  const files = generateApp(ir, {
    smithableVersion: "0.0.0",
    auth: auth("smithableAuth: 0.1\nsignIn: none\n"),
  });
  expect(files.some((f) => f.path === "src/routes/app-card.tsx")).toBe(false);
  const taken = validateSpec({
    path: "smithable.yml",
    text: spec.replace(
      "customers: { crud: Customer }",
      "customers: { route: /app-card, crud: Customer }",
    ),
  });
  expect(taken.diagnostics.map((d) => d.message)).toContain(
    'Route "/app-card" is reserved for the application itself.',
  );
});
