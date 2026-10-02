import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = `smithable: 0.1
app: { name: Acme }
models:
  Customer:
    fields: { name: string!, manager: User }
pages:
  customers: { crud: Customer }
  team: { users: manage }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const authOf = (text: string) =>
  validateAuth({ path: "smithable.auth.yml", text }, ir).auth as AuthIR;
const OPEN =
  "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: {}, sales: {} }\n";
const CLOSED = OPEN.replace("[google] }", "[google], selfSignUp: false }");
const files = (auth: AuthIR) =>
  generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (list: ReturnType<typeof files>, path: string) =>
  list.find((f) => f.path === path)?.content ?? "";

test("a users page brings the invitation table, the server module, the kit, a test and a README section", () => {
  const app = files(authOf(OPEN));
  const paths = app.map((f) => f.path);
  expect(paths).toEqual(
    expect.arrayContaining([
      "src/kit/Users.tsx",
      "src/generated/users.server.ts",
      "src/generated/users.test.ts",
      "src/routes/team/index.tsx",
    ]),
  );
  expect(file(app, "src/db/schema.ts")).toContain(
    'export const invitation = sqliteTable("invitation"',
  );
  expect(file(app, "src/generated/pages.ts")).toMatch(
    /team: \{\s*public: false,\s*roles: \["admin"\]/,
  );
  expect(file(app, "README.md")).toContain("## Users and invitations");
  const server = file(app, "src/generated/users.server.ts");
  expect(server).toContain('const RULE = pageAccess["team"];');
  expect(server).toContain('export const ROLES = ["admin", "sales"] as const;');
  expect(file(app, "src/routes/team/index.tsx")).toContain("origin()");
  // Open sign-up: an invitation gives its role, everyone else the default one.
  const auth = file(app, "src/lib/auth.ts");
  expect(auth).toContain('role: ADMINS.includes(email) ? "admin" : open?.role ?? "sales"');
  expect(auth).not.toContain("Only invited people");
  expect(auth).toContain("after: async (created) =>");
  expect(file(app, "src/routes/sign-in.tsx")).toContain("invitation={invitation}");
  expect(file(app, "src/generated/users.test.ts")).toContain("gets the default role");
});

test("closed sign-up refuses uninvited addresses at sign-in, but not the admins or the development users", () => {
  const app = files(authOf(CLOSED));
  const auth = file(app, "src/lib/auth.ts");
  expect(auth).toContain('import { APIError } from "better-auth/api";');
  expect(auth).toContain('!(demoSignIn && email.startsWith("demo-"))');
  expect(auth).toContain("Only invited people can sign in to");
  expect(file(app, "src/generated/users.test.ts")).toContain("is refused");
  expect(file(app, "README.md")).toContain("Sign-up is closed");
});

test("without a users page nothing of it is generated", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Acme }\nmodels:\n  Customer:\n    fields: { name: string! }\npages:\n  customers: { crud: Customer }\n",
  }).ir as SpecIR;
  const app = generateApp(plain, {
    smithableVersion: "0.0.0",
    auth: validateAuth({ path: "smithable.auth.yml", text: OPEN }).auth as AuthIR,
    content: emptyContent(),
  });
  const paths = app.map((f) => f.path);
  expect(paths).not.toContain("src/kit/Users.tsx");
  expect(paths).not.toContain("src/generated/users.server.ts");
  expect(file(app, "src/db/schema.ts")).not.toContain("invitation");
  expect(file(app, "src/lib/auth.ts")).not.toContain("invitation");
});
