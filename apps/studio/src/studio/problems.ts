// Where the validator's problems are in the spec's text, for the editor to mark them.

/** A problem the validator found, by the line and column it reports. */
export interface Problem {
  line: number;
  column: number;
  severity: string;
  message: string;
  hint?: string;
}

/** Where a problem is in the text: from its column to the end of its line. */
export function problemRange(text: string, problem: Problem): { from: number; to: number } {
  const lines = text.split("\n");
  const line = Math.min(Math.max(problem.line, 1), lines.length);
  const start = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
  const length = (lines[line - 1] ?? "").length;
  const from = start + Math.min(Math.max(problem.column - 1, 0), length);
  return { from, to: Math.max(start + length, from) };
}
