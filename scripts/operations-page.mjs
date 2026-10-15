// The operations reference for docs.smithable.ai, generated from the operations themselves
// (core's OPERATIONS), so it cannot go stale: each operation's summary, its usage with the
// positional arguments and the options, each argument's description and type, whether it can
// lose data, and one example command from the how-to or the spec reference where one exists.
// Used by build-docs.mjs; throws when an operation has no summary.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OPERATIONS, SECTIONS } from "../packages/core/dist/index.js";

// The spec sections' operations are grouped by section; the companions' and the spec-wide ones
// by name. One the map does not know goes to "Other changes", never off the page.
const GROUPS = [
  ["Models and fields", { sections: ["models"], except: ["importRecords"] }],
  ["Pages and navigation", { sections: ["pages", "navigation"] }],
  [
    "Access and sign-in",
    {
      names: ["grant", "setSignUp", "setDefaultAccess", "setRoles", "setPublic", "setPublicWhere"],
    },
  ],
  [
    "Look",
    {
      names: [
        "setTheme",
        "addTheme",
        "setSectionLook",
        "setColumns",
        "setFieldOrder",
        "setTone",
        "setIcon",
        "setBelow",
        "setControl",
        "setFormSections",
        "setFormColumns",
        "setView",
        "setSort",
      ],
    },
  ],
  ["Texts", { names: ["setText"] }],
  ["Actions and queries", { sections: ["actions", "queries"] }],
  ["Data", { names: ["importRecords"] }],
  ["The app as a whole", { sections: ["app"], names: ["setRuleId", "setPackage", "editSpec"] }],
];

const REFS = {
  model: "a model's name",
  field: "a field's name",
  page: "a page's name",
  role: "a role",
  choiceValue: "a choice value",
  section: "a landing section",
};

/** An argument's kind, worded as `smithable op <name> --help` words it. */
function kind(p) {
  const ref = p["x-smithable"]?.ref;
  if (REFS[ref]) return REFS[ref];
  if (p.enum) return p.enum.map((v) => `\`${v}\``).join(" or ");
  if (p.type === "array") return "a list";
  if (p.type === "object") return "key=value pairs";
  if (p.type === "boolean") return "true or false";
  if (p.type === "integer" || p.type === "number") return "a number";
  return "text";
}

/** The first example of an operation in the docs: a `smithable op` line, else inline code. */
function examples(root) {
  const texts = ["docs/site/change.md", "docs/site/start-local.md", "docs/spec/v0.1.md"].map((f) =>
    readFileSync(join(root, f), "utf8"),
  );
  const found = new Map();
  for (const op of OPERATIONS) {
    for (const text of texts) {
      // A command in a code block, without its trailing comment, or inline code naming the operation.
      const line = new RegExp(`smithable op ${op.name} [^\\n\`]*`).exec(text);
      const inline = new RegExp(`\`(${op.name} [^\`]+)\``).exec(text);
      const example =
        line?.[0].replace(/\s{2,}#.*$/, "").trim() ??
        (inline ? `smithable op ${inline[1]}` : undefined);
      // A usage template is not an example: placeholders in <>, [] or …, or only argument names.
      const words = example?.split(/\s+/).slice(3) ?? [];
      const names = op.positional.map((p) => p.replace(/^\.\.\./, ""));
      const template =
        /[<[…]/.test(example ?? "") || (words.length > 0 && words.every((w) => names.includes(w)));
      if (example && !template) {
        found.set(op.name, example);
        break;
      }
    }
  }
  return found;
}

export function operationsPage(root) {
  const missing = OPERATIONS.filter((op) => !op.summary?.trim()).map((op) => op.name);
  if (missing.length) throw new Error(`Operations without a summary: ${missing.join(", ")}`);
  const sectionOf = new Map(
    SECTIONS.flatMap((s) => (s.operations ?? []).map((op) => [op.name, s.key])),
  );
  const groupOf = (op) =>
    GROUPS.find(
      ([, g]) =>
        !g.except?.includes(op.name) &&
        (g.names?.includes(op.name) || g.sections?.includes(sectionOf.get(op.name))),
    )?.[0] ?? "Other changes";
  const sample = examples(root);
  const entry = (op) => {
    const properties = op.schema.properties ?? {};
    const required = op.schema.required ?? [];
    const positional = op.positional.map((p) => p.replace(/^\.\.\./, ""));
    const options = Object.keys(properties).filter((k) => !positional.includes(k));
    const usage = [
      `smithable op ${op.name}`,
      ...op.positional.map((p) => {
        const key = p.replace(/^\.\.\./, "");
        return required.includes(key) ? `<${key}>` : `[${key}]`;
      }),
      ...options.map((k) => `[--${k} …]`),
    ].join(" ");
    const args = [...positional, ...options].map((key) => {
      const p = properties[key] ?? {};
      const name = positional.includes(key) ? `\`<${key}>\`` : `\`--${key}\``;
      const notes = [kind(p), required.includes(key) ? undefined : "optional"].filter(Boolean);
      return `- ${name} (${notes.join(", ")})${p.description ? `: ${p.description}` : ""}`;
    });
    // `() => false` in the source means the operation never loses data; any other rule can.
    const safe = /^\(\)\s*=>\s*false$/.test(String(op.destructive).trim());
    return [
      `### ${op.name}`,
      "",
      op.summary,
      "",
      "```sh",
      usage,
      "```",
      "",
      ...(args.length ? [...args, ""] : []),
      safe
        ? "Never loses data."
        : "Can lose data in some cases (removing or narrowing what holds records); then it asks first, or takes `--yes`.",
      ...(sample.has(op.name) ? ["", `Example: \`${sample.get(op.name)}\``] : []),
    ].join("\n");
  };
  const groups = [...GROUPS.map(([name]) => name), "Other changes"]
    .map((name) => [name, OPERATIONS.filter((op) => groupOf(op) === name)])
    .filter(([, ops]) => ops.length);
  return `# Operations

Every change to an app goes through an operation: it checks the change, edits the spec files, regenerates the code, migrates the database and commits a checkpoint, so \`smithable undo\` takes it back. This page is generated from the operations themselves (${OPERATIONS.length} of them), so it matches the Smithable it was built with. Run one with \`smithable op <name> …\`; \`smithable op <name> --help\` shows the same, and \`smithable mcp\` offers them as tools to AI agents. [Change an app without writing code](change.md) walks through five of them.

${groups.map(([name, ops]) => `## ${name}\n\n${ops.map(entry).join("\n\n")}`).join("\n\n")}
`;
}
