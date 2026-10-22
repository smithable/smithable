// The companion files of smithable.yml (ARCHITECTURE §3), registered like the spec's sections
// (§5.1): each owns its file, its check, its operations, and how it follows a change made
// elsewhere (a field renamed, a page removed). applyOperation knows them only through this list.

import type { ProjectFiles } from "./apply.js";
import { validateAuth } from "./auth.js";
import { followRenamed, lostValues } from "./condition.js";
import { validateContent } from "./content.js";
import { validateContext } from "./context-file.js";
import type { Diagnostic } from "./diagnostics.js";
import type { YamlEditor } from "./edit.js";
import type { Condition, SpecIR } from "./ir.js";
import type { AnyOperation, Editors, Effect, Note, Refusal } from "./operation.js";
import { pageModel } from "./patterns.js";
import { renameReferences } from "./rename.js";
import { authOperations } from "./sections/auth-operations.js";
import { contentOperations } from "./sections/content-operations.js";
import { contextOperations } from "./sections/context-operations.js";
import { uxOperations } from "./sections/ux-operations.js";
import { validateUx } from "./ux.js";

export interface Companion {
  key: Exclude<keyof Editors, "spec" | "themes" | "translations">;
  file: string;
  /** A new file's text; without it the file is never created (sign-in is chosen, not implied). */
  empty?: string;
  /** Problems with the file given the spec (and the project's other files); an error makes it invalid. */
  check(text: string, ir: SpecIR, files?: ProjectFiles): Diagnostic[];
  operations: AnyOperation[];
  /**
   * Keeps the file in step with what an operation did elsewhere, or refuses the change; a note
   * says what it changed, in the operation's confirmation.
   */
  follow?(editor: YamlEditor, effect: Effect, ir: SpecIR): Refusal | Note | undefined;
}

const fieldPath = (m: string, f: string) => ["models", m, "fields", f];

/**
 * A map keyed by a choice field's values (their texts, their tones) after the field changed: a
 * renamed value's entry moves to its new name, and entries of values that are gone are removed.
 * A value that became one the field already had brings nothing along: that one keeps its own.
 */
function followValueKeys(
  editor: YamlEditor,
  path: string[],
  effect: Extract<Effect, { kind: "change-field" }>,
  ir: SpecIR,
): void {
  const before = ir.models
    .find((m) => m.name === effect.model)
    ?.fields.find((f) => f.name === effect.field)?.type;
  const had = before?.kind === "choice" ? before.values : [];
  const keys = Object.keys(editor.get(path) as object);
  for (const value of keys) {
    if (effect.choices.includes(value)) continue;
    const to = effect.renamed?.[value];
    if (to && !had.includes(to) && !keys.includes(to)) editor.renameKey([...path, value], to);
    else editor.removeAndPrune([...path, value], 0);
  }
}

const content: Companion = {
  key: "content",
  file: "smithable.content.yml",
  empty: "smithableContent: 0.1\n",
  check: (text, ir) => validateContent({ path: "smithable.content.yml", text }, ir).diagnostics,
  operations: contentOperations,
  follow(editor, effect, ir) {
    // A renamed model's or page's texts move to its new name.
    if (effect.kind === "rename-model" || effect.kind === "rename-page") {
      const path = [effect.kind === "rename-model" ? "models" : "pages", effect.from];
      if (editor.has(path)) editor.renameKey(path, effect.to);
      return undefined;
    }
    // The texts of a choice field's values: a renamed value's text goes to its new name, and
    // those of values that are gone go with them.
    if (effect.kind === "change-field") {
      const values = [...fieldPath(effect.model, effect.field), "values"];
      if (editor.has(values)) followValueKeys(editor, values, effect, ir);
      return undefined;
    }
    // A field's texts follow it; a page's and a section's go with them.
    const path =
      effect.kind === "rename-field" || effect.kind === "remove-field"
        ? fieldPath(effect.model, effect.kind === "rename-field" ? effect.from : effect.field)
        : effect.kind === "remove-page"
          ? ["pages", effect.page]
          : effect.kind === "remove-section"
            ? ["pages", effect.page, effect.section]
            : undefined;
    if (!path || !editor.has(path)) return undefined;
    if (effect.kind === "rename-field") editor.renameKey(path, effect.to);
    else editor.removeAndPrune(path, effect.kind === "remove-field" ? 1 : 0);
    return undefined;
  },
};

const ux: Companion = {
  key: "ux",
  file: "smithable.ux.yml",
  empty: "smithableUx: 0.1\n",
  check: (text, ir, files) =>
    validateUx({ path: "smithable.ux.yml", text }, ir, files?.themes).diagnostics,
  operations: uxOperations,
  follow(editor, effect, ir) {
    if (effect.kind === "rename-page") {
      if (editor.has(["pages", effect.from])) editor.renameKey(["pages", effect.from], effect.to);
      return undefined;
    }
    if (effect.kind === "rename-model") {
      // Tones are keyed "Model.field"; a page's look is keyed by the page, which stays.
      const tones = editor.has(["tones"]) ? Object.keys(editor.get(["tones"]) as object) : [];
      for (const key of tones)
        if (key.startsWith(`${effect.from}.`))
          editor.renameKey(["tones", key], `${effect.to}.${key.slice(effect.from.length + 1)}`);
      return undefined;
    }
    if (effect.kind === "remove-page") {
      if (editor.has(["pages", effect.page])) editor.removeAndPrune(["pages", effect.page], 0);
      return undefined;
    }
    if (effect.kind === "remove-section") {
      // A section's look goes with it.
      const look = ["pages", effect.page, "sections", effect.section];
      if (editor.has(look)) editor.removeAndPrune(look, 0);
      return undefined;
    }
    if (effect.kind === "change-field") {
      // A renamed choice value keeps its tone under its new name; tones of values that are gone
      // go with them.
      const tones = ["tones", `${effect.model}.${effect.field}`];
      if (editor.has(tones)) followValueKeys(editor, tones, effect, ir);
      return undefined;
    }
    if (effect.kind !== "rename-field" && effect.kind !== "remove-field") return undefined;
    const m = effect.model;
    const from = effect.kind === "rename-field" ? effect.from : effect.field;
    const to = effect.kind === "rename-field" ? effect.to : undefined;
    // A thread finds its message as the model's first long text: the last one cannot go while a
    // page shows the model as a thread (docs/design/conversation.md).
    if (effect.kind === "remove-field") {
      const model = ir.models.find((x) => x.name === m);
      const long = (name: string) =>
        model?.fields.some(
          (f) =>
            f.name === name &&
            f.type.kind === "scalar" &&
            (f.type.name === "text" || f.type.name === "markdown"),
        );
      const others = model?.fields.filter((f) => f.name !== from && long(f.name)) ?? [];
      if (long(from) && !others.length)
        for (const page of ir.pages) {
          const shown = editor.has(["pages", page.id, "record", "lists"])
            ? (editor.get(["pages", page.id, "record", "lists"]) as Record<string, string>)
            : {};
          const owner = ir.models.find((x) => x.name === pageModel(page));
          const list = Object.entries(shown).find(
            ([name, look]) =>
              look === "thread" &&
              owner?.fields.some(
                (f) => f.name === name && f.type.kind === "relation" && f.type.model === m,
              ),
          );
          if (list)
            return {
              refusal: `${m}.${from} is the message of the thread on the ${page.id} page; show the list as a table first.`,
            };
        }
    }
    const tones = ["tones", `${m}.${from}`];
    if (editor.has(tones)) {
      if (to) editor.renameKey(tones, `${m}.${to}`);
      else editor.removeAndPrune(tones, 0);
    }
    for (const page of ir.pages.filter((p) => pageModel(p) === m)) {
      // A list shown as a thread follows its field, and goes with it.
      const listed = ["pages", page.id, "record", "lists", from];
      if (editor.has(listed)) {
        if (to) editor.renameKey(listed, to);
        else editor.removeAndPrune(listed, 0);
      }
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
        ["pages", page.id, "filters", "shown"],
      ]) {
        const list = editor.has(path) ? (editor.get(path) as string[]) : undefined;
        if (!list?.includes(from)) continue;
        const next = to ? list.map((f) => (f === from ? to : f)) : list.filter((f) => f !== from);
        if (next.length) editor.set(path, next);
        else editor.removeAndPrune(path, 0);
      }
      // The list's order, a field's control, and the form's sections follow the field too.
      const sort = ["pages", page.id, "table", "sort"];
      const sorted = editor.has(sort) ? (editor.get(sort) as string) : undefined;
      if (sorted !== undefined && sorted.replace(/^-/, "") === from) {
        if (to) editor.set(sort, sorted.startsWith("-") ? `-${to}` : to);
        else editor.removeAndPrune(sort, 0);
      }
      const control = ["pages", page.id, "form", "control", from];
      if (editor.has(control)) {
        if (to) editor.renameKey(control, to);
        else editor.removeAndPrune(control, 0);
      }
      const sections = ["pages", page.id, "form", "sections"];
      const groups = editor.has(sections)
        ? (editor.get(sections) as { name: string; fields: string[] }[])
        : undefined;
      groups?.forEach((g, i) => {
        if (!g.fields.includes(from)) return;
        const fields = to
          ? g.fields.map((f) => (f === from ? to : f))
          : g.fields.filter((f) => f !== from);
        editor.setItem(sections, i, { name: g.name, fields });
      });
    }
    return undefined;
  },
};

const auth: Companion = {
  key: "auth",
  file: "smithable.auth.yml",
  check: (text, ir) => validateAuth({ path: "smithable.auth.yml", text }, ir).diagnostics,
  operations: authOperations,
  follow(editor, effect) {
    // Grants, the public block and the api block name models and pages: rewritten where the
    // parser saw them.
    if (effect.kind === "rename-model" || effect.kind === "rename-page") {
      const { references } = validateAuth({ path: "smithable.auth.yml", text: editor.text });
      const kind = effect.kind === "rename-model" ? "model" : "page";
      editor.replaceAll(renameReferences(editor.text, references, kind, effect.from, effect.to));
      return undefined;
    }
    // A removed page is no longer one visitors may open.
    if (effect.kind === "remove-page") {
      const pages = ["public", "pages"];
      const listed = editor.has(pages) ? (editor.get(pages) as string[]) : [];
      if (!listed.includes(effect.page)) return undefined;
      const rest = listed.filter((p) => p !== effect.page);
      if (rest.length) editor.set(pages, rest);
      else editor.removeAndPrune(pages, 0);
      return { note: "it is no longer public" };
    }
    // A removed action is no longer one programs are offered by name.
    if (effect.kind === "remove-action") {
      const actions = ["api", "actions"];
      const listed = editor.has(actions) ? editor.get(actions) : undefined;
      if (!Array.isArray(listed) || !listed.includes(effect.action)) return undefined;
      const rest = (listed as string[]).filter((a) => a !== effect.action);
      if (rest.length) editor.set(actions, rest);
      else editor.remove(actions);
      return { note: "programs are no longer offered it" };
    }
    // What visitors may read (`Post: { where: { status: published } }`) follows the field it
    // names, and refuses to lose it: reading would otherwise widen silently.
    if (
      effect.kind !== "rename-field" &&
      effect.kind !== "remove-field" &&
      effect.kind !== "change-field"
    )
      return undefined;
    const read = ["public", "read"];
    const items = editor.has(read) ? (editor.get(read) as unknown[]) : [];
    for (const [i, item] of items.entries()) {
      if (!item || typeof item !== "object") continue;
      const [model, options] = Object.entries(item as Record<string, unknown>)[0] ?? [];
      if (model !== effect.model || !options || typeof options !== "object") continue;
      const where = (options as { where?: Condition }).where ?? {};
      const field = effect.kind === "rename-field" ? effect.from : effect.field;
      if (!(field in where)) continue;
      if (effect.kind === "remove-field")
        return {
          refusal: `Visitors read ${model} only where ${field} fits; change "read" under "public" in smithable.auth.yml first.`,
        };
      if (effect.kind === "change-field") {
        // A renamed value is followed; one that is gone would widen what visitors read.
        const wanted = followRenamed(
          editor,
          [...read, String(i), model, "where", field],
          where[field] as Condition[string],
          effect.renamed,
        );
        const lost = lostValues(wanted, effect.choices);
        if (!lost.length) continue;
        return {
          refusal: `Visitors read ${model} only where ${field} is ${lost.join(" or ")}; change "read" under "public" in smithable.auth.yml first.`,
        };
      }
      const renamed = Object.fromEntries(
        Object.entries(where).map(([k, v]) => [k === field ? effect.to : k, v]),
      );
      editor.setItem(read, i, { [model]: { where: renamed } });
    }
    return undefined;
  },
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
