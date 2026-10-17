import { expect, test } from "vitest";
import { BUILT_IN_THEMES, parseTheme } from "./theme.js";
import { themeFit } from "./theme-fit.js";
import { DEFAULT_STYLE } from "./theme-style.js";

const colors = `light: { primary: "#2f5d50", background: "#f7f3ec", foreground: "#1f2420" }
dark: { primary: "#9fcbb8", background: "#171a18", foreground: "#ebe7df" }
`;
const read = (fields: string) =>
  parseTheme({ path: "themes/nordic.yml", text: `smithableTheme: 0.1\n${fields}${colors}` });
const codes = (fields: string) => read(fields).diagnostics.map((d) => d.code);

test("a theme that says nothing has today's modern shape", () => {
  const { theme } = read("");
  expect(theme?.style).toEqual(DEFAULT_STYLE);
  expect(theme?.font).toBe("Inter");
});

test("the style fields of a theme file", () => {
  const { theme, diagnostics } = read(`fonts: { body: Source Sans 3, heading: Fraunces }
headings: { weight: 600, tracking: normal, scale: large, case: none }
surfaces: { cards: flat, sections: open, dividers: light }
buttons: { shape: pill, weight: bold }
pictures: { corners: round, frame: border }
tables: { numbers: tabular, rows: zebra }
`);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(theme?.font).toBe("Source Sans 3");
  expect(theme?.style).toEqual({
    headingFont: "Fraunces",
    headings: { weight: 600, tracking: "normal", scale: "large", case: "none" },
    surfaces: { cards: "flat", sections: "open", dividers: "light" },
    buttons: { shape: "pill", weight: "bold" },
    pictures: { corners: "round", frame: "border" },
    tables: { numbers: "tabular", rows: "zebra" },
  });
  // A group can say one thing; the rest stays the default.
  expect(read("surfaces: { cards: raised }\n").theme?.style.surfaces).toEqual({
    ...DEFAULT_STYLE.surfaces,
    cards: "raised",
  });
});

test("fonts from the list only, values from their sets, and no tight capitals", () => {
  expect(codes("fonts: { heading: Comic Sans }\n")).toContain("invalid-value");
  expect(codes("font: Inter\nfonts: { body: DM Sans }\n")).toContain("invalid-value");
  expect(codes("headings: { weight: 650 }\n")).toContain("invalid-value");
  // A weight the heading font lacks: Archivo Narrow goes from 400 to 700.
  expect(codes("fonts: { heading: Archivo Narrow }\nheadings: { weight: 800 }\n")).toContain(
    "invalid-value",
  );
  expect(codes("fonts: { heading: Archivo Narrow }\nheadings: { weight: 700 }\n")).not.toContain(
    "invalid-value",
  );
  expect(codes("surfaces: { cards: glass }\n")).toContain("invalid-value");
  expect(codes("buttons: { colour: red }\n")).toContain("unknown-key");
  expect(codes("headings: { case: upper, tracking: tight }\n")).toContain("invalid-value");
  expect(codes("headings: { case: upper, tracking: wide }\n")).not.toContain("invalid-value");
  // The old single font still reads.
  expect(read("font: DM Sans\n").theme?.font).toBe("DM Sans");
});

test("the four presets carry their shapes as data", () => {
  const style = (name: string) => BUILT_IN_THEMES.find((t) => t.name === name)?.style;
  expect(style("modern")).toEqual(DEFAULT_STYLE);
  expect(style("minimal")?.headings).toMatchObject({ weight: 600, tracking: "normal" });
  expect(style("playful")).toMatchObject({
    headings: { weight: 800 },
    surfaces: { cards: "raised" },
    buttons: { shape: "pill" },
  });
  expect(style("corporate")).toMatchObject({
    headings: { weight: 600 },
    tables: { numbers: "tabular" },
  });
  // The library's nine have the default shape, as before.
  for (const t of BUILT_IN_THEMES.slice(8, 17)) expect(t.style, t.name).toEqual(DEFAULT_STYLE);
});

test("the theme lab's three styles (§6) read with their fields, and none has an avoid", () => {
  const theme = (name: string) => BUILT_IN_THEMES.find((t) => t.name === name);
  expect(theme("restaurant")?.style).toMatchObject({
    headingFont: "Fraunces",
    headings: { weight: 600, scale: "large" },
    surfaces: { cards: "flat" },
  });
  expect(theme("street-food")?.style).toMatchObject({
    headingFont: "Archivo Narrow",
    headings: { weight: 700, tracking: "wide", case: "upper" },
    surfaces: { sections: "boxed", dividers: "strong" },
  });
  expect(theme("cafe")?.style).toMatchObject({
    surfaces: { cards: "raised", dividers: "none" },
    buttons: { shape: "pill" },
  });
  for (const name of ["restaurant", "street-food", "cafe"])
    expect(
      themeFit(theme(name) as never).filter((f) => f.verdict === "avoid"),
      name,
    ).toEqual([]);
});

test("the fit lines: fine, a note or avoid, each with its sentence", () => {
  const fit = (fields: string) =>
    Object.fromEntries(themeFit(read(fields).theme as never).map((f) => [f.rule, f.verdict]));
  expect(Object.values(fit(""))).toEqual(["fine", "fine", "fine", "fine", "fine", "fine"]);
  expect(fit("fonts: { heading: Fraunces }\nheadings: { scale: large }\n")["split-hero"]).toBe(
    "note",
  );
  expect(fit("fonts: { heading: Fraunces }\nheadings: { scale: small }\n")["heading-scale"]).toBe(
    "note",
  );
  expect(fit("surfaces: { cards: flat }\n")["card-grid"]).toBe("avoid");
  expect(fit("tables: { rows: zebra }\nsurfaces: { dividers: strong }\n")["table-rows"]).toBe(
    "note",
  );
  expect(fit("surfaces: { sections: boxed, cards: raised }\n").sections).toBe("note");
  for (const line of themeFit(read("").theme as never)) expect(line.text.length).toBeGreaterThan(5);
});
