import { BUILT_IN_THEMES, parseTheme, type ThemeIR } from "@smithable/core";
import { expect, test } from "vitest";
import {
  changeModes,
  draftHistory,
  editDraft,
  newDraft,
  redoDraft,
  remember,
  undoDraft,
} from "./theme-draft";
import { getField, setField, themeText } from "./theme-text";

const base = () => themeText(BUILT_IN_THEMES[0] as ThemeIR);
const palette = (text: string, mode: "light" | "dark") =>
  parseTheme({ path: "draft.yml", text }).theme?.[mode];

test.each(["light", "dark"] as const)(
  "both → %s → both restores authored palette and comments",
  (mode) => {
    const other = mode === "light" ? "dark" : "light";
    const text = setField(base(), [other, "chart-3"], "#834488").replace(
      `${other}:`,
      `${other}: # keep palette`,
    );
    const single = changeModes(newDraft(text), mode).draft;
    expect(parseTheme({ path: "draft.yml", text: single.text }).theme?.modes).toBe(mode);
    expect(getField(single.text, [other])).toBeUndefined();
    const edited = editDraft(single, setField(single.text, [mode, "primary"], "#335577"));
    const both = changeModes(edited, "both").draft;
    expect(palette(both.text, other)).toEqual(palette(text, other));
    expect(palette(both.text, mode)?.primary).toBe("#335577");
    expect(both.text).toContain("# keep palette");
  },
);

test("switching directly between single modes uses the stash and retains each palette", () => {
  const light = changeModes(newDraft(base()), "light").draft;
  const dark = changeModes(light, "dark").draft;
  expect(parseTheme({ path: "draft.yml", text: dark.text }).theme?.modes).toBe("dark");
  expect(palette(changeModes(dark, "both").draft.text, "light")).toEqual(palette(base(), "light"));
});

test("a fresh one-mode source requires explicit generation; saved YAML has no stash", () => {
  const single = newDraft(changeModes(newDraft(base()), "light").draft.text);
  expect(changeModes(single, "both")).toEqual({ draft: single, missing: "dark" });
  expect(changeModes(single, "dark")).toEqual({ draft: single, missing: "dark" });
  const made = changeModes(single, "both", true).draft;
  expect(parseTheme({ path: "draft.yml", text: made.text }).theme?.modes).toBe("both");
});

test("undo/redo restores text and hidden palettes as one edit", () => {
  let history = draftHistory(base());
  history = remember(history, changeModes(history.present, "dark").draft);
  const single = history;
  history = remember(history, changeModes(history.present, "both").draft);
  expect(undoDraft(history)).toEqual({ ...single, future: [history.present] });
  expect(redoDraft(undoDraft(history))).toEqual(history);
  expect(undoDraft(single).present.text).toBe(base());
});

test("valid YAML replaces stash; invalid YAML is retained and can recover without losing it", () => {
  const single = changeModes(newDraft(base()), "light").draft;
  const invalid = editDraft(single, "light: [", true);
  expect(changeModes(invalid, "both").draft).toBe(invalid);
  expect(invalid.palettes).toEqual(single.palettes);
  const recovered = editDraft(invalid, single.text, true);
  expect(changeModes(recovered, "both").missing).toBe("dark");
  const authored = setField(base(), ["dark", "primary"], "#553388");
  expect(
    palette(changeModes(editDraft(single, authored, true), "dark").draft.text, "dark")?.primary,
  ).toBe("#553388");
});

test("starting another theme gets a new draft with no palette leakage", () => {
  const single = changeModes(newDraft(base()), "light").draft;
  expect(single.palettes.dark).toBeDefined();
  const fresh = draftHistory(single.text);
  expect(fresh.present.palettes).toEqual({});
  expect(fresh.past).toEqual([]);
});
