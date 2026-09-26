// Writes the published JSON Schema for smithable.yml. Run after `pnpm build`.
import { writeFileSync } from "node:fs";
import { buildJsonSchema } from "../packages/core/dist/index.js";

const path = new URL("../packages/core/schema/smithable.schema.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(buildJsonSchema(), null, 2)}\n`);
console.log(`Wrote ${path.pathname}`);
