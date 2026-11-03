import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";

const spec = (app: string) =>
  `smithable: 0.1\napp: { name: Notes${app} }\nmodels:\n  Note: { fields: { text: string! } }\npages:\n  notes: { crud: Note }\n`;
const read = (app: string) => validateSpec({ path: "smithable.yml", text: spec(app) });

test("how times are written: 12h or 24h, unsaid 24-hour (A 220)", () => {
  expect(read(", clock: 12h").ir?.app.clock).toBe("12h");
  expect(read("").ir?.app.clock).toBeUndefined();
  expect(read(", clock: 13h").diagnostics[0]?.message).toBe('"clock" under "app" is 12h or 24h.');
  const set = applyOperation({ spec: spec("") }, "setApp", { clock: "12h" });
  if (!set.ok) throw new Error(set.message);
  expect(validateSpec({ path: "smithable.yml", text: set.files.spec }).ir?.app.clock).toBe("12h");
  const gone = applyOperation({ spec: set.files.spec }, "setApp", { clock: "none" });
  if (!gone.ok) throw new Error(gone.message);
  expect(
    validateSpec({ path: "smithable.yml", text: gone.files.spec }).ir?.app.clock,
  ).toBeUndefined();
});
