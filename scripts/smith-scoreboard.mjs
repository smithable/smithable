// The Smith scoreboard (T756): one line per round of bench-smith, so each round shows whether the
// weakest kinds moved. Given the round's runs (bench-smith's .jsonl files: the rules, small and
// small>better), it adds a line to docs/benchmarks/smith-scoreboard.json and writes
// docs/benchmarks/smith-scoreboard.md from all the lines:
//   per setup: right, wrong and asked, of how many, and Smith's cost per request (the judge apart),
//     per kind and per language (en, sv, fi apart);
//   the escalation's four numbers: answered by a rule and wrong (rules too eager); passed on by
//     the rules though the set says no model is needed (a rule could have done it); small wrong
//     where small>better is right (should have gone up); went up to the better model where small
//     alone was right (paid for nothing). The last two compare the round's small and small>better
//     runs request by request, so they need both.
// A kind that falls below the last line's right share for the same setup is marked ▼ in the page.
// Spend totals stay out of this public file: cost per request is a product fact, totals are not.
//   node scripts/smith-scoreboard.mjs <run.jsonl>… [--note "what changed"] [--dry-run]   (later files win)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "./dev-app.mjs";

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const files = args.filter((a, i) => a.endsWith(".jsonl") && args[i - 1] !== "--note");
if (!files.length) throw new Error("Give the round's bench-smith .jsonl files.");
const set = JSON.parse(readFileSync(join(repo, "docs/benchmarks/smith-requests.json"), "utf8"));
const labelled = new Map(set.requests.map((r) => [r.id, r]));
// A setup run again in a later file replaces the earlier rows (a rerun after a cut or a limit).
const rows = [
  ...new Map(
    files
      .flatMap((f) =>
        readFileSync(f, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l)),
      )
      .map((r) => [`${r.setup} ${r.id}`, r]),
  ).values(),
];

const asked = (r) => r.got === "question";
const share = (right, of) => (of ? Math.round((1000 * right) / of) / 10 : null);
/** Right, wrong, asked and cost per request over some rows. */
const tally = (of) => {
  const right = of.filter((r) => r.right).length;
  const cost = of.reduce((n, r) => n + (r.smithCost ?? r.cost ?? 0), 0);
  return {
    of: of.length,
    right,
    wrong: of.length - right,
    asked: of.filter(asked).length,
    share: share(right, of.length),
    perRequest: of.length ? Math.round((cost / of.length) * 1e5) / 1e5 : 0,
  };
};
const by = (of, key) =>
  Object.fromEntries(
    [...new Set(of.map((r) => r[key]))]
      .sort()
      .map((k) => [k, tally(of.filter((r) => r[key] === k))]),
  );

const setups = {};
for (const setup of [...new Set(rows.map((r) => r.setup))]) {
  const of = rows.filter((r) => r.setup === setup);
  setups[setup] = {
    ...tally(of),
    models: [...new Set(of.map((r) => r.model).filter(Boolean))],
    kinds: by(of, "kind"),
    languages: by(of, "language"),
  };
}

// The escalation's numbers. A rule's answer is the same in every setup, so any setup's rows count.
const once = [...new Map(rows.map((r) => [r.id, r])).values()];
const ruled = once.filter((r) => r.tier === "rules" || (r.tier === undefined && r.byRule));
const small = new Map(rows.filter((r) => r.setup === "small").map((r) => [r.id, r]));
const both = rows.filter((r) => r.setup === "small>better" && small.has(r.id));
const escalation = {
  rulesWrong: ruled.filter((r) => !r.right).length,
  rulesAnswered: ruled.length,
  ruleCouldHave: once.filter(
    (r) =>
      labelled.get(r.id)?.noModel && !(r.tier === "rules" || (r.tier === undefined && r.byRule)),
  ).length,
  ...(both.length
    ? {
        shouldHaveGoneUp: both.filter((r) => !small.get(r.id).right && r.right).length,
        paidForNothing: both.filter((r) => r.tier === "better" && small.get(r.id).right).length,
        compared: both.length,
      }
    : {}),
};

const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" }).trim();
const line = {
  date: new Date().toISOString().slice(0, 10),
  commit: git("rev-parse", "--short", "HEAD"),
  set: set.version ?? 1,
  requests: once.length,
  runs: files.map((f) => f.replace(/^.*\//, "")),
  note: option("--note") ?? "",
  setups,
  escalation,
};

const store = join(repo, "docs/benchmarks/smith-scoreboard.json");
const lines = existsSync(store) ? JSON.parse(readFileSync(store, "utf8")) : [];
if (!args.includes("--dry-run")) lines.push(line);

/** The page, from every line: the newest first, a kind under the line before it marked ▼. */
function page(all) {
  const out = [
    "# Smith's scoreboard",
    "",
    "One line per round of [bench-smith](../../scripts/bench-smith.mjs) on [what people say to Smith](smith-requests.json), made by [smith-scoreboard.mjs](../../scripts/smith-scoreboard.mjs); the rows are in [smith-scoreboard.json](smith-scoreboard.json). Right is the share of requests answered as labelled; cost is Smith's own per request, in US dollars at the models' list prices (the judge apart). ▼: under the round before, for the same setup.",
    "",
  ];
  for (const [i, l] of [...all.entries()].reverse()) {
    const before = all[i - 1];
    out.push(
      `## ${l.date}, ${l.commit} (set ${l.set}, ${l.requests} requests)${l.note ? `: ${l.note}` : ""}`,
      "",
    );
    const names = Object.keys(l.setups);
    const kinds = [...new Set(names.flatMap((s) => Object.keys(l.setups[s].kinds)))].sort();
    const languages = [...new Set(names.flatMap((s) => Object.keys(l.setups[s].languages)))].sort();
    const cell = (s, t, k, group) => {
      const was = before?.setups[s]?.[group]?.[k]?.share;
      return t ? `${t.right} / ${t.of}${was != null && t.share < was ? " ▼" : ""}` : "";
    };
    out.push(
      `| | ${names.map((s) => `${s} (${l.setups[s].models.join(", ") || (s === "rules" ? "no model" : "models not recorded")})`).join(" | ")} |`,
      `|---|${names.map(() => "---").join("|")}|`,
      `| **All** | ${names.map((s) => `${l.setups[s].right} / ${l.setups[s].of}, asked ${l.setups[s].asked}, $${l.setups[s].perRequest.toFixed(4)} a request`).join(" | ")} |`,
      ...kinds.map(
        (k) =>
          `| ${k} | ${names.map((s) => cell(s, l.setups[s].kinds[k], k, "kinds")).join(" | ")} |`,
      ),
      ...languages.map(
        (g) =>
          `| ${g} | ${names.map((s) => cell(s, l.setups[s].languages[g], g, "languages")).join(" | ")} |`,
      ),
      "",
    );
    const e = l.escalation;
    out.push(
      `Escalation: the rules answered ${e.rulesAnswered}, ${e.rulesWrong} of them wrong; they passed on ${e.ruleCouldHave} that the set says need no model.${
        e.compared !== undefined
          ? ` Of ${e.compared} requests in both small and small>better: ${e.shouldHaveGoneUp} small got wrong where small>better was right (should have gone up), ${e.paidForNothing} went up where small alone was right (paid for nothing).`
          : " small and small>better were not both run, so the two comparing numbers are not counted."
      }`,
      "",
    );
  }
  return `${out.join("\n")}\n`;
}

if (args.includes("--dry-run")) console.log(JSON.stringify(line, null, 1));
else {
  writeFileSync(store, `${JSON.stringify(lines, null, 1)}\n`);
  writeFileSync(join(repo, "docs/benchmarks/smith-scoreboard.md"), page(lines));
  console.log("docs/benchmarks/smith-scoreboard.md");
}
