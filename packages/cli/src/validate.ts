import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type ContentIR,
  formatDiagnostic,
  hasErrors,
  type SpecIR,
  validateContent,
  validateSpec,
} from "@smithable/core";
import type { Io } from "./io.js";

/**
 * Reads and validates the spec and, when present, smithable.content.yml next to it.
 * Prints diagnostics; returns the IR only when everything is valid.
 */
export function loadSpec(
  target: string,
  io: Io,
): { ir?: SpecIR; content?: ContentIR; path: string } {
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
  const contentPath = join(dirname(path), "smithable.content.yml");
  if (!existsSync(contentPath)) return { ir, path };
  const result = validateContent(
    { path: contentPath, text: readFileSync(contentPath, "utf8") },
    ir,
  );
  for (const d of result.diagnostics) io.err(`${formatDiagnostic(d)}\n`);
  if (!result.content) {
    io.err(`\nErrors in ${contentPath}.\n`);
    return { path };
  }
  return { ir, content: result.content, path };
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
