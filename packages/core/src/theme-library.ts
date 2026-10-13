// The nine themes added to the built-in presets on 2026-10-04 (and the theme lab's three styles,
// docs/design/theme-lab.md §6, at the end): rule-made candidates
// (scripts/theme-candidates.mjs) that Johan picked from their sheets. Each is a theme file as a
// project would write one (docs/spec/v0.1.md, Themes), with seven colors per mode; theme.ts
// parses them with the same parser and checks as a project's own, and derives the rest. To
// change one, change its text here: nothing else names its colors.

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
  weight: 800
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
};
