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
headings: { weight: 600, tracking: normal, scale: large, case: none, align: center }
surfaces: { cards: flat, sections: open, dividers: light }
buttons: { shape: pill, weight: bold }
pictures: { corners: round, frame: border }
tables: { numbers: tabular, rows: zebra }
`);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(theme?.font).toBe("Source Sans 3");
  expect(theme?.style).toEqual({
    headingFont: "Fraunces",
    headings: { weight: 600, tracking: "normal", scale: "large", case: "none", align: "center" },
    labels: { case: "none", tracking: "normal" },
    surfaces: { cards: "flat", sections: "open", dividers: "light", bands: "soft" },
    buttons: { shape: "pill", weight: "bold" },
    pictures: { corners: "round", frame: "border", treatment: "natural" },
    tables: { numbers: "tabular", rows: "zebra" },
    texture: "none",
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
  expect(codes("surfaces: { cards: foggy }\n")).toContain("invalid-value");
  expect(codes("headings: { align: right }\n")).toContain("invalid-value");
  expect(read("fonts: { body: Outfit }\n").theme?.font).toBe("Outfit");
  // A banded theme: every second landing section on the muted band; open is the default.
  expect(read("surfaces: { sections: banded }\n").theme?.style.surfaces.sections).toBe("banded");
  expect(codes("surfaces: { sections: striped }\n")).toContain("invalid-value");
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
  for (const t of BUILT_IN_THEMES.slice(4, 13)) expect(t.style, t.name).toEqual(DEFAULT_STYLE);
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

test("look breadth (docs/design/look-breadth.md §2–3): the new faces and fields", () => {
  // Twelve more faces; a one-weight face takes 400 alone; a display face is no body font.
  expect(
    read(
      "fonts: { body: Hanken Grotesk, heading: Instrument Serif, labels: JetBrains Mono }\nheadings: { weight: 400 }\n",
    ).theme?.style,
  ).toMatchObject({
    headingFont: "Instrument Serif",
    labelsFont: "JetBrains Mono",
  });
  expect(codes("fonts: { heading: Instrument Serif }\nheadings: { weight: 600 }\n")).toContain(
    "invalid-value",
  );
  expect(
    read("fonts: { heading: Instrument Serif }\nheadings: { weight: 600 }\n").diagnostics[0]
      ?.message,
  ).toContain("400 to 400");
  const body = read("fonts: { body: Big Shoulders Display }\n");
  expect(body.diagnostics.map((d) => d.message)).toEqual([expect.stringContaining("display face")]);
  // The weight range: 300 to 900 within the face's own.
  expect(
    read("fonts: { heading: Mona Sans }\nheadings: { weight: 300 }\n").theme?.style.headings.weight,
  ).toBe(300);
  expect(
    read("fonts: { heading: Mona Sans }\nheadings: { weight: 900 }\n").theme?.style.headings.weight,
  ).toBe(900);
  expect(codes("headings: { weight: 200 }\n")).toContain("invalid-value");
  // Labels follow the headings until said: capitals bring wide tracking.
  expect(read("headings: { case: upper, tracking: wide }\n").theme?.style.labels).toEqual({
    case: "upper",
    tracking: "wide",
  });
  expect(
    read("headings: { case: upper, tracking: wide }\nlabels: { case: none }\n").theme?.style.labels,
  ).toEqual({ case: "none", tracking: "normal" });
  expect(read("labels: { case: upper }\n").theme?.style.labels).toEqual({
    case: "upper",
    tracking: "wide",
  });
  expect(read("labels: { case: upper, tracking: normal }\n").theme?.style.labels).toEqual({
    case: "upper",
    tracking: "normal",
  });
  // Glass, bands, huge, treatment, texture.
  const bold = read(
    "headings: { scale: huge }\nsurfaces: { cards: glass, bands: strong }\npictures: { treatment: duotone }\ntexture: grain\n",
  );
  expect(bold.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(bold.theme?.style).toMatchObject({
    headings: { scale: "huge" },
    surfaces: { cards: "glass", bands: "strong" },
    pictures: { treatment: "duotone" },
    texture: "grain",
  });
  expect(codes("texture: velvet\n")).toContain("invalid-value");
  expect(codes("pictures: { treatment: sepia }\n")).toContain("invalid-value");
  // Text on glass is read on the card's tint over the band: a pale text on it is said.
  const faint = parseTheme({
    path: "themes/x.yml",
    text: `smithableTheme: 0.1\nsurfaces: { cards: glass }\nlight: { primary: "#2f5d50", background: "#f7f3ec", foreground: "#1f2420", card: "#ffffff", card-foreground: "#8a8f8c" }\ndark: { primary: "#9fcbb8", background: "#171a18", foreground: "#ebe7df" }\n`,
  });
  expect(faint.diagnostics.map((d) => d.message)).toEqual(
    expect.arrayContaining([expect.stringContaining("glass card")]),
  );
});

test("a one-mode theme (modes: light | dark) carries one block and fills the other", () => {
  const dark = parseTheme({
    path: "themes/dusk.yml",
    text: `smithableTheme: 0.1\nmodes: dark\ndark: { primary: "#9fcbb8", background: "#171a18", foreground: "#ebe7df" }\n`,
  });
  expect(dark.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(dark.theme?.modes).toBe("dark");
  expect(dark.theme?.light).toEqual(dark.theme?.dark);
  // The other mode's colours would never show: refused, so the file says what is seen.
  const both = parseTheme({
    path: "themes/dusk.yml",
    text: `smithableTheme: 0.1\nmodes: dark\nlight: { primary: "#2f5d50", background: "#f7f3ec", foreground: "#1f2420" }\ndark: { primary: "#9fcbb8", background: "#171a18", foreground: "#ebe7df" }\n`,
  });
  expect(both.diagnostics.map((d) => d.code)).toContain("unknown-key");
  expect(codes("modes: dusk\n")).toContain("invalid-value");
  expect(read("").theme?.modes).toBe("both");
  for (const t of BUILT_IN_THEMES) expect(t.modes, t.name).toBe("both");
});
