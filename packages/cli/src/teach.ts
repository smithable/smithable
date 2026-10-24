import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REFERENCE } from "@smithable/ai";
import { SECTIONS, YamlEditor } from "@smithable/core";
import { type Coder, coderFromEnv, runCoder } from "./code.js";
import { generate } from "./generate.js";
import { exec, type Io, tool } from "./io.js";
import { declaredPlugins, PLUGIN_NAME, pluginPath } from "./plugins.js";

/**
 * `smithable teach <section>` (ARCHITECTURE §5.1): for a section of smithable.yml that no
 * plugin handles, a coder writes a project plugin once, in smithable/plugins/<section>/. It
 * expands the section into ordinary spec, so regenerating afterwards needs no AI at all.
 */
export async function teach(
  dir: string,
  io: Io,
  key: string | undefined,
  coder: Coder | undefined = coderFromEnv(),
): Promise<number> {
  if (!key || !PLUGIN_NAME.test(key)) {
    io.err(
      `teach needs a section name with letters, numbers, and dashes, like: smithable teach newsletter\n`,
    );
    return 2;
  }
  const specText = readFileSync(join(dir, "smithable.yml"), "utf8");
  const spec = new YamlEditor(specText);
  if (!spec.has([key])) {
    io.err(`There is no ${key}: section in smithable.yml to teach.\n`);
    return 2;
  }
  if (key === "smithable" || SECTIONS.some((s) => s.key === key)) {
    io.err(`"${key}" is built into Smithable.\n`);
    return 1;
  }
  if (declaredPlugins(dir).includes(key)) {
    io.err(`"${key}" already has a plugin: ${pluginPath(dir, key)}.\n`);
    return 1;
  }
  const area = `smithable/plugins/${key}`;
  const section = specText.slice(specText.search(new RegExp(`^${key}:`, "m"))).split(/\n(?=\S)/)[0];
  const prompt = `You teach Smithable a new section of smithable.yml by writing a project plugin. Smithable generates whole web apps from smithable.yml; it does not know the section "${key}" yet.

The section:
\`\`\`yaml
${section}
\`\`\`

Write ${area}/plugin.mjs: one self-contained ES module without imports (it also runs in the browser), exporting

export default {
  key: "${key}",
  description: "<what the section means, in one sentence>",
  schema: { /* JSON Schema of the section's value: type, properties, required, additionalProperties, items, enum */ },
  expand(value) {
    // The ordinary spec the section stands for, as the JavaScript form of its YAML:
    return { models: { ... }, pages: { ... }, queries: { ... }, actions: { ... } };
  },
  // Optional: additions to entries smithable.yml already has (never changes or removals).
  patch(value) { return [{ add: "field", model: "Customer", field: "newsletter", type: "bool" }, { add: "section", page: "home", section: "subscribe" }, { add: "menu", page: "subscribers" }]; },
  // Optional: operations on the section, like Smithable's own (they appear in the CLI, MCP and Studio):
  // { name, summary, schema, positional, describe(args, ir), destructive(args, ir), apply(editors, args, ir) }, editing editors.spec (a YamlEditor: get, set, add, remove, renameKey, has) and returning [].
  operations: [],
  // Optional: the section in plain language for the Builder, one sentence per item.
  summarize(value) { return ["..."]; },
  // Optional, only for what the spec cannot say: files in src/generated/plugins/${key}/, the same output for the same input.
  generate(value, ir) { return [{ path: "src/generated/plugins/${key}/...", content: "..." }]; },
};
// Or, to use OperationError, didYouMean, identifier, kebab or refTo: export default (api) => ({ ... });

Rules:
- Prefer expand: models, fields, pages, access, queries and actions in the spec's own grammar, so Smithable builds the database, pages, forms and access checks itself. Names must not clash with the rest of smithable.yml.
- Make the schema strict (additionalProperties: false) and give defaults in expand for optional values.
- Field types: string, text, int, decimal, money, bool, date, datetime, email, phone, url; choices "a | b | c"; a reference "Customer"; a list of related records "Order[]". Append ! for required, "unique", "= value" for a default.
- Change only files in ${area}/. Smithable declares the plugin, validates it and regenerates the app afterwards.
- You may run "pnpm typecheck" only. Smithable validates the plugin and regenerates the app afterwards, and undoes everything if it fails.

The spec's grammar, by example:
\`\`\`yaml
${REFERENCE["smithable.yml"]}\`\`\`

The app's smithable.yml:
\`\`\`yaml
${specText}\`\`\``;
  const code = await runCoder(dir, io, coder, {
    prompt,
    area,
    request: `Teach Smithable "${key}"`,
    subject: `Teach Smithable the ${key} section`,
    // Smithable's own part: declare the plugin, then check and regenerate the app with it.
    after: async () => {
      if (!existsSync(pluginPath(dir, key))) {
        io.err(`The coder did not write ${pluginPath(dir, key)}.\n`);
        return 1;
      }
      declare(dir, key);
      return generate(dir, io, {
        tools: true,
        force: false,
        migration: { name: `teach_${key}`, renames: [], apply: false },
      });
    },
  });
  if (code !== 0) return code;
  // Committed: now the development database gets the new tables.
  return exec(...tool(dir, "tsx", ["src/db/index.ts"]), dir);
}

/** Adds the plugin to smithable.context.yml, creating the file when there is none. */
function declare(dir: string, key: string): void {
  const path = join(dir, "smithable.context.yml");
  if (!existsSync(path)) {
    writeFileSync(
      path,
      `# How the app is built: implementation choices, the only file that may name technologies.\nsmithableContext: 0.1\n\n# Project plugins in smithable/plugins/<name>/plugin.mjs, for sections Smithable does not know.\nplugins: [${key}]\n`,
    );
    return;
  }
  const context = new YamlEditor(readFileSync(path, "utf8"));
  if (context.has(["plugins"])) context.set(["plugins"], [...declaredPlugins(dir), key]);
  else context.add([], "plugins", [key]);
  writeFileSync(path, context.text);
}
