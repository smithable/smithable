import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { appName } from "./build.js";
import { generate } from "./generate.js";
import { discardChanges, ensureRepository, git, uncommitted, uncommittedRefusal } from "./git.js";
import type { Io } from "./io.js";

/**
 * Security levels (ARCHITECTURE §12). External tools are detected, not bundled: a tool on the
 * PATH is used as is; otherwise its pinned image runs in Docker. Findings are shown and fail
 * the check; Smithable never suppresses them (a project may still use a tool's own, visible
 * ignore file).
 */
export type Level = "fast" | "normal" | "release";

interface Tool {
  name: string;
  what: string;
  binary: string;
  image: string;
}

const TOOLS = {
  osv: {
    name: "OSV-Scanner",
    what: "Dependencies",
    binary: "osv-scanner",
    image: "ghcr.io/google/osv-scanner:v2.6.0",
  },
  gitleaks: {
    name: "Gitleaks",
    what: "Secrets",
    binary: "gitleaks",
    image: "ghcr.io/gitleaks/gitleaks:v8.30.1",
  },
  semgrep: { name: "Semgrep", what: "Code", binary: "semgrep", image: "semgrep/semgrep:1.178.0" },
  trivy: { name: "Trivy", what: "Container image", binary: "trivy", image: "aquasec/trivy:0.74.0" },
  zap: {
    name: "OWASP ZAP",
    what: "Running app",
    binary: "zap-baseline.py",
    image: "ghcr.io/zaproxy/zaproxy:2.16.1",
  },
} satisfies Record<string, Tool>;

export interface Result {
  what: string;
  /** Which tool and how it ran, e.g. "Gitleaks (image v8.30.1)". */
  by: string;
  ok: boolean;
  /** One line per finding, or why the check could not run. */
  findings: string[];
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
): { status: number | null; stdout: string; by: string } | undefined {
  if (has(tool.binary)) {
    const r = spawnSync(tool.binary, args(dir), { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28 });
    return { status: r.status, stdout: r.stdout, by: `${tool.name} (installed)` };
  }
  if (!has("docker")) return undefined;
  const r = spawnSync(
    "docker",
    ["run", "--rm", "-v", `${resolve(dir)}:/src`, ...docker, tool.image, ...args("/src")],
    { encoding: "utf8", maxBuffer: 1 << 28 },
  );
  return {
    status: r.status,
    stdout: r.stdout,
    by: `${tool.name} (image ${tool.image.split(":")[1]})`,
  };
}

const notRun = (tool: Tool): Result => ({
  what: tool.what,
  by: tool.name,
  ok: false,
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
  const report = parse<{
    results?: {
      packages?: {
        package: { name: string; version: string };
        vulnerabilities?: { id: string; summary?: string }[];
      }[];
    }[];
  }>(r.stdout);
  if (!report) return { what: TOOLS.osv.what, by: r.by, ok: false, findings: ["The scan failed."] };
  const findings = (report.results ?? []).flatMap((result) =>
    (result.packages ?? []).flatMap((p) =>
      (p.vulnerabilities ?? []).map(
        (v) => `${p.package.name}@${p.package.version}: ${v.id}${v.summary ? ` ${v.summary}` : ""}`,
      ),
    ),
  );
  return { what: TOOLS.osv.what, by: r.by, ok: findings.length === 0, findings };
}

/** Where scan reports go while they are read: ignored by Git, since they can quote secrets. */
const REPORTS = "data/.smithable/reports";

/** Secrets committed to the project's history. */
function secrets(dir: string): Result {
  // The report goes to a file: the tool's log lines share its output. It holds the secrets it
  // found, so it lives in the ignored data folder, and only until it is read.
  mkdirSync(join(dir, REPORTS), { recursive: true });
  const r = runTool(TOOLS.gitleaks, dir, (src) => [
    "git",
    src,
    "--no-banner",
    "--report-format",
    "json",
    "--report-path",
    `${src}/${REPORTS}/gitleaks.json`,
    "--exit-code",
    "0",
  ]);
  if (!r) return notRun(TOOLS.gitleaks);
  const path = join(dir, REPORTS, "gitleaks.json");
  const leaks = existsSync(path)
    ? parse<{ File: string; StartLine: number; RuleID: string }[]>(readFileSync(path, "utf8"))
    : undefined;
  rmSync(path, { force: true });
  if (!leaks)
    return { what: TOOLS.gitleaks.what, by: r.by, ok: false, findings: ["The scan failed."] };
  const findings = leaks.map((l) => `${l.File}:${l.StartLine}  ${l.RuleID}`);
  return { what: TOOLS.gitleaks.what, by: r.by, ok: findings.length === 0, findings };
}

/** Risky code patterns in the app's source, generated and custom alike. */
function code(dir: string): Result {
  const r = runTool(TOOLS.semgrep, dir, (src) => [
    "semgrep",
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
  const report = parse<{
    results?: { path: string; start: { line: number }; check_id: string }[];
    errors?: unknown[];
  }>(r.stdout);
  if (!report)
    return { what: TOOLS.semgrep.what, by: r.by, ok: false, findings: ["The scan failed."] };
  const findings = (report.results ?? []).map(
    (f) => `${f.path.replace(/^\/src\//, "")}:${f.start.line}  ${f.check_id.split(".").at(-1)}`,
  );
  return { what: TOOLS.semgrep.what, by: r.by, ok: findings.length === 0, findings };
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
  const report = parse<{
    Results?: {
      Target: string;
      Vulnerabilities?: { VulnerabilityID: string; PkgName: string; Severity: string }[];
    }[];
  }>(r.stdout);
  if (!report)
    return { what: TOOLS.trivy.what, by: r.by, ok: false, findings: ["The scan failed."] };
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
  const r = runTool(TOOLS.zap, dir, () => ["zap-baseline.py", "-t", url, "-J", "zap.json", "-I"], [
    "--network",
    "host",
    "-v",
    `${resolve(work)}:/zap/wrk:rw`,
    "--user",
    String(process.getuid?.() ?? 1000),
  ]);
  if (!r) return notRun(TOOLS.zap);
  const path = join(work, "zap.json");
  const report = existsSync(path)
    ? parse<{
        site?: {
          alerts?: { name: string; riskdesc: string; riskcode: string; pluginid: string }[];
        }[];
      }>(readFileSync(path, "utf8"))
    : undefined;
  rmSync(work, { recursive: true, force: true });
  if (!report) return { what: TOOLS.zap.what, by: r.by, ok: false, findings: ["The scan failed."] };
  // Informational alerts are not findings; low and above are. "ZAP is Out of Date" (10116)
  // is about the scanner, pinned on purpose, not about the app.
  const findings = (report.site ?? []).flatMap((s) =>
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
 * gives their name and address.
 */
export function checks(
  dir: string,
  level: Level,
  release?: { image: string; url: string },
): Result[] {
  const results = [command(dir, "Type check", ["typecheck"]), command(dir, "Tests", ["test"])];
  if (level === "fast") return results;
  results.push(dependencies(dir), secrets(dir), code(dir));
  if (level === "normal") return results;
  if (!release) throw new Error("Release checks need the built image and the running app.");
  results.push(
    command(dir, "Smoke tests", ["test:smoke"]),
    image(dir, release.image),
    running(dir, release.url),
  );
  return results;
}

export function report(io: Io, level: Level, results: Result[]): number {
  io.out(`Security check (${level}):\n`);
  for (const r of results) {
    io.out(
      `  ${r.ok ? "✓" : "✗"} ${r.what} (${r.by})${r.ok ? "" : `: ${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}`}\n`,
    );
    for (const f of r.findings.slice(0, 20)) io.out(`      ${f}\n`);
    if (r.findings.length > 20) io.out(`      … and ${r.findings.length - 20} more\n`);
  }
  const failed = results.filter((r) => !r.ok).length;
  io.out(
    failed
      ? `\n${failed} check${failed === 1 ? "" : "s"} failed. Findings are never suppressed: fix them, or record an exception in the tool's own ignore file, visible in the project.\n`
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
  if (level !== "release") return report(io, level, checks(dir, level));
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
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(`${url}/health`)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    return report(io, level, checks(dir, level, { image: name, url }));
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
  const code = report(io, "normal", checks(dir, "normal"));
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
