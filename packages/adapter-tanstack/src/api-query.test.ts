import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A list's query in its bounds, and an import a key's only (T821 #8, #9).
const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Acme }\nmodels:\n  Message:\n    trash: true\n    fields: { text: string!, size: int }\npages:\n  messages: { crud: Message }\n  team: { users: manage }\n",
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: {} }\npublic: { create: [Message] }\napi: { models: all }\n",
  },
  ir,
).auth as AuthIR;
const route =
  generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
    (f) => f.path === "src/routes/api/v1/messages/index.ts",
  )?.content ?? "";

test("a list's page, limit and sums stay in their bounds, and ?trashed is no filter", () => {
  expect(route).toContain("return Number.isSafeInteger(n) && n >= 1 ? n : fallback;");
  expect(route).toContain('const page = Math.min(whole("page", 1), 1_000_000);');
  expect(route).toContain('"sort", "sum", "trashed"]');
  expect(route).toContain(
    'const sums = [...new Set(query.get("sum")?.split(",").filter(Boolean))].slice(0, 10);',
  );
});

test("a visitor adds one at a time: a list from a visitor is no import", () => {
  expect(route).toContain('if (viewer === null) throw new BadInput("Add one at a time.");');
  expect(route).toMatch(/import \{ BadInput, [^}]*openApiCall[^}]*\} from "#\/kit\/api\.server";/);
});
