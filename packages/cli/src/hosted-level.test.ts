import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { hostedLevel, levelLine, levelWarnings } from "./hosted-level.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Support }\nmodels:\n  Case:\n    fields: { subject: string! }\noutgoing:\n  caseOpened: { when: Case created, to: mail, recipient: admin }\n",
}).ir as SpecIR;
const file = {
  path: "smithable.auth.yml",
  text: "smithableAuth: 0.1\nsignIn:\n  providers: [email, google]\ndefaultAccess: shared\n",
};
const auth = validateAuth(file, ir).auth as AuthIR;

test("the level is read from the hosted service's setting, and only its three values", () => {
  expect(hostedLevel({ SMITHABLE_HOSTED_LEVEL: "strict" })).toBe("strict");
  expect(hostedLevel({ SMITHABLE_HOSTED_LEVEL: "loose" })).toBeUndefined();
  expect(hostedLevel({})).toBeUndefined();
});

test("at Strict, sign-in with Google is a warning where the file names it; at Normal nothing", () => {
  const [warning, ...rest] = levelWarnings("strict", auth, file);
  expect(rest).toEqual([]);
  expect(warning).toMatchObject({ severity: "warning", code: "hosted-level-sign-in", line: 3 });
  expect(warning?.message).toContain("Google");
  expect(levelWarnings("normal", auth, file)).toEqual([]);
});

test("the release check's line names the level and the app's connections", () => {
  expect(levelLine("strict", ir, auth)).toBe(
    "This app's level is Strict; its connections: sign-in with Google, mail.",
  );
});
