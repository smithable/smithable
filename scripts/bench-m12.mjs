// M12 first builds: the same app descriptions (ten, and two status pages since the sixth starter), each started from a sentence with
// `smithable new --describe` by the models set up in the environment (docs/ai.md). Records
// whether a valid app came out, how many model calls it took, tokens, cost and time, and the
// plain-language summary for people to review. Uses the configured model: ask before running.
// Run after `pnpm build`, once per model: `node scripts/bench-m12.mjs`.
// Writes docs/benchmarks/m12-first-builds-<model>.md, with a scorecard of the kept spec files:
// facts only (what the draft kept of its starter, access, what is public, warnings, reuse of the
// starter's texts, sample records), for the reader to judge. `--score <kept dir>` scores a run's
// kept files again without calling a model, and puts the table into that run's report.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { closestStarter } from "../packages/ai/dist/index.js";
import { STARTERS } from "../packages/cli/dist/starters.gen.js";
import {
  fitSamples,
  titleField,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "../packages/core/dist/index.js";

const repo = new URL("..", import.meta.url).pathname;
const cli = join(repo, "packages/cli/dist/bin.js");
const root = mkdtempSync(join(tmpdir(), "smithable-bench-m12-"));
const { values: args } = parseArgs({
  options: { score: { type: "string" }, set: { type: "string", default: "core" } },
});

const SPECS = ["smithable.yml", "smithable.auth.yml", "smithable.ux.yml", "smithable.content.yml"];
const read = (dir, file) =>
  existsSync(join(dir, file)) ? readFileSync(join(dir, file), "utf8") : undefined;

/** A project's spec files checked like `smithable validate`: the IR, the auth file, every diagnostic. */
function check(dir) {
  const authFile = { path: "smithable.auth.yml", text: read(dir, "smithable.auth.yml") ?? "" };
  const roles = validateAuth(authFile).auth?.roles.map((r) => r.name);
  const spec = validateSpec(
    { path: "smithable.yml", text: read(dir, "smithable.yml") ?? "" },
    roles ? { roles } : {},
  );
  const diagnostics = [...spec.diagnostics];
  let auth;
  if (spec.ir) {
    const a = validateAuth(authFile, spec.ir);
    auth = a.auth;
    diagnostics.push(...a.diagnostics);
    for (const [file, validate] of [
      ["smithable.content.yml", validateContent],
      ["smithable.ux.yml", validateUx],
    ]) {
      const text = read(dir, file);
      if (text !== undefined)
        diagnostics.push(...validate({ path: file, text }, spec.ir).diagnostics);
    }
  }
  return { ir: spec.ir, auth, diagnostics };
}

// Common words of the description languages in the wide set, for a plain check of the language
// a text is in: does it contain words of the description's language. A fact, not a judgement.
const WORDS = {
  sv: "och för med att som vår våra vi min mitt där kan ska på av till en ett det de kunder bokning boka tid sälja",
  fi: "ja sekä meidän tai ovat verkossa asiakkaat varaukset varaus tunnit laskut työt pieni",
  de: "und für mit der die das den meinen unsere kunden produkte abholung bestellungen",
};
function inLanguage(text, lang, description) {
  if (!text) return "none";
  const words = (t) => t.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const known = new Set([
    ...WORDS[lang].split(" "),
    ...words(description).filter((w) => w.length >= 4),
  ]);
  const hits = words(text).filter((w) => known.has(w));
  return hits.length ? `yes (${[...new Set(hits)].slice(0, 3).join(", ")})` : "no";
}

/** The visible texts of a content file: labels of models and fields, and every landing page's texts. */
function contentTexts(dir, ir) {
  const text = read(dir, "smithable.content.yml");
  if (!text) return { labels: "", landing: "", counts: "no content file" };
  const strings = (node) =>
    typeof node === "string"
      ? [node]
      : node && typeof node === "object"
        ? Object.values(node).flatMap(strings)
        : [];
  const doc = (ir && validateContent({ path: "smithable.content.yml", text }, ir).content) ?? {};
  const labels = Object.values(doc.models ?? {}).flatMap((m) => [
    m?.label ?? "",
    ...Object.values(m?.fields ?? {}).map((f) => f?.label ?? ""),
  ]);
  const landings = (ir?.pages ?? []).filter((p) => p.pattern?.kind === "landing").map((p) => p.id);
  // How much of the app has a text of its own: models and fields with a label, pages with a title.
  const models = ir?.models ?? [];
  const fields = models.flatMap((m) => m.fields.map((f) => [m.name, f.name]));
  const pages = ir?.pages ?? [];
  const counts = `models ${models.filter((m) => doc.models?.[m.name]?.label).length}/${models.length}, fields ${fields.filter(([m, f]) => doc.models?.[m]?.fields?.[f]?.label).length}/${fields.length}, pages ${pages.filter((p) => doc.pages?.[p.id]?.title).length}/${pages.length}`;
  return {
    labels: labels.filter(Boolean).join(" "),
    landing: landings.flatMap((id) => strings(doc.pages?.[id])).join(" "),
    counts,
  };
}

/** The deterministic facts about one kept draft, against the starter it began from. */
function score(dir, description, starter, lang, meta = {}) {
  const draft = check(dir);
  const example = join(repo, "examples", starter);
  const base = existsSync(example) ? check(example) : undefined;
  const names = (ir, key) => new Set((ir?.[key] ?? []).map((x) => x.id ?? x.name));
  const kept = (key) => {
    const from = names(base?.ir, key);
    const now = names(draft.ir, key);
    // What the draft kept of the starter's, and how many it has in all (none is a failed draft).
    return `${[...from].filter((n) => now.has(n)).length} / ${from.size} (has ${now.size})`;
  };
  // The starter's name and its sample records' titles, found again in the draft's texts.
  const texts =
    `${read(dir, "smithable.yml") ?? ""}\n${read(dir, "smithable.content.yml") ?? ""}`.toLowerCase();
  const samplesDir = join(example, "samples");
  const sampleFiles = existsSync(samplesDir)
    ? readdirSync(samplesDir).map((f) => ({
        path: f,
        text: readFileSync(join(samplesDir, f), "utf8"),
      }))
    : [];
  const titles = sampleFiles.flatMap((f) => {
    const model = base?.ir?.models.find((m) => m.name === basename(f.path, ".yml"));
    if (!model) return [];
    const key = titleField(model);
    return [...f.text.matchAll(new RegExp(`(?:^|[{,]\\s*|- )${key}: ([^,}\\n]+)`, "gm"))].map((m) =>
      m[1].trim().replace(/^["']|["']$/g, ""),
    );
  });
  const starterName = base?.ir?.app.name;
  const reused = [starterName, ...titles].filter(
    (t) => t && t.length > 3 && texts.includes(t.toLowerCase()),
  );
  const fitted = draft.ir ? fitSamples(sampleFiles, draft.ir) : [];
  const withSamples = fitted.filter((f) => /^- /m.test(f.text)).length;
  const warnings = draft.diagnostics.filter((d) => d.severity === "warning");
  const codes = [...new Set(warnings.map((d) => d.code))];
  const auth = draft.auth;
  const mentionsPublic = /\b(visitors?|public|site)\b/i.test(description);
  const landing = (draft.ir?.pages ?? []).some((p) => p.pattern?.kind === "landing");
  const list = (xs) => (xs?.length ? xs.join(", ") : "none");
  return {
    starter,
    models: kept("models"),
    pages: kept("pages"),
    // Actions the draft left out because they could not be made valid, as `new` printed them.
    actions: `${kept("actions")}${meta.dropped ? `; left out: ${meta.dropped}` : ""}`,
    access: auth
      ? `${auth.defaultAccess}; ${list(auth.roles.map((r) => r.name))} (${auth.defaultRole})`
      : "?",
    pageAccess: list(
      (draft.ir?.pages ?? [])
        .filter((p) => p.access?.length)
        .map((p) => `${p.id}: ${p.access.join("/")}`),
    ),
    public: auth
      ? `pages ${list(auth.public.pages)}; read ${list(auth.public.read)}; create ${list(auth.public.create)}`
      : "?",
    warnings: warnings.length ? `${warnings.length} (${codes.join(", ")})` : "0",
    reused: list(reused),
    samples: `${withSamples} / ${draft.ir?.models.length ?? 0}`,
    landing: `${mentionsPublic ? "mentions visitors" : "no mention"}; ${landing ? "landing page" : "no landing page"}`,
    // The word-match starter (what `new --yes` used to pick) and the first step's questions.
    wordStarter: meta.wordStarter,
    questions: meta.questions
      ? `${meta.questions.length}${lang && meta.questions.length ? ` (${lang}: ${inLanguage(meta.questions.join(" "), lang, description)})` : ""}`
      : "–",
    ...(lang &&
      (() => {
        const texts = contentTexts(dir, draft.ir);
        return {
          lang,
          nameLang: inLanguage(draft.ir?.app.name, lang, description),
          labelsLang: inLanguage(texts.labels, lang, description),
          landingLang: inLanguage(texts.landing, lang, description),
          labelled: texts.counts,
        };
      })()),
  };
}

function scorecard(rows) {
  const languages = rows.some((r) => r.lang);
  const head = languages
    ? " Language | App name in it | Labels in it | Landing texts in it | With a text of their own |"
    : "";
  const extra = (r) =>
    languages
      ? r.lang
        ? ` ${r.lang} | ${r.nameLang} | ${r.labelsLang} | ${r.landingLang} | ${r.labelled} |`
        : " en | | | | |"
      : "";
  const starter = (r) =>
    r.wordStarter && r.wordStarter !== r.starter
      ? `${r.starter} (words: ${r.wordStarter})`
      : r.starter;
  return `| # | Starter | Questions | Models kept | Pages kept | Actions kept | Access; roles (default) | Pages with access | Public | Warnings | Starter's texts in the draft | Models with the starter's samples | Visitors / landing |${head}
|---|---|---|---|---|---|---|---|---|---|---|---|---|${languages ? "---|---|---|---|---|" : ""}
${rows.map((r, i) => `| ${r.n ?? i + 1} | ${starter(r)} | ${r.questions} | ${r.models} | ${r.pages} | ${r.actions} | ${r.access} | ${r.pageAccess} | ${r.public} | ${r.warnings} | ${r.reused} | ${r.samples} | ${r.landing} |${extra(r)}`).join("\n")}

"Kept" counts the starter's models, pages and actions that the draft still has by name, with how many the draft has in all; "left out" names what the draft dropped because it could not be made valid: an action by its name, anything else (a formula field, a capacity) with its operation. "Starter's texts" lists the starter's app name or sample titles found in the draft's spec or content. "Models with the starter's samples" counts the draft's models that keep some of the starter's sample records after \`fitSamples\`; the rest get generated rows. "Mentions visitors" means the description says visitors, public or site. "Starter" is the one \`new --describe --yes\` printed, with the word-match starter (\`closestStarter\`) beside it when it differs; "Questions" counts what \`smithable clarify\` would ask (\`--yes\` asks nothing), with their language for a description not in English.${languages ? " For a description not in English, the language columns say whether the app's name, its model and field labels, and its landing pages' texts contain words of that language (common words, or the description's own words of four letters or more), with up to three of them, and how many models and fields have a label and pages a title in the content file." : ""}`;
}

const SCORE_START = "<!-- scorecard -->";
const SCORE_END = "<!-- /scorecard -->";

if (args.score) {
  const dir = args.score.replace(/\/$/, "");
  const reportFile = `${dir}.md`;
  const report = existsSync(reportFile) ? readFileSync(reportFile, "utf8") : "";
  // The starter of each app: meta.json beside its files, or the report's table for older runs.
  const tableStarters = [...report.matchAll(/^\| (.+?) \| (\w+) \| (?:yes|\*\*no\*\*) \|/gm)].map(
    (m) => ({
      description: m[1],
      starter: m[2],
    }),
  );
  const apps = readdirSync(dir)
    .filter((d) => /^app-\d+$/.test(d))
    .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  const rows = apps.map((app) => {
    const n = Number(app.slice(4));
    const meta = existsSync(join(dir, app, "meta.json"))
      ? JSON.parse(readFileSync(join(dir, app, "meta.json"), "utf8"))
      : tableStarters[n - 1];
    if (!meta) throw new Error(`no starter known for ${app}: no meta.json and no report row`);
    return { n, ...score(join(dir, app), meta.description, meta.starter, meta.lang, meta) };
  });
  const table = `${SCORE_START}\n## Scorecard (scripts/bench-m12.mjs --score)\n\n${scorecard(rows)}\n${SCORE_END}`;
  if (report) {
    const at = report.indexOf(SCORE_START);
    const next =
      at >= 0
        ? report.slice(0, at) + table + report.slice(report.indexOf(SCORE_END) + SCORE_END.length)
        : report.replace(/\n## /, `\n${table}\n\n## `);
    writeFileSync(reportFile, next);
    console.log(`The scorecard is in ${reportFile}.`);
  } else console.log(table);
  process.exit(0);
}

const model =
  process.env.SMITHABLE_MODEL ||
  process.env.SMITHABLE_LOCAL_MODEL ||
  (process.env.SMITHABLE_FRONTIER === "claude-code"
    ? process.env.SMITHABLE_FRONTIER_MODEL || "claude-code"
    : undefined);
if (!model) throw new Error("Set up a model first (docs/ai.md).");

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
  "A status page for our API, with incidents and planned maintenance.",
  "A public uptime page for a web shop: which services work, outages and their updates.",
];

// The second set (--set wide): each starter's territory twice more with another slant (one
// person, a team, public visitors), four that fit no starter, and six not in English, written
// the way a shop owner would. The first set stays as it is, so runs remain comparable.
const WIDE = [
  { text: "My clients as a freelance translator: who they are, what I quoted and what they paid." },
  { text: "A sales pipeline for our six-person web agency: leads, deals and who follows up when." },
  { text: "Online booking for a hair salon: customers pick a stylist and a free time themselves." },
  { text: "A piano teacher's lessons: my pupils, their weekly times and what each one practises." },
  { text: "Invoices for my photography work: clients, shoots and what is still unpaid." },
  {
    text: "Our cleaning company of three sends invoices to households every month; we need one place for them.",
  },
  {
    text: "A town flea market site where anyone can post things to sell, with photos and a price.",
  },
  {
    text: "A swap shelf for our office: colleagues offer things they no longer need and others claim them.",
  },
  { text: "My vinyl record collection: albums, artists, condition and what I paid." },
  {
    text: "Our local museum's collection online, so visitors can browse the objects and their stories.",
  },
  {
    text: "An internal status board for our IT systems, so staff see what is down and when it is back.",
  },
  {
    text: "Service status for our municipality's online services, for residents to check outages.",
  },
  { text: "A log of my car's fuel, service visits and costs." },
  {
    text: "The guest list and seating plan for our wedding, with who has answered and their meal choices.",
  },
  { text: "Bird sightings for our birdwatching club: species, place, date and who saw it." },
  { text: "Our allotment society: who has which plot, the waiting list and the yearly fee." },
  {
    text: "Bokning för min frisörsalong, kunderna ska kunna boka tid själva på nätet.",
    lang: "sv",
  },
  {
    text: "Vi är en liten byggfirma och behöver hålla koll på offerter, kunder och fakturor.",
    lang: "sv",
  },
  {
    text: "En sida för vår loppis där folk kan lägga upp saker de vill sälja, med bilder och pris.",
    lang: "sv",
  },
  {
    text: "Varausjärjestelmä joogastudiollemme: tunnit, ohjaajat ja varaukset verkossa.",
    lang: "fi",
  },
  {
    text: "Pieni autokorjaamo: asiakkaat, autot, huoltotyöt ja laskut yhdessä paikassa.",
    lang: "fi",
  },
  {
    text: "Für meinen kleinen Hofladen: Produkte, Vorbestellungen der Kunden und Abholzeiten.",
    lang: "de",
  },
];
const set = args.set === "wide" ? WIDE : DESCRIPTIONS.map((text) => ({ text }));
if (!["core", "wide"].includes(args.set)) throw new Error(`--set is core or wide, not ${args.set}`);

// Each draft's spec files, kept next to the report so what the model made can be read later.
const slug = `m12-first-builds-${model.replace(/[^a-z0-9.-]+/gi, "-")}${args.set === "wide" ? "-wide" : ""}`;
const kept = join(repo, "docs/benchmarks", slug);
rmSync(kept, { recursive: true, force: true });

const rows = [];
for (const [i, { text: description, lang }] of set.entries()) {
  const dir = join(root, `app-${i + 1}`);
  // What the first step would ask: `new --yes` asks nothing, so the questions come from clarify.
  const wordStarter = closestStarter(description, STARTERS);
  const clarified = spawnSync("node", [cli, "clarify", "--json", description], {
    cwd: repo,
    encoding: "utf8",
  });
  let questions = [];
  try {
    questions = JSON.parse(clarified.stdout.trim().split("\n").at(-1)).questions.map(
      (q) => q.question,
    );
  } catch {}
  const started = Date.now();
  const run = spawnSync("node", [cli, "new", dir, "--describe", description, "--yes"], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${run.stdout}${run.stderr}`;
  const used = /\(([^)]+)\) · ([\d,]+) tokens · ([€$])([\d.]+)/.exec(out);
  const typecheck =
    existsSync(join(dir, "package.json")) &&
    spawnSync("pnpm", ["typecheck"], { cwd: dir, encoding: "utf8" }).status === 0;
  for (const spec of SPECS)
    if (existsSync(join(dir, spec))) {
      mkdirSync(join(kept, `app-${i + 1}`), { recursive: true });
      cpSync(join(dir, spec), join(kept, `app-${i + 1}`, spec));
    }
  const row = {
    description,
    starter: /Starting from the (\w+) starter/.exec(out)?.[1] ?? "?",
    created: run.status === 0,
    typecheck,
    tokens: Number((used?.[2] ?? "0").replaceAll(",", "")),
    cost: Number(used?.[4] ?? 0),
    currency: used?.[3] ?? "€",
    seconds: Math.round((Date.now() - started) / 1000),
    summary: out
      .slice(out.indexOf("\n", out.indexOf("tokens ·")) + 1, out.indexOf("Create this app?"))
      .trim(),
    error: run.status === 0 ? "" : out.slice(-600),
  };
  // One indented line per action left out ("  addAction <name>: <reason>"); the names are enough here.
  const dropped = /Left out, since it could not be made valid:\n((?: {2}.+\n?)+)/
    .exec(out)?.[1]
    .split("\n")
    // An action by its name; anything else (a formula field, a capacity) with its operation.
    .map((line) => /^\s+(\w+) ([^:]+):/.exec(line))
    .map((m) => m && (m[1] === "addAction" ? m[2] : `${m[1]} ${m[2]}`))
    .filter(Boolean)
    .join(", ");
  row.meta = { wordStarter, questions, dropped };
  rows.push(row);
  if (existsSync(join(kept, `app-${i + 1}`)))
    writeFileSync(
      join(kept, `app-${i + 1}`, "meta.json"),
      `${JSON.stringify({ description, starter: row.starter, wordStarter, questions, ...(dropped && { dropped }), ...(lang && { lang }) }, null, 2)}\n`,
    );
  console.log(
    `${i + 1}. ${row.created ? "created" : "failed"} (${row.starter}) · ${row.tokens} tokens · ${row.currency}${row.cost}`,
  );
}

const yes = (v) => (v ? "yes" : "**no**");
const report = `# M12 first builds: ${model}${args.set === "wide" ? ", the second set" : ""} (${new Date().toISOString().slice(0, 10)})

The app descriptions, each started with \`smithable new --describe … --yes\` (the starter the first step picks, adapted by the model; errors go back up to twice).${args.set === "wide" ? " The beta is English: the descriptions not in English are measured to know where we stand, not because they are supported." : ""} Totals: ${rows.filter((r) => r.created).length} / ${rows.length} created, ${rows.filter((r) => r.typecheck).length} type-check, ${rows.reduce((n, r) => n + r.tokens, 0).toLocaleString("en")} tokens, ${rows[0]?.currency ?? "€"}${rows.reduce((n, r) => n + r.cost, 0).toFixed(4)}.

| Description | Starter | Created | Type-checks | Tokens | Cost | Time |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.description} | ${r.starter} | ${yes(r.created)} | ${yes(r.typecheck)} | ${r.tokens.toLocaleString("en")} | ${r.currency}${r.cost.toFixed(4)} | ${r.seconds} s |`).join("\n")}

Each created app's four spec files are in [${slug}/](${slug}/), one folder per description (app-1 …).

${SCORE_START}
## Scorecard (scripts/bench-m12.mjs --score)

${scorecard(rows.map((r, i) => (existsSync(join(kept, `app-${i + 1}`, "smithable.yml")) ? { n: i + 1, ...score(join(kept, `app-${i + 1}`), r.description, r.starter, set[i].lang, r.meta) } : null)).filter(Boolean))}
${SCORE_END}

## Summaries, for review

${rows.map((r, i) => `### ${i + 1}. ${r.description}\n\n${r.created ? `\`\`\`text\n${r.summary}\n\`\`\`` : `Failed:\n\n\`\`\`text\n${r.error}\n\`\`\``}`).join("\n\n")}
`;
const file = `docs/benchmarks/${slug}.md`;
writeFileSync(join(repo, file), report);
console.log(`\nWrote ${file}. The apps are in ${root}`);
