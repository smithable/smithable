export type Severity = "error" | "warning";

/** A problem found in a spec file, positioned for editors and CLI output (1-based). */
export interface Diagnostic {
  severity: Severity;
  /** Stable, kebab-case identifier, for tests and documentation. */
  code: string;
  message: string;
  hint?: string;
  file: string;
  line: number;
  column: number;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

export function formatDiagnostic(d: Diagnostic): string {
  const head = `${d.file}:${d.line}:${d.column}  ${d.severity}  ${d.message}`;
  return d.hint ? `${head}\n    hint: ${d.hint}` : head;
}
