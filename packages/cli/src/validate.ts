import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatDiagnostic, hasErrors, validateSpec } from "@smithable/core";
import type { CliResult } from "./cli.js";

/** `smithable validate [path]`: a directory containing smithable.yml, or the file itself. */
export function validate(target: string): CliResult {
  const path = isDirectory(target) ? join(target, "smithable.yml") : target;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { code: 1, stdout: "", stderr: `No spec found at ${path}.\n` };
  }
  const { ir, diagnostics } = validateSpec({ path, text });
  const report = diagnostics.map((d) => `${formatDiagnostic(d)}\n`).join("");
  if (!ir || hasErrors(diagnostics)) {
    const errors = diagnostics.filter((d) => d.severity === "error").length;
    return {
      code: 1,
      stdout: "",
      stderr: `${report}\n${errors} ${errors === 1 ? "error" : "errors"} in ${path}.\n`,
    };
  }
  const summary = `${path} is valid: ${count(ir.models.length, "model")}, ${count(ir.pages.length, "page")}.\n`;
  return { code: 0, stdout: report + summary, stderr: "" };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
