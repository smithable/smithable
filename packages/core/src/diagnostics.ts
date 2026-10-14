/** An error stops the app; a warning is a risk; a note is advice the app is fine without. */
export type Severity = "error" | "warning" | "note";

/** The operation that does what a note advises, as Studio's Apply runs it. */
export interface Fix {
  op: string;
  args: Record<string, unknown>;
}

/** A problem found in a spec file, positioned for editors and CLI output (1-based). */
export interface Diagnostic {
  severity: Severity;
  /** Stable, kebab-case identifier, for tests and documentation. */
  code: string;
  message: string;
  hint?: string;
  /** A note's way: the operation that applies the advice. */
  fix?: Fix;
  file: string;
  line: number;
  column: number;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

export function formatDiagnostic(d: Diagnostic): string {
  const head = `${d.file}:${d.line}:${d.column}  ${d.severity}  ${d.message}`;
  const lines = [
    head,
    ...(d.hint ? [`    hint: ${d.hint}`] : []),
    ...(d.fix ? [`    do: ${fixCommand(d.fix)}`] : []),
  ];
  return lines.join("\n");
}

/** A note's fix as the command that runs it. */
export function fixCommand(fix: Fix): string {
  const args = Object.entries(fix.args)
    .map(([k, v]) => `--${k} ${Array.isArray(v) ? v.join(",") : String(v)}`)
    .join(" ");
  return `smithable op ${fix.op} ${args}`;
}
