import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { mailWarning, targetWarnings } from "./deploy.js";
import { tempDir } from "./test-dir.js";

test("deploying an app with email sign-in and no mail settings warns that no code reaches anyone", () => {
  const dir = tempDir("deploy-");
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

test("deploying an app whose outgoing target is not set names its missing settings", () => {
  const dir = tempDir("deploy-");
  writeFileSync(
    join(dir, "smithable.yml"),
    `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields:
      title: string!
outgoing:
  incidentOpened:
    when: Incident created
    to: statusFeed
pages:
  incidents: { crud: Incident }
`,
  );
  expect(targetWarnings(dir, {})).toEqual([
    "Warning: the outgoing target statusFeed is not set (OUTGOING_STATUSFEED_URL, OUTGOING_STATUSFEED_SECRET): its calls wait in the outbox until it is.",
  ]);
  expect(
    targetWarnings(dir, {
      OUTGOING_STATUSFEED_URL: "https://feed.example/hook",
      OUTGOING_STATUSFEED_SECRET: "s",
    }),
  ).toEqual([]);
});
