import { EditorSelection, EditorState, type Transaction } from "@codemirror/state";
import { expect, test } from "vitest";
import { enterKeepingLevel, newlineFor } from "./enter-indent";

test("Enter after a key with nothing after it goes one level deeper", () => {
  expect(newlineFor("  Customer:", 11)).toBe("\n    ");
  expect(newlineFor("models:", 7)).toBe("\n  ");
  expect(newlineFor("    fields:  ", 13)).toBe("\n      ");
});

test("anywhere else the new line keeps the current indentation", () => {
  expect(newlineFor("    name: string!", 17)).toBe("\n    ");
  // The cursor before the colon, or with text after it, is not the end of a key.
  expect(newlineFor("  fields:", 4)).toBe("\n  ");
  expect(newlineFor("  fields: x", 9)).toBe("\n  ");
  expect(newlineFor("  # what follows:", 17)).toBe("\n  ");
  expect(newlineFor("", 0)).toBe("\n");
});

test("the command splits the line at the cursor and lands on the new level", () => {
  const doc = "models:\n  Customer:";
  let state = EditorState.create({ doc, selection: EditorSelection.cursor(doc.length) });
  enterKeepingLevel({
    state,
    dispatch: (tr: Transaction) => {
      state = tr.state;
    },
  });
  expect(state.doc.toString()).toBe("models:\n  Customer:\n    ");
  expect(state.selection.main.head).toBe(state.doc.length);
});
