import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  type AuthIR,
  type ContentIR,
  type Diagnostic,
  formatDiagnostic,
  hasErrors,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import type { Io } from "./io.js";

/**
 * Reads and validates the spec with its companions: smithable.auth.yml (required) and,
 * when present, smithable.content.yml. Prints diagnostics; returns the IR only when
 * everything is valid.
 */
export function loadSpec(
  target: string,
  io: Io,
): { ir?: SpecIR; auth?: AuthIR; content?: ContentIR; path: string } {
  const path = isDirectory(target) ? join(target, "smithable.yml") : target;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    io.err(`No spec found at ${path}.\n`);
    return { path };
  }
  const print = (diagnostics: Diagnostic[]) => {
    for (const d of diagnostics) io.err(`${formatDiagnostic(d)}\n`);
  };
  const failed = (file: string, diagnostics: Diagnostic[]) => {
    const errors = diagnostics.filter((d) => d.severity === "error").length;
    io.err(`\n${errors} ${errors === 1 ? "error" : "errors"} in ${file}.\n`);
    return { path };
  };

  const authPath = join(dirname(path), "smithable.auth.yml");
  if (!existsSync(authPath)) {
    io.err(
      `${authPath} is missing. Every project has one; for an app without sign-in it contains:\n\n  smithableAuth: 0.1\n  signIn: none\n`,
    );
    return { path };
  }
  const authFile = { path: authPath, text: readFileSync(authPath, "utf8") };
  // The roles are needed to check smithable.yml; the full check of the auth file needs its IR.
  const roles = validateAuth(authFile).auth?.roles.map((r) => r.name);
  const { ir, diagnostics } = validateSpec({ path, text }, roles ? { roles } : {});
  print(diagnostics);
  if (!ir || hasErrors(diagnostics)) return failed(path, diagnostics);
  const authResult = validateAuth(authFile, ir);
  print(authResult.diagnostics);
  if (!authResult.auth) return failed(authPath, authResult.diagnostics);
  const auth = authResult.auth;

  const contentPath = join(dirname(path), "smithable.content.yml");
  if (!existsSync(contentPath)) return { ir, auth, path };
  const result = validateContent(
    { path: contentPath, text: readFileSync(contentPath, "utf8") },
    ir,
  );
  print(result.diagnostics);
  if (!result.content) return failed(contentPath, result.diagnostics);
  return { ir, auth, content: result.content, path };
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
