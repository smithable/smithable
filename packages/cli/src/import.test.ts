import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { BETA } from "./beta.js";
import { prepareImport } from "./import.js";
import { tempDir } from "./test-dir.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: CRM }\nmodels:\n  Customer: { fields: { name: string! } }\n",
}).ir;
if (!ir) throw new Error("the spec does not read");
const refusals = (dir: string) =>
  prepareImport(
    dir,
    { kind: "import-records", model: "Customer", source: { text: "name\nAcme\n" } } as never,
    ir,
  ).refusals.map((r) => r.message);

test("a hosted project with test data only takes no records from a file", () => {
  const dir = tempDir("import-");
  mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
  const refused =
    "Test hosting only: this project may hold fictional data alone, so records from a file are refused until real data is switched on.";
  writeFileSync(join(dir, BETA), JSON.stringify({ data: "test" }));
  expect(refusals(dir)).toContain(refused);
  writeFileSync(join(dir, BETA), JSON.stringify({ data: "live" }));
  expect(refusals(dir)).not.toContain(refused);
});
