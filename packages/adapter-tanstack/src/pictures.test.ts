import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Studio }
models:
  Instructor:
    fields:
      name: string!
      portrait: picture
pages:
  instructors: { crud: Instructor }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\npublic: { read: [Instructor] }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("a picture field: a JSON column, the form's own control, and the files routes with their table", () => {
  expect(file("src/db/schema.ts")).toContain('portrait: text({ mode: "json" }).$type<Picture>()');
  expect(file("src/generated/instructor.ts")).toContain(
    'input: bindPicture("instructor", "portrait")',
  );
  expect(file("src/generated/instructor.ts")).toContain(
    "portrait: z.object({ file: z.string().max(100), alt: z.string().trim().max(200), width: z.int().positive(), height: z.int().positive() }).nullish()",
  );
  expect(file("src/generated/pictures.ts")).toContain(
    '"instructor": {\n    "portrait": { data: instructorData, access: instructorAccess, key: "portrait" },',
  );
  for (const path of [
    "src/kit/uploads.ts",
    "src/kit/PictureInput.tsx",
    "src/routes/files/$model.$field.ts",
    "src/routes/files/$model.$id.$field.ts",
  ])
    expect(
      files.some((f) => f.path === path),
      path,
    ).toBe(true);
  // A replaced or removed picture loses its file, unless another record shows the same one.
  const data = file("src/generated/instructor.server.ts");
  expect(data).toContain(
    "if (row.portrait && row.portrait.file !== changed.portrait?.file) deletePicture(row.portrait,",
  );
  expect(data).toContain(
    "if (row.portrait && row.portrait.file !== undefined) deletePicture(row.portrait,",
  );
  expect(file("src/db/seed.ts")).toContain(
    'portrait: samplePicture("instructor", 0, "A picture of',
  );
});

test("without a picture field none of it is generated", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Studio }\nmodels:\n  Instructor:\n    fields: { name: string! }\npages:\n  instructors: { crud: Instructor }\n",
  }).ir as SpecIR;
  const app = generateApp(plain, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  expect(app.some((f) => f.path.startsWith("src/routes/files/"))).toBe(false);
  expect(app.some((f) => f.path === "src/kit/uploads.ts")).toBe(false);
  expect(app.find((f) => f.path === "src/generated/instructor.server.ts")?.content).not.toContain(
    "deletePicture",
  );
});

test("a picture cannot be unique or have a default, and /files is reserved", () => {
  const bad = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Studio }\nmodels:\n  Instructor:\n    fields: { name: string!, portrait: picture unique }\npages:\n  files: { crud: Instructor }\n",
  });
  expect(bad.diagnostics.map((d) => d.code)).toEqual(
    expect.arrayContaining(["invalid-field", "reserved-route"]),
  );
});
