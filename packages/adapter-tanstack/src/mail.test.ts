import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";
import { STACK_PROFILE } from "./stack.js";

test("every app gets the mail kit and its library, and the README says how to set it up", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item:\n    fields: { name: string! }\n",
  }).ir as SpecIR;
  const auth = validateAuth({
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: none\n",
  }).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const paths = files.map((f) => f.path);
  expect(paths).toContain("src/kit/mail.ts");
  const pkg = JSON.parse(files.find((f) => f.path === "package.json")?.content ?? "{}");
  expect(pkg.dependencies.nodemailer).toBe(STACK_PROFILE.dependencies.nodemailer);
  expect(files.find((f) => f.path === "README.md")?.content).toContain("## Mail");
  expect(files.find((f) => f.path === "src/custom/hooks.ts")?.content).toContain("sendMail");
});
