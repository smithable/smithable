import { expect, test } from "vitest";
import { validateAuth } from "./auth.js";
import { validateContent } from "./content.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

// The names every plain object answers to: a field, a page or an action called so is a name like
// any other, never a lookup that finds the object's own machinery.
const NAMES = Object.getOwnPropertyNames(Object.prototype).filter((n) =>
  /^[a-z][A-Za-z0-9]*$/.test(n),
);

const spec = (field: string) => `smithable: 0.1
app: { name: Notes }
models:
  Note:
    fields: { ${field}: string, title: string! }
pages:
  notes: { crud: Note }
`;

test.each(NAMES)("a field called %s is a field like any other", (name) => {
  const read = validateSpec({ path: "smithable.yml", text: spec(name) });
  const said = read.diagnostics.map((d) => d.message).join("\n");
  expect(said).not.toMatch(/native code|function |\[object/);
  if (!read.ir) return;
  // Its texts, its column and its access read it as a name too.
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google], selfSignUp: false }\ndefaultAccess: shared\nroles: { admin: {} }\n",
    },
    read.ir,
  );
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: `smithableContent: 0.1\nmodels:\n  Note:\n    fields:\n      ${name}: { label: Its label }\n`,
    },
    read.ir,
    undefined,
    auth.auth,
  );
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  notes:\n    columns: [${name}, title]\n`,
    },
    read.ir,
  );
  for (const d of [...auth.diagnostics, ...content.diagnostics, ...ux.diagnostics])
    expect(d.message, d.message).not.toMatch(/native code|function |\[object/);
  expect(content.content?.models.Note?.fields[name]?.label).toBe("Its label");
});

test.each(NAMES)("%s written under a model by mistake is an unknown key, plainly said", (name) => {
  const read = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1\napp: { name: Notes }\nmodels:\n  Note:\n    ${name}: string\n    fields: { title: string! }\n`,
  });
  const said = read.diagnostics.map((d) => d.message).join("\n");
  expect(said).toContain(`"${name}"`);
  expect(said).not.toMatch(/native code|function |\[object/);
});
