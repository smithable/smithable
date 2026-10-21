// The scanners' answers (security.ts): a check that could not run to its end is never a pass,
// whatever its report says, and a report from an earlier run is never read as this one's.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  commandLine,
  freshReport,
  type Ran,
  readGitleaks,
  readOsv,
  readSemgrep,
  readTrivy,
  readZap,
  report,
  TOOLS,
} from "./security.js";
import { tempDir } from "./test-dir.js";

const ran = (status: number | null, stdout = "", stderr = ""): Ran => ({
  status,
  stdout,
  stderr,
  by: "test",
});

describe("Semgrep", () => {
  test("a clean scan passes; findings fail with where they are", () => {
    expect(readSemgrep(ran(0, '{"results":[],"errors":[]}'))).toMatchObject({
      ok: true,
      findings: [],
    });
    const found = readSemgrep(
      ran(
        0,
        '{"results":[{"path":"/src/src/a.ts","start":{"line":3},"check_id":"x.y.eval"}],"errors":[]}',
      ),
    );
    expect(found).toMatchObject({ ok: false, findings: ["src/a.ts:3  eval"] });
    expect(found.checked).toBeUndefined();
  });
  test("a failed scan is not checked: an error status, errors with status 0, bad or no JSON", () => {
    for (const r of [
      ran(
        2,
        '{"results":[],"errors":[{"message":"scan configuration failed"}]}',
        "rules could not be fetched",
      ),
      ran(0, '{"results":[],"errors":[{"message":"scan configuration failed","level":"error"}]}'),
      ran(0, "{not json"),
      ran(0, ""),
      ran(0, '{"errors":[]}'),
      ran(null, ""),
    ])
      expect(readSemgrep(r)).toMatchObject({ ok: false, checked: false });
    expect(readSemgrep(ran(2, "{}", "rules could not be fetched")).findings).toContain(
      "rules could not be fetched",
    );
  });
  test("a file it could only partly read is said beside a pass", () => {
    const r = readSemgrep(
      ran(0, '{"results":[],"errors":[{"level":"warn","message":"Syntax error in a.ts"}]}'),
    );
    expect(r).toMatchObject({ ok: true, notes: ["Partly read: Syntax error in a.ts"] });
  });
});

describe("the other scanners", () => {
  test("OSV-Scanner: 0 clean, 1 with vulnerabilities, anything else or no report not checked", () => {
    expect(readOsv(ran(0, '{"results":[]}'))).toMatchObject({ ok: true });
    expect(
      readOsv(
        ran(
          1,
          '{"results":[{"packages":[{"package":{"name":"a","version":"1.0.0"},"vulnerabilities":[{"id":"GHSA-1"}]}]}]}',
        ),
      ),
    ).toMatchObject({ ok: false, findings: ["a@1.0.0: GHSA-1"] });
    for (const r of [ran(127, ""), ran(0, "{}"), ran(0, "oops"), ran(1, "")])
      expect(readOsv(r)).toMatchObject({ ok: false, checked: false });
  });
  test("Gitleaks: its report file, read once; none or a failed run is not checked", () => {
    expect(readGitleaks(ran(0), "[]")).toMatchObject({ ok: true });
    expect(
      readGitleaks(ran(0), '[{"File":"a.env","StartLine":2,"RuleID":"generic-api-key"}]'),
    ).toMatchObject({
      ok: false,
      findings: ["a.env:2  generic-api-key"],
    });
    for (const [r, text] of [
      [ran(0), undefined],
      [ran(1), "[]"],
      [ran(0), "{}"],
      [ran(0), "{bad"],
    ] as const)
      expect(readGitleaks(r, text)).toMatchObject({ ok: false, checked: false });
  });
  test("Trivy: a report with no vulnerabilities passes; an error status or no report is not checked", () => {
    expect(readTrivy(ran(0, '{"Results":[]}'))).toMatchObject({ ok: true });
    expect(
      readTrivy(
        ran(
          0,
          '{"Results":[{"Target":"t","Vulnerabilities":[{"VulnerabilityID":"CVE-1","PkgName":"p","Severity":"HIGH"}]}]}',
        ),
      ),
    ).toMatchObject({ ok: false, findings: ["HIGH CVE-1 in p (t)"] });
    for (const r of [ran(1, '{"Results":[]}'), ran(0, ""), ran(0, "[]")])
      expect(readTrivy(r)).toMatchObject({ ok: false, checked: false });
  });
  test("ZAP: 0, 1 and 2 are finished scans; 3 or no report is not checked", () => {
    const site =
      '{"site":[{"alerts":[{"name":"X-Frame","riskdesc":"Medium (High)","riskcode":"2","pluginid":"1"},{"name":"info","riskdesc":"Informational","riskcode":"0","pluginid":"2"}]}]}';
    expect(readZap(ran(2), site)).toMatchObject({
      ok: false,
      findings: ["Medium (High): X-Frame"],
    });
    expect(readZap(ran(0), '{"site":[]}')).toMatchObject({ ok: true });
    for (const [r, text] of [
      [ran(3), '{"site":[]}'],
      [ran(0), undefined],
      [ran(0), "{}"],
    ] as const)
      expect(readZap(r, text)).toMatchObject({ ok: false, checked: false });
  });
});

test("a report left by an earlier run is removed first, never read as this run's", () => {
  const path = join(tempDir("report-"), "gitleaks.json");
  writeFileSync(path, "[]");
  // This run wrote nothing: there is no report, so nothing passes.
  const { text } = freshReport(path, () => ran(0));
  expect(text).toBeUndefined();
  expect(readGitleaks(ran(0), text)).toMatchObject({ ok: false, checked: false });
});

test("an installed tool is called once by name; its image gets the command it needs", () => {
  const args = (src: string) => ["scan", `${src}/src`];
  expect(commandLine(TOOLS.semgrep, true, "/app", args)).toEqual(["semgrep", "scan", "/app/src"]);
  expect(commandLine(TOOLS.semgrep, false, "/app", args).slice(-4)).toEqual([
    "semgrep/semgrep:1.178.0",
    "semgrep",
    "scan",
    "/src/src",
  ]);
  const zap = () => ["-t", "http://localhost:3000"];
  expect(commandLine(TOOLS.zap, true, "/app", zap)).toEqual([
    "zap-baseline.py",
    "-t",
    "http://localhost:3000",
  ]);
  expect(commandLine(TOOLS.zap, false, "/app", zap, ["--network", "host"]).slice(-5)).toEqual([
    "host",
    "ghcr.io/zaproxy/zaproxy:2.16.1",
    "zap-baseline.py",
    "-t",
    "http://localhost:3000",
  ]);
});

test("the report says which checks could not check, and fails for them", () => {
  let out = "";
  const code = report(
    {
      out: (s: string) => {
        out += s;
      },
      err: () => {},
    } as never,
    "normal",
    [
      {
        what: "Code",
        by: "Semgrep",
        ok: false,
        checked: false,
        findings: ["Semgrep stopped with exit status 2, so this was not checked."],
      },
      { what: "Secrets", by: "Gitleaks", ok: true, findings: [] },
    ],
  );
  expect(code).toBe(1);
  expect(out).toContain("✗ Code (Semgrep): could not check");
  expect(out).toContain("1 check failed, 1 of them because it could not check");
});
