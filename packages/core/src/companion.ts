// The companion files of smithable.yml (ARCHITECTURE §3), registered like the spec's sections
// (§5.1): each owns its file, its check, its operations, and how it follows a change made
// elsewhere (a field renamed, a page removed). applyOperation knows them only through this list.
import { validateAuth } from "./auth.js";
import { validateContent } from "./content.js";
import { validateContext } from "./context-file.js";
import type { Diagnostic } from "./diagnostics.js";
import type { YamlEditor } from "./edit.js";
import { pageModel, type SpecIR } from "./ir.js";
import type { AnyOperation, Editors, Effect } from "./operation.js";
import { contentOperations } from "./sections/content-operations.js";
import { contextOperations } from "./sections/context-operations.js";
import { uxOperations } from "./sections/ux-operations.js";
import { validateUx } from "./ux.js";

export interface Companion {
  key: Exclude<keyof Editors, "spec">;
  file: string;
  /** A new file's text; without it the file is never created (sign-in is chosen, not implied). */
  empty?: string;
  /** Problems with the file given the spec; an error makes it invalid. */
  check(text: string, ir: SpecIR): Diagnostic[];
  operations: AnyOperation[];
  /** Keeps the file in step with what an operation did elsewhere. */
  follow?(editor: YamlEditor, effect: Effect, ir: SpecIR): void;
}

const fieldPath = (m: string, f: string) => ["models", m, "fields", f];

const content: Companion = {
  key: "content",
  file: "smithable.content.yml",
  empty: "smithableContent: 0.1\n",
  check: (text, ir) => validateContent({ path: "smithable.content.yml", text }, ir).diagnostics,
  operations: contentOperations,
  follow(editor, effect) {
    // A field's texts follow it; a page's and a section's go with them.
    const path =
      effect.kind === "rename-field" || effect.kind === "remove-field"
        ? fieldPath(effect.model, effect.kind === "rename-field" ? effect.from : effect.field)
        : effect.kind === "remove-page"
          ? ["pages", effect.page]
          : effect.kind === "remove-section"
            ? ["pages", effect.page, effect.section]
            : undefined;
    if (!path || !editor.has(path)) return;
    if (effect.kind === "rename-field") editor.renameKey(path, effect.to);
    else editor.removeAndPrune(path, effect.kind === "remove-field" ? 1 : 0);
  },
};

const ux: Companion = {
  key: "ux",
  file: "smithable.ux.yml",
  empty: "smithableUx: 0.1\n",
  check: (text, ir) => validateUx({ path: "smithable.ux.yml", text }, ir).diagnostics,
  operations: uxOperations,
  follow(editor, effect, ir) {
    if (effect.kind === "remove-page") {
      if (editor.has(["pages", effect.page])) editor.removeAndPrune(["pages", effect.page], 0);
      return;
    }
    if (effect.kind === "change-field") {
      // Tones of choice values the new type no longer has go with them.
      const tones = ["tones", `${effect.model}.${effect.field}`];
      if (editor.has(tones))
        for (const value of Object.keys(editor.get(tones) as object))
          if (!effect.choices.includes(value)) editor.removeAndPrune([...tones, value], 0);
      return;
    }
    if (effect.kind !== "rename-field" && effect.kind !== "remove-field") return;
    const m = effect.model;
    const from = effect.kind === "rename-field" ? effect.from : effect.field;
    const to = effect.kind === "rename-field" ? effect.to : undefined;
    const tones = ["tones", `${m}.${from}`];
    if (editor.has(tones)) {
      if (to) editor.renameKey(tones, `${m}.${to}`);
      else editor.removeAndPrune(tones, 0);
    }
    for (const page of ir.pages.filter((p) => pageModel(p) === m)) {
      // A second line under a column: the pair goes with either field, and follows a rename.
      const below = ["pages", page.id, "table", "below"];
      const pairs = editor.has(below) ? (editor.get(below) as Record<string, string>) : {};
      for (const [column, second] of Object.entries(pairs)) {
        if (column !== from && second !== from) continue;
        if (!to) editor.removeAndPrune([...below, column], 0);
        else if (column === from) editor.renameKey([...below, column], to);
        else editor.set([...below, column], to);
      }
      for (const path of [
        ["pages", page.id, "table", "columns"],
        ["pages", page.id, "form", "fieldOrder"],
      ]) {
        const list = editor.has(path) ? (editor.get(path) as string[]) : undefined;
        if (!list?.includes(from)) continue;
        const next = to ? list.map((f) => (f === from ? to : f)) : list.filter((f) => f !== from);
        if (next.length) editor.set(path, next);
        else editor.removeAndPrune(path, 0);
      }
    }
  },
};

const auth: Companion = {
  key: "auth",
  file: "smithable.auth.yml",
  check: (text, ir) => validateAuth({ path: "smithable.auth.yml", text }, ir).diagnostics,
  operations: [],
};

const context: Companion = {
  key: "context",
  file: "smithable.context.yml",
  empty: "smithableContext: 0.1\n",
  check: (text) => validateContext({ path: "smithable.context.yml", text }),
  operations: contextOperations,
};

/** In the order their operations are listed. */
export const COMPANIONS: readonly Companion[] = [ux, content, auth, context];
