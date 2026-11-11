import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A field named like what every plain object has is read as a name: the app's files never carry
// the object's own machinery ("function toString() { [native code] }") for it.
test("fields called like an object's own properties generate as fields", () => {
  const names = Object.getOwnPropertyNames(Object.prototype).filter((n) =>
    /^[a-z][A-Za-z0-9]*$/.test(n),
  );
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1\napp: { name: Notes }\nmodels:\n  Note:\n    fields: { title: string!, ${names.map((n) => `${n}: string`).join(", ")} }\npages:\n  notes: { crud: Note }\n`,
  }).ir as SpecIR;
  expect(ir).toBeDefined();
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [notes], read: [Note] }\n",
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  for (const file of files) expect(file.content, file.path).not.toMatch(/native code/);
  const ui = files.find((f) => f.path === "src/generated/note.ts")?.content ?? "";
  expect(ui).toContain('"To string"');
});
