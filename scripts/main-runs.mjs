// Main's full checks since the last read: node scripts/main-runs.mjs [days, default 1].
// Gates run what a change needs (scripts/gate-plan.mjs), so what main's scheduled and
// hand-started runs find is read every day. Lists each run since then by its `full` job (a run
// that skipped it, main unchanged, checked nothing), and names the last COMPLETED one. Exit 1
// when that one failed, or when none completed in the time: then start one by hand.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DONE = new Set(["success", "failure", "timed_out"]);

/** runs, newest first: { createdAt, url, full } where full is the job's conclusion or status. */
export function report(runs, since) {
  const lines = runs
    .filter((r) => Date.parse(r.createdAt) >= since)
    .map((r) => `${r.createdAt} full=${r.full} ${r.url}`);
  const last = runs.find((r) => DONE.has(r.full));
  const fresh = last && Date.parse(last.createdAt) >= since;
  lines.push(
    last
      ? `last completed full run: ${last.full}, ${last.createdAt} ${last.url}`
      : "no completed full run among the runs read",
  );
  if (!fresh)
    lines.push("none completed in the time: start one with gh workflow run ci.yml --ref main");
  return { lines, ok: Boolean(fresh) && last.full === "success" };
}

const gh = (...args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8" }));

function main(days) {
  const since = Date.now() - days * 86_400_000;
  const listed = ["schedule", "workflow_dispatch"]
    .flatMap((event) =>
      gh(
        ...["run", "list", "--workflow", "ci.yml", "--branch", "main", "--event", event],
        ...["--limit", "20", "--json", "databaseId,createdAt,url"],
      ),
    )
    .toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const runs = [];
  for (const run of listed) {
    const { jobs } = gh("run", "view", String(run.databaseId), "--json", "jobs");
    const job = jobs.find((j) => j.name === "full");
    const full = job ? job.conclusion || job.status : "not started";
    runs.push({ ...run, full });
    // Older runs than the time asked for matter only until one that completed.
    if (Date.parse(run.createdAt) < since && DONE.has(full)) break;
  }
  const { lines, ok } = report(runs, since);
  console.log(lines.join("\n"));
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(Number(process.argv[2] ?? 1));
