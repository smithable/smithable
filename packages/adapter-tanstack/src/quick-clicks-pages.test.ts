// The generated pages' side of quick-clicks.test.ts: each puts the change alone on the address in
// force. The snapshot has these lines too, and is refreshed after every template edit.
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
app: { name: Classes }
models:
  Lesson:
    fields:
      title: string!
      level: bool
      startsAt: datetime!
pages:
  lessons:
    crud: Lesson
    filters: [level]
  schedule:
    calendar: { model: Lesson }
    filters: [level]
`;

test("a generated page's filters change the address in force", () => {
  const { ir } = validateSpec({ path: "smithable.yml", text: spec });
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
    },
    ir as SpecIR,
  ).auth as AuthIR;
  const files = generateApp(ir as SpecIR, {
    smithableVersion: "0.0.0",
    auth,
    content: emptyContent(),
  });
  const page = (path: string) => files.find((f) => f.path === path)?.content ?? "";
  expect(page("src/routes/lessons/index.tsx")).toContain(
    'onChange={(_, change) => navigate({ to: "/lessons", search: (now) => ({ ...now, ...change(now), page: undefined }), replace: true, resetScroll: false })}',
  );
  expect(page("src/routes/schedule/index.tsx")).toContain(
    'onChange={(_, change) => navigate({ to: "/schedule", search: (now) => ({ ...now, ...change(now), open: undefined }), replace: true, resetScroll: false })}',
  );
});
