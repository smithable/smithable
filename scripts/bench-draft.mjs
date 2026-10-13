// Drafting a first app two ways, on the M12 descriptions plus one more, with the model
// set up in the environment (docs/ai.md): whole files adapted from the closest starter (today),
// and a batch of operations from an empty app (docs/design/first-build.md, 2.7). Records whether
// each draft is a valid app, what it contains, tokens, cost and time, into
// docs/benchmarks/draft-modes-<model>.md. Uses the configured model's allowance: ask first.
//   node scripts/bench-draft.mjs [files|operations]   (both when left out)
import { writeFileSync } from "node:fs";
import {
  closestStarter,
  draftProject,
  draftProjectByOperations,
  openAICompatible,
} from "../packages/ai/dist/index.js";
import { STARTERS } from "../packages/cli/dist/starters.gen.js";
import { validateSpec } from "../packages/core/dist/index.js";

const repo = new URL("..", import.meta.url).pathname;
const model = process.env.SMITHABLE_MODEL;
if (!model || !process.env.SMITHABLE_MODEL_URL)
  throw new Error("Set SMITHABLE_MODEL, SMITHABLE_MODEL_URL and SMITHABLE_MODEL_KEY.");
const [input = 0, output = 0] = (process.env.SMITHABLE_MODEL_PRICE ?? "0/0").split("/").map(Number);
const provider = openAICompatible({
  name: "smithable",
  tier: "smithable",
  location: "eu",
  baseUrl: process.env.SMITHABLE_MODEL_URL,
  model,
  apiKey: process.env.SMITHABLE_MODEL_KEY,
  price: { input, output },
});
const modes = process.argv[2] ? [process.argv[2]] : ["files", "operations"];

const DESCRIPTIONS = [
  "A booking site for a yoga studio, with classes, teachers and online booking.",
  "A CRM for a small sales team: companies, contacts, deals and follow-ups.",
  "Invoicing for freelancers, with clients, invoices and payments.",
  "A tool library where neighbors lend each other tools.",
  "An inventory app for a small bakery: ingredients, suppliers and stock levels.",
  "A job board for a local union, with job posts and applications.",
  "A football club's site: teams, players, matches and results.",
  "Event registration for a conference: talks, speakers and attendees.",
  "A help desk for an IT team: tickets, priorities and who handles them.",
  "A recipe collection for a family, with ingredients and shopping lists.",
  "I want a site where I can show my dogs. Each dog should have a gallery and some information about it.",
];

const rows = [];
for (const description of DESCRIPTIONS) {
  for (const mode of modes) {
    const t0 = Date.now();
    const draft =
      mode === "files"
        ? await draftProject({
            description,
            starter: STARTERS[closestStarter(description, STARTERS)],
            providers: [provider],
          })
        : await draftProjectByOperations({ description, providers: [provider] });
    const seconds = Math.round((Date.now() - t0) / 1000);
    const tokens = draft.usage.reduce(
      (n, u) => n + (u.inputTokens ?? 0) + (u.outputTokens ?? 0),
      0,
    );
    const cost = draft.usage.reduce((n, u) => n + (u.costEur ?? u.cost ?? 0), 0);
    const ir =
      draft.kind === "draft"
        ? validateSpec({ path: "smithable.yml", text: draft.files["smithable.yml"] }).ir
        : undefined;
    const row = {
      description,
      mode,
      valid: Boolean(ir),
      seconds,
      tokens,
      cost,
      name: ir?.app.name ?? "",
      models: ir?.models.map((m) => `${m.name} (${m.fields.length})`).join(", ") ?? "",
      pages: ir?.pages.map((p) => p.pattern.kind).join(", ") ?? "",
      operations: draft.operations?.length ?? "",
      problem:
        draft.kind === "failed"
          ? draft.message.split("\n").slice(1, 2).join(" ").slice(0, 100)
          : "",
    };
    rows.push(row);
    console.log(
      `${row.valid ? "✓" : "✗"} ${mode.padEnd(10)} ${description.slice(0, 48).padEnd(48)} ${seconds} s, ${tokens} tokens${row.valid ? ` | ${row.name}: ${row.models}` : ` | ${row.problem}`}`,
    );
  }
}
const cell = (t) => String(t).replace(/\|/g, "\\|");
const summary = modes.map((mode) => {
  const r = rows.filter((x) => x.mode === mode);
  return `${mode}: ${r.filter((x) => x.valid).length} / ${r.length} valid, ${r.reduce((n, x) => n + x.tokens, 0).toLocaleString("en")} tokens, €${r.reduce((n, x) => n + x.cost, 0).toFixed(3)}, ${r.reduce((n, x) => n + x.seconds, 0)} s`;
});
const report = `# First drafts, files against operations: ${model} (${new Date().toISOString().slice(0, 10)})

${DESCRIPTIONS.length} descriptions (the M12 ten and one more), each drafted as whole files adapted from the closest starter and as a batch of operations from an empty app (docs/design/first-build.md, 2.7). Valid means the draft is an app Smithable accepts.

${summary.map((s) => `- ${s}`).join("\n")}

| Description | Mode | Valid | Name | Models (fields) | Pages | Ops | Tokens | Time | Problem |
|---|---|---|---|---|---|---|---|---|---|
${rows.map((r) => `| ${cell(r.description)} | ${r.mode} | ${r.valid ? "yes" : "**no**"} | ${cell(r.name)} | ${cell(r.models)} | ${cell(r.pages)} | ${r.operations} | ${r.tokens.toLocaleString("en")} | ${r.seconds} s | ${cell(r.problem)} |`).join("\n")}
`;
const path = `${repo}docs/benchmarks/draft-modes-${model}.md`;
writeFileSync(path, report);
console.log(summary.join("\n"));
console.log(`Wrote ${path}`);
