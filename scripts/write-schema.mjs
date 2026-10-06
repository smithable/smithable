// Writes the published JSON Schemas: smithable.yml's, and each companion file's. Run after
// `pnpm build`.
import { writeFileSync } from "node:fs";
import { buildJsonSchema, COMPANION_SCHEMAS } from "../packages/core/dist/index.js";

const dir = new URL("../packages/core/schema/", import.meta.url);
const write = (name, schema) => {
  const path = new URL(name, dir);
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`Wrote ${path.pathname}`);
};
write("smithable.schema.json", buildJsonSchema());
for (const [file, schema] of Object.entries(COMPANION_SCHEMAS))
  write(file.replace(/\.yml$/, ".schema.json"), schema);
