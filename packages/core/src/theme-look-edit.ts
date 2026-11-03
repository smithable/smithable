// Shared source edits for theme operations and read-only drafts of a validated project IR.
import type { AuthIR } from "./auth.js";
import { YamlEditor } from "./edit.js";
import type { SpecIR } from "./ir.js";
import type { LookReset } from "./look.js";
import { OperationError } from "./operation.js";
import type { ThemeIR } from "./theme.js";
import { validateUx } from "./ux.js";
import { put } from "./ux-edit.js";

export interface ThemeSettingsEdit {
  page?: string;
  preset?: string;
  primary?: string;
  background?: string;
  font?: string;
  density?: string;
  motion?: string;
}
export function writeThemeSettings(
  ux: YamlEditor,
  { page, ...args }: ThemeSettingsEdit,
  ir: SpecIR,
): void {
  if (Object.keys(args).length === 0)
    throw new OperationError(
      "Say what to set: preset, primary, background, font, density or motion.",
    );
  // A landing page's own theme lives under the page, with the same keys as the app's.
  if (page !== undefined && ir.pages.find((p) => p.id === page)?.pattern.kind !== "landing")
    throw new OperationError(
      `Only a landing page has a theme of its own; there is no landing page "${page}".`,
    );
  const at = page === undefined ? ["theme"] : ["pages", page, "theme"];
  if (page === undefined && args.density === "none")
    throw new OperationError(
      "The app's density is comfortable, standard or compact; \"none\" returns a landing page's density to the app's.",
    );
  // On a page, "none" returns a key to the app's theme; for the app it removes a brand key.
  // For motion alone, "none" is a value: no motion.
  if (args.preset !== undefined)
    put(ux, [...at, "preset"], page && args.preset === "none" ? undefined : args.preset);
  if (args.density !== undefined)
    put(ux, [...at, "density"], page && args.density === "none" ? undefined : args.density);
  if (args.motion !== undefined) put(ux, [...at, "motion"], args.motion);
  for (const key of ["primary", "background", "font"] as const) {
    const value = args[key];
    if (value !== undefined) put(ux, [...at, "brand", key], value === "none" ? undefined : value);
  }
}

export function resetThemeSetting(ux: YamlEditor, { key, page }: LookReset, ir: SpecIR): void {
  if (page !== undefined && ir.pages.find((p) => p.id === page)?.pattern.kind !== "landing")
    throw new OperationError(
      `Only a landing page has a theme of its own; there is no landing page "${page}".`,
    );
  const at = page === undefined ? [] : ["pages", page];
  put(
    ux,
    [...at, "theme", ...(["primary", "background", "font"].includes(key) ? ["brand", key] : [key])],
    undefined,
  );
}

/** Drafts never reparse the plugin-owned spec grammar or execute plugins. The host supplies
 * its already validated IR. Only UX theme selection/resets are staged; all persisted changes
 * still go through the complete canonical operation validation and checkpoint pipeline. */
export function stageThemeSelection(
  project: { ir: SpecIR; uxText: string; themes: ThemeIR[]; auth?: AuthIR },
  selection: { preset: string; page?: string; resets?: LookReset[] },
) {
  const read = (text: string) => {
    const result = validateUx(
      { path: "smithable.ux.yml", text },
      project.ir,
      project.themes,
      project.auth,
    );
    if (!result.ux) throw new OperationError(result.diagnostics.map((d) => d.message).join("\n"));
    return result.ux;
  };
  read(project.uxText);
  const editor = new YamlEditor(project.uxText);
  for (const reset of selection.resets ?? []) resetThemeSetting(editor, reset, project.ir);
  writeThemeSettings(
    editor,
    { preset: selection.preset, ...(selection.page ? { page: selection.page } : {}) },
    project.ir,
  );
  return { uxText: editor.text, ux: read(editor.text) };
}
