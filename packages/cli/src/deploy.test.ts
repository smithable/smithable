import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { mailWarning } from "./deploy.js";

test("deploying an app with email sign-in and no mail settings warns that no code reaches anyone", () => {
  const dir = mkdtempSync(join(tmpdir(), "deploy-"));
  writeFileSync(
    join(dir, "smithable.auth.yml"),
    "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\n",
  );
  expect(mailWarning(dir, {})).toContain("email sign-in needs mail settings");
  expect(mailWarning(dir, { SMTP_URL: "smtp://x" })).toBeUndefined();
  writeFileSync(
    join(dir, "smithable.auth.yml"),
    "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
  );
  expect(mailWarning(dir, {})).toBeUndefined();
});
