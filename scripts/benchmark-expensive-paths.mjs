// Local synthetic runtime measurements; never a hosted latency or throughput claim.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus, release, tmpdir, totalmem } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const root = mkdtempSync(join(tmpdir(), "smithable-expensive-"));
const app = join(root, "app");
const run = (command, args, cwd = repo) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 240000,
    maxBuffer: 16 * 1024 * 1024,
  });
const outputIndex = process.argv.indexOf("--out");
const output = resolve(
  outputIndex < 0 ? "test-results/expensive-paths.json" : process.argv[outputIndex + 1],
);
try {
  const began = performance.now();
  run(process.execPath, [
    join(repo, "packages/cli/dist/bin.js"),
    "new",
    app,
    "--starter",
    "booking",
  ]);
  const generateMs = performance.now() - began;
  const selection = process.argv.includes("--selection-only");
  if (selection) {
    const { parse, stringify } = createRequire(join(repo, "packages/core/package.json"))("yaml");
    const spec = parse(readFileSync(join(app, "smithable.yml"), "utf8"));
    spec.models.Counter = { fields: { enabled: "bool" } };
    spec.models.Booking.fields.counter = "Counter";
    spec.models.NamedCounter = {
      namedBy: ["counter", "label"],
      fields: { counter: "Counter!", label: "string!" },
    };
    spec.models.Booking.fields.namedCounter = "NamedCounter";
    spec.pages["booking-filters"] = { crud: "Booking", filters: ["counter", "namedCounter"] };
    writeFileSync(join(app, "smithable.yml"), stringify(spec));
    const ux = parse(readFileSync(join(app, "smithable.ux.yml"), "utf8"));
    ux.pages ??= {};
    ux.pages["booking-filters"] = { filters: { pick: { counter: "list" } } };
    writeFileSync(join(app, "smithable.ux.yml"), stringify(ux));
    run(process.execPath, [join(repo, "packages/cli/dist/bin.js"), "generate"], app);
  }

  let evidence = { status: "passed", measurements: [] };
  if (!process.argv.includes("--lifecycle-only") || selection) {
    writeFileSync(
      join(app, "src/expensive-paths.test.ts"),
      readFileSync(
        join(
          repo,
          selection
            ? "scripts/fixtures/bounded-relations.test.ts"
            : "scripts/fixtures/expensive-paths.test.ts",
        ),
      ),
    );
    console.log(run("pnpm", ["exec", "vitest", "run", "src/expensive-paths.test.ts"], app));
    if (!selection) evidence = JSON.parse(readFileSync(join(app, "expensive-paths.json"), "utf8"));
    else evidence.selectionRuntime = "passed";
  }
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(
    output,
    `${JSON.stringify({ ...evidence, status: "runtime passed; lifecycle pending" }, null, 2)}\n`,
  );
  if (
    process.argv.includes("--lifecycle") ||
    process.argv.includes("--lifecycle-only") ||
    selection
  ) {
    const { measurePreview } = await import("./benchmark-preview-lifecycle.mjs");
    evidence.lifecycle = await measurePreview(
      app,
      join(repo, "packages/cli/dist/bin.js"),
      run,
      selection,
    );
  }
  Object.assign(evidence, {
    generateMs,
    node: process.version,
    platform: process.platform,
    kernel: release(),
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryBytes: totalmem(),
    engine: run("git", ["rev-parse", "HEAD"]).trim(),
    dirty: run("git", ["status", "--porcelain"]).trim().length > 0,
    seed: 1,
    measuredAt: new Date().toISOString(),
    appVersions: JSON.parse(readFileSync(join(app, "package.json"), "utf8")).dependencies,
    sourceHashes: Object.fromEntries(
      [
        "packages/adapter-tanstack/src/data.ts",
        "packages/adapter-tanstack/src/dev-door.ts",
        "packages/adapter-tanstack/src/pages/list.ts",
        "packages/adapter-tanstack/templates/src/kit/uploads.ts",
      ].map((path) => [
        path,
        createHash("sha256")
          .update(readFileSync(join(repo, path)))
          .digest("hex"),
      ]),
    ),
  });
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Evidence: ${output}`);
} catch (error) {
  mkdirSync(resolve(output, ".."), { recursive: true });
  const previous = (() => {
    try {
      return JSON.parse(readFileSync(output, "utf8"));
    } catch {
      return {};
    }
  })();
  writeFileSync(
    output,
    `${JSON.stringify({ ...previous, status: "failed", error: String(error).slice(0, 2000) }, null, 2)}\n`,
  );
  throw error;
} finally {
  if (process.argv.includes("--keep")) console.log(`Owned fixture retained: ${root}`);
  else rmSync(root, { recursive: true, force: true });
}
