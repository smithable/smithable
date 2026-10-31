// The twenty-two themes after the first four presets: nine added on 2026-10-04, rule-made
// candidates (scripts/theme-candidates.mjs) that Johan picked from their sheets; the theme lab's
// three styles (docs/design/theme-lab.md §6); and at the end the three candidates of 2026-10-18
// from a tester's report, warm-service, quiet-workspace and ink-and-brass; then the CRM's and
// the booking starter's own of 2026-10-31, workbench and stillwater, and look-gap round 2's starters' own of
// the same night, brass, paperwork, monochrome, softbox and helpdesk. Each is a theme file as
// a project would write one (docs/spec/v0.1.md, Themes), with seven colors per mode, or more where
// it names colors otherwise derived (the three of 2026-10-18 name thirteen); theme.ts parses them
// with the same parser and checks as a project's own, and derives the rest. To change one, change
// its text here: nothing else names its colors.

export const THEME_LIBRARY: Record<string, string> = {
  coastal: `# coastal: from the rule-made candidate coastal-2 (primary hue 190), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: coastal
font: Nunito Sans
radius: 12px
shadow: soft
light:
  background: "oklch(0.978 0.012 90.0)"
  foreground: "oklch(0.240 0.030 90.0)"
  card: "oklch(1.000 0.000 90.0)"
  primary: "oklch(0.500 0.120 190.0)"
  muted: "oklch(0.950 0.018 90.0)"
  border: "oklch(0.620 0.046 90.0)"
  accent: "oklch(0.940 0.040 340.0)"
dark:
  background: "oklch(0.190 0.030 190.0)"
  foreground: "oklch(0.960 0.012 190.0)"
  card: "oklch(0.245 0.036 190.0)"
  primary: "oklch(0.780 0.120 190.0)"
  muted: "oklch(0.310 0.036 190.0)"
  border: "oklch(0.600 0.036 190.0)"
  accent: "oklch(0.350 0.060 340.0)"
`,
  navy: `# navy: from the rule-made candidate corporate-blue-3 (primary hue 265), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: navy
font: Source Sans 3
radius: 4px
shadow: none
density: compact
light:
  background: "oklch(0.978 0.006 265.0)"
  foreground: "oklch(0.240 0.030 265.0)"
  card: "oklch(1.000 0.000 265.0)"
  primary: "oklch(0.450 0.170 265.0)"
  muted: "oklch(0.950 0.009 265.0)"
  border: "oklch(0.620 0.028 265.0)"
  accent: "oklch(0.940 0.040 295.0)"
dark:
  background: "oklch(0.190 0.015 265.0)"
  foreground: "oklch(0.960 0.006 265.0)"
  card: "oklch(0.245 0.018 265.0)"
  primary: "oklch(0.780 0.120 265.0)"
  muted: "oklch(0.310 0.018 265.0)"
  border: "oklch(0.600 0.018 265.0)"
  accent: "oklch(0.350 0.060 295.0)"
`,
  editorial: `# editorial: from the rule-made candidate editorial-3 (primary hue 350), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: editorial
font: Source Sans 3
radius: 2px
shadow: none
light:
  background: "oklch(0.978 0.012 85.0)"
  foreground: "oklch(0.240 0.030 85.0)"
  card: "oklch(1.000 0.000 85.0)"
  primary: "oklch(0.420 0.140 350.0)"
  muted: "oklch(0.950 0.018 85.0)"
  border: "oklch(0.620 0.046 85.0)"
  accent: "oklch(0.940 0.040 170.0)"
dark:
  background: "oklch(0.190 0.030 85.0)"
  foreground: "oklch(0.960 0.012 85.0)"
  card: "oklch(0.245 0.036 85.0)"
  primary: "oklch(0.780 0.120 350.0)"
  muted: "oklch(0.310 0.036 85.0)"
  border: "oklch(0.600 0.036 85.0)"
  accent: "oklch(0.350 0.060 170.0)"
`,
  // Not "forest": that is the name the docs, the help and the tests use for a project's own
  // theme, and a built-in of that name would refuse `addTheme forest`.
  woodland: `# woodland: from the rule-made candidate forest-2 (primary hue 160), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: woodland
font: Source Sans 3
radius: 10px
shadow: soft
light:
  background: "oklch(0.978 0.012 160.0)"
  foreground: "oklch(0.240 0.030 160.0)"
  card: "oklch(1.000 0.000 160.0)"
  primary: "oklch(0.450 0.110 160.0)"
  muted: "oklch(0.950 0.018 160.0)"
  border: "oklch(0.620 0.046 160.0)"
  accent: "oklch(0.940 0.040 40.0)"
dark:
  background: "oklch(0.190 0.030 160.0)"
  foreground: "oklch(0.960 0.012 160.0)"
  card: "oklch(0.245 0.036 160.0)"
  primary: "oklch(0.780 0.110 160.0)"
  muted: "oklch(0.310 0.036 160.0)"
  border: "oklch(0.600 0.036 160.0)"
  accent: "oklch(0.350 0.060 40.0)"
`,
  contrast: `# contrast: from the rule-made candidate high-contrast-2 (primary hue 25), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: contrast
font: Inter
radius: 4px
shadow: none
light:
  background: "oklch(1.000 0.000 25.0)"
  foreground: "oklch(0.150 0.030 25.0)"
  card: "oklch(1.000 0.000 25.0)"
  primary: "oklch(0.420 0.200 25.0)"
  muted: "oklch(0.950 0.000 25.0)"
  border: "oklch(0.450 0.010 25.0)"
  accent: "oklch(0.940 0.040 205.0)"
dark:
  background: "oklch(0.120 0.000 25.0)"
  foreground: "oklch(0.990 0.000 25.0)"
  card: "oklch(0.160 0.000 25.0)"
  primary: "oklch(0.780 0.120 25.0)"
  muted: "oklch(0.310 0.000 25.0)"
  border: "oklch(0.600 0.000 25.0)"
  accent: "oklch(0.350 0.060 205.0)"
`,
  nordic: `# nordic: from the rule-made candidate nordic-light-1 (primary hue 230), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: nordic
font: Inter
radius: 8px
shadow: soft
light:
  background: "oklch(0.978 0.008 230.0)"
  foreground: "oklch(0.240 0.030 230.0)"
  card: "oklch(1.000 0.000 230.0)"
  primary: "oklch(0.500 0.120 230.0)"
  muted: "oklch(0.950 0.012 230.0)"
  border: "oklch(0.620 0.034 230.0)"
  accent: "oklch(0.940 0.040 260.0)"
dark:
  background: "oklch(0.190 0.020 230.0)"
  foreground: "oklch(0.960 0.008 230.0)"
  card: "oklch(0.245 0.024 230.0)"
  primary: "oklch(0.780 0.120 230.0)"
  muted: "oklch(0.310 0.024 230.0)"
  border: "oklch(0.600 0.024 230.0)"
  accent: "oklch(0.350 0.060 260.0)"
`,
  pastel: `# pastel: from the rule-made candidate pastel-1 (primary hue 330), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: pastel
font: Nunito Sans
radius: 16px
shadow: raised
light:
  background: "oklch(0.978 0.020 330.0)"
  foreground: "oklch(0.240 0.030 330.0)"
  card: "oklch(1.000 0.000 330.0)"
  primary: "oklch(0.550 0.100 330.0)"
  muted: "oklch(0.950 0.030 330.0)"
  border: "oklch(0.620 0.070 330.0)"
  accent: "oklch(0.940 0.040 30.0)"
dark:
  background: "oklch(0.190 0.050 330.0)"
  foreground: "oklch(0.960 0.020 330.0)"
  card: "oklch(0.245 0.060 330.0)"
  primary: "oklch(0.780 0.100 330.0)"
  muted: "oklch(0.310 0.060 330.0)"
  border: "oklch(0.600 0.060 330.0)"
  accent: "oklch(0.350 0.060 30.0)"
`,
  midnight: `# midnight: from the rule-made candidate tech-dark-3 (primary hue 280), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: midnight
font: Inter
radius: 6px
shadow: none
light:
  background: "oklch(0.970 0.010 260.0)"
  foreground: "oklch(0.240 0.030 260.0)"
  card: "oklch(1.000 0.000 260.0)"
  primary: "oklch(0.500 0.150 280.0)"
  muted: "oklch(0.950 0.015 260.0)"
  border: "oklch(0.620 0.040 260.0)"
  accent: "oklch(0.940 0.040 100.0)"
dark:
  background: "oklch(0.190 0.025 260.0)"
  foreground: "oklch(0.960 0.010 260.0)"
  card: "oklch(0.245 0.030 260.0)"
  primary: "oklch(0.780 0.120 280.0)"
  muted: "oklch(0.310 0.030 260.0)"
  border: "oklch(0.600 0.030 260.0)"
  accent: "oklch(0.350 0.060 100.0)"
`,
  craft: `# craft: from the rule-made candidate warm-craft-1 (primary hue 45), picked by Johan 2026-10-04.
smithableTheme: 0.1
name: craft
font: Nunito Sans
radius: 12px
shadow: soft
light:
  background: "oklch(0.978 0.015 75.0)"
  foreground: "oklch(0.240 0.030 75.0)"
  card: "oklch(1.000 0.000 75.0)"
  primary: "oklch(0.500 0.130 45.0)"
  muted: "oklch(0.950 0.022 75.0)"
  border: "oklch(0.620 0.055 75.0)"
  accent: "oklch(0.940 0.040 195.0)"
dark:
  background: "oklch(0.190 0.037 75.0)"
  foreground: "oklch(0.960 0.015 75.0)"
  card: "oklch(0.245 0.045 75.0)"
  primary: "oklch(0.780 0.120 45.0)"
  muted: "oklch(0.310 0.045 75.0)"
  border: "oklch(0.600 0.045 75.0)"
  accent: "oklch(0.350 0.060 195.0)"
`,
  restaurant: `# restaurant: the Nordic restaurant of docs/design/theme-lab.md §6 (step 2, 2026-10-13).
smithableTheme: 0.1
name: restaurant
fonts:
  body: Source Sans 3
  heading: Fraunces
radius: 6px
shadow: none
headings:
  weight: 600
  tracking: normal
  scale: large
surfaces:
  cards: flat
  sections: open
  dividers: light
light:
  background: "oklch(0.975 0.018 85.0)"
  foreground: "oklch(0.250 0.030 150.0)"
  card: "oklch(0.910 0.030 85.0)"
  primary: "oklch(0.420 0.090 155.0)"
  muted: "oklch(0.940 0.020 85.0)"
  border: "oklch(0.620 0.040 120.0)"
  accent: "oklch(0.930 0.040 60.0)"
dark:
  background: "oklch(0.200 0.025 155.0)"
  foreground: "oklch(0.955 0.015 85.0)"
  card: "oklch(0.260 0.030 155.0)"
  primary: "oklch(0.780 0.100 155.0)"
  muted: "oklch(0.310 0.030 155.0)"
  border: "oklch(0.600 0.030 155.0)"
  accent: "oklch(0.360 0.050 60.0)"
`,
  "street-food": `# street-food: the Street food of docs/design/theme-lab.md §6 (step 2, 2026-10-13). Its headings
# are tracked wide, not tight: capitals set tight are refused (theme-style.ts).
smithableTheme: 0.1
name: street-food
fonts:
  body: DM Sans
  heading: Archivo Narrow
radius: 0px
shadow: none
headings:
  weight: 700
  tracking: wide
  scale: large
  case: upper
surfaces:
  cards: bordered
  sections: boxed
  dividers: strong
buttons:
  shape: square
  weight: bold
light:
  background: "oklch(0.985 0.000 0.0)"
  foreground: "oklch(0.170 0.010 30.0)"
  card: "oklch(1.000 0.000 0.0)"
  primary: "oklch(0.550 0.220 30.0)"
  muted: "oklch(0.950 0.005 30.0)"
  border: "oklch(0.300 0.010 30.0)"
  accent: "oklch(0.920 0.120 95.0)"
dark:
  background: "oklch(0.160 0.010 30.0)"
  foreground: "oklch(0.970 0.005 95.0)"
  card: "oklch(0.210 0.010 30.0)"
  primary: "oklch(0.700 0.200 35.0)"
  muted: "oklch(0.270 0.010 30.0)"
  border: "oklch(0.650 0.020 30.0)"
  accent: "oklch(0.400 0.100 95.0)"
`,
  cafe: `# cafe: the Neighbourhood café of docs/design/theme-lab.md §6 (step 2, 2026-10-13).
smithableTheme: 0.1
name: cafe
fonts:
  body: Nunito Sans
radius: 16px
shadow: soft
headings:
  weight: 700
  tracking: normal
  scale: regular
surfaces:
  cards: raised
  sections: open
  dividers: none
buttons:
  shape: pill
pictures:
  corners: theme
light:
  background: "oklch(0.970 0.012 70.0)"
  foreground: "oklch(0.280 0.030 50.0)"
  card: "oklch(0.995 0.005 70.0)"
  primary: "oklch(0.520 0.100 45.0)"
  muted: "oklch(0.940 0.018 70.0)"
  border: "oklch(0.800 0.025 60.0)"
  accent: "oklch(0.930 0.040 140.0)"
dark:
  background: "oklch(0.210 0.020 50.0)"
  foreground: "oklch(0.950 0.012 70.0)"
  card: "oklch(0.260 0.025 50.0)"
  primary: "oklch(0.760 0.100 45.0)"
  muted: "oklch(0.310 0.025 50.0)"
  border: "oklch(0.580 0.030 50.0)"
  accent: "oklch(0.360 0.050 140.0)"
`,
  "warm-service": `smithableTheme: 0.1
name: warm-service
fonts: { body: DM Sans, heading: DM Sans }
headings: { weight: 600, tracking: normal, scale: regular, case: none }
surfaces: { cards: bordered, sections: open, dividers: light }
buttons: { shape: rounded, weight: regular }
pictures: { corners: theme, frame: none }
tables: { numbers: tabular, rows: lined }
radius: 10px
shadow: none
density: comfortable
motion: subtle
chroma: 0.12
light:
  background: "#F7F5F0"
  foreground: "#24332F"
  card: "#FFFFFF"
  primary: "#21655B"
  primary-foreground: "#FFFFFF"
  muted: "#EDEFE9"
  muted-foreground: "#59665F"
  border: "#D9DED7"
  input: "#7E8C83"
  ring: "#21655B"
  sidebar: "#F0F1EB"
  accent: "#E2EEE8"
  secondary: "#EDEFE9"
dark:
  background: "#141C1A"
  foreground: "#E7EEE9"
  card: "#1D2924"
  primary: "#91C9BB"
  primary-foreground: "#142C25"
  muted: "#28362F"
  muted-foreground: "#AABBB0"
  border: "#34463C"
  input: "#6E8577"
  ring: "#91C9BB"
  sidebar: "#18231E"
  accent: "#2A4237"
  secondary: "#28362F"
`,
  "quiet-workspace": `smithableTheme: 0.1
name: quiet-workspace
fonts: { body: Inter, heading: Inter }
headings: { weight: 600, tracking: tight, scale: regular, case: none }
surfaces: { cards: bordered, sections: open, dividers: light }
buttons: { shape: rounded, weight: regular }
pictures: { corners: theme, frame: none }
tables: { numbers: tabular, rows: lined }
radius: 8px
shadow: small
density: compact
motion: subtle
chroma: 0.14
light:
  background: "#F5F7FA"
  foreground: "#1B2B3F"
  card: "#FFFFFF"
  primary: "#2657A7"
  primary-foreground: "#FFFFFF"
  muted: "#EDF1F6"
  muted-foreground: "#5E6E82"
  border: "#DFE5EC"
  input: "#8190A3"
  ring: "#2657A7"
  sidebar: "#F0F3F8"
  accent: "#E8EFFB"
  secondary: "#EDF1F6"
dark:
  background: "#121A25"
  foreground: "#E7EDF5"
  card: "#1B2534"
  primary: "#9BBEF9"
  primary-foreground: "#14243A"
  muted: "#263448"
  muted-foreground: "#AFBDD0"
  border: "#344356"
  input: "#74849B"
  ring: "#9BBEF9"
  sidebar: "#151F2D"
  accent: "#283F5F"
  secondary: "#263448"
`,
  "ink-and-brass": `smithableTheme: 0.1
name: ink-and-brass
fonts: { body: Source Sans 3, heading: Source Sans 3 }
headings: { weight: 600, tracking: normal, scale: regular, case: none }
surfaces: { cards: bordered, sections: open, dividers: light }
buttons: { shape: rounded, weight: regular }
pictures: { corners: theme, frame: none }
tables: { numbers: tabular, rows: lined }
radius: 8px
shadow: none
density: comfortable
motion: subtle
chroma: 0.10
light:
  background: "#F8F7F3"
  foreground: "#172B40"
  card: "#FFFFFF"
  primary: "#163B5C"
  primary-foreground: "#FFFFFF"
  muted: "#EEEFEA"
  muted-foreground: "#596779"
  border: "#DFE2E1"
  input: "#7B8B98"
  ring: "#163B5C"
  sidebar: "#F0F1EE"
  accent: "#E6EDF1"
  secondary: "#EEEFEA"
dark:
  background: "#101B2A"
  foreground: "#E8EEF4"
  card: "#1A293A"
  primary: "#E9BD68"
  primary-foreground: "#152A40"
  muted: "#23364A"
  muted-foreground: "#B1BECF"
  border: "#34495E"
  input: "#7790A8"
  ring: "#E9BD68"
  sidebar: "#142233"
  accent: "#3D3527"
  secondary: "#23364A"
`,
  workbench: `# workbench: the CRM starter's own (docs/design/look-gap.md §3, 2026-10-31): a quiet near-white
# workspace with a light sidebar, one neutral face at medium weights, colour kept for the data.
smithableTheme: 0.1
name: workbench
fonts: { body: Inter, heading: Inter }
headings: { weight: 600, tracking: tight, scale: regular, case: none }
surfaces: { cards: bordered, sections: open, dividers: light }
buttons: { shape: rounded, weight: regular }
pictures: { corners: round, frame: none }
tables: { numbers: tabular, rows: lined }
radius: 6px
shadow: none
density: compact
motion: subtle
chroma: 0.08
light:
  background: "#FAFAF9"
  foreground: "#18212B"
  card: "#FFFFFF"
  primary: "#1D6B63"
  muted: "#F1F2F1"
  border: "#DADDDC"
  accent: "#E5F0EE"
  sidebar: "#F2F3F2"
dark:
  background: "#121519"
  foreground: "#E6E9EC"
  card: "#1A1E23"
  primary: "#62C0B3"
  muted: "#22272D"
  border: "#343B43"
  accent: "#1E3532"
  sidebar: "#171B20"
`,
  stillwater: `# stillwater: the booking starter's own (docs/design/look-gap.md §3, 2026-10-31; round 2 the same
# night): ink on warm paper with one terracotta accent, a display serif set large and light, rules
# and space instead of boxes, square buttons and pictures.
smithableTheme: 0.1
name: stillwater
fonts: { body: Source Sans 3, heading: Fraunces }
headings: { weight: 500, tracking: tight, scale: large, case: none }
surfaces: { cards: flat, sections: open, dividers: light }
buttons: { shape: square, weight: bold }
pictures: { corners: square, frame: none }
tables: { numbers: tabular, rows: lined }
radius: 4px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.12
light:
  background: "#F4F1EC"
  foreground: "#1A1A18"
  card: "#F6F5F1"
  primary: "#A8482A"
  muted: "#E2E1DB"
  border: "#CFCDC5"
  accent: "#E4E2DA"
dark:
  background: "#171615"
  foreground: "#ECE8E1"
  card: "#1C1D1F"
  primary: "#E39A7C"
  muted: "#26282A"
  border: "#3A3C3F"
  accent: "#2A2B2D"
`,
  brass: `# brass: the barbers starter's own (look-gap round 2, 2026-10-31): bottle green on cream, brass in
# the dark, a light display serif in small tracked capitals over the sections, hairline rules,
# square buttons and pictures.
smithableTheme: 0.1
name: brass
fonts: { body: DM Sans, heading: Fraunces }
headings: { weight: 400, tracking: normal, scale: large, case: upper }
surfaces: { cards: bordered, sections: open, dividers: light }
buttons: { shape: square, weight: bold }
pictures: { corners: square, frame: none }
tables: { numbers: tabular, rows: lined }
radius: 2px
shadow: none
density: comfortable
motion: subtle
chroma: 0.10
light: { background: "#F4EFE6", foreground: "#1C2420", primary: "#1F3A2E" }
dark: { background: "#14201B", foreground: "#EFE9DD", primary: "#D6B67A" }
`,
  paperwork: `# paperwork: the invoicing starter's own (look-gap round 2, 2026-10-31): a geometric heading over Inter,
# firm titles, form sections as bordered blocks, amounts in tabular figures; modern's colours.
smithableTheme: 0.1
name: paperwork
fonts: { body: Inter, heading: DM Sans }
headings: { weight: 700, tracking: tight, scale: regular, case: none }
surfaces: { cards: bordered, sections: boxed, dividers: light }
buttons: { shape: rounded, weight: bold }
pictures: { corners: theme, frame: none }
tables: { numbers: tabular, rows: lined }
radius: 10px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.22
light: { background: "oklch(0.976510 0.005419 274.9666)", foreground: "oklch(0.244862 0.038771 264.3540)", primary: "oklch(0.510573 0.230053 276.9656)" }
dark: { background: "oklch(0.197469 0.027449 267.7258)", foreground: "oklch(0.961159 0.018238 269.0896)", primary: "oklch(0.785298 0.104135 274.7134)" }
`,
  monochrome: `# monochrome: the marketplace starter's own (look-gap round 2, 2026-10-31): black on white, heavy
# geometric titles in capitals, hairline tiles, near-square corners, no tint in badges or links.
smithableTheme: 0.1
name: monochrome
fonts: { body: Inter, heading: DM Sans }
headings: { weight: 700, tracking: normal, scale: large, case: upper }
surfaces: { cards: bordered, sections: open, dividers: light }
buttons: { shape: square, weight: bold }
pictures: { corners: theme, frame: none }
radius: 6px
shadow: none
density: comfortable
motion: subtle
chroma: 0.02
light: { background: "#FFFFFF", foreground: "#111111", primary: "#111111" }
dark: { background: "#121212", foreground: "#F2F2F2", primary: "#F2F2F2" }
`,
  softbox: `# softbox: the status starter's own (look-gap round 2, 2026-10-31): a friendly geometric face, small
# medium titles so the status comes first, each part in a soft bordered box, pill buttons, no
# shadow; minimal's colours.
smithableTheme: 0.1
name: softbox
fonts: { body: DM Sans }
headings: { weight: 500, tracking: normal, scale: small, case: none }
surfaces: { cards: bordered, sections: boxed, dividers: light }
buttons: { shape: pill, weight: regular }
tables: { numbers: tabular, rows: lined }
radius: 20px
shadow: none
density: comfortable
motion: subtle
chroma: 0.08
light: { background: "oklch(0.982049 0.004110 91.4458)", foreground: "oklch(0.256472 0.003981 84.5842)", primary: "oklch(0.268485 0.006287 34.2976)" }
dark: { background: "oklch(0.195324 0.001971 106.5807)", foreground: "oklch(0.966535 0.006712 97.3521)", primary: "oklch(0.969871 0.001324 106.4238)" }
`,
  helpdesk: `# helpdesk: the support starter's own (look-gap round 2, 2026-10-31): a neutral grotesque, small firm
# titles, the form and the thread lifted a little off the page, quiet rounded buttons; minimal's
# colours, a little warmer in its badges.
smithableTheme: 0.1
name: helpdesk
fonts: { body: Inter }
headings: { weight: 600, tracking: tight, scale: small, case: none }
surfaces: { cards: raised, sections: boxed, dividers: light }
buttons: { shape: rounded, weight: regular }
tables: { numbers: tabular, rows: lined }
radius: 12px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.12
light: { background: "oklch(0.982049 0.004110 91.4458)", foreground: "oklch(0.256472 0.003981 84.5842)", primary: "oklch(0.268485 0.006287 34.2976)" }
dark: { background: "oklch(0.195324 0.001971 106.5807)", foreground: "oklch(0.966535 0.006712 97.3521)", primary: "oklch(0.969871 0.001324 106.4238)" }
`,
};
