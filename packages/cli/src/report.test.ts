import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import {
  buildReport,
  recordFailure,
  reportChoice,
  sendReport,
  setReportChoice,
  traceIdOf,
} from "./report.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "report-"));
  process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "report-config-"));
  delete process.env.SMITHABLE_REPORT_URL;
  writeFileSync(join(dir, "smithable.yml"), "smithable: 0.1\napp: { name: CRM }\n");
  writeFileSync(join(dir, "smithable.auth.yml"), "smithableAuth: 0.1\nadmins: [owner@acme.com]\n");
  // What a report never holds: records, uploads, custom code.
  mkdirSync(join(dir, "samples"));
  writeFileSync(join(dir, "samples", "Customer.yml"), "- { name: Secret AB }\n");
  mkdirSync(join(dir, "src", "custom"), { recursive: true });
  writeFileSync(join(dir, "src", "custom", "hook.ts"), "export const secret = 1;\n");
});

test("a report: the failure, the log tail and the spec files; never data, people's addresses or custom code", () => {
  expect(buildReport(dir)).toBeUndefined();
  recordFailure(
    dir,
    "addField",
    { model: "Customer", field: "x", type: "nope" },
    "Unknown type nope.\n",
  );
  const report = buildReport(
    dir,
    Array.from({ length: 80 }, (_, i) => `line ${i}`),
  );
  expect(report?.operation).toBe("addField");
  expect(report?.error).toBe("Unknown type nope.");
  expect(report?.log).toHaveLength(50);
  expect(Object.keys(report?.files ?? {})).toEqual(["smithable.yml", "smithable.auth.yml"]);
  expect(report?.files["smithable.auth.yml"]).toContain("admins: [(an email address)]");
  expect(JSON.stringify(report)).not.toMatch(/Secret AB|secret = 1|owner@acme/);
});

test("a whole file's text is its size; an import's problems and a question to confirm are no failures", () => {
  recordFailure(dir, "editSpec", { text: "x\n".repeat(3000) }, "Broken.");
  expect(buildReport(dir)?.args).toEqual({ text: "(3001 lines left out)" });
  recordFailure(dir, "importRecords", { model: "Customer" }, '"lots" is not an amount');
  recordFailure(dir, "removeField", {}, "Run again with --yes to apply it.");
  expect(buildReport(dir)?.operation).toBe("editSpec");
});

test("self-hosted, a prefilled GitHub issue; the choice is remembered for the person", async () => {
  recordFailure(dir, "addPage", { page: "x" }, "Regenerating the app failed.");
  const report = buildReport(dir);
  if (!report) throw new Error("no report");
  const sent = await sendReport(report);
  expect("url" in sent && sent.url).toMatch(
    /^https:\/\/github\.com\/smithable\/smithable\/issues\/new\?title=addPage\+failed/,
  );
  expect(reportChoice()).toBeUndefined();
  setReportChoice("never");
  expect(reportChoice()).toBe("never");
  setReportChoice("ask");
  expect(reportChoice()).toBeUndefined();
});

test("hosted, the service's own words: its thanks, or why it refused", async () => {
  recordFailure(dir, "addPage", { page: "x" }, "Regenerating the app failed.");
  const report = buildReport(dir);
  if (!report) throw new Error("no report");
  const { createServer } = await import("node:http");
  let status = 201;
  const server = createServer((_req, res) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        message: status === 201 ? "Report 7 received. Thank you." : "Too many reports today.",
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  process.env.SMITHABLE_REPORT_URL = `http://localhost:${port}/reports/1`;
  try {
    expect(await sendReport(report)).toEqual({
      sent: true,
      message: "Report 7 received. Thank you.",
    });
    status = 429;
    await expect(sendReport(report)).rejects.toThrow("Too many reports today.");
  } finally {
    server.close();
  }
});

test("a report carries the trace id of the request that failed, from its traceparent", () => {
  expect(traceIdOf("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")).toBe(
    "4bf92f3577b34da6a3ce929d0e0e4736",
  );
  expect(traceIdOf(undefined)).toBeUndefined();
  expect(traceIdOf("not a traceparent")).toBeUndefined();
  const dir = mkdtempSync(join(tmpdir(), "report-trace-"));
  recordFailure(
    dir,
    "addField",
    { model: "Customer" },
    "It failed.",
    "4bf92f3577b34da6a3ce929d0e0e4736",
  );
  expect(buildReport(dir)?.trace).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  recordFailure(dir, "addField", { model: "Customer" }, "It failed again.");
  expect(buildReport(dir)?.trace).toBeUndefined();
});
