// Opt-in error reports: what failed (the operation, its arguments, the error, the last log
// lines) and the spec files, shown in full before anything leaves, never the data, uploads or
// custom code. Hosted, the service collects them (SMITHABLE_REPORT_URL); self-hosted, they open
// a prefilled GitHub issue. "Always" or "never" is remembered for the person, not the project.
// Apart from them, a hosted workspace sends every failure's record without the person's
// content (SMITHABLE_FAILURE_URL, studio-v3.md §6): the version, the operation's name, the
// error's class, message and stack, and the trace id; never the arguments, files or records.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Io } from "./io.js";
import { VERSION } from "./version.js";

const FAILURE = join("data", ".smithable", "last-failure.json");
const SPEC_FILES = [
  "smithable.yml",
  "smithable.auth.yml",
  "smithable.content.yml",
  "smithable.ux.yml",
  "smithable.context.yml",
];
const ISSUES = "https://github.com/smithable/smithable/issues/new";

export interface Report {
  smithable: string;
  node: string;
  platform: string;
  at: string;
  operation: string;
  args: Record<string, unknown>;
  error: string;
  /** The trace id of the request that failed, when one came with it (the hosted front door). */
  trace?: string;
  log: string[];
  files: Record<string, string>;
}

export interface Failure {
  at: string;
  operation: string;
  args: Record<string, unknown>;
  error: string;
  trace?: string;
}

const TRACEPARENT = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/;

/**
 * The trace id in a request's W3C traceparent header, which the hosted service's front door sends
 * on every request: with it in a report, the service finds the request in its logs.
 */
export function traceIdOf(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  return value ? TRACEPARENT.exec(value.trim())?.[1] : undefined;
}

/**
 * Remembers what just failed, for a report. An import's problems are about its file (and quote
 * its values), and a destructive change that stops to ask has not failed: neither is kept.
 */
export function recordFailure(
  dir: string,
  operation: string,
  args: Record<string, unknown>,
  output: string,
  trace?: string,
): void {
  if (operation === "importRecords" || output.includes("Run again with")) return;
  const failure: Failure = {
    at: new Date().toISOString(),
    operation,
    args: redactArgs(args),
    error: output.trim().split("\n").slice(-40).join("\n"),
    ...(trace ? { trace } : {}),
  };
  mkdirSync(dirname(join(dir, FAILURE)), { recursive: true });
  writeFileSync(join(dir, FAILURE), `${JSON.stringify(failure, null, 2)}\n`);
  void sendFailure(failure);
}

/**
 * The failure's record without content, as the service takes it (cloud #234): its name, the
 * error's class, the message (the service takes quoted values out) and the stack lines (it keeps
 * Smithable's own frames). Nothing when not hosted; a refused or failed send is let go.
 */
export async function sendFailure(failure: Failure): Promise<boolean> {
  const target = process.env.SMITHABLE_FAILURE_URL;
  if (!target) return false;
  const lines = failure.error.split("\n");
  const stack = lines.filter((l) => /^\s+at /.test(l));
  const message =
    lines
      .filter((l) => l.trim() && !/^\s+at /.test(l))
      .at(-1)
      ?.trim() ?? "";
  const record = {
    version: VERSION.replace(/[^0-9A-Za-z.+-]/g, "").slice(0, 40),
    operation: /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(failure.operation)
      ? failure.operation
      : "unknown",
    errorClass: /\b([A-Z][A-Za-z0-9_$]*Error)\b/.exec(failure.error)?.[1] ?? "OperationFailed",
    message: message.slice(0, 500),
    stack: stack.join("\n").slice(0, 4000),
    ...(failure.trace ? { traceId: failure.trace } : {}),
  };
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", "x-smithable-failure": "1" },
      body: JSON.stringify(record),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Arguments as a report shows them: a whole file's text is only its size. */
function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) =>
      typeof value === "string" && value.length > 2000
        ? [key, `(${value.split("\n").length} lines left out)`]
        : [key, value],
    ),
  );
}

/** The report for the last failure, or undefined when nothing has failed. */
export function buildReport(dir: string, log: string[] = []): Report | undefined {
  const path = join(dir, FAILURE);
  if (!existsSync(path)) return undefined;
  const failure = JSON.parse(readFileSync(path, "utf8")) as Failure;
  const files: Record<string, string> = {};
  for (const name of SPEC_FILES)
    if (existsSync(join(dir, name))) files[name] = readFileSync(join(dir, name), "utf8");
  const themes = join(dir, "themes");
  if (existsSync(themes))
    for (const name of readdirSync(themes).filter((f) => f.endsWith(".yml")))
      files[`themes/${name}`] = readFileSync(join(themes, name), "utf8");
  // The admins' addresses are people's, not the app's: left out.
  if (files["smithable.auth.yml"])
    files["smithable.auth.yml"] = files["smithable.auth.yml"].replace(
      /[\w.+-]+@[\w-]+(\.[\w-]+)+/g,
      "(an email address)",
    );
  return {
    smithable: VERSION,
    node: process.version,
    platform: process.platform,
    ...failure,
    log: log.slice(-50),
    files,
  };
}

/** The report exactly as it would be sent. */
export function reportText(report: Report): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Sends a report: to the service when hosted, else a GitHub issue link to open (the spec files
 * do not fit in a link; the issue asks for them).
 */
export async function sendReport(
  report: Report,
): Promise<{ sent: true; message?: string } | { url: string }> {
  const target = process.env.SMITHABLE_REPORT_URL;
  if (target) {
    const response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", "x-smithable-report": "1" },
      body: JSON.stringify(report),
    });
    // The service says what happened in its own words ("Report 12 received", "too many today").
    const message = await response
      .json()
      .then((answer: unknown) => {
        const said = (answer as { message?: unknown } | null)?.message;
        return typeof said === "string" ? said : undefined;
      })
      .catch(() => undefined);
    if (!response.ok)
      throw new Error(message ?? `The report was not accepted (${response.status}).`);
    return { sent: true, message };
  }
  const body = [
    `Smithable ${report.smithable}, Node ${report.node}, ${report.platform}`,
    "",
    `Operation: ${report.operation} ${JSON.stringify(report.args)}`,
    ...(report.trace ? [`Trace: ${report.trace}`] : []),
    "",
    "```",
    report.error,
    "```",
    "",
    "Log:",
    "```",
    report.log.slice(-20).join("\n"),
    "```",
    "",
    `Spec files (please attach if you can): ${Object.keys(report.files).join(", ")}`,
  ].join("\n");
  const title = `${report.operation} failed: ${report.error.split("\n")[0]?.slice(0, 80) ?? ""}`;
  const url = `${ISSUES}?${new URLSearchParams({ title, body: body.slice(0, 6000) })}`;
  return { url };
}

const settingsPath = () =>
  join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "smithable", "reports.json");

/** Whether this person always or never sends reports; undefined until they choose. */
export function reportChoice(): "always" | "never" | undefined {
  try {
    const choice = JSON.parse(readFileSync(settingsPath(), "utf8")).choice;
    return choice === "always" || choice === "never" ? choice : undefined;
  } catch {
    return undefined;
  }
}

export function setReportChoice(choice: "always" | "never" | "ask"): void {
  mkdirSync(dirname(settingsPath()), { recursive: true });
  writeFileSync(settingsPath(), `${JSON.stringify({ choice })}\n`);
}

/** After a failure: sent at once for "always", else a line on how to see and send it. */
export async function afterFailure(dir: string, io: Io, log: string[] = []): Promise<void> {
  const choice = reportChoice();
  if (choice === "never") return;
  const report = buildReport(dir, log);
  if (!report) return;
  if (choice === "always") {
    try {
      const result = await sendReport(report);
      io.err(
        "sent" in result
          ? "A report of this was sent (smithable report shows what).\n"
          : `To report this: ${result.url}\n`,
      );
    } catch (error) {
      io.err(`The report could not be sent: ${(error as Error).message}\n`);
    }
    return;
  }
  io.err("To report this, run `smithable report`: it shows exactly what it would send first.\n");
}

/**
 * `smithable report [--send] [--always | --never | --ask]`: shows the report of the last failure;
 * --send sends it; --always and --never are remembered, --ask forgets the choice.
 */
export async function report(
  dir: string,
  io: Io,
  flags: { send?: boolean; always?: boolean; never?: boolean; ask?: boolean },
): Promise<number> {
  if (flags.never || flags.always || flags.ask) {
    setReportChoice(flags.never ? "never" : flags.always ? "always" : "ask");
    io.out(
      flags.never
        ? "Reports will not be offered.\n"
        : flags.always
          ? "Reports will be sent when something fails, without asking.\n"
          : "You will be asked before each report.\n",
    );
    if (!flags.send && !flags.always) return 0;
  }
  const built = buildReport(dir);
  if (!built) {
    io.out("Nothing has failed in this project, so there is nothing to report.\n");
    return 0;
  }
  if (!flags.send && !flags.always) {
    io.out(
      `${reportText(built)}\n\nThis is everything a report sends: no records, uploads or custom code. Send it with \`smithable report --send\`.\n`,
    );
    return 0;
  }
  try {
    const result = await sendReport(built);
    io.out(
      "sent" in result
        ? `${result.message ?? "Sent. Thank you."}\n`
        : `Open this to file it on GitHub:\n${result.url}\n`,
    );
    return 0;
  } catch (error) {
    io.err(`${(error as Error).message}\n`);
    return 1;
  }
}
