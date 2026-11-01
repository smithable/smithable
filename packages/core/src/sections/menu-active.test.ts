import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { validateUx } from "../ux.js";

const spec =
  "smithable: 0.1\napp: { name: Notes }\nmodels:\n  Note: { fields: { text: string! } }\npages:\n  notes: { crud: Note }\n";
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("the notes do not read");
const read = (text: string) =>
  validateUx({ path: "smithable.ux.yml", text: `smithableUx: 0.1\n${text}` }, ir, []);

test("how the menu marks the open page: filled, subtle or underline (A 215)", () => {
  expect(read("active: subtle\n").ux?.active).toBe("subtle");
  expect(read("").ux?.active).toBeUndefined();
  expect(read("active: bold\n").diagnostics[0]?.message).toBe(
    '"active" is filled, subtle or underline.',
  );
  const set = applyOperation({ spec }, "setMenuActive", { active: "underline" });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toBe("smithableUx: 0.1\nactive: underline\n");
  expect(
    applyOperation({ spec, ux: set.files.ux as string }, "setMenuActive", { active: "default" }),
  ).toMatchObject({
    ok: true,
    files: { ux: "smithableUx: 0.1\n" },
  });
});
