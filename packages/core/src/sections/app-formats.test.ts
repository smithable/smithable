import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { formatsOf, numbersOf } from "../formats.js";
import { validateSpec } from "../spec.js";

// How an app writes dates, weeks and numbers (docs/design/formats.md, A 230).
const spec = (app: string) =>
  `smithable: 0.1\napp: { name: Notes${app} }\nmodels:\n  Note: { fields: { text: string! } }\npages:\n  notes: { crud: Note }\n`;
const read = (app: string) => validateSpec({ path: "smithable.yml", text: spec(app) });

test("date, week and numbers are read with their choices; others are refused naming them", () => {
  const { app } = read(", date: month-day, week: sunday, numbers: comma").ir ?? {};
  expect([app?.date, app?.week, app?.numbers]).toEqual(["month-day", "sunday", "comma"]);
  expect(read(", date: year-first").diagnostics[0]).toMatchObject({
    code: "invalid-value",
    message: '"date" under "app" is day-month or month-day.',
  });
  expect(read(", week: saturday").diagnostics[0]?.message).toBe(
    '"week" under "app" is monday or sunday.',
  );
  expect(read(", numbers: comm").diagnostics[0]?.hint).toContain("comma");
});

test("defaults say why: numbers from the language, the rest fixed", () => {
  const app = read("").ir?.app ?? { name: "" };
  expect(formatsOf(app, "sv")).toEqual({
    clock: { value: "24h", reason: "unsaid" },
    date: { value: "day-month", reason: "unsaid" },
    week: { value: "monday", reason: "unsaid" },
    numbers: { value: "comma", reason: "from language sv" },
  });
  expect(numbersOf(app)).toEqual({ value: "point", reason: "from language en" });
  expect(numbersOf({ ...app, numbers: "point" }, "sv")).toEqual({ value: "point", reason: "" });
});

test("setApp sets each and none takes it back to the default", () => {
  const set = applyOperation({ spec: spec("") }, "setApp", {
    date: "month-day",
    week: "sunday",
    numbers: "comma",
  });
  if (!set.ok) throw new Error(set.message);
  const app = validateSpec({ path: "smithable.yml", text: set.files.spec }).ir?.app;
  expect([app?.date, app?.week, app?.numbers]).toEqual(["month-day", "sunday", "comma"]);
  const gone = applyOperation({ spec: set.files.spec }, "setApp", { numbers: "none" });
  if (!gone.ok) throw new Error(gone.message);
  expect(validateSpec({ path: "smithable.yml", text: gone.files.spec }).ir?.app.numbers).toBe(
    undefined,
  );
});
