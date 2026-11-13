// Smith's stages before a model, scored with no model at all (T784 layer 1): what can be measured
// for free on every change to the rules, the search or the prompts.
//   retrieval  for each docs question with labelled parts: is one of them among the docs parts
//              the search finds, in the top 3 and the top 5 (without the small model's search
//              phrases, which Studio adds and which cost a call; so this is the floor)
//   prompt     what would be sent to the model per kind of request, in tokens (about four
//              characters a token), from a model that records the request and refuses it; the
//              requests a rule answers send nothing and are counted apart
// Needs `pnpm build` and `pnpm site` (the docs' index). Free. Writes docs/benchmarks/smith-stages.md
// and .json.
//   node scripts/smith-stages.mjs [--only id,id]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "./dev-app.mjs";

const { validateAuth, validateContent, validateSpec, validateUx } = await import(
  join(repo, "packages/core/dist/index.js")
);
const { appParts, buildContext, buildIndex, searchDocsWith, specLines, summarize } = await import(
  join(repo, "packages/index/dist/index.js")
);
const { proposeChange } = await import(join(repo, "packages/ai/dist/index.js"));

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const only = option("--only")?.split(",");
const set = JSON.parse(readFileSync(join(repo, "docs/benchmarks/smith-requests.json"), "utf8"));
const requests = set.requests.filter(
  (r) => (!only || only.includes(r.id)) && r.kind !== "undo" && r.kind !== "feedback",
);
const docsIndex = (() => {
  try {
    return JSON.parse(readFileSync(join(repo, "site/search.json"), "utf8"));
  } catch {
    throw new Error("No site/search.json: run `pnpm site` first.");
  }
})();

/** A starter's files as Studio reads them, its index and its summary (as bench-smith). */
const projects = new Map();
function project(starter) {
  if (!projects.has(starter)) {
    const read = (name) => {
      try {
        return readFileSync(join(repo, "examples", starter, name), "utf8");
      } catch {
        return undefined;
      }
    };
    const f = { spec: read("smithable.yml") };
    for (const [key, name] of [
      ["auth", "smithable.auth.yml"],
      ["content", "smithable.content.yml"],
      ["ux", "smithable.ux.yml"],
    ])
      if (read(name)) f[key] = read(name);
    const ir = validateSpec({ path: "smithable.yml", text: f.spec }).ir;
    const auth = f.auth && validateAuth({ path: "smithable.auth.yml", text: f.auth }, ir).auth;
    const content =
      f.content && validateContent({ path: "smithable.content.yml", text: f.content }, ir).content;
    const ux = f.ux && validateUx({ path: "smithable.ux.yml", text: f.ux }, ir).ux;
    projects.set(starter, {
      files: f,
      index: buildIndex({ ir, generated: {}, custom: [] }),
      summary: summarize(ir, auth || undefined, content || undefined, [], ux || undefined),
    });
  }
  return projects.get(starter);
}
const isLabelled = (url, labels) => {
  const at = url.replace("https://docs.smithable.ai/", "");
  return labels.some((d) => at === d || (!d.includes("#") && at.split("#")[0] === d));
};

// ── Retrieval ───────────────────────────────────────────────────────────────

const retrieval = requests
  .filter((r) => r.docs?.length)
  .map((r) => {
    const found = (n) =>
      searchDocsWith(docsIndex, r.text, [], n).some((d) => isLabelled(d.url, r.docs));
    return { id: r.id, language: r.language, top3: found(3), top5: found(5) };
  });

// ── What would be sent ──────────────────────────────────────────────────────

let captured = [];
const capture = {
  name: "capture",
  model: "capture",
  tier: "smithable",
  location: "eu",
  price: { input: 0, output: 0 },
  async complete(request) {
    captured.push(request);
    throw new Error("captured");
  },
};
const prompts = [];
for (const r of requests) {
  const { files: f, index, summary } = project(r.starter);
  captured = [];
  const p = await proposeChange({
    request: r.text,
    files: f,
    context: buildContext(index, r.text),
    providers: [capture],
    docs: searchDocsWith(docsIndex, r.text, []),
    app: ((lines) =>
      `${appParts(summary, r.text)}${lines ? `\n\nIts lines in smithable.yml:\n${lines}` : ""}`)(
      specLines(f.spec, r.text),
    ),
  });
  const first = captured[0];
  prompts.push({
    id: r.id,
    kind: r.kind,
    language: r.language,
    byRule: !captured.length && p.kind !== "failed",
    tokens: first
      ? Math.ceil(`${first.system}${first.user}${JSON.stringify(first.schema ?? "")}`.length / 4)
      : 0,
    calls: captured.length,
  });
}

// ── Report ──────────────────────────────────────────────────────────────────

const share = (n, of) => (of ? `${n} / ${of} (${Math.round((100 * n) / of)} %)` : "–");
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};
const kinds = [...new Set(prompts.map((p) => p.kind))].sort();
const languages = [...new Set(retrieval.map((r) => r.language))].sort();
const result = {
  date: new Date().toISOString().slice(0, 10),
  retrieval: {
    questions: retrieval.length,
    top3: retrieval.filter((r) => r.top3).length,
    top5: retrieval.filter((r) => r.top5).length,
    missed: retrieval.filter((r) => !r.top5).map((r) => r.id),
  },
  prompt: Object.fromEntries(
    kinds.map((k) => {
      const of = prompts.filter((p) => p.kind === k);
      const sent = of.filter((p) => p.tokens);
      return [
        k,
        {
          requests: of.length,
          byRule: of.filter((p) => p.byRule).length,
          medianTokens: median(sent.map((p) => p.tokens)),
          maxTokens: Math.max(0, ...sent.map((p) => p.tokens)),
        },
      ];
    }),
  ),
};
const lines = [
  "# Smith's stages before a model",
  "",
  `${result.date}, ${requests.length} requests of docs/benchmarks/smith-requests.json, with no model ([smith-stages.mjs](../../scripts/smith-stages.mjs)). Free; run it on any change to the rules, the search or the prompts.`,
  "",
  "## Retrieval",
  "",
  `Docs questions whose labelled part is among the parts found, without the search phrases a model adds: top 3 ${share(result.retrieval.top3, retrieval.length)}, top 5 ${share(result.retrieval.top5, retrieval.length)}.`,
  "",
  "| Language | Top 3 | Top 5 |",
  "|---|---|---|",
  ...languages.map((l) => {
    const of = retrieval.filter((r) => r.language === l);
    return `| ${l} | ${share(of.filter((r) => r.top3).length, of.length)} | ${share(of.filter((r) => r.top5).length, of.length)} |`;
  }),
  "",
  result.retrieval.missed.length ? `Not in the top 5: ${result.retrieval.missed.join(", ")}.` : "",
  "",
  "## What would be sent",
  "",
  "The first model call's prompt per kind of request, about four characters a token: the cost before any answer. A request a rule answers sends nothing.",
  "",
  "| Kind | Requests | Answered by a rule | Median tokens sent | Most |",
  "|---|---|---|---|---|",
  ...kinds.map((k) => {
    const p = result.prompt[k];
    return `| ${k} | ${p.requests} | ${p.byRule} | ${p.medianTokens.toLocaleString("en")} | ${p.maxTokens.toLocaleString("en")} |`;
  }),
  "",
];
writeFileSync(join(repo, "docs/benchmarks/smith-stages.md"), lines.join("\n"));
writeFileSync(
  join(repo, "docs/benchmarks/smith-stages.json"),
  `${JSON.stringify(result, null, 1)}\n`,
);
console.log(lines.join("\n"));
