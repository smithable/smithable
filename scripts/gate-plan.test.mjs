import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { changeEnds, patchId, plan, SNAPSHOT, sample, snapshotParts } from "./gate-plan.mjs";

const examples = [
  "api",
  "barbers",
  "booking",
  "builder",
  "crm",
  "invoicing",
  "kiosk",
  "painter",
  "records",
  "status",
];

const entry = (example, file, body) =>
  `\nexports[\`../../../examples/${example}/smithable.yml > file list and generated code > ${file} 1\`] = \`\n"${body}"\n\`;\n`;
/** A snapshot of every example; `changed` gives an example's file another body. */
const snapshot = (changed = {}) =>
  snapshotParts(
    `// Vitest Snapshot\n${examples
      .map(
        (e) =>
          entry(e, "package.json", changed[`${e}/package.json`] ?? "{}") +
          entry(e, "a.ts", changed[e] ?? "1"),
      )
      .join("")}`,
  );

const TODAY = "apps=all studio=yes visual=no why=the change reaches every app";
const run = (changed, { head = {}, today = TODAY, failed = [], id = "abc", snapshots } = {}) =>
  plan(today, changed, {
    examples,
    snapshots: snapshots ?? (() => ({ base: snapshot(), head: snapshot(head) })),
    patchId: () => id,
    failed: () => failed,
  });
const apps = (line) => /^apps=(.*?) studio=(yes|no)/.exec(line).slice(1);
const outputOf = (names) => Object.fromEntries(names.map((n) => [n, "2"]));

test("documents alone, and nothing changed, keep today's plan", () => {
  assert.equal(run(["docs/a.md"]), TODAY);
  assert.equal(run([""]), TODAY);
  assert.equal(run(["site/index.html", "fixes/a.md"]), TODAY);
  assert.match(run(["apps/studio/src/a.tsx", "fixes/a.md"]), /why=row 9/);
});

test("rows 1, 1b and 3 run everything, even beside a sensitive path", () => {
  for (const path of [
    "pnpm-lock.yaml",
    "apps/studio/package.json",
    "scripts/gate.sh",
    "scripts/gate-plan.mjs",
    ".github/workflows/ci.yml",
  ])
    assert.match(run([path]), /^apps=all studio=yes visual=yes why=row 1:/, path);
  assert.match(
    run(["packages/core/src/a.ts"], { head: { "kiosk/package.json": "x" } }),
    /^apps=all studio=yes visual=yes why=row 1b/,
  );
  assert.match(
    run(["scripts/ports.mjs", "packages/cli/src/auth.ts"]),
    /^apps=all studio=yes visual=no why=row 3/,
  );
});

test("rows 2, 4 and 7 are today's plan", () => {
  const today = "apps=crm studio=yes visual=no why=examples";
  assert.match(run(["packages/cli/src/signIn.ts"], { today }), /^apps=crm studio=yes .*why=row 2/);
  assert.match(run(["scripts/test-apps.mjs"], { today }), /^apps=crm .*why=row 4/);
  assert.match(run(["examples/crm/smithable.yml"], { today, head: {} }), /^apps=crm .*why=row 7/);
});

test("row 5: most examples' output changed gives booking, the edited and three drawn", () => {
  const wide = outputOf(examples.slice(0, 8));
  const changed = ["packages/core/src/a.ts", "examples/kiosk/smithable.yml"];
  const line = run(changed, { head: wide });
  const [list, studio] = apps(line);
  const chosen = list.split(" ");
  for (const name of ["booking", "crm", "kiosk"]) assert.ok(chosen.includes(name), line);
  assert.equal(chosen.length, 6, line);
  assert.equal(studio, "yes");
  assert.equal(run(changed, { head: wide }), line, "the same change draws the same");
  const draws = new Set(["a", "b", "c", "d", "e"].map((id) => run(changed, { head: wide, id })));
  assert.ok(draws.size > 1, "another change can draw others");
  assert.ok(
    apps(run(changed, { head: wide, failed: ["status"] }))[0]
      .split(" ")
      .includes("status"),
  );
});

test("the sample is the lowest hashes of the patch id and the name", () => {
  assert.deepEqual(sample(["a", "b", "c", "d"], "id"), sample(["d", "c", "b", "a"], "id"));
  assert.equal(sample(["a"], "id").length, 1);
});

test("row 6: a few examples' output changed runs those, with what failed last time", () => {
  const line = run(["packages/adapter-tanstack/src/pages/list.ts"], {
    head: outputOf(["kiosk", "records"]),
    today: "apps=crm studio=yes visual=yes why=x",
    failed: ["status"],
  });
  assert.match(
    line,
    /^apps=crm kiosk records status studio=yes visual=yes why=row 6: .*failed last time: status$/,
  );
});

test("rows 8, 9 and 10 with the output unchanged", () => {
  assert.match(run(["packages/core/src/a.test.ts", SNAPSHOT]), /^apps=none studio=no .*why=row 8/);
  assert.match(
    run(["apps/studio/src/a.tsx", "scripts/test-studio.mjs"]),
    /^apps=none studio=yes .*why=row 9/,
  );
  assert.match(
    run(["packages/adapter-tanstack/src/a.ts"]),
    /^apps=booking studio=yes .*why=row 10/,
  );
  assert.match(run(["packages/core/src/a.ts"]), /^apps=booking crm studio=yes .*why=row 10/);
  assert.match(run(["scripts/bench-x.mjs"]), /^apps=booking studio=yes .*why=row 10/);
  assert.match(run(["scripts/upgrade-flow.mjs"]), /^apps=all .*why=row 4/);
  assert.match(run(["vitest.config.ts"]), /^apps=all .*why=row 11/);
});

test("no snapshot to compare runs every app; a stale one stops", () => {
  const broken = () => {
    throw new Error("no merge base");
  };
  assert.match(
    run(["packages/core/src/a.ts"], { snapshots: broken }),
    /^apps=all studio=yes visual=yes why=every app: no snapshot/,
  );
  const stale = () => {
    throw Object.assign(new Error("stale"), { stale: true });
  };
  assert.throws(() => run(["packages/core/src/a.ts"], { snapshots: stale }), /stale/);
  assert.throws(() => snapshotParts("// nothing"), /no example/);
});

const repository = () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-plan-"));
  // A merge commits too, and a clean machine names nobody.
  const who = ["-c", "user.name=t", "-c", "user.email=t@example.invalid"];
  const git = (...args) =>
    execFileSync("git", [...who, ...args], { cwd: dir, encoding: "utf8", stdio: "pipe" }).trim();
  const write = (path, text) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (message) => {
    git("add", "-A");
    git("commit", "-qm", message);
  };
  git("init", "-qb", "main");
  write("a.txt", "one\n");
  write("examples/crm/smithable.yml", "x\n");
  commit("base");
  git("switch", "-qc", "work");
  return { dir, git, write, commit };
};

test("a change has one patch id, uncommitted with a new file or committed, at whatever merge base", () => {
  const { dir, git, write, commit } = repository();
  try {
    const id = (env) => patchId(changeEnds(env, dir), dir);
    write("a.txt", "two\n");
    write("new.txt", "new\n");
    const local = id({ GATE_BASE: "main" });
    commit("work");
    git("config", "diff.context", "9");
    git("config", "diff.noprefix", "true");
    assert.equal(id({ GATE_BASE: "main" }), local);
    // CI: the pull request's head against a main that has moved on.
    const head = git("rev-parse", "HEAD");
    git("switch", "-q", "main");
    write("other.txt", "main moved\n");
    commit("main");
    assert.equal(id({ GATE_BASE: "main", GATE_HEAD: head }), local);
    assert.match(local, /^[0-9a-f]{40}$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a branch that merged main has the same patch id locally and on the merged checkout", () => {
  const { dir, git, write, commit } = repository();
  try {
    const id = (env) => patchId(changeEnds(env, dir), dir);
    write("a.txt", "two\n");
    commit("work");
    git("switch", "-q", "main");
    write("other.txt", "main moved\n");
    commit("main");
    git("switch", "-q", "work");
    git("merge", "-q", "--no-edit", "main");
    const local = id({ GATE_BASE: "main" });
    // CI: main moves on again, and the checkout is the head merged into it.
    const head = git("rev-parse", "HEAD");
    git("switch", "-q", "main");
    write("third.txt", "again\n");
    commit("main again");
    git("switch", "-qc", "merged");
    git("merge", "-q", "--no-ff", "--no-edit", head);
    assert.equal(id({ GATE_BASE: "HEAD^1", GATE_HEAD: head }), local);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--check-snapshot stops with exit 3 until the units have passed on the files", () => {
  const { dir, write, commit } = repository();
  try {
    write(SNAPSHOT, entry("crm", "a.ts", "1"));
    commit("snapshot");
    write("packages/core/src/a.ts", "a\n");
    const script = fileURLToPath(new URL("gate-plan.mjs", import.meta.url));
    const r = spawnSync("node", [script, "--check-snapshot", TODAY], {
      cwd: dir,
      env: {
        ...process.env,
        GATE_CHANGED: "packages/core/src/a.ts",
        GATE_BASE: "work",
        GATE_HEAD: "",
        GATE_ALL_APPS: "",
        GATE_FAILED_FILE: "",
      },
      encoding: "utf8",
    });
    assert.equal(r.status, 3, r.stderr);
    assert.match(r.stderr, /units have not passed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("all-apps asks for every app whatever changed", () => {
  const script = fileURLToPath(new URL("gate-plan.mjs", import.meta.url));
  const out = execFileSync("node", [script, "apps=none studio=yes visual=no why=studio"], {
    env: { ...process.env, GATE_ALL_APPS: "1" },
    encoding: "utf8",
  });
  assert.match(out, /^apps=all studio=yes visual=no why=every app asked for/);
});

test("an example the changed tree's snapshot holds nothing of runs everything", () => {
  const line = run(["packages/core/src/a.ts"], {
    snapshots: () => {
      const head = snapshot();
      head.output.delete("kiosk");
      return { base: snapshot(), head };
    },
  });
  assert.match(line, /^apps=all studio=yes visual=yes why=every app: .*kiosk/);
});
