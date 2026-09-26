import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatDiagnostic, hasErrors, type SpecIR, validateSpec } from "@smithable/core";
import type { Io } from "./io.js";

/** Reads and validates the spec. Prints diagnostics; returns the IR only when it is valid. */
export function loadSpec(target: string, io: Io): { ir?: SpecIR; path: string } {
  const path = isDirectory(target) ? join(target, "smithable.yml") : target;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    io.err(`No spec found at ${path}.\n`);
    return { path };
  }
  const { ir, diagnostics } = validateSpec({ path, text });
  for (const d of diagnostics) io.err(`${formatDiagnostic(d)}\n`);
  if (!ir || hasErrors(diagnostics)) {
    const errors = diagnostics.filter((d) => d.severity === "error").length;
    io.err(`\n${errors} ${errors === 1 ? "error" : "errors"} in ${path}.\n`);
    return { path };
  }
  return { ir, path };
}

/** `smithable validate [path]`: a directory containing smithable.yml, or the file itself. */
export function validate(target: string, io: Io): number {
  const { ir, path } = loadSpec(target, io);
  if (!ir) return 1;
  io.out(
    `${path} is valid: ${count(ir.models.length, "model")}, ${count(ir.pages.length, "page")}.\n`,
  );
  return 0;
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
