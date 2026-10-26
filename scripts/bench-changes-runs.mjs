// bench-changes over several runs: the rows each run wrote (bench-changes.mjs … --results
// <file>), read together into the mean and spread per setup and per request, and what a pair's
// questions back would have been from the stronger model alone.
//   node scripts/bench-changes-runs.mjs <dir with run-*.json>
// Writes docs/benchmarks/builder-changes-runs.md. Free: it calls no model.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = new URL("..", import.meta.url).pathname;
const dir = process.argv[2] ?? join(repo, "docs/benchmarks/builder-changes-runs");
const runs = readdirSync(dir)
  .filter((f) => /^run-\d+\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
if (runs.length === 0) throw new Error(`No run-*.json in ${dir}.`);
const models = [...new Set(runs.flat().map((r) => r.model))];
const tasks = [...new Set(runs.flat().map((r) => r.task))];
// A request the provider never answered (a rate limit, an error) is no answer from the model.
const failed = (r) => r.tokens === 0 && r.outcome === "no change";
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const sd = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
const fmt = (x) => x.toFixed(1);

const perSetup = models.map((m) => {
  const per = runs.map((run) => run.filter((r) => r.model === m));
  const count = (o) => per.map((rows) => rows.filter((r) => r.outcome === o && !failed(r)).length);
  const right = count("right");
  const cost = mean(
    per.map((rows) => rows.reduce((s, r) => s + r.cost, 0) / Math.max(1, rows.length)),
  );
  const currency = per.flat()[0]?.currency ?? "$";
  return `| ${m} | ${fmt(mean(right))} | ${Math.min(...right)}–${Math.max(...right)} | ${fmt(sd(right))} | ${fmt(mean(count("wrong")))} | ${fmt(mean(count("no change")))} | ${per.flat().filter(failed).length} | ${currency}${cost.toFixed(4)} |`;
});

const perTask = tasks.map((t) => {
  const cells = models.map((m) => {
    const rows = runs.flatMap((run) => run.filter((r) => r.model === m && r.task === t));
    const right = rows.filter((r) => r.outcome === "right").length;
    const asked = rows.filter((r) => r.outcome === "no change" && !failed(r)).length;
    return `${right}/${rows.length}${asked ? ` (${asked} asked)` : ""}`;
  });
  return `| ${t} | ${cells.join(" | ")} |`;
});

// A pair (cheap>better): its questions back stay with the cheap model. What did the better
// model alone do with the same request in the same run?
const pairs = models.filter((m) => m.includes(">"));
const routing = pairs.map((pair) => {
  const better = pair.split(">").at(-1);
  let asked = 0;
  let betterRight = 0;
  let betterAsked = 0;
  let escalated = 0;
  for (const run of runs)
    for (const r of run.filter((x) => x.model === pair)) {
      if (r.by?.includes(better)) escalated++;
      if (r.outcome !== "no change" || failed(r)) continue;
      asked++;
      const alone = run.find((x) => x.model === better && x.task === r.task);
      if (alone?.outcome === "right") betterRight++;
      else if (alone?.outcome === "no change") betterAsked++;
    }
  const total = runs.flat().filter((x) => x.model === pair).length;
  return `- **${pair}**: ${escalated} of ${total} requests went on to ${better}. ${asked} ended in a question back from the cheap model; for the same request in the same run, ${better} alone made the right change ${betterRight} times and asked back ${betterAsked} times.`;
});

const report = `# Builder changes over ${runs.length} runs (${new Date().toISOString().slice(0, 10)})

The twelve requests of [builder-changes.md](builder-changes.md), run ${runs.length} times on each setup ([scripts/bench-changes-runs.mjs](../../scripts/bench-changes-runs.mjs) reads the runs' rows in [builder-changes-runs/](builder-changes-runs/)). *Right* out of twelve per run: the mean, the lowest and highest, and the standard deviation. *Failed* counts requests the provider never answered (a rate limit), left out of the other columns.

| Setup | Right (mean) | Range | SD | Wrong (mean) | No change (mean) | Failed | Cost per request |
|---|---|---|---|---|---|---|---|
${perSetup.join("\n")}

## Each request

Right out of ${runs.length}, and how often the model asked back instead.

| Request | ${models.join(" | ")} |
|---|${models.map(() => "---").join("|")}|
${perTask.join("\n")}

## A pair's questions back

${routing.join("\n")}
`;
writeFileSync(join(repo, "docs/benchmarks/builder-changes-runs.md"), report);
console.log(report);
