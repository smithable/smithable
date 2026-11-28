// What a gate runs for a change, beyond gate.sh's own rules (its plan_today): the generated-code
// snapshot says which example apps the change reaches. gate.sh calls
//   node scripts/gate-plan.mjs [--check-snapshot] "<today's plan line>"
// and prints what comes back: "apps=<all|none|name…> studio=<yes|no> visual=<yes|no> why=<reason>".
// The rows below are numbered by priority: among 1 to 4 the widest wins, from 5 down what each
// part needs is added together. Main's scheduled full run covers what a narrowed plan leaves out.
//   GATE_CHANGED   the changed paths, one a line (gate.sh's changes)
//   GATE_BASE      the commit to compare with (default origin/main); the merge base is taken
//   GATE_HEAD      the commit that holds the change (default: the working copy, new files included)
//   GATE_ALL_APPS  1: every example app (the pull request's label all-apps)
//   GATE_FAILED_FILE  the apps that failed in this branch's last run, kept in a narrowed plan
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const SNAPSHOT = "packages/adapter-tanstack/src/__snapshots__/generate.test.ts.snap";
/** Row 5: so many examples with changed output are not all run, but these. */
const WIDE = 8;
const SAMPLE = 3;
const FIXED = "booking";

const DOCUMENT = /^(docs\/|[^/]*\.md$)/;
/** Row 1: what installs, builds or decides the gate itself. */
const FOUNDATION =
  /^(pnpm-[^/]*|biome\.json|scripts\/(embed|gate|gate-plan)\.(mjs|sh)|\.github\/(workflows|actions)\/.*)$|(^|\/)tsconfig[^/]*\.json$|^(?!examples\/)([^/]+\/)*package\.json$/;
/** Row 2: sensitive paths, matched as whole words of the path (also split at camelCase). */
const WORDS = new RegExp(
  "(^|[/._-])(auth|authn|authz|authentication|authorization|oauth|sign[-_]?in|log[-_]?in|sessions?|access|permissions?|roles?" +
    "|gateway|sandbox(es|ed|ing)?|docker[-_]?guard|mail|mails|mailer|send[-_]?e?mail|invites?|invitations?" +
    "|legal|terms|privacy|licen[cs]es?|dpa|migrations?|backups?|restores?|infra|tofu|secrets?|credentials?|gitleaks" +
    "|pre[-_]push|pre[-_]commit)([/._-]|$)",
  "i",
);
const SENSITIVE_PLACE =
  /\.tf(vars)?$|(^|\/)\.githooks\/|(^|\/)\.claude\/(hooks\/|settings)|(^|\/)\.github\/workflows\/|(^|\/)deploy\/host/;
export const sensitive = (path) =>
  WORDS.test(path) ||
  WORDS.test(path.replace(/([a-z0-9])([A-Z])/g, "$1-$2")) ||
  SENSITIVE_PLACE.test(path);
/** Row 3: helpers the apps' check and Studio's both use. */
const SHARED_HELPER = /^scripts\/(ports|patience|fake-model|gate-ports)\.mjs$/;
/** Row 4: the apps' check itself. */
const APPS_CHECK = /^scripts\/test-apps[^/]*\.mjs$/;
/** Row 8: what vitest alone reads. */
const UNIT_ONLY = /^(packages|apps)\/[^/]+\/src\/(.*\.test\.ts$|(.*\/)?__snapshots__\/)/;
/** Row 9: what only Studio's checks load. */
const STUDIO_SIDE =
  /^(apps\/studio\/|packages\/(look-editor|index)\/|packages\/cli\/src\/studio|scripts\/(test-studio|studio-|release-review|scenario-clock|test-visual|visual-|picture-picker-browser|preview-pages-checks|static-state-checks|theme-lab-checks|look-|[^/]*-look))/;
/** Where a change can alter the generated code, so the snapshot is asked. */
const OUTPUT_SOURCE = /^(packages|examples)\//;
/** Row 10's "+crm": its check also tests the engine's own commands. */
const COMMANDS = /^packages\/(cli|core)\/src\//;

export function parsePlan(line) {
  const m = /^apps=(.*?) studio=(yes|no) visual=(yes|no) why=(.*)$/.exec(line.trim());
  if (!m) throw new Error(`not a plan line: ${line}`);
  return { apps: m[1], studio: m[2] === "yes", visual: m[3] === "yes", why: m[4] };
}
export const planLine = ({ apps, studio, visual, why }) =>
  `apps=${apps} studio=${studio ? "yes" : "no"} visual=${visual ? "yes" : "no"} why=${why}`;

/** A snapshot's entries by example, and each example's generated package.json among them. */
export function snapshotParts(text) {
  const output = new Map();
  const packages = new Map();
  for (const block of text.split("\nexports[`").slice(1)) {
    const example = /^\.\.\/\.\.\/\.\.\/examples\/([^/]+)\//.exec(block)?.[1];
    if (!example) continue;
    const entry = block.trimEnd();
    output.set(example, `${output.get(example) ?? ""}\n${entry}`);
    if (entry.split("\n", 1)[0].includes("> package.json 1`] =")) packages.set(example, entry);
  }
  if (!output.size) throw new Error("the snapshot holds no example");
  return { output, packages };
}

/** The examples that are drawn: lowest SHA-256 of the change's patch id and the name first. */
export function sample(names, patchId, n = SAMPLE) {
  const key = (name) =>
    createHash("sha256")
      .update(patchId + name)
      .digest("hex");
  return names.toSorted((a, b) => (key(a) < key(b) ? -1 : 1)).slice(0, n);
}

/**
 * The plan. `facts` reads the repository, only when a row needs it:
 * snapshots() gives { base, head } as snapshotParts, patchId() the change's, failed() the apps
 * of the last failed run.
 */
export function plan(today, changed, facts) {
  const examples = facts.examples.toSorted();
  const every = new Set(examples);
  const now = parsePlan(today);
  const nowApps =
    now.apps === "all"
      ? every
      : new Set(now.apps === "none" ? [] : now.apps.split(" ").filter((a) => every.has(a)));
  const line = (apps, studio, visual, why) => {
    const list = examples.filter((e) => apps.has(e));
    const text = list.length === examples.length ? "all" : list.join(" ") || "none";
    return planLine({ apps: text, studio, visual, why });
  };

  const paths = changed.filter((p) => p && !DOCUMENT.test(p));
  // Nothing but documents, or nothing at all (main's own run): as gate.sh has it.
  if (!paths.length) return today;
  const product = paths.filter((p) => !UNIT_ONLY.test(p));

  if (paths.some((p) => FOUNDATION.test(p)))
    return line(every, true, true, "row 1: dependencies, the workflow or the gate itself changed");

  let snapshots;
  if (paths.some((p) => OUTPUT_SOURCE.test(p))) {
    try {
      snapshots = facts.snapshots();
    } catch (error) {
      if (error.stale) throw error;
      return line(every, true, true, `every app: no snapshot to compare (${error.message})`);
    }
  }
  const differs = (a, b, name) => a.get(name) !== b.get(name);
  const reached = snapshots
    ? examples.filter((e) => differs(snapshots.base.output, snapshots.head.output, e))
    : [];
  if (
    snapshots &&
    examples.some(
      (e) =>
        snapshots.base.packages.has(e) &&
        differs(snapshots.base.packages, snapshots.head.packages, e),
    )
  )
    return line(every, true, true, "row 1b: a generated package.json changed");
  if (product.some((p) => SHARED_HELPER.test(p)))
    return line(every, true, now.visual, "row 3: a helper both browser checks use changed");

  // From here on the apps may be narrowed: those that failed last time stay in.
  const kept = () => facts.failed().filter((a) => every.has(a));
  const narrowed = (apps, studio, visual, why) => {
    const more = kept().filter((a) => !apps.has(a));
    return line(
      new Set([...apps, ...more]),
      studio,
      visual,
      more.length ? `${why}; failed last time: ${more.join(" ")}` : why,
    );
  };
  const asToday = (why) => narrowed(nowApps, now.studio, now.visual, `${why}: ${now.why}`);

  if (product.some(sensitive)) return asToday("row 2: a sensitive path");
  if (product.some((p) => APPS_CHECK.test(p))) return asToday("row 4: the apps' check");

  const own = new Set(
    product.map((p) => /^examples\/([^/]+)\//.exec(p)?.[1]).filter((e) => e && every.has(e)),
  );
  const withCommands = product.some((p) => COMMANDS.test(p));
  if (reached.length >= WIDE) {
    const apps = new Set([FIXED, ...own, ...(withCommands ? ["crm"] : []), ...kept()]);
    const drawn = sample(
      reached.filter((e) => !apps.has(e)),
      facts.patchId(),
    );
    const again = kept();
    return line(
      new Set([...apps, ...drawn].filter((e) => every.has(e))),
      true,
      now.visual,
      `row 5: ${reached.length} examples' output changed; sampled ${drawn.join(" ") || "none"}${again.length ? `; failed last time: ${again.join(" ")}` : ""}`,
    );
  }
  if (reached.length) {
    const apps = new Set([...reached, ...own, ...(nowApps.has("crm") ? ["crm"] : [])]);
    return narrowed(apps, now.studio, now.visual, `row 6: output changed: ${reached.join(" ")}`);
  }
  if (!product.length)
    return narrowed(new Set(), false, now.visual, "row 8: only unit tests and snapshots");
  if (product.every((p) => p.startsWith("examples/"))) return asToday("row 7: only examples");
  if (product.every((p) => STUDIO_SIDE.test(p)))
    return narrowed(new Set(), true, now.visual, "row 9: only Studio's side, output unchanged");
  if (product.every((p) => /^(apps\/studio|packages|examples)\//.test(p) || STUDIO_SIDE.test(p))) {
    const apps = new Set([...own, FIXED, ...(withCommands ? ["crm"] : [])]);
    return narrowed(
      new Set([...apps].filter((e) => every.has(e))),
      true,
      now.visual,
      "row 10: engine source, output unchanged",
    );
  }
  return asToday("row 11");
}

const git = (args, options = {}) =>
  execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });

/** The change as two commits-or-trees: the merge base, and the head or the working copy's tree. */
export function changeEnds(env, cwd) {
  const head = env.GATE_HEAD || undefined;
  const base = git(["merge-base", env.GATE_BASE || "origin/main", head ?? "HEAD"], { cwd }).trim();
  // mark-verified.sh's tree: tracked and new files, as a commit of it all would have.
  const markVerified = fileURLToPath(new URL("mark-verified.sh", import.meta.url));
  const tree =
    head ?? execFileSync("bash", [markVerified, "--tree"], { cwd, encoding: "utf8" }).trim();
  return { base, tree };
}

/**
 * The same id for the same change, uncommitted or committed, here or in CI: one diff, between the
 * merge base's tree and the change's, whatever git's own settings say.
 */
export function patchId({ base, tree }, cwd) {
  const diff = git(
    [
      "diff-tree",
      "-r",
      "-p",
      "--no-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--full-index",
      "--diff-algorithm=myers",
      "-U3",
      base,
      tree,
    ],
    { cwd },
  );
  return git(["patch-id", "--stable"], { cwd, input: diff }).split(" ")[0];
}

function repositoryFacts(env, cwd, checkSnapshot) {
  let ends;
  const change = () => {
    ends ??= changeEnds(env, cwd);
    return ends;
  };
  return {
    examples: readdirSync(join(cwd, "examples"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
    snapshots() {
      const { base, tree } = change();
      // The snapshot says what the output is only once the units have passed on these files
      // (a gate runs them before the apps; --plan does not).
      if (checkSnapshot && !env.GATE_HEAD) {
        const verified = join(
          git(["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd }).trim(),
          "verified",
          tree,
        );
        if (!existsSync(verified))
          throw Object.assign(
            new Error(
              "the units have not passed on these files, so the snapshot may be stale and the plan wrong: run scripts/verify.sh (or the gate), then --plan again",
            ),
            { stale: true },
          );
      }
      const at = (rev) => snapshotParts(git(["show", `${rev}:${SNAPSHOT}`], { cwd }));
      return { base: at(base), head: at(tree) };
    },
    patchId: () => patchId(change(), cwd),
    failed() {
      const file = env.GATE_FAILED_FILE;
      if (!file || !existsSync(file)) return [];
      // A run of one part of an example (name:part) brings the whole example back.
      const names = readFileSync(file, "utf8").split(/\s+/).filter(Boolean);
      return [...new Set(names.map((n) => n.split(":")[0]))];
    },
  };
}

function main(argv, env, cwd) {
  const checkSnapshot = argv[0] === "--check-snapshot";
  const today = argv.at(-1);
  const now = parsePlan(today);
  if (env.GATE_ALL_APPS === "1")
    return planLine({ ...now, apps: "all", why: `every app asked for (all-apps): ${now.why}` });
  const changed = (env.GATE_CHANGED ?? "").split("\n");
  return plan(today, changed, repositoryFacts(env, cwd, checkSnapshot));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(main(process.argv.slice(2), process.env, process.cwd()));
  } catch (error) {
    console.error(`gate-plan: ${error.message}`);
    process.exit(error.stale ? 3 : 1);
  }
}
