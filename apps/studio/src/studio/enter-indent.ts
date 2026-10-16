// Enter in the spec's text (Johan, 2026-10-16): at the end of a line that is a key with nothing
// after it (`fields:`), the new line goes one level deeper; anywhere else it keeps the current
// line's indentation. Plain text rules, not the YAML grammar's guesses.
import { completionStatus } from "@codemirror/autocomplete";
import { EditorSelection, type StateCommand } from "@codemirror/state";

/** One level in the spec files. */
const LEVEL = "  ";

/** What Enter inserts at `column` of a line: the break and the new line's indentation. */
export function newlineFor(line: string, column: number): string {
  const indent = /^[ \t]*/.exec(line)?.[0] ?? "";
  const before = line.slice(0, column).trimEnd();
  const atEnd = line.slice(column).trim() === "";
  const opensKey = atEnd && before.endsWith(":") && !before.trimStart().startsWith("#");
  return `\n${indent}${opensKey ? LEVEL : ""}`;
}

/** Enter, the spec's way; an open list of suggestions keeps Enter for choosing. */
export const enterKeepingLevel: StateCommand = ({ state, dispatch }) => {
  if (completionStatus(state) === "active") return false;
  dispatch(
    state.update(
      state.changeByRange((range) => {
        const line = state.doc.lineAt(range.from);
        const insert = newlineFor(line.text, range.from - line.from);
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.cursor(range.from + insert.length),
        };
      }),
      { scrollIntoView: true, userEvent: "input" },
    ),
  );
  return true;
};
