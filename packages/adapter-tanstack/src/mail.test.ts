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

test("MAIL_MODE holds mail unless it is testers or all, and Import says which mode the app runs with", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Item:\n    fields: { name: string! }\n",
  }).ir as SpecIR;
  const auth = validateAuth({
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: none\n",
  }).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";
  const mail = file("src/kit/mail.ts");
  // Outbox, or a mode the kit does not know, keeps every mail in with SMTP settings too.
  expect(mail).toMatch(
    /function smtp\(\) \{\n {2}const env = process\.env;\n {2}if \(!sends\(\)\) return undefined;/,
  );
  expect(mail).toContain('!mode || mode === "testers" || mode === "all"');
  expect(mail).toContain("export function mailMode()");
  // The import's preview carries it, and the panel shows its sentence.
  expect(file("src/kit/import.server.ts")).toContain("const mail = mailMode();");
  expect(file("src/kit/ImportDialog.tsx")).toContain("w.importMail[shown.mail]");
  expect(file("README.md")).toContain("`MAIL_MODE=outbox` keeps them there with settings too");
});
