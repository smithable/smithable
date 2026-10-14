// The spec's text in Code mode: CodeMirror 6 with YAML colours, line numbers, folding and
// search, the validator's problems shown in the text where they are, and what can be written at
// the cursor and what a word means, from the spec's schema and the app's own names (core's
// complete.ts). Its own module, loaded when the spec tab opens: Builder never pays for it.
import { acceptCompletion, completionStatus, startCompletion } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap, type ViewUpdate } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { completeSpec, type EditedFile, hoverSpec, type Known } from "@smithable/core";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { type Problem, problemRange } from "./problems";

export default function SpecText({
  label,
  value,
  onChange,
  problems,
  select,
  kept,
  known,
  assist = false,
  ask,
}: {
  /** What the text is, for assistive tools and tests: the file's name. */
  label: string;
  value: string;
  onChange: (text: string) => void;
  problems: Problem[];
  /** A range to select and bring into view, each time `at` changes. */
  select?: { from: number; to: number; at: number };
  /** The session-storage key the cursor and scroll are kept under. */
  kept: string;
  /** What the text may name that it does not say: the auth file's roles, the spec's text. */
  known?: Known;
  /** Offer what can be written and explain keys, from the file's schema: `label` says which. */
  assist?: boolean;
  /** Open what can be written at the cursor, each time it changes (a phone has no Ctrl-Space). */
  ask?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  const changed = useRef(onChange);
  changed.current = onChange;
  const knows = useRef(known);
  knows.current = known;
  const file = label as EditedFile;
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const scheme = useRef(new Compartment()).current;
  // Made once. The text, the problems and the selection reach it through the effects below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the editor is made once
  useEffect(() => {
    if (!host.current) return;
    const keep = (editor: EditorView) => {
      try {
        sessionStorage.setItem(
          kept,
          JSON.stringify({
            at: editor.state.selection.main.head,
            scroll: editor.scrollDOM.scrollTop,
          }),
        );
      } catch {}
    };
    // The editor's own completion (in basicSetup) asks the language's data for its sources, and
    // knows a source by being the same function: made once here, or it would start over at
    // every keystroke. Typing opens the list for a value or a word begun; an empty indented line
    // (where a key goes) opens it when the cursor lands there, below; elsewhere, Ctrl-Space or the
    // toolbar's "What goes here?".
    const sources = [
      {
        autocomplete: (context: { state: EditorState; pos: number; explicit: boolean }) => {
          const found = completeSpec(
            context.state.doc.toString(),
            context.pos,
            knows.current ?? {},
            file,
          );
          if (!found || (!context.explicit && found.from === found.to && !found.value)) return null;
          return {
            from: found.from,
            to: found.to,
            validFor: /^[\w-]*$/,
            // In the order given (a kind of record's fields as it lists them), not by the alphabet.
            options: found.suggestions.map((s, index) => ({
              label: s.label,
              boost: Math.max(-99, -index),
              type: found.value ? "constant" : "property",
              ...(s.insert ? { apply: s.insert } : {}),
              ...(s.detail ? { info: s.detail } : {}),
            })),
          };
        },
      },
    ];
    const hover = hoverTooltip((editor, pos) => {
      const found = hoverSpec(editor.state.doc.toString(), pos, file, knows.current ?? {});
      if (!found) return null;
      return {
        pos: found.from,
        end: found.to,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "cm-spec-hint";
          dom.textContent = found.text;
          return { dom };
        },
      };
    });
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          // Tab takes the chosen suggestion when the list is open, as Enter does; otherwise Tab
          // indents and Shift+Tab outdents, as in any code editor. Escape then Tab leaves the
          // editor for the next control (CodeMirror's own way out, for the keyboard).
          keymap.of([{ key: "Tab", run: acceptCompletion }, indentWithTab]),
          yaml(),
          lintGutter(),
          // Studio's colours follow the system's light or dark setting, as it changes.
          scheme.of(dark.matches ? DARK : []),
          ...(assist ? [EditorState.languageData.of(() => sources), hover] : []),
          EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "false" }),
          EditorView.theme({
            "&": { height: "100%", fontSize: "13px" },
            "&.cm-focused": { outline: "none" },
            ".cm-scroller": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              lineHeight: "20px",
            },
            ".cm-spec-hint": { padding: "4px 8px", maxWidth: "420px", fontSize: "12px" },
            ".cm-tooltip.cm-completionInfo": { maxWidth: "320px", fontSize: "12px" },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changed.current(update.state.doc.toString());
            if (update.docChanged || update.selectionSet) keep(update.view);
            if (assist && landed(update)) setTimeout(() => startCompletion(update.view));
          }),
        ],
      }),
    });
    editor.scrollDOM.addEventListener("scroll", () => keep(editor), { passive: true });
    const recolour = () =>
      editor.dispatch({ effects: scheme.reconfigure(dark.matches ? DARK : []) });
    dark.addEventListener("change", recolour);
    // The text and the selection answer as a text box's do (value, selectionStart,
    // selectionEnd, setSelectionRange), for tools and tests that read or set a field's text: only the lines in
    // view are in the page, so the element's own content is not the text.
    Object.defineProperties(editor.contentDOM, {
      value: {
        configurable: true,
        get: () => editor.state.doc.toString(),
        set: (text: string) =>
          editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } }),
      },
      selectionStart: { configurable: true, get: () => editor.state.selection.main.from },
      selectionEnd: { configurable: true, get: () => editor.state.selection.main.to },
      setSelectionRange: {
        configurable: true,
        value: (from: number, to = from) =>
          editor.dispatch({ selection: EditorSelection.range(from, to), scrollIntoView: true }),
      },
    });
    // Coming back to Code mode opens the editor where it was left (studio-v2.md §2).
    if (!select) {
      try {
        const { at, scroll } = JSON.parse(sessionStorage.getItem(kept) ?? "") as {
          at: number;
          scroll: number;
        };
        editor.dispatch({ selection: { anchor: Math.min(at, editor.state.doc.length) } });
        requestAnimationFrame(() => {
          editor.scrollDOM.scrollTop = scroll;
        });
      } catch {}
    }
    view.current = editor;
    return () => {
      dark.removeEventListener("change", recolour);
      view.current = undefined;
      editor.destroy();
    };
  }, []);
  // Each "What goes here?" (a count, so asking twice opens it twice).
  useEffect(() => {
    const editor = view.current;
    if (!editor || !ask) return;
    editor.focus();
    startCompletion(editor);
  }, [ask]);
  // A text from outside (a save, the file on disk): put in whole; typing arrives here unchanged.
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const text = editor.state.doc.toString();
    editor.dispatch(
      setDiagnostics(
        editor.state,
        problems.map((p) => ({
          ...problemRange(text, p),
          severity: p.severity === "error" ? "error" : "warning",
          message: p.hint ? `${p.message}\n${p.hint}` : p.message,
        })),
      ),
    );
  }, [problems]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a jump is asked by its time
  useEffect(() => {
    const editor = view.current;
    if (!editor || !select) return;
    const length = editor.state.doc.length;
    const from = Math.min(select.from, length);
    editor.dispatch({
      selection: EditorSelection.range(from, Math.min(select.to, length)),
      effects: EditorView.scrollIntoView(from, { y: "start", yMargin: 60 }),
    });
    editor.focus();
  }, [select?.at]);
  // No wider than its place: a long line scrolls inside the editor, and must not widen the panel
  // (which pushed Save out of sight).
  return <div ref={host} className="min-h-0 min-w-0 flex-1 overflow-hidden" />;
}

/**
 * The editor in dark mode: Studio's dark panel and lines (styles.css), and YAML's parts in colours
 * that read on it (the editor's own highlighting is made for a white page).
 */
const DARK = [
  EditorView.theme(
    {
      "&": { backgroundColor: "var(--panel)", color: "var(--fg)" },
      ".cm-gutters": {
        backgroundColor: "var(--surface)",
        color: "var(--faint)",
        borderRight: "1px solid var(--line)",
      },
      ".cm-activeLine": { backgroundColor: "oklch(100% 0 0 / 0.04)" },
      ".cm-activeLineGutter": { backgroundColor: "var(--subtle)" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: "oklch(45% 0.08 268 / 0.6)",
      },
      ".cm-tooltip": {
        backgroundColor: "var(--panel)",
        color: "var(--fg)",
        border: "1px solid var(--line-strong)",
      },
      ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "var(--accent-soft)",
        color: "var(--fg)",
      },
      ".cm-panels": { backgroundColor: "var(--surface)", color: "var(--fg)" },
      ".cm-searchMatch": { backgroundColor: "oklch(60% 0.12 85 / 0.35)" },
      ".cm-foldPlaceholder": { backgroundColor: "var(--subtle)", color: "var(--muted)" },
    },
    { dark: true },
  ),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.definition(tags.propertyName), color: "oklch(80% 0.09 250)" },
      { tag: [tags.string, tags.special(tags.string)], color: "oklch(82% 0.11 145)" },
      { tag: [tags.lineComment, tags.comment], color: "var(--faint)", fontStyle: "italic" },
      { tag: [tags.labelName, tags.typeName, tags.keyword], color: "oklch(80% 0.1 310)" },
      {
        tag: [tags.separator, tags.punctuation, tags.squareBracket, tags.brace],
        color: "var(--quiet)",
      },
    ]),
  ),
];

/**
 * The cursor has just come to the end of an empty indented line (a click or tap there, an arrow
 * key, Enter), with no list open: a key goes there, so the keys that may are offered unasked.
 */
function landed(update: ViewUpdate): boolean {
  const { state, startState } = update;
  const at = state.selection.main;
  if (!update.selectionSet || !at.empty || completionStatus(state) !== null) return false;
  const line = state.doc.lineAt(at.head);
  if (at.head !== line.to || !/^\s+$/.test(line.text)) return false;
  return (
    startState.doc.lineAt(Math.min(startState.selection.main.head, startState.doc.length))
      .number !== line.number || update.transactions.some((t) => t.isUserEvent("select.pointer"))
  );
}
