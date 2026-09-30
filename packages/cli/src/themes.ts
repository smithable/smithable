import { readFileSync } from "node:fs";
import { BUILT_IN_THEMES, formatDiagnostic, parseTheme } from "@smithable/core";
import type { Io } from "./io.js";
import { projectThemeFiles } from "./validate.js";

/**
 * `smithable themes [dir]`: the themes the ux file's `theme.preset` may name, the built-in
 * ones and the project's own (themes/<name>.yml), each with its font; a theme file with a
 * problem is reported and left out.
 */
export function themes(dir: string, io: Io): number {
  let failed = 0;
  const own = projectThemeFiles(dir).flatMap((file) => {
    const result = parseTheme({ path: file, text: readFileSync(file, "utf8") });
    for (const d of result.diagnostics) io.err(`${formatDiagnostic(d)}\n`);
    if (!result.theme) failed++;
    return result.theme ? [result.theme] : [];
  });
  for (const t of [...BUILT_IN_THEMES, ...own])
    io.out(
      `${t.name.padEnd(16)} ${t.source === "built-in" ? "built in" : "themes/"}  ${t.font}, ${t.radius} corners\n`,
    );
  if (!own.length) io.out("Add your own as themes/<name>.yml: see docs/spec/v0.1.md, Themes.\n");
  return failed ? 1 : 0;
}
