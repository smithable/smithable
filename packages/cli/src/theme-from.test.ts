import { contrast, parseTheme } from "@smithable/core";
import { expect, test } from "vitest";
import { type Look, themeFromLook } from "./theme-from.js";

const look = (over: Partial<Look>): Look => ({
  background: "#ffffff",
  foreground: "#333333",
  primary: "#006aac",
  link: null,
  card: null,
  border: null,
  shadowShare: 0,
  radius: 8,
  bodyFont: "Roboto",
  headingFont: null,
  ...over,
});

test("a light site with no dark mode: its colours, a derived dark mode, the nearest font", () => {
  const { text, notes } = themeFromLook(
    "https://el.example/",
    "el",
    look({}),
    look({}),
    "2026-10-02",
  );
  const theme = parseTheme({ path: "themes/el.yml", text }).theme;
  expect(theme).toBeDefined();
  expect(text).toContain("font: Source Sans 3");
  expect(text).toContain("radius: 8px");
  expect(notes).toContain("The site has no dark mode; it is derived from the light colours.");
  const dark =
    /dark:\n {2}background: "(#[0-9a-f]+)"\n {2}foreground: "(#[0-9a-f]+)"\n {2}primary: "(#[0-9a-f]+)"/.exec(
      text,
    );
  expect(dark).not.toBeNull();
  const [, background = "", foreground = "", primary = ""] = dark ?? [];
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(primary, background)).toBeGreaterThanOrEqual(3);
});

test("a dark site, unreadable grey text, no buttons, an unknown font", () => {
  const { text, notes } = themeFromLook(
    "https://night.example/",
    "night",
    look({
      background: "#101418",
      foreground: "#3a3f44",
      primary: null,
      link: null,
      radius: null,
      bodyFont: "Papyrus",
    }),
    undefined,
    "2026-10-02",
  );
  expect(parseTheme({ path: "themes/night.yml", text }).theme).toBeDefined();
  expect(notes).toEqual(
    expect.arrayContaining([
      "The site is dark by default; its colours are the dark mode, the light mode is derived.",
      "No coloured button or link found; the primary is a neutral blue.",
      "No buttons, cards or fields to read corners from; 8px.",
      'The site\'s font "Papyrus" has no near match among the hosted fonts; using Inter.',
    ]),
  );
});
