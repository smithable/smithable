import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { STACK_PROFILE } from "@smithable/adapter-tanstack";
import {
  advisoriesCacheDir,
  affected,
  lockedVersions,
  type Read,
  readAdvisories,
} from "./advisories.js";
import { appName } from "./build.js";
import { generate } from "./generate.js";
import { discardChanges, ensureRepository, git, uncommitted, uncommittedRefusal } from "./git.js";
import { hostedLevel, levelLine } from "./hosted-level.js";
import type { Io } from "./io.js";
import { loadSpec } from "./validate.js";

/**
 * Security levels (ARCHITECTURE §12). External tools are detected, not bundled: a tool on the
 * PATH is used as is; otherwise its pinned image runs in Docker. Findings are shown and fail
 * the check; Smithable never suppresses them (a project may still use a tool's own, visible
 * ignore file).
 */
export type Level = "fast" | "normal" | "release";

export interface Tool {
  name: string;
  what: string;
  binary: string;
  image: string;
  /** The command the image runs before the arguments, when it has no entrypoint of its own. */
  command?: string[];
  /** The exit statuses of a scan that ran to its end: anything else means it could not check. */
  done: number[];
}

export const TOOLS = {
  osv: {
    name: "OSV-Scanner",
    what: "Dependencies",
    binary: "osv-scanner",
    image: "ghcr.io/google/osv-scanner:v2.6.0",
    // 1: vulnerabilities found.
    done: [0, 1],
  },
  gitleaks: {
    name: "Gitleaks",
    what: "Secrets",
    binary: "gitleaks",
    image: "ghcr.io/gitleaks/gitleaks:v8.30.1",
    // Run with --exit-code 0: leaks are read from the report.
    done: [0],
  },
  semgrep: {
    name: "Semgrep",
    what: "Code",
    binary: "semgrep",
    image: "semgrep/semgrep:1.178.0",
    command: ["semgrep"],
    // 1: findings (only with --error); 2 and up: the scan failed.
    done: [0, 1],
  },
  trivy: {
    name: "Trivy",
    what: "Container image",
    binary: "trivy",
    image: "aquasec/trivy:0.74.0",
    done: [0],
  },
  zap: {
    name: "OWASP ZAP",
    what: "Running app",
    binary: "zap-baseline.py",
    image: "ghcr.io/zaproxy/zaproxy:2.16.1",
    command: ["zap-baseline.py"],
    // 1: failing alerts, 2: warnings; 3: the scan failed.
    done: [0, 1, 2],
  },
} satisfies Record<string, Tool>;

export interface Result {
  what: string;
  /** Which tool and how it ran, e.g. "Gitleaks (image v8.30.1)". */
  by: string;
  ok: boolean;
  /** One line per finding, or why the check could not run. */
  findings: string[];
  /** False when the check could not run to its end: no findings then means nothing, and it fails. */
  checked?: false;
  /** Said at every run though nothing fails for it: an advisory accepted, with why. */
  notes?: string[];
}

const has = (command: string) =>
  spawnSync("sh", ["-c", `command -v ${command}`], { encoding: "utf8" }).status === 0;

/**
 * Runs a tool on the project, mounted at /src when it runs in Docker. `args` get the project
 * path ("/src" or the directory itself).
 */
function runTool(
  tool: Tool,
  dir: string,
  args: (src: string) => string[],
  docker: string[] = [],
): Ran | undefined {
  const installed = has(tool.binary);
  if (!installed && !has("docker")) return undefined;
  const [command, ...rest] = commandLine(tool, installed, dir, args, docker);
  const r = spawnSync(command as string, rest, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28 });
  return {
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr ?? "",
    by: installed ? `${tool.name} (installed)` : `${tool.name} (image ${tool.image.split(":")[1]})`,
  };
}

/** The command that runs a tool: the installed one as it is, or its image with the project at /src. */
export function commandLine(
  tool: Tool,
  installed: boolean,
  dir: string,
  args: (src: string) => string[],
  docker: string[] = [],
): string[] {
  return installed
    ? [tool.binary, ...args(dir)]
    : [
        "docker",
        "run",
        "--rm",
        "-v",
        `${resolve(dir)}:/src`,
        ...docker,
        tool.image,
        ...(tool.command ?? []),
        ...args("/src"),
      ];
}

/** How a tool ran: its exit status, its output and what it said on the side. */
export interface Ran {
  status: number | null;
  stdout: string;
  stderr: string;
  by: string;
}

/** A check that could not run to its end: why, with the tool's last words. */
function notChecked(tool: Tool, ran: Ran, why: string): Result {
  const said = ran.stderr.trim().split("\n").filter(Boolean).slice(-3);
  return { what: tool.what, by: ran.by, ok: false, checked: false, findings: [why, ...said] };
}

/** Whether the tool ran to its end: an exit status it gives for a finished scan. */
const finished = (tool: Tool, ran: Ran) =>
  ran.status !== null && tool.done.includes(ran.status)
    ? undefined
    : notChecked(
        tool,
        ran,
        `${tool.name} stopped with exit status ${ran.status ?? "none"}, so this was not checked.`,
      );

/** A report file written by this run only: an old one is removed first, and read and removed after. */
export function freshReport(
  path: string,
  run: () => Ran | undefined,
): { ran?: Ran; text?: string } {
  rmSync(path, { force: true });
  const ran = run();
  const text = existsSync(path) ? readFileSync(path, "utf8") : undefined;
  rmSync(path, { force: true });
  return { ran, text };
}

const notRun = (tool: Tool): Result => ({
  what: tool.what,
  by: tool.name,
  ok: false,
  checked: false,
  findings: [`${tool.name} is not installed and Docker is not available, so this was not checked.`],
});

function parse<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** Known vulnerabilities in the locked dependencies. */
function dependencies(dir: string): Result {
  const r = runTool(TOOLS.osv, dir, (src) => [
    "scan",
    "source",
    "--lockfile",
    `${src}/pnpm-lock.yaml`,
    "--format",
    "json",
  ]);
  if (!r) return notRun(TOOLS.osv);
  return readOsv(r);
}

/** OSV-Scanner's answer: the vulnerabilities, or that it could not check. */
export function readOsv(r: Ran): Result {
  const stopped = finished(TOOLS.osv, r);
  if (stopped) return stopped;
  const report = parse<{
    results?: {
      packages?: {
        package: { name: string; version: string };
        vulnerabilities?: { id: string; summary?: string }[];
      }[];
    }[];
  }>(r.stdout);
  if (!report?.results)
    return notChecked(TOOLS.osv, r, "OSV-Scanner gave no report, so this was not checked.");
  const findings = report.results.flatMap((result) =>
    (result.packages ?? []).flatMap((p) =>
      (p.vulnerabilities ?? []).map(
        (v) => `${p.package.name}@${p.package.version}: ${v.id}${v.summary ? ` ${v.summary}` : ""}`,
      ),
    ),
  );
  return { what: TOOLS.osv.what, by: r.by, ok: findings.length === 0, findings };
}

/** What was read from the packages' advisory lists, kept an hour: GitHub answers sixty calls an hour without a token. */
const ADVISORIES = "data/.smithable/advisories.json";

/**
 * Holes the packages' own repositories have published (advisories.ts), which the databases list
 * days later: the lists of what package.json names, against every installed version.
 */
export async function published(
  dir: string,
  read: typeof readAdvisories = readAdvisories,
  accepted: Record<string, string> = STACK_PROFILE.advisories,
): Promise<Result> {
  const result = { what: "Dependencies, at their source", by: "the packages' advisory lists" };
  const manifest = parse<Record<"dependencies" | "devDependencies", Record<string, string>>>(
    readFileSync(join(dir, "package.json"), "utf8"),
  );
  const named = { ...manifest?.dependencies, ...manifest?.devDependencies };
  const lock = join(dir, "pnpm-lock.yaml");
  const versions = lockedVersions(existsSync(lock) ? readFileSync(lock, "utf8") : "");
  // Not installed yet: package.json's own versions (Smithable pins them exactly).
  for (const [name, version] of Object.entries(named))
    if (!versions.has(name) && /^\d/.test(version)) versions.set(name, [version]);
  const packages = Object.fromEntries(
    Object.keys(named).flatMap((name) => {
      const version = versions.get(name)?.[0];
      return version ? [[name, version]] : [];
    }),
  );
  const key = JSON.stringify(packages);
  const file = join(dir, ADVISORIES);
  const kept = existsSync(file)
    ? parse<{ at: number; key: string; read: Read }>(readFileSync(file, "utf8"))
    : undefined;
  const fresh = kept && kept.key === key && Date.now() - kept.at < 3_600_000;
  const lists = fresh
    ? kept.read
    : await read(packages, {
        token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
        cacheDir: advisoriesCacheDir(),
      });
  if (!fresh && !lists.unread.length) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ at: Date.now(), key, read: lists }));
  }
  const findings = affected(
    versions,
    lists.advisories.filter((a) => !(a.id in accepted)),
  );
  if (lists.unread.length) {
    // Said as what happened and what to do: a newcomer's first deploy met this with "fix the
    // findings" and nothing to fix (the stranger walk, 2026-10-07).
    const at = lists.limitedUntil
      ? new Date(lists.limitedUntil).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined;
    findings.push(
      at
        ? `GitHub allowed no more reads from this machine this hour, so the advisory lists of ${lists.unread.join(", ")} were not read and the check cannot pass. Set GITHUB_TOKEN to any GitHub token (no permissions needed), or run again after ${at}.`
        : `The advisory lists of ${lists.unread.join(", ")} could not be read (no network?), so the check cannot pass. With a network, set GITHUB_TOKEN to any GitHub token in case GitHub's hourly limit is the cause.`,
    );
  }
  // Shown at every run, never hidden: what was looked at and found not to reach the app.
  const notes = lists.advisories
    .filter((a) => a.id in accepted)
    .flatMap((a) =>
      affected(versions, [a]).map(
        (line) => `Accepted, since ${accepted[a.id]}: ${line.split(";")[0]}`,
      ),
    );
  return {
    ...result,
    ok: findings.length === 0,
    findings,
    notes,
    ...(lists.unread.length ? { checked: false as const } : {}),
  };
}

/** Where scan reports go while they are read: ignored by Git, since they can quote secrets. */
const REPORTS = "data/.smithable/reports";

/** Secrets committed to the project's history. */
function secrets(dir: string): Result {
  // The report goes to a file: the tool's log lines share its output. It holds the secrets it
  // found, so it lives in the ignored data folder, and only until it is read.
  mkdirSync(join(dir, REPORTS), { recursive: true });
  const { ran, text } = freshReport(join(dir, REPORTS, "gitleaks.json"), () =>
    runTool(TOOLS.gitleaks, dir, (src) => [
      "git",
      src,
      "--no-banner",
      "--report-format",
      "json",
      "--report-path",
      `${src}/${REPORTS}/gitleaks.json`,
      "--exit-code",
      "0",
    ]),
  );
  if (!ran) return notRun(TOOLS.gitleaks);
  return readGitleaks(ran, text);
}

/** Gitleaks's report (written to a file, read once): the leaks, or that it could not check. */
export function readGitleaks(r: Ran, text: string | undefined): Result {
  const stopped = finished(TOOLS.gitleaks, r);
  if (stopped) return stopped;
  const leaks =
    text === undefined
      ? undefined
      : parse<{ File: string; StartLine: number; RuleID: string }[]>(text);
  if (!Array.isArray(leaks))
    return notChecked(TOOLS.gitleaks, r, "Gitleaks wrote no report, so this was not checked.");
  const findings = leaks.map((l) => `${l.File}:${l.StartLine}  ${l.RuleID}`);
  return { what: TOOLS.gitleaks.what, by: r.by, ok: findings.length === 0, findings };
}

/** Risky code patterns in the app's source, generated and custom alike. */
function code(dir: string): Result {
  const r = runTool(TOOLS.semgrep, dir, (src) => [
    "scan",
    "--config",
    "p/typescript",
    "--config",
    "p/react",
    "--metrics",
    "off",
    "--json",
    "--quiet",
    "--exclude",
    "node_modules",
    "--exclude",
    "dist",
    `${src}/src`,
  ]);
  if (!r) return notRun(TOOLS.semgrep);
  return readSemgrep(r);
}

/**
 * Semgrep's answer: the findings, or that it could not check. An error it reports (a rule set
 * not fetched, a configuration it could not read) means the scan is not whole, whatever its exit
 * status; a file it could only partly read is a warning, said beside the result.
 */
export function readSemgrep(r: Ran): Result {
  const stopped = finished(TOOLS.semgrep, r);
  if (stopped) return stopped;
  const report = parse<{
    results?: { path: string; start: { line: number }; check_id: string }[];
    errors?: { level?: string; message?: string; type?: unknown }[];
  }>(r.stdout);
  if (!report?.results)
    return notChecked(TOOLS.semgrep, r, "Semgrep gave no report, so this was not checked.");
  const errors = report.errors ?? [];
  const serious = errors.filter((e) => e?.level !== "warn");
  if (serious.length)
    return notChecked(
      TOOLS.semgrep,
      r,
      `Semgrep could not scan everything (${String(serious[0]?.message ?? serious[0]?.type ?? "an error").split("\n")[0]}), so this was not checked.`,
    );
  const findings = report.results.map(
    (f) => `${f.path.replace(/^\/src\//, "")}:${f.start.line}  ${f.check_id.split(".").at(-1)}`,
  );
  const warnings = errors.map((e) => `Partly read: ${String(e.message ?? "").split("\n")[0]}`);
  return {
    what: TOOLS.semgrep.what,
    by: r.by,
    ok: findings.length === 0,
    findings,
    ...(warnings.length ? { notes: warnings } : {}),
  };
}

/** High and critical vulnerabilities in the built image. */
function image(dir: string, name: string): Result {
  const r = runTool(
    TOOLS.trivy,
    dir,
    () => ["image", "--quiet", "--format", "json", "--severity", "HIGH,CRITICAL", name],
    [
      "-v",
      "/var/run/docker.sock:/var/run/docker.sock",
      "-v",
      "smithable-trivy-cache:/root/.cache/",
    ],
  );
  if (!r) return notRun(TOOLS.trivy);
  return readTrivy(r);
}

/** Trivy's answer: the vulnerabilities, or that it could not check. */
export function readTrivy(r: Ran): Result {
  const stopped = finished(TOOLS.trivy, r);
  if (stopped) return stopped;
  const report = parse<{
    Results?: {
      Target: string;
      Vulnerabilities?: { VulnerabilityID: string; PkgName: string; Severity: string }[];
    }[];
  }>(r.stdout);
  if (!report || typeof report !== "object" || Array.isArray(report))
    return notChecked(TOOLS.trivy, r, "Trivy gave no report, so this was not checked.");
  const findings = (report.Results ?? []).flatMap((t) =>
    (t.Vulnerabilities ?? []).map(
      (v) => `${v.Severity} ${v.VulnerabilityID} in ${v.PkgName} (${t.Target})`,
    ),
  );
  return { what: TOOLS.trivy.what, by: r.by, ok: findings.length === 0, findings };
}

/** The running app, probed passively for common web weaknesses (ZAP's baseline scan). */
function running(dir: string, url: string): Result {
  // ZAP writes only into a folder of its own, as this user rather than root.
  const work = join(dir, REPORTS, "zap");
  mkdirSync(work, { recursive: true });
  const { ran, text } = freshReport(join(work, "zap.json"), () =>
    runTool(TOOLS.zap, dir, () => ["-t", url, "-J", "zap.json", "-I"], [
      "--network",
      "host",
      "-v",
      `${resolve(work)}:/zap/wrk:rw`,
      "--user",
      String(process.getuid?.() ?? 1000),
    ]),
  );
  rmSync(work, { recursive: true, force: true });
  if (!ran) return notRun(TOOLS.zap);
  return readZap(ran, text);
}

/** ZAP's report: alerts of low risk and above, or that it could not check. */
export function readZap(r: Ran, text: string | undefined): Result {
  const stopped = finished(TOOLS.zap, r);
  if (stopped) return stopped;
  const report =
    text === undefined
      ? undefined
      : parse<{
          site?: {
            alerts?: { name: string; riskdesc: string; riskcode: string; pluginid: string }[];
          }[];
        }>(text);
  if (!report?.site)
    return notChecked(TOOLS.zap, r, "ZAP wrote no report, so this was not checked.");
  // Informational alerts are not findings; low and above are. "ZAP is Out of Date" (10116)
  // is about the scanner, pinned on purpose, not about the app.
  const findings = report.site.flatMap((s) =>
    (s.alerts ?? [])
      .filter((a) => Number(a.riskcode) >= 1 && a.pluginid !== "10116")
      .map((a) => `${a.riskdesc}: ${a.name}`),
  );
  return { what: TOOLS.zap.what, by: r.by, ok: findings.length === 0, findings };
}

/** Runs a check that is a project command, e.g. the type check. */
function command(dir: string, what: string, args: string[]): Result {
  const r = spawnSync("pnpm", args, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28 });
  const output = `${r.stdout}${r.stderr}`.trim().split("\n").slice(-8);
  return {
    what,
    by: `pnpm ${args.join(" ")}`,
    ok: r.status === 0,
    findings: r.status === 0 ? [] : output,
  };
}

/**
 * The checks of a level. Release also needs the built image and the app running: `release`
 * gives their name and address. `say` hears each check's name as it starts (they take
 * minutes together, and the report comes at the end).
 */
export async function checks(
  dir: string,
  level: Level,
  release?: { image: string; url: string },
  say: (what: string) => void = () => {},
): Promise<Result[]> {
  const run = <T>(what: string, check: () => T) => {
    say(what);
    return check();
  };
  const results = [
    run("Type check", () => command(dir, "Type check", ["typecheck"])),
    run("Tests", () => command(dir, "Tests", ["test"])),
  ];
  if (level === "fast") return results;
  results.push(
    run("Dependencies", () => dependencies(dir)),
    await run("Dependencies, at their source", () => published(dir)),
    run("Secrets", () => secrets(dir)),
    run("Code", () => code(dir)),
  );
  if (level === "normal") return results;
  if (!release) throw new Error("Release checks need the built image and the running app.");
  results.push(
    run("Smoke tests", () => command(dir, "Smoke tests", ["test:smoke"])),
    run("Container image", () => image(dir, release.image)),
    run("Running app", () => running(dir, release.url)),
  );
  return results;
}

export function report(io: Io, level: Level, results: Result[]): number {
  io.out(`Security check (${level}):\n`);
  for (const r of results) {
    io.out(
      `  ${r.ok ? "✓" : "✗"} ${r.what} (${r.by})${r.ok ? "" : r.checked === false ? ": could not check" : `: ${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}`}\n`,
    );
    for (const f of r.findings.slice(0, 20)) io.out(`      ${f}\n`);
    if (r.findings.length > 20) io.out(`      … and ${r.findings.length - 20} more\n`);
    for (const note of r.notes ?? []) io.out(`      ${note}\n`);
  }
  const failed = results.filter((r) => !r.ok).length;
  const unchecked = results.filter((r) => r.checked === false).length;
  io.out(
    failed
      ? `\n${failed} check${failed === 1 ? "" : "s"} failed${unchecked ? `, ${unchecked} of them because ${unchecked === 1 ? "it" : "they"} could not check: a check that did not run is never a pass` : ""}. Findings are never suppressed: fix them, or record an exception in the tool's own ignore file, visible in the project.\n`
      : "\nAll checks passed.\n",
  );
  return failed ? 1 : 0;
}

/**
 * `smithable security [dir] --level fast|normal|release`. Release builds the image and runs
 * it on a free port with a throwaway data volume while the image and the running app are
 * scanned.
 */
export async function security(dir: string, io: Io, level: Level): Promise<number> {
  if (level !== "release") return report(io, level, await checks(dir, level));
  const name = appName(dir);
  const docker = (args: string[]) => spawnSync("docker", args, { cwd: dir, encoding: "utf8" });
  if (!has("docker")) {
    io.err("Release checks build and run the app's image: they need Docker.\n");
    return 1;
  }
  io.out(`Building the image ${name}…\n`);
  const built = docker(["build", "-q", "-t", name, "."]);
  if (built.status !== 0) {
    io.err(`${built.stdout}${built.stderr}\nThe image did not build.\n`);
    return 1;
  }
  const port = 4600 + (process.pid % 300);
  const container = `${name}-security-${process.pid}`;
  const started = docker([
    "run",
    "-d",
    "--rm",
    "--name",
    container,
    "-p",
    `${port}:3000`,
    "-e",
    `BETTER_AUTH_SECRET=${crypto.randomUUID()}${crypto.randomUUID()}`,
    "-e",
    `BETTER_AUTH_URL=http://localhost:${port}`,
    name,
  ]);
  if (started.status !== 0) {
    io.err(`${started.stderr}\nThe image did not start.\n`);
    return 1;
  }
  try {
    const url = `http://localhost:${port}`;
    // On the hosted service, the project's level and what the app connects to outside itself.
    const hosted = hostedLevel();
    const spec = hosted ? loadSpec(dir, { ...io, err: () => {} }) : undefined;
    if (hosted && spec?.ir && spec.auth) io.out(`${levelLine(hosted, spec.ir, spec.auth)}\n`);
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(`${url}/health`)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    return report(
      io,
      level,
      await checks(dir, level, { image: name, url }, (what) => io.out(`  ${what}…\n`)),
    );
  } finally {
    docker(["rm", "-f", container]);
  }
}

/**
 * `smithable update --security [dir]`: brings in this Smithable's security fixes (the stack
 * profile's overrides and versions), reinstalls, and keeps them only when the type check,
 * the tests and the normal security checks pass. One commit, undoable.
 */
export async function updateSecurity(dir: string, io: Io): Promise<number> {
  ensureRepository(dir);
  const refused = uncommittedRefusal(dir, "so the update can be undone on its own");
  if (refused) {
    io.err(refused);
    return 1;
  }
  if ((await generate(dir, io, { tools: true, force: false })) !== 0) {
    discardChanges(dir);
    return 1;
  }
  const code = report(io, "normal", await checks(dir, "normal"));
  if (code !== 0) {
    discardChanges(dir);
    io.err("The update was undone: fix the findings above, or update the dependency by hand.\n");
    return 1;
  }
  if (uncommitted(dir).length === 0) {
    io.out("Already up to date.\n");
    return 0;
  }
  git(dir, ["add", "-A"]);
  git(dir, [
    "commit",
    "-q",
    "-m",
    "smithable: Apply security updates\n\nSmithable-Update: security\n",
  ]);
  io.out("Applied the security updates. Undo with: smithable undo\n");
  return 0;
}
