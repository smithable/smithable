import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PrivacyFactKey } from "@smithable/adapter-tanstack";
import { expect, test } from "vitest";
import { git } from "./git.js";
import { PARTS, privacyStates } from "./privacy-review.js";
import { tempDir } from "./test-dir.js";

const spec = `smithable: 0.1
app: { name: Review fixture }
models:
  Message:
    fields: { name: string!, email: email! }
pages:
  home: { route: /, landing: { hero: {}, footer: {} } }
  messages: { crud: Message }
  privacy: { route: /privacy, legal: privacy }
`;
const auth =
  "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, member: { pages: all } }\npublic: { pages: [home, privacy] }\n";
const content =
  "smithableContent: 0.1\npages:\n  privacy:\n    operator: { name: Calm Ab, email: hello@calm.example }\n";

const commit = (dir: string, message: string) => {
  expect(git(dir, ["add", "-A"]).ok).toBe(true);
  expect(
    git(dir, ["-c", "user.name=T", "-c", "user.email=t@example.com", "commit", "-q", "-m", message])
      .ok,
  ).toBe(true);
};

test("Studio's view of the privacy page's review: never, reviewed, and what changed since (legal-page.md §6.4)", () => {
  const dir = tempDir("privacy-review-");
  writeFileSync(join(dir, "smithable.yml"), spec);
  writeFileSync(join(dir, "smithable.auth.yml"), auth);
  writeFileSync(join(dir, "smithable.content.yml"), content);
  expect(git(dir, ["init", "-q"]).ok).toBe(true);
  commit(dir, "start");
  const [never] = privacyStates(dir);
  expect(never).toMatchObject({ page: "privacy", state: "never" });
  // The review, recorded in a change of its own as the operation does.
  writeFileSync(
    join(dir, "smithable.content.yml"),
    `smithableContent: 0.1\npages:\n  privacy:\n    operator: { name: Calm Ab, email: hello@calm.example }\n    reviewed:\n      facts: ${never?.facts}\n      on: 2026-11-13\n`,
  );
  commit(dir, "reviewed");
  expect(privacyStates(dir)[0]).toMatchObject({ state: "reviewed", on: "2026-11-13" });
  // A new personal field: the records part changed, said by the page's own heading.
  writeFileSync(
    join(dir, "smithable.yml"),
    spec.replace("email: email! }", "email: email!, phone: phone }"),
  );
  commit(dir, "a phone");
  expect(privacyStates(dir)[0]).toMatchObject({
    state: "changed",
    on: "2026-11-13",
    changed: ["Information in records"],
  });
});

// Every fact the page can describe is in one of the parts: a new one outside them would be told
// as "The page's wording" when it changed. Checked by the type checker (the build fails), and
// here for the parts' own keys.
type Named = (typeof PARTS)[number][1][number];
const everyFactNamed: [Exclude<PrivacyFactKey, Named>] extends [never] ? true : false = true;

test("every fact the privacy page describes belongs to one of its parts", () => {
  expect(everyFactNamed).toBe(true);
  const keys = PARTS.flatMap(([, k]) => [...k]);
  expect(new Set(keys).size).toBe(keys.length);
});
