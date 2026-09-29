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
app: { name: Studio, timezone: Europe/Mariehamn }
models:
  ClassType:
    fields: { name: string!, durationMinutes: int! }
  Session:
    fields: { classType: ClassType!, startsAt: datetime! }
pages:
  sessions: { crud: Session }
  schedule: { calendar: { model: Session, duration: classType.durationMinutes } }
`;
const generate = (text: string) => {
  const ir = validateSpec({ path: "smithable.yml", text }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "a",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: {} }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return (path: string) => files.find((f) => f.path === path)?.content;
};
const file = generate(spec);

test("a calendar loads the range shown through the model's data function, with lengths one reference away", () => {
  const route = file("src/routes/schedule/index.tsx") ?? "";
  expect(route).toContain(
    "sessionData.list(viewer, and(gte(sessions.startsAt, new Date(data.from)), lt(sessions.startsAt, new Date(data.to))))",
  );
  expect(route).toContain("await classTypeData.list(viewer)");
  expect(route).toContain("minutes.get(row.classTypeId)");
  // A block says its session's class type (the model has no title field of its own).
  expect(route).toContain('title: String(row.classType?.name ?? "")');
  expect(route).toContain('allows(pageAccess["sessions"], viewer)');
  expect(file("src/kit/Calendar.tsx")).toBeDefined();
});

test("the new session's form takes its start from the address; seeds are placed around today", () => {
  const form = file("src/routes/sessions/new.tsx") ?? "";
  expect(form).toContain(
    "validateSearch: z.object({ startsAt: z.string().max(40).optional().catch(undefined) })",
  );
  expect(form).toContain("instantOf(search.startsAt, app.timeZone)");
  expect(file("src/db/seed.ts")).toContain("function aroundToday(");
});

test("without a calendar, no kit file, no search on the new form and no moved samples", () => {
  const plain = generate(spec.replace(/ {2}schedule: .*\n/, ""));
  expect(plain("src/kit/Calendar.tsx")).toBeUndefined();
  expect(plain("src/routes/sessions/new.tsx")).not.toContain("validateSearch");
  expect(plain("src/db/seed.ts")).not.toContain("aroundToday");
});
