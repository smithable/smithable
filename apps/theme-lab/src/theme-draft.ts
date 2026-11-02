// Session-only draft history. Saved YAML contains only the enabled palettes.
import { type Mode, oppositeMode, parseTheme, type ThemeIR } from "@smithable/core";
import { isNode, parseDocument } from "yaml";
import { themeText } from "./theme-text";

export interface ThemeDraft {
  text: string;
  /** Full source snapshots retain palette comments as well as values. */
  palettes: Partial<Record<Mode, string>>;
}
export interface DraftHistory {
  present: ThemeDraft;
  past: ThemeDraft[];
  future: ThemeDraft[];
}
export const newDraft = (text: string): ThemeDraft => ({ text, palettes: {} });
export const draftHistory = (text: string): DraftHistory => ({
  present: newDraft(text),
  past: [],
  future: [],
});
const read = (text: string) => parseTheme({ path: "draft.yml", text }).theme;

/** Raw YAML is authoritative: a valid edit replaces any hidden palette history. Invalid text
 * keeps the last stash available for recovery, but mode controls never transform it. */
export function editDraft(draft: ThemeDraft, text: string, yaml = false): ThemeDraft {
  return { text, palettes: yaml && read(text) ? {} : draft.palettes };
}

/** An absent palette is offered for explicit generation, never silently invented. */
export function changeModes(
  draft: ThemeDraft,
  modes: ThemeIR["modes"],
  generate = false,
): { draft: ThemeDraft; missing?: Mode } {
  const theme = read(draft.text);
  if (!theme || theme.modes === modes) return { draft };
  const doc = parseDocument(draft.text);
  const palettes = { ...draft.palettes };
  for (const mode of ["light", "dark"] as const) {
    const enabled = modes === "both" || modes === mode;
    if (!enabled) {
      if (doc.has(mode)) palettes[mode] = draft.text;
      doc.delete(mode);
      continue;
    }
    if (!doc.has(mode)) {
      const stored = palettes[mode] && parseDocument(palettes[mode]).get(mode, true);
      if (isNode(stored)) doc.set(mode, stored.clone());
      else {
        if (!generate) return { draft, missing: mode };
        const from = mode === "light" ? "dark" : "light";
        const made = { ...theme, modes: "both" as const, [mode]: oppositeMode(theme[from], from) };
        doc.set(mode, parseDocument(themeText(made)).get(mode, true));
      }
    }
    delete palettes[mode];
  }
  doc.set("modes", modes);
  const text = String(doc);
  return { draft: read(text) ? { text, palettes } : draft };
}

export function remember(history: DraftHistory, draft: ThemeDraft): DraftHistory {
  if (
    draft === history.present ||
    (draft.text === history.present.text && draft.palettes === history.present.palettes)
  )
    return history;
  return { present: draft, past: [...history.past.slice(-99), history.present], future: [] };
}
export function undoDraft(history: DraftHistory): DraftHistory {
  const present = history.past.at(-1);
  return present
    ? { present, past: history.past.slice(0, -1), future: [history.present, ...history.future] }
    : history;
}
export function redoDraft(history: DraftHistory): DraftHistory {
  const present = history.future[0];
  return present
    ? { present, past: [...history.past, history.present], future: history.future.slice(1) }
    : history;
}
