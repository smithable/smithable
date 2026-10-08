import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

test("the privacy page's facts are typed, so a public model with a personal field type-checks", () => {
  // The stranger walk of 2026-10-07: a phone on the public Instructor made `readers: "visitors"`,
  // which TypeScript widened to string against the kit's union, and the app no longer built.
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: X }
models:
  Instructor:
    fields: { name: string!, phone: phone }
  Message:
    fields: { name: string!, email: email! }
pages:
  home: { route: /, landing: { hero: {}, footer: {} } }
  privacy: { route: /privacy, legal: privacy }
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy], read: [Instructor] }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const route = files.find((f) => f.path === "src/routes/privacy/index.tsx")?.content ?? "";
  expect(route).toContain("const facts: LegalFacts = ");
  expect(route).toContain('readers: "visitors"');
  expect(route).toContain('readers: ["admin"]');
  expect(route).toContain('import { LegalPage, type LegalFacts } from "#/kit/LegalPage"');
});
