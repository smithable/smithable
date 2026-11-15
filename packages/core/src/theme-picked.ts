// Imported catalogue themes selected for the gallery. Their source and licence are named in each file.
export const PICKED_THEMES = {
  arcade: `# Arcade, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# aubergine CRT ground, lilac-white ink, Bungee capitals split in RGB over Chivo, Silkscreen figures, hard offset shadows, ember and acid signals
# The original Bungee display and Chivo body faces are self-hosted.
# keywords: game, indie, game studio, launch party, demo night, hackathon, festival, meetup, retro, pixel, arcade, nostalgia, synth, lo-fi, toy, zine, club night, loud
smithableTheme: 0.1
name: arcade
fonts: { body: Chivo, heading: Bungee }
headings: { weight: 400, tracking: normal, case: upper }
surfaces: { cards: bordered }
buttons: { shape: square }
pictures: { treatment: duotone }
tables: { numbers: tabular }
radius: 4px
shadow: none
density: comfortable
motion: subtle
chroma: 0.2
light:
  background: "#fdf8ff"
  foreground: "#1a151b"
  card: "#ffffff"
  primary: "#f3580e"
  muted: "#eee8ef"
  border: "#b2acb3"
  accent: "#ffe5dc"
dark:
  background: "#0f0415"
  foreground: "#f2ecf5"
  card: "#190d20"
  muted: "#190d20"
  secondary: "#24162c"
  border: "#41304b"
  input: "#6d5e75"
  primary: "#f3580e"
  primary-foreground: "#0f0415"
  sidebar: "#190d20"
`,
  darkmatter: `# Darkmatter, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Geist Mono → JetBrains Mono.
# letter-spacing 0rem is body tracking, which a theme file does not have.
smithableTheme: 0.1
name: darkmatter
fonts: { body: JetBrains Mono }
surfaces: { cards: raised }
radius: 12px
shadow: small
density: comfortable
motion: subtle
chroma: 0.14
light:
  background: "#ffffff"
  foreground: "#111827"
  card: "#ffffff"
  primary: "#d87943"
  muted: "#f3f4f6"
  border: "#e5e7eb"
  input: "#858b95"
  sidebar: "#f3f4f6"
  chart-1: "#5f8787"
  chart-2: "#e78a53"
  chart-3: "#fbcb97"
  chart-4: "#888888"
  chart-5: "#999999"
dark:
  background: "#121113"
  foreground: "#c1c1c1"
  card: "#121212"
  primary: "#e78a53"
  muted: "#222222"
  border: "#222222"
  input: "#676767"
  sidebar: "#121212"
  chart-1: "#5f8787"
  chart-2: "#e78a53"
  chart-3: "#fbcb97"
  chart-4: "#888888"
  chart-5: "#999999"
`,
  halftone: `# Halftone, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# butter-cream stock, brown-black ink, Ultra over Chivo, three-pixel ink rules and square wells, one vermilion printed solid and through a dot screen, photographs in full colour
# Faces we do not host: Ultra → Zilla Slab; Chivo → Hanken Grotesk.
# keywords: drinks, soda, food brand, print shop, zine, magazine, record label, packaging, campaign, label, bottle, can, screen print, bold, one colour, retail, craft, loud, fruit, snack
smithableTheme: 0.1
name: halftone
fonts: { body: Hanken Grotesk, heading: Zilla Slab }
headings: { weight: 400, tracking: normal }
surfaces: { cards: glass, dividers: light }
buttons: { shape: rounded }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.2
light:
  background: "#f9f3db"
  foreground: "#2d160f"
  card: "#f9f3db"
  muted: "#f1e6c4"
  secondary: "#e5d5ab"
  border: "#d2c2a6"
  input: "#95826d"
  primary: "#c92d09"
  primary-foreground: "#faf5e5"
  sidebar: "#f1e6c4"
dark:
  background: "#151001"
  foreground: "#efebdc"
  card: "#1e1906"
  primary: "#c92d09"
  muted: "#1f1a08"
  border: "#4e4937"
  accent: "#231b01"
`,
  "starry-night": `# Starry Night, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Libre Baskerville → Newsreader.
smithableTheme: 0.1
name: starry-night
fonts: { body: Newsreader }
surfaces: { cards: bordered }
radius: 8px
shadow: none
density: comfortable
motion: subtle
chroma: 0.12
light:
  background: "#f5f7fa"
  foreground: "#1a2238"
  card: "#e3eaf2"
  primary: "#3a5ba0"
  muted: "#e5e5df"
  border: "#b0b8c1"
  input: "#77808f"
  sidebar: "#e3eaf2"
  chart-1: "#3a5ba0"
  chart-2: "#f7c873"
  chart-3: "#6ea3c1"
  chart-4: "#b0b8c1"
  chart-5: "#2d1e2f"
dark:
  background: "#181a24"
  foreground: "#e6eaf3"
  card: "#23243a"
  primary: "#3a5ba0"
  muted: "#1d1e2f"
  border: "#2d2e3e"
  input: "#737484"
  sidebar: "#23243a"
  chart-1: "#3a5ba0"
  chart-2: "#ffe066"
  chart-3: "#6ea3c1"
  chart-4: "#7a88a1"
  chart-5: "#a04a6c"
`,
  nature: `# Nature, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Montserrat → Outfit.
smithableTheme: 0.1
name: nature
fonts: { body: Outfit }
surfaces: { cards: bordered }
radius: 8px
shadow: none
density: comfortable
motion: subtle
chroma: 0.13
light:
  background: "#f8f5f0"
  foreground: "#3e2723"
  card: "#f8f5f0"
  primary: "#2e7d32"
  muted: "#f0e9e0"
  border: "#e0d6c9"
  input: "#9a8980"
  sidebar: "#f0e9e0"
  chart-1: "#4caf50"
  chart-2: "#388e3c"
  chart-3: "#2e7d32"
  chart-4: "#1b5e20"
  chart-5: "#0a1f0c"
dark:
  background: "#1c2a1f"
  foreground: "#f0ebe5"
  card: "#2d3a2e"
  primary: "#4caf50"
  muted: "#252f26"
  border: "#3e4a3d"
  input: "#82877e"
  sidebar: "#1c2a1f"
  chart-1: "#81c784"
  chart-2: "#66bb6a"
  chart-3: "#4caf50"
  chart-4: "#43a047"
  chart-5: "#388e3c"
`,
  dusk: `# Dusk, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# a real landscape at the turn of the light behind the hero, slate below it, the product in smoked glass with a lit top edge, Wix Madefor Display at a quiet weight over Wix Madefor Text, bone wells for light surfaces, one periwinkle signal and one apricot
# Faces we do not host: Wix Madefor Display → Hanken Grotesk; Wix Madefor Text → Instrument Sans.
# keywords: treasury, banking, fintech, payments, reconciliation, ledger, accounting, close, month end, audit, balance, cash management, payouts, settlement, compliance, controller, bookkeeping, finance team, invoicing, payroll, overnight, automation
smithableTheme: 0.1
name: dusk
fonts: { body: Instrument Sans, heading: Hanken Grotesk }
headings: { weight: 500, tracking: tight }
surfaces: { cards: glass }
buttons: { shape: pill }
tables: { numbers: tabular }
radius: 18px
shadow: raised
density: comfortable
motion: subtle
chroma: 0.1
light:
  background: "#f1f4ff"
  foreground: "#151619"
  card: "#ffffff"
  primary: "#7581b5"
  muted: "#e1e5ef"
  border: "#a7aab2"
  accent: "#dfe3f5"
dark:
  background: "#0e1017"
  foreground: "#f4f1ed"
  card: "#151820"
  muted: "#151820"
  secondary: "#1e212a"
  border: "#2a2e36"
  input: "#686c70"
  primary: "#a0b0f4"
  primary-foreground: "#0f1223"
  sidebar: "#151820"
`,
  "hallmark-midnight": `# Midnight, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# midnight-blue ground to every edge, cool white ink, Mona Sans expanded at 300 over its normal width, square-cut surfaces in lightness steps, photographs as moonlight, one azure signal
# Faces we do not host: var(--font-display) → Hanken Grotesk.
# keywords: render, 3d, animation, vfx, film, video, frames, pipeline, generative, ai tool, model playground, dark mode, nocturnal, late-night, after-hours, overnight, moody, cinematic, cerebral, calm, technical, midnight
smithableTheme: 0.1
name: hallmark-midnight
fonts: { body: Hanken Grotesk, heading: Mona Sans }
headings: { weight: 300, tracking: tight }
surfaces: { cards: glass }
buttons: { shape: square }
pictures: { treatment: duotone }
tables: { numbers: tabular }
radius: 0px
shadow: raised
density: comfortable
motion: subtle
chroma: 0.11
light:
  background: "#f8faff"
  foreground: "#12181e"
  card: "#ffffff"
  primary: "#4d95b6"
  muted: "#e7ebef"
  border: "#aaafb4"
  accent: "#deedf4"
dark:
  background: "#02071d"
  foreground: "#e7f0f9"
  card: "#071129"
  muted: "#071129"
  secondary: "#0f1c37"
  border: "#1c2a48"
  input: "#5a6882"
  primary: "#6bcbf7"
  primary-foreground: "#040c22"
  sidebar: "#071129"
`,
  ultraviolet: `# Ultraviolet, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# lavender paper or a violet-black night, Outfit set lowercase over Onest, hairline pills, one saturated violet in two strengths, photographs pulled into the violet
# Faces we do not host: Onest → Hanken Grotesk.
# keywords: music, audio, stems, remix, dj, producer, player, streaming, tempo, playlist, creator, app, consumer, lowercase, violet, sound, beats, recording studio
smithableTheme: 0.1
name: ultraviolet
fonts: { body: Hanken Grotesk, heading: Outfit }
headings: { weight: 500, tracking: tight }
surfaces: { cards: raised, dividers: light }
buttons: { shape: pill }
pictures: { treatment: duotone }
tables: { numbers: tabular }
radius: 16px
shadow: small
density: comfortable
motion: subtle
chroma: 0.25
light:
  background: "#f0ecfa"
  foreground: "#131019"
  card: "#f0ecfa"
  muted: "#e7e1f6"
  secondary: "#ded6ef"
  border: "#cec5e1"
  input: "#868095"
  primary: "#6b2ae3"
  primary-foreground: "#f6f4fb"
  sidebar: "#e7e1f6"
dark:
  background: "#131019"
  foreground: "#f1edfa"
  card: "#1c1922"
  primary: "#764ae8"
  muted: "#1e1a24"
  border: "#4c4954"
  accent: "#1d1932"
`,
  ribbon: `# Ribbon, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# warm off-white or blue-black night, Instrument Sans at a quiet weight over Figtree, machined parts lit from above, the hour drawn as light on a generated canvas, one signal
# Faces we do not host: Figtree → Hanken Grotesk.
# keywords: sleep, sound, soundscape, audio, night, rest, calm, wellness, meditation, white noise, ambient, listen, headphones, wind down, bedtime, quiet, breathing, app, subscription
smithableTheme: 0.1
name: ribbon
fonts: { body: Hanken Grotesk, heading: Instrument Sans }
headings: { weight: 400, tracking: tight }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: pill }
pictures: { treatment: muted }
tables: { numbers: tabular }
radius: 20px
shadow: none
density: comfortable
motion: subtle
chroma: 0.07
texture: grain
light:
  background: "#fcf9f3"
  foreground: "#13110f"
  card: "#fcf9f3"
  muted: "#f5f1e9"
  secondary: "#eae5db"
  border: "#e0dcd4"
  input: "#928f89"
  primary: "#035f5c"
  primary-foreground: "#faf8f4"
  sidebar: "#f5f1e9"
dark:
  background: "#0f0e0a"
  foreground: "#f2efec"
  card: "#191613"
  primary: "#2b6e6b"
  muted: "#1b1815"
  border: "#4b4744"
  accent: "#0f1b1a"
`,
  studio: `# Studio, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# cool studio-white proof paper with an ink dot grid and grain, blue-black ink, Hedvig Letters Serif heads over Geist, crop marks on every printed piece, orange construction guides, the work photographed in true colour, one cadmium-orange signal
# Faces we do not host: Hedvig Letters Serif → Instrument Serif; Geist → Inter.
# keywords: design studio, creative studio, branding, brand identity, art direction, agency, portfolio, case study, selected work, editorial design, typography, creative direction, graphic design, considered, curatorial
smithableTheme: 0.1
name: studio
fonts: { body: Inter, heading: Instrument Serif }
headings: { weight: 400, tracking: tight }
surfaces: { cards: bordered }
buttons: { shape: rounded }
tables: { numbers: tabular }
radius: 3px
shadow: none
density: comfortable
motion: subtle
chroma: 0.17
texture: grain
light:
  background: "#f1f7f8"
  foreground: "#030e1a"
  card: "#f1f7f8"
  muted: "#e5edef"
  secondary: "#d8e2e4"
  border: "#c4cccf"
  input: "#7a838b"
  primary: "#e97219"
  primary-foreground: "#030e1a"
  sidebar: "#e5edef"
dark:
  background: "#0c1011"
  foreground: "#e7f3fe"
  card: "#15181b"
  primary: "#e97219"
  muted: "#171a1d"
  border: "#454a4f"
  accent: "#2b1b12"
`,
  vantage: `# Vantage, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# blue-black ground, a live point cloud of the real thing as the hero's light, a sweep that lights it, pale steel ink, Geologica with sharpened corners at a light weight, hairline frames with corner ticks, one lime signal for what was found
# Faces we do not host: Geologica → Hanken Grotesk; Geologica → Hanken Grotesk.
# keywords: lidar, scan, survey, mapping, 3d, spatial, point cloud, robotics, autonomy, drone, construction, digital twin, geospatial, measurement, sensor, inspection, engineering, heritage, digitisation, infrastructure, reality capture, terrain
smithableTheme: 0.1
name: vantage
fonts: { body: Hanken Grotesk }
headings: { weight: 300, tracking: tight }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: pill }
pictures: { treatment: muted }
tables: { numbers: tabular }
radius: 4px
shadow: none
density: comfortable
motion: subtle
chroma: 0.19
light:
  background: "#f6fcff"
  foreground: "#15181a"
  card: "#ffffff"
  primary: "#7c9d39"
  muted: "#e7ecf0"
  border: "#abb0b3"
  accent: "#e7efdd"
dark:
  background: "#04090c"
  foreground: "#ebeff2"
  card: "#091015"
  muted: "#091015"
  secondary: "#111a1f"
  border: "#20282c"
  input: "#5e666a"
  primary: "#bcf053"
  primary-foreground: "#0f1703"
  sidebar: "#091015"
`,
  specimen: `# Specimen, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# warm oat paper, warm near-black ink, razor-hairline Bodoni Moda over Geist, square 1px rules, one ink-blue signal that also draws the metric guides
# Faces we do not host: Geist → Inter.
# keywords: typography, type specimen, foundry, letterform, portfolio, editorial, magazine, essay, type studio, agency, brand story, print, publication, craft, considered, literary
smithableTheme: 0.1
name: specimen
fonts: { body: Inter, heading: Bodoni Moda }
headings: { weight: 400, tracking: tight, scale: large }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: square }
pictures: { treatment: duotone }
tables: { numbers: tabular }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.18
light:
  background: "#f9f3e8"
  foreground: "#130e0a"
  card: "#f9f3e8"
  muted: "#f1e8db"
  secondary: "#e4d9ca"
  border: "#c5bcb1"
  input: "#8f887e"
  primary: "#144bb7"
  primary-foreground: "#f9f5ec"
  sidebar: "#f1e8db"
dark:
  background: "#130f08"
  foreground: "#f4f0e8"
  card: "#1c1810"
  primary: "#2d5fc0"
  muted: "#1d1a12"
  border: "#4d4941"
  accent: "#111a2b"
`,
  spore: `# Spore, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# coffee-ground black with a warm grain, parchment ink, Young Serif over Instrument Sans, soft pills and grained wells, photographs lit by lamps and candles, one oyster pink
# keywords: grower, mushroom, fungi, farm, food, producer, fermentation, wine, natural wine, wine bar, bottle shop, cellar, preserves, dark, culture, night market, harvest, subscription, small batch
smithableTheme: 0.1
name: spore
fonts: { body: Instrument Sans, heading: Young Serif }
headings: { weight: 400, tracking: normal }
surfaces: { cards: glass }
buttons: { shape: pill }
pictures: { treatment: warm }
radius: 14px
shadow: raised
density: comfortable
motion: subtle
chroma: 0.09
texture: grain
light:
  background: "#fff7f0"
  foreground: "#21170f"
  card: "#ffffff"
  primary: "#be8176"
  muted: "#f0e7e1"
  border: "#b6aca5"
  accent: "#f8e5e1"
dark:
  background: "#0f0a06"
  foreground: "#efe7d8"
  card: "#19120e"
  muted: "#19120e"
  secondary: "#271d17"
  border: "#372f28"
  input: "#71695e"
  primary: "#e89f92"
  primary-foreground: "#0f0a06"
  sidebar: "#19120e"
`,
  sticker: `# Sticker, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# warm off-white paper, warm black ink, Bowlby One SC over Sofia Sans, white die-cut borders on hard offset shadows, hot pink, lime and ink fills set with type
# Faces we do not host: Bowlby One SC → Big Shoulders Display; Sofia Sans → Hanken Grotesk.
# keywords: stickers, print, merch, shop, maker, creator, diy, craft, vinyl, packaging, labels, small business, ecommerce, fun, loud, pink, cut, ship, order
smithableTheme: 0.1
name: sticker
fonts: { body: Hanken Grotesk, heading: Big Shoulders Display }
headings: { weight: 400, tracking: normal, scale: large }
surfaces: { cards: bordered }
buttons: { shape: pill }
tables: { numbers: tabular }
radius: 18px
shadow: none
density: comfortable
motion: subtle
chroma: 0.23
light:
  background: "#f5f0e7"
  foreground: "#1b1813"
  card: "#f5f0e7"
  muted: "#efe6d8"
  secondary: "#fffdf8"
  border: "#e4dccf"
  input: "#89847a"
  primary: "#d3036a"
  primary-foreground: "#fefdfb"
  sidebar: "#efe6d8"
dark:
  background: "#14110b"
  foreground: "#f0ece5"
  card: "#1d1913"
  primary: "#d3036a"
  muted: "#1f1b15"
  border: "#4d4943"
  accent: "#2e141c"
`,
  broadside: `# Broadside, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# grained buff stock, near-black ink, Six Caps and Bevan wood capitals over Archivo Narrow, ink rules at one point or five, one vermilion
# Faces we do not host: Six Caps → Oswald; Archivo Narrow → Hanken Grotesk (a display face is no body font).
# keywords: auction, sale, market, fair, event, one night, announcement, town, notice, poster, bill, lots, machinery, tools, festival, fete, hammer, date, venue, tickets
smithableTheme: 0.1
name: broadside
fonts: { body: Hanken Grotesk, heading: Oswald }
headings: { weight: 400, tracking: wide, scale: large, case: upper }
surfaces: { cards: bordered }
buttons: { shape: square }
pictures: { treatment: duotone }
tables: { numbers: tabular }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.19
texture: grain
light:
  background: "#ece4d0"
  foreground: "#15100e"
  card: "#ece4d0"
  muted: "#e2d8c2"
  secondary: "#d8cdb4"
  border: "#b7ad9a"
  input: "#877d70"
  primary: "#c12b09"
  primary-foreground: "#f5f0e3"
  sidebar: "#e2d8c2"
dark:
  background: "#1b1507"
  foreground: "#f2efe8"
  card: "#241e10"
  primary: "#c12b09"
  muted: "#262012"
  border: "#544e41"
  accent: "#2b1f00"
`,
  solstice: `# Solstice, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# cream paper, warm brown ink, Yeseva One over Archivo and Archivo Narrow, gold hairlines and hard paper shadows, photographs in low warm light, one vermilion signal
# Faces we do not host: Yeseva One → Bodoni Moda; Archivo → Hanken Grotesk.
# keywords: farm, orchard, cider, perry, winery, harvest, seasonal, food, almanac, produce, vineyard, calendar, market, craft drink, label, bottle, rural, slow, sun, midsummer
smithableTheme: 0.1
name: solstice
fonts: { body: Hanken Grotesk, heading: Bodoni Moda }
headings: { weight: 400, tracking: normal, scale: large }
surfaces: { cards: glass, dividers: light }
buttons: { shape: pill }
pictures: { treatment: warm }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.2
light:
  background: "#f6e9d5"
  foreground: "#3a1e0e"
  card: "#f6e9d5"
  muted: "#fbf4e6"
  secondary: "#ecd8b6"
  border: "#e0c69f"
  input: "#987c5f"
  primary: "#c9212e"
  primary-foreground: "#fbf4e6"
  sidebar: "#fbf4e6"
dark:
  background: "#1b1204"
  foreground: "#efe7d9"
  card: "#241a0b"
  primary: "#c9212e"
  muted: "#251c0d"
  border: "#53493a"
  accent: "#2b1c00"
`,
  kiln: `# Kiln, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# near-black ground, cream ink, Boska over Geist, smoked wells, photographs lit by the work, a heat ramp that marks temperature, one ember signal
# Faces we do not host: Boska → Bodoni Moda; Geist → Inter.
# keywords: kiln, ceramics, pottery, firing, glaze, heat, temperature, ceramics studio, craft, sensor, monitor, hardware, iot, warmth, dark, glow, schedule, workshop
smithableTheme: 0.1
name: kiln
fonts: { body: Inter, heading: Bodoni Moda }
headings: { weight: 500, tracking: tight, scale: large }
surfaces: { cards: raised }
buttons: { shape: pill }
pictures: { treatment: warm }
tables: { numbers: tabular }
radius: 28px
shadow: raised
density: comfortable
motion: subtle
chroma: 0.2
light:
  background: "#fffbfa"
  foreground: "#1d170e"
  card: "#ffffff"
  primary: "#e5610a"
  muted: "#eeece8"
  border: "#b3afaa"
  accent: "#fee7dc"
dark:
  background: "#0b0605"
  foreground: "#f2eadd"
  card: "#170e0b"
  muted: "#170e0b"
  secondary: "#221814"
  border: "#f5f1ea"
  input: "#f5f1ea"
  primary: "#fe6a00"
  primary-foreground: "#100704"
  sidebar: "#170e0b"
`,
  refract: `# Refract, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# sunlit white plaster with real light falling across it, water caustics or prism dispersion rendered live, deep pool-blue ink, Funnel Display at a light weight over Funnel Sans, clear surfaces that cast tinted shadows, one water signal
# Faces we do not host: Funnel Display → Hanken Grotesk; Funnel Sans → Hanken Grotesk.
# keywords: pool, lido, swim, spa, hotel, resort, water, skincare, sunscreen, eyewear, glass, optics, light, daylight, architecture, interiors, studio, wellness, bathhouse, summer, clean, calm, product launch, hardware
smithableTheme: 0.1
name: refract
fonts: { body: Hanken Grotesk }
headings: { weight: 400, tracking: tight }
surfaces: { cards: glass, dividers: light }
buttons: { shape: pill }
tables: { numbers: tabular }
radius: 22px
shadow: raised
density: comfortable
motion: subtle
chroma: 0.1
light:
  background: "#faf9f5"
  foreground: "#0e1f2c"
  card: "#faf9f5"
  muted: "#f4f3ef"
  secondary: "#ebeae4"
  border: "#d7dde1"
  input: "#7c8891"
  primary: "#066c95"
  primary-foreground: "#fcfcf9"
  sidebar: "#f4f3ef"
dark:
  background: "#0f0e0b"
  foreground: "#e0edf8"
  card: "#14171a"
  primary: "#066c95"
  muted: "#16191b"
  border: "#42484c"
  accent: "#0f1a20"
`,
  terrazzo: `# Terrazzo, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# off-white paper, white card surfaces ruled in ink over a hard offset, wide Syne heads over Onest, JetBrains Mono for codes and millimetres, surfaces photographed flat-on in true colour, rust the one signal
# Faces we do not host: Syne → Outfit; Onest → Hanken Grotesk.
# keywords: materials, library, architects, samples, catalogue, surfaces, stone, timber, terrazzo, ceramic, tile, interiors, interiors studio, showroom, specification, swatches, supplier, drawer, photography, tactile
smithableTheme: 0.1
name: terrazzo
fonts: { body: Hanken Grotesk, heading: Outfit }
headings: { weight: 700, tracking: tight }
surfaces: { cards: bordered }
buttons: { shape: square }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.15
texture: grain
light:
  background: "#f5f1eb"
  foreground: "#0f0d0b"
  card: "#f5f1eb"
  muted: "#e9e4dc"
  secondary: "#dbd5cc"
  border: "#c5c0b8"
  input: "#8e8a84"
  primary: "#b14420"
  primary-foreground: "#fefdfb"
  sidebar: "#e9e4dc"
dark:
  background: "#13100c"
  foreground: "#f3f0ed"
  card: "#1c1915"
  primary: "#b14420"
  muted: "#1e1a17"
  border: "#4d4946"
  accent: "#281712"
`,
  "sunset-horizon": `# Sunset Horizon, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Montserrat → Outfit.
smithableTheme: 0.1
name: sunset-horizon
fonts: { body: Outfit }
surfaces: { cards: raised }
radius: 10px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.16
light:
  background: "#fff9f5"
  foreground: "#3d3436"
  card: "#ffffff"
  primary: "#ff7e5f"
  muted: "#fff0eb"
  border: "#ffe0d6"
  input: "#9e8a86"
  sidebar: "#fff0eb"
  chart-1: "#ff7e5f"
  chart-2: "#feb47b"
  chart-3: "#ffcaa7"
  chart-4: "#ffad8f"
  chart-5: "#ce6a57"
dark:
  background: "#2a2024"
  foreground: "#f2e9e4"
  card: "#392f35"
  primary: "#ff7e5f"
  muted: "#30272c"
  border: "#463a41"
  input: "#877b7f"
  sidebar: "#2a2024"
  chart-1: "#ff7e5f"
  chart-2: "#feb47b"
  chart-3: "#ffcaa7"
  chart-4: "#ffad8f"
  chart-5: "#ce6a57"
`,
  "amber-minimal": `# Amber Minimal, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# letter-spacing 0em is body tracking, which a theme file does not have.
smithableTheme: 0.1
name: amber-minimal
fonts: { body: Inter }
surfaces: { cards: raised }
radius: 6px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.16
light:
  background: "#ffffff"
  foreground: "#262626"
  card: "#ffffff"
  primary: "#f59e0b"
  muted: "#f9fafb"
  border: "#e5e7eb"
  input: "#909194"
  sidebar: "#f9fafb"
  chart-1: "#f59e0b"
  chart-2: "#d97706"
  chart-3: "#b45309"
  chart-4: "#92400e"
  chart-5: "#78350f"
dark:
  background: "#171717"
  foreground: "#e5e5e5"
  card: "#262626"
  primary: "#f59e0b"
  muted: "#1f1f1f"
  border: "#404040"
  input: "#757575"
  sidebar: "#0f0f0f"
  chart-1: "#fbbf24"
  chart-2: "#d97706"
  chart-3: "#92400e"
  chart-4: "#b45309"
  chart-5: "#92400e"
`,
  coral: `# Coral, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# warm grey paper and a felt desk, cotton stationery lit from the left, General Sans throughout with Geist Mono figures, letterpress card controls, coral pressed into the stock for the one settled state
# Faces we do not host: General Sans → Hanken Grotesk; var(--font-display) → Hanken Grotesk.
# keywords: saas, platform, billing, payments, invoicing, dashboard, b2b, startup, product, pricing, analytics, fintech, workflow, team, onboarding, trust, warm, human, calm
smithableTheme: 0.1
name: coral
fonts: { body: Hanken Grotesk }
headings: { weight: 600, tracking: tight }
surfaces: { cards: raised }
buttons: { shape: pill }
pictures: { treatment: muted }
tables: { numbers: tabular }
radius: 8px
shadow: small
density: comfortable
motion: subtle
chroma: 0.12
texture: grain
light:
  background: "#f8f4f1"
  foreground: "#1d1614"
  card: "#f8f4f1"
  muted: "#f1ece8"
  secondary: "#e8e1dd"
  border: "#d9d3cf"
  input: "#928b87"
  primary: "#ef8b7b"
  primary-foreground: "#1d1614"
  sidebar: "#f1ece8"
dark:
  background: "#110f0d"
  foreground: "#f5eae7"
  card: "#1a1716"
  primary: "#ef8b7b"
  muted: "#1c1918"
  border: "#4c4746"
  accent: "#2b1e1b"
`,
  "amethyst-haze": `# Amethyst Haze, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Geist → Inter.
# letter-spacing 0em is body tracking, which a theme file does not have.
smithableTheme: 0.1
name: amethyst-haze
fonts: { body: Inter }
surfaces: { cards: raised }
radius: 8px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.08
light:
  background: "#f8f7fa"
  foreground: "#3d3c4f"
  card: "#ffffff"
  primary: "#8a79ab"
  muted: "#dcd9e3"
  border: "#cec9d9"
  input: "#8f8c9e"
  sidebar: "#f1eff5"
  chart-1: "#8a79ab"
  chart-2: "#e6a5b8"
  chart-3: "#77b8a1"
  chart-4: "#f0c88d"
  chart-5: "#a0bbe3"
dark:
  background: "#1a1823"
  foreground: "#e0ddef"
  card: "#232030"
  primary: "#a995c9"
  muted: "#242031"
  border: "#302c40"
  input: "#716d82"
  sidebar: "#16141e"
  chart-1: "#a995c9"
  chart-2: "#f2b8c6"
  chart-3: "#77b8a1"
  chart-4: "#f0c88d"
  chart-5: "#a0bbe3"
`,
  "cosmic-night": `# Cosmic Night, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
smithableTheme: 0.1
name: cosmic-night
fonts: { body: Inter }
surfaces: { cards: raised }
radius: 8px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.18
light:
  background: "#f5f5ff"
  foreground: "#2a2a4a"
  card: "#ffffff"
  primary: "#6e56cf"
  muted: "#f0f0fa"
  border: "#e0e0f0"
  input: "#85859f"
  sidebar: "#f0f0fa"
  chart-1: "#6e56cf"
  chart-2: "#9e8cfc"
  chart-3: "#5d5fef"
  chart-4: "#7c75fa"
  chart-5: "#4740b3"
dark:
  background: "#0f0f1a"
  foreground: "#e2e2f5"
  card: "#1a1a2e"
  primary: "#a48fff"
  muted: "#222244"
  border: "#303052"
  input: "#666888"
  sidebar: "#1a1a2e"
  chart-1: "#a48fff"
  chart-2: "#7986cb"
  chart-3: "#64b5f6"
  chart-4: "#4db6ac"
  chart-5: "#ff79c6"
`,
  caffeine: `# Caffeine, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
smithableTheme: 0.1
name: caffeine
fonts: { body: Inter }
surfaces: { cards: bordered }
radius: 8px
shadow: none
density: comfortable
motion: subtle
chroma: 0.04
light:
  background: "#f9f9f9"
  foreground: "#202020"
  card: "#fcfcfc"
  primary: "#644a40"
  muted: "#efefef"
  border: "#d8d8d8"
  input: "#868686"
  sidebar: "#fbfbfb"
  chart-1: "#644a40"
  chart-2: "#ffdfb5"
  chart-3: "#e8e8e8"
  chart-4: "#ffe6c4"
  chart-5: "#66493e"
dark:
  background: "#111111"
  foreground: "#eeeeee"
  card: "#191919"
  primary: "#ffe0c2"
  muted: "#222222"
  border: "#201e18"
  input: "#6b6a68"
  sidebar: "#18181b"
  chart-1: "#ffe0c2"
  chart-2: "#393028"
  chart-3: "#2a2a2a"
  chart-4: "#42382e"
  chart-5: "#ffe0c1"
`,
  ink: `# Ink, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# white paper, a black with no hue, Epilogue 700 over Epilogue 400, hairline rules and state pills, one teal that means in
# Faces we do not host: Epilogue → Hanken Grotesk; var(--font-display) → Hanken Grotesk.
# keywords: library, lending, community, civic, notice board, catalogue, rota, volunteer, non-profit, neighbourhood, borrow, tools, repair, membership, events, local, competent, monochrome
smithableTheme: 0.1
name: ink
fonts: { body: Hanken Grotesk, labels: JetBrains Mono }
headings: { weight: 700, tracking: tight }
surfaces: { cards: raised, dividers: light }
buttons: { shape: rounded }
pictures: { treatment: muted }
radius: 12px
shadow: raised
density: comfortable
motion: subtle
chroma: 0.09
light:
  background: "#fefdfb"
  foreground: "#0d0d0d"
  card: "#fefdfb"
  muted: "#f6f5f2"
  secondary: "#ecebe7"
  border: "#dbdbd8"
  input: "#8c8c8a"
  primary: "#01736c"
  primary-foreground: "#fefdfb"
  sidebar: "#f6f5f2"
dark:
  background: "#0d0c0b"
  foreground: "#f1f1f1"
  card: "#161415"
  primary: "#01736c"
  muted: "#181617"
  border: "#474646"
  accent: "#0f1918"
`,
  riso: `# Riso, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# bright uncoated stock and no black, a medium blue drum for every word, a fluorescent pink drum for the fills, purple where they cross, Cabinet Grotesk 800 over Literata, grain, one word a hair out of register
# Faces we do not host: Cabinet Grotesk → Mona Sans; Literata → Source Serif 4.
# keywords: risograph, riso, print studio, print fair, zine, small press, poster, art book, spot colour, two colour, indie press, diy, handmade, prints, open studio
smithableTheme: 0.1
name: riso
fonts: { body: Source Serif 4, heading: Mona Sans }
headings: { weight: 800, tracking: tight }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: rounded }
pictures: { treatment: duotone }
tables: { numbers: tabular }
radius: 2px
shadow: none
density: comfortable
motion: subtle
chroma: 0.23
texture: grain
light:
  background: "#f8f5ed"
  foreground: "#1a3c9f"
  card: "#f8f5ed"
  muted: "#fee1ea"
  secondary: "#feb0cc"
  border: "#bfceec"
  input: "#6d8bca"
  primary: "#fe419d"
  primary-foreground: "#061b64"
  sidebar: "#fee1ea"
dark:
  background: "#110f0a"
  foreground: "#e2ddcf"
  card: "#191712"
  primary: "#fe419d"
  muted: "#1b1913"
  border: "#47443c"
  accent: "#2f1620"
`,
  vellum: `# Vellum, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# parchment paper, a long tan fibre wash on bands, umber ink, Grenze Gotisch heads over Hanken Grotesk with Grenze roman for statements, hairline and double rules, one ultramarine pigment
# Faces we do not host: Grenze Gotisch → Bricolage Grotesque.
# keywords: roastery, coffee, bakery, wine, cellar, apothecary, bookshop, press, letterpress, guild, heritage, artisan, manuscript, parchment, edition, tasting, vintage, craft, old world, slow
smithableTheme: 0.1
name: vellum
fonts: { body: Hanken Grotesk, heading: Bricolage Grotesque }
headings: { weight: 600, tracking: normal }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: rounded }
pictures: { treatment: warm }
tables: { numbers: tabular }
radius: 2px
shadow: none
density: comfortable
motion: subtle
chroma: 0.17
texture: paper
light:
  background: "#f3eada"
  foreground: "#261a12"
  card: "#f3eada"
  muted: "#e9dcc7"
  secondary: "#decfb7"
  border: "#bcab96"
  input: "#8f806e"
  primary: "#2942ab"
  primary-foreground: "#f5eee0"
  sidebar: "#e9dcc7"
dark:
  background: "#191207"
  foreground: "#f3eadd"
  card: "#221b0f"
  primary: "#4c67be"
  muted: "#241c11"
  border: "#524a3e"
  accent: "#291c06"
`,
  loom: `# Loom, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# ecru paper with sand steps, warm near-black ink, Libre Caslon Display heads and prices over Hanken Grotesk, thin rules and one ink rule, cloth photographed close in window light, one deep indigo
# Faces we do not host: Libre Caslon Display → Instrument Serif.
# keywords: weaving, textile, linen, wool, weaving studio, cloth, craft, atelier, handmade, natural, indigo, fabric, by the metre, workshop, maker, slow, commission, interiors, samples
smithableTheme: 0.1
name: loom
fonts: { body: Hanken Grotesk, heading: Instrument Serif }
headings: { weight: 400, tracking: normal }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: square }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.11
texture: paper
light:
  background: "#f4f0e6"
  foreground: "#1d1713"
  card: "#f4f0e6"
  muted: "#ece4d5"
  secondary: "#d9ccb7"
  border: "#cec6b8"
  input: "#8b8479"
  primary: "#1d3172"
  primary-foreground: "#f4f0e6"
  sidebar: "#ece4d5"
dark:
  background: "#14110a"
  foreground: "#f0ece4"
  card: "#1d1912"
  primary: "#536799"
  muted: "#1f1b14"
  border: "#4d4942"
  accent: "#171c28"
`,
  terminal: `# Terminal, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# a near-black ground with a green cast in three lightness steps, pale phosphor ink and one bright phosphor signal with a dim wash of itself, every glyph Martian Mono with heads wide and text narrow, and pictures printed in the page's own glyphs: a photograph rendered as a grid of characters taken from the product's own text, dim cells small, bright cells full, stirred by the cursor
# Faces we do not host: Martian Mono → JetBrains Mono; var(--font-display) → Hanken Grotesk.
# keywords: cli, terminal, shell, command-line, tui, self-hosted, open-source, binary, ssh, sysadmin, devops, homelab, install script, package manager, repl, dotfiles, developer tool, phosphor
smithableTheme: 0.1
name: terminal
fonts: { body: Hanken Grotesk, heading: JetBrains Mono }
headings: { weight: 500, tracking: tight }
surfaces: { cards: bordered }
buttons: { shape: square }
pictures: { treatment: duotone }
tables: { numbers: tabular }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.2
light:
  background: "#f6fef8"
  foreground: "#0d1c12"
  card: "#ffffff"
  primary: "#54a14d"
  muted: "#e6efe8"
  border: "#a8b3ab"
  accent: "#e1f1de"
dark:
  background: "#040805"
  foreground: "#e1f1de"
  card: "#080f0a"
  muted: "#080f0a"
  secondary: "#101a12"
  border: "#1d2a1f"
  input: "#5a6859"
  primary: "#7ef473"
  primary-foreground: "#040b05"
  sidebar: "#080f0a"
`,
  "neo-brutalism": `# Neo Brutalism, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
smithableTheme: 0.1
name: neo-brutalism
fonts: { body: DM Sans }
surfaces: { cards: bordered }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.24
light:
  background: "#ffffff"
  foreground: "#000000"
  card: "#ffffff"
  primary: "#ff3333"
  muted: "#f0f0f0"
  border: "#000000"
  input: "#000000"
  sidebar: "#f0f0f0"
  chart-1: "#ff3333"
  chart-2: "#ffff00"
  chart-3: "#0066ff"
  chart-4: "#00cc00"
  chart-5: "#cc00cc"
dark:
  background: "#000000"
  foreground: "#ffffff"
  card: "#333333"
  primary: "#ff6666"
  muted: "#1a1a1a"
  border: "#ffffff"
  input: "#ffffff"
  sidebar: "#000000"
  chart-1: "#ff6666"
  chart-2: "#ffff33"
  chart-3: "#3399ff"
  chart-4: "#33cc33"
  chart-5: "#cc33cc"
`,
  sport: `# Sport, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# cool concrete paper, blue-black ink, uppercase Saira Condensed over Albert Sans, condensed figures and mono times, two-weight rules, one volt fill
# Faces we do not host: Saira Condensed → Oswald; Albert Sans → Hanken Grotesk.
# keywords: running, marathon, race, training, fitness, gym, team, league, fixtures, standings, scoreboard, athletics, performance, splits, sportswear, club, match, tournament
smithableTheme: 0.1
name: sport
fonts: { body: Hanken Grotesk, heading: Oswald }
headings: { weight: 700, tracking: normal, scale: large, case: upper }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: rounded }
pictures: { treatment: duotone }
tables: { numbers: tabular }
radius: 4px
shadow: none
density: comfortable
motion: subtle
chroma: 0.2
light:
  background: "#f6f9fc"
  foreground: "#000b28"
  card: "#f6f9fc"
  muted: "#ebeff2"
  secondary: "#dfe3e7"
  border: "#b4b8bc"
  input: "#7b8592"
  primary: "#c8e928"
  primary-foreground: "#000b28"
  sidebar: "#ebeff2"
dark:
  background: "#0c0e10"
  foreground: "#e9f2ff"
  card: "#151719"
  primary: "#c8e928"
  muted: "#17181b"
  border: "#45484d"
  accent: "#232715"
`,
  squeeze: `# Squeeze, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# forest-green paper with real chroma, warm white ink, Gabarito 800 heads and figures over Manrope, soft rounded tiles a step lighter or deeper, fruit photographed bright and close, juicy peach controls
# Faces we do not host: Gabarito → Outfit; Manrope → Hanken Grotesk.
# keywords: fruit, food box, grocer, market, delivery, weekly, seasonal, farm shop, subscription, produce, veg box, cheerful, family, treats, stall, orchard, local, fresh
smithableTheme: 0.1
name: squeeze
fonts: { body: Hanken Grotesk, heading: Outfit }
headings: { weight: 800, tracking: tight }
surfaces: { cards: raised }
buttons: { shape: pill }
tables: { numbers: tabular }
radius: 24px
shadow: raised
density: comfortable
motion: subtle
chroma: 0.11
light:
  background: "#d0e4d5"
  foreground: "#111311"
  card: "#ffffff"
  primary: "#8d6344"
  muted: "#c3d6c8"
  border: "#909e93"
  accent: "#bdd5c3"
dark:
  background: "#075930"
  foreground: "#fdfcf8"
  card: "#1b6b3e"
  muted: "#1b6b3e"
  secondary: "#004425"
  border: "#3c8256"
  input: "#97bb9f"
  primary: "#feb581"
  primary-foreground: "#4a2010"
  sidebar: "#1b6b3e"
`,
  "midnight-bloom": `# Midnight Bloom, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Montserrat → Outfit.
smithableTheme: 0.1
name: midnight-bloom
fonts: { body: Outfit }
surfaces: { cards: raised }
radius: 8px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.2
light:
  background: "#f9f9f9"
  foreground: "#333333"
  card: "#ffffff"
  primary: "#6c5ce7"
  muted: "#c9c4b5"
  border: "#d4d4d4"
  input: "#8d8d8d"
  sidebar: "#f9f9f9"
  chart-1: "#6c5ce7"
  chart-2: "#8e44ad"
  chart-3: "#4b0082"
  chart-4: "#6495ed"
  chart-5: "#4682b4"
dark:
  background: "#1a1d23"
  foreground: "#e5e5e5"
  card: "#2f3436"
  primary: "#6c5ce7"
  muted: "#444444"
  border: "#444444"
  input: "#808080"
  sidebar: "#1a1d23"
  chart-1: "#6c5ce7"
  chart-2: "#8e44ad"
  chart-3: "#4b0082"
  chart-4: "#6495ed"
  chart-5: "#4682b4"
`,
  rim: `# Rim, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# warm black paper, warm off-white ink, Switzer 500 with Geist Mono for every measurement, square hairline surfaces, the earth photographed straight down, an orange signal and a sky-blue second
# Faces we do not host: Switzer → Instrument Sans; var(--font-display) → Hanken Grotesk.
# keywords: space, satellite, earth observation, orbit, imagery, ground station, telemetry, hardware, schedule, utc, infrastructure, mission, sensor, monitoring, instrument, night, dark, measured
smithableTheme: 0.1
name: rim
fonts: { body: Hanken Grotesk, heading: Instrument Sans, labels: JetBrains Mono }
headings: { weight: 500, tracking: tight }
surfaces: { cards: glass, dividers: light }
buttons: { shape: square }
tables: { numbers: tabular }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.17
light:
  background: "#fffbf6"
  foreground: "#1b1813"
  card: "#ffffff"
  primary: "#e17038"
  muted: "#efece6"
  border: "#b3afaa"
  accent: "#fee7dd"
dark:
  background: "#030201"
  foreground: "#efebe4"
  card: "#080604"
  muted: "#080604"
  secondary: "#010100"
  border: "#24211c"
  input: "#625f5a"
  primary: "#f97c3d"
  primary-foreground: "#070201"
  sidebar: "#080604"
`,
  "elegant-luxury": `# Elegant Luxury, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Poppins → Outfit.
smithableTheme: 0.1
name: elegant-luxury
fonts: { body: Outfit }
surfaces: { cards: raised }
radius: 6px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.15
light:
  background: "#faf7f5"
  foreground: "#1a1a1a"
  card: "#faf7f5"
  primary: "#9b2c2c"
  muted: "#f0ebe8"
  border: "#f5e8d2"
  input: "#938c80"
  sidebar: "#f0ebe8"
  chart-1: "#b91c1c"
  chart-2: "#9b2c2c"
  chart-3: "#7f1d1d"
  chart-4: "#b45309"
  chart-5: "#92400e"
dark:
  background: "#1c1917"
  foreground: "#f5f5f4"
  card: "#292524"
  primary: "#b91c1c"
  muted: "#1f1c1a"
  border: "#44403c"
  input: "#7c7a76"
  sidebar: "#1c1917"
  chart-1: "#f87171"
  chart-2: "#ef4444"
  chart-3: "#dc2626"
  chart-4: "#fbbf24"
  chart-5: "#f59e0b"
`,
  darkroom: `# Darkroom, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# warm print-black ground, a fine light grain, fibre-white ink, hairline Sofia Sans Extra Condensed capitals over Barlow, zero radius, black-and-white photographs printed deeper than the ground, one amber safelight
# Faces we do not host: Sofia Sans Extra Condensed → Oswald; Barlow → Hanken Grotesk.
# keywords: photographer, photography, film, analogue, darkroom, prints, portfolio, exhibition, gallery, edition, commission, cinematographer, negative, archive, monochrome, lab, moody, black and white, night, print shop, travel, places, landscape, portrait, photo studio
smithableTheme: 0.1
name: darkroom
fonts: { body: Hanken Grotesk, heading: Oswald }
headings: { tracking: normal, scale: large, case: upper }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: rounded }
pictures: { treatment: mono }
tables: { numbers: tabular }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.15
texture: grain
light:
  background: "#fffbf8"
  foreground: "#1e1a14"
  card: "#ffffff"
  primary: "#c1732f"
  muted: "#efece8"
  border: "#b4b0ab"
  accent: "#f7e8dd"
dark:
  background: "#090604"
  foreground: "#e9e4dc"
  card: "#100c0a"
  muted: "#100c0a"
  secondary: "#1b1613"
  border: "#2f2a27"
  input: "#696460"
  primary: "#ec8d38"
  primary-foreground: "#090604"
  sidebar: "#100c0a"
`,
  tangerine: `# Tangerine, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
smithableTheme: 0.1
name: tangerine
fonts: { body: Inter }
surfaces: { cards: raised }
radius: 12px
shadow: small
density: comfortable
motion: subtle
chroma: 0.17
light:
  background: "#e8ebed"
  foreground: "#333333"
  card: "#ffffff"
  primary: "#e05d38"
  muted: "#f9fafb"
  border: "#dcdfe2"
  input: "#7f8082"
  sidebar: "#dddfe2"
  chart-1: "#86a7c8"
  chart-2: "#eea591"
  chart-3: "#5a7ca6"
  chart-4: "#466494"
  chart-5: "#334c82"
dark:
  background: "#1c2433"
  foreground: "#e5e5e5"
  card: "#2a3040"
  primary: "#e05d38"
  muted: "#2a303e"
  border: "#3d4354"
  input: "#7e808b"
  sidebar: "#2a303f"
  chart-1: "#86a7c8"
  chart-2: "#e6a08f"
  chart-3: "#5a7ca6"
  chart-4: "#466494"
  chart-5: "#334c82"
`,
  mono: `# Mono, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Geist Mono → JetBrains Mono.
smithableTheme: 0.1
name: mono
fonts: { body: JetBrains Mono }
surfaces: { cards: bordered }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.04
light:
  background: "#ffffff"
  foreground: "#0a0a0a"
  card: "#ffffff"
  primary: "#737373"
  muted: "#f5f5f5"
  border: "#e5e5e5"
  input: "#919191"
  sidebar: "#fafafa"
  chart-1: "#737373"
  chart-2: "#737373"
  chart-3: "#737373"
  chart-4: "#737373"
  chart-5: "#737373"
dark:
  background: "#0a0a0a"
  foreground: "#fafafa"
  card: "#191919"
  primary: "#737373"
  muted: "#262626"
  border: "#383838"
  input: "#686868"
  sidebar: "#171717"
  chart-1: "#737373"
  chart-2: "#737373"
  chart-3: "#737373"
  chart-4: "#737373"
  chart-5: "#737373"
`,
  "mocha-mousse": `# Mocha Mousse, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
smithableTheme: 0.1
name: mocha-mousse
fonts: { body: DM Sans }
surfaces: { cards: bordered }
radius: 8px
shadow: none
density: comfortable
motion: subtle
chroma: 0.06
light:
  background: "#f1f0e5"
  foreground: "#56453f"
  card: "#f1f0e5"
  primary: "#a37764"
  muted: "#e4c7b8"
  border: "#baab92"
  input: "#968574"
  sidebar: "#ebd6cb"
  chart-1: "#a37764"
  chart-2: "#8a655a"
  chart-3: "#c39e88"
  chart-4: "#baab92"
  chart-5: "#a28777"
dark:
  background: "#2d2521"
  foreground: "#f1f0e5"
  card: "#3c332e"
  primary: "#c39e88"
  muted: "#56453f"
  border: "#56453f"
  input: "#887b75"
  sidebar: "#1f1a17"
  chart-1: "#c39e88"
  chart-2: "#baab92"
  chart-3: "#a37764"
  chart-4: "#8a655a"
  chart-5: "#a28777"
`,
  graphite: `# Graphite, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Montserrat → Outfit.
smithableTheme: 0.1
name: graphite
fonts: { body: Outfit }
surfaces: { cards: bordered }
radius: 6px
shadow: none
density: comfortable
motion: subtle
chroma: 0.04
light:
  background: "#f0f0f0"
  foreground: "#333333"
  card: "#f5f5f5"
  primary: "#606060"
  muted: "#d9d9d9"
  border: "#d0d0d0"
  input: "#828282"
  sidebar: "#eaeaea"
  chart-1: "#606060"
  chart-2: "#476666"
  chart-3: "#909090"
  chart-4: "#a8a8a8"
  chart-5: "#c0c0c0"
dark:
  background: "#1a1a1a"
  foreground: "#d9d9d9"
  card: "#202020"
  primary: "#a0a0a0"
  muted: "#2a2a2a"
  border: "#353535"
  input: "#737373"
  sidebar: "#1f1f1f"
  chart-1: "#a0a0a0"
  chart-2: "#7e9ca0"
  chart-3: "#707070"
  chart-4: "#585858"
  chart-5: "#404040"
`,
  notebook: `# Notebook, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Architects Daughter → Nunito Sans.
# letter-spacing 0.5px is body tracking, which a theme file does not have.
smithableTheme: 0.1
name: notebook
fonts: { body: Nunito Sans }
surfaces: { cards: raised }
radius: 10px
shadow: soft
density: comfortable
motion: subtle
chroma: 0.04
light:
  background: "#f9f9f9"
  foreground: "#3a3a3a"
  card: "#ffffff"
  primary: "#606060"
  muted: "#e3e3e3"
  border: "#747272"
  input: "#747272"
  sidebar: "#f0f0f0"
  chart-1: "#333333"
  chart-2: "#555555"
  chart-3: "#777777"
  chart-4: "#999999"
  chart-5: "#bbbbbb"
dark:
  background: "#2b2b2b"
  foreground: "#dcdcdc"
  card: "#333333"
  primary: "#b0b0b0"
  muted: "#454545"
  border: "#4f4f4f"
  input: "#7d7d7d"
  sidebar: "#212121"
  chart-1: "#efefef"
  chart-2: "#d0d0d0"
  chart-3: "#b0b0b0"
  chart-4: "#909090"
  chart-5: "#707070"
`,
  "modern-minimal": `# Modern Minimal, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
smithableTheme: 0.1
name: modern-minimal
fonts: { body: Inter }
surfaces: { cards: bordered }
radius: 6px
shadow: none
density: comfortable
motion: subtle
chroma: 0.19
light:
  background: "#ffffff"
  foreground: "#333333"
  card: "#ffffff"
  primary: "#3b82f6"
  muted: "#f9fafb"
  border: "#e5e7eb"
  input: "#8c8c8f"
  sidebar: "#f9fafb"
  chart-1: "#3b82f6"
  chart-2: "#2563eb"
  chart-3: "#1d4ed8"
  chart-4: "#1e40af"
  chart-5: "#1e3a8a"
dark:
  background: "#171717"
  foreground: "#e5e5e5"
  card: "#262626"
  primary: "#3b82f6"
  muted: "#1f1f1f"
  border: "#404040"
  input: "#757575"
  sidebar: "#171717"
  chart-1: "#60a5fa"
  chart-2: "#3b82f6"
  chart-3: "#2563eb"
  chart-4: "#1d4ed8"
  chart-5: "#1e40af"
`,
  manifesto: `# Manifesto, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# warm near-black ground, warm off-white ink, Anton capitals at poster size leaded tight over a quiet Public Sans body, hairlines, a heavy ink bar and square edges, one fighting red
# Faces we do not host: Anton → Oswald; Public Sans → Hanken Grotesk.
# keywords: manifesto, statement, declaration, principles, beliefs, mission, movement, protest, cause, campaign, petition, activism, advocacy, rights, values, take a stand, bold launch, defiant, punk, record label
smithableTheme: 0.1
name: manifesto
fonts: { body: Hanken Grotesk, heading: Oswald }
headings: { weight: 400, tracking: normal, scale: large, case: upper }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: square }
pictures: { treatment: duotone }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.23
light:
  background: "#fffbf6"
  foreground: "#1a1710"
  card: "#ffffff"
  primary: "#db0310"
  muted: "#eeece6"
  border: "#b2afa9"
  accent: "#ffe0db"
dark:
  background: "#0a0704"
  foreground: "#f3eee4"
  card: "#130e0b"
  muted: "#130e0b"
  secondary: "#1f1915"
  border: "#362f29"
  input: "#716a63"
  primary: "#db0310"
  primary-foreground: "#fbfaf7"
  sidebar: "#130e0b"
`,
  "solar-dusk": `# Solar Dusk, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Oxanium → Outfit.
smithableTheme: 0.1
name: solar-dusk
fonts: { body: Outfit }
surfaces: { cards: raised }
radius: 5px
shadow: small
density: comfortable
motion: subtle
chroma: 0.15
light:
  background: "#fdfbf7"
  foreground: "#4a3b33"
  card: "#f8f4ee"
  primary: "#b45309"
  muted: "#f1e9da"
  border: "#e4d9bc"
  input: "#988b79"
  sidebar: "#f1e9da"
  chart-1: "#b45309"
  chart-2: "#78716c"
  chart-3: "#a16207"
  chart-4: "#78716c"
  chart-5: "#ca8a04"
dark:
  background: "#1c1917"
  foreground: "#f5f5f4"
  card: "#292524"
  primary: "#f97316"
  muted: "#201d1a"
  border: "#44403c"
  input: "#7c7a76"
  sidebar: "#292524"
  chart-1: "#f97316"
  chart-2: "#0ea5e9"
  chart-3: "#eab308"
  chart-4: "#a8a29e"
  chart-5: "#78716c"
`,
  "sage-garden": `# Sage Garden, from the tweakcn presets (jnsahaj/tweakcn, Apache-2.0), by scripts/theme-import.mjs.
# Faces we do not host: Antic → Hanken Grotesk.
# letter-spacing 0em is body tracking, which a theme file does not have.
smithableTheme: 0.1
name: sage-garden
fonts: { body: Hanken Grotesk }
surfaces: { cards: raised }
radius: 6px
shadow: small
density: comfortable
motion: subtle
chroma: 0.04
light:
  background: "#f8f7f4"
  foreground: "#1a1f2e"
  card: "#ffffff"
  primary: "#7c9082"
  muted: "#e8e6e1"
  border: "#e8e6e1"
  input: "#8c8e93"
  sidebar: "#fafaf8"
  chart-1: "#7c9082"
  chart-2: "#a0aa88"
  chart-3: "#8b9d83"
  chart-4: "#6b7280"
  chart-5: "#e8e6e1"
dark:
  background: "#0a0a0a"
  foreground: "#f5f5f5"
  card: "#121212"
  primary: "#7c9082"
  muted: "#1a1a1a"
  border: "#2a2a2a"
  input: "#686868"
  sidebar: "#0f0f0f"
  chart-1: "#7c9082"
  chart-2: "#a0aa88"
  chart-3: "#8b9d83"
  chart-4: "#6b7280"
  chart-5: "#5a6b5e"
`,
  grid: `# Grid, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# white poster stock, blue-black ink, Radio Canada Big 700 in sentence case over Radio Canada, flat fields of ultramarine and one Swiss red mark, no strokes
# Faces we do not host: Radio Canada Big → Hanken Grotesk; Radio Canada → Hanken Grotesk.
# keywords: identity, brand system, wayfinding, signage, design studio, type specimen, editorial grid, institution, museum, archive, index, directory, systems, modular, swiss, grotesque, manual, programme, poster, collection
smithableTheme: 0.1
name: grid
fonts: { body: Hanken Grotesk }
headings: { weight: 700, tracking: tight }
surfaces: { cards: bordered, dividers: light }
buttons: { shape: square }
pictures: { treatment: duotone }
radius: 0px
shadow: none
density: comfortable
motion: subtle
chroma: 0.2
light:
  background: "#f8f7f3"
  foreground: "#0f141e"
  card: "#f8f7f3"
  muted: "#edece7"
  secondary: "#e2dfda"
  border: "#d8d6d0"
  input: "#8b8d8d"
  primary: "#1f40be"
  primary-foreground: "#f8f7f3"
  sidebar: "#edece7"
dark:
  background: "#0f0f0c"
  foreground: "#e8effc"
  card: "#16181b"
  primary: "#3256c6"
  muted: "#18191d"
  border: "#45484e"
  accent: "#121927"
`,
  furrow: `# Furrow, from the Hallmark catalog (Nutlope/hallmark, MIT), by scripts/theme-import.mjs.
# warm manila paper, near-black ink in rules, a generated survey map in sienna contours and slate water, Red Hat Display 600 over Red Hat Text with Red Hat Mono figures, moulded 6px keys, a waterproof notebook card, one tangerine signal and a grass green for what is in date
# Faces we do not host: Red Hat Display → Hanken Grotesk; Red Hat Text → Hanken Grotesk.
# keywords: farm, agriculture, land, field, livestock, sheep, cattle, crop, records, compliance, inspection, fleet, field service, rural, contractor, hectares, yard, outdoors, seasonal, working, units
smithableTheme: 0.1
name: furrow
fonts: { body: Hanken Grotesk }
headings: { weight: 600, tracking: tight }
surfaces: { cards: raised, dividers: light }
buttons: { shape: rounded }
tables: { numbers: tabular }
radius: 10px
shadow: raised
density: comfortable
motion: subtle
chroma: 0.19
texture: grain
light:
  background: "#f5f1ea"
  foreground: "#14110f"
  card: "#f5f1ea"
  muted: "#fffdfa"
  secondary: "#e9e4d9"
  border: "#dbd7ce"
  input: "#8f8b85"
  primary: "#fc6b33"
  primary-foreground: "#14110f"
  sidebar: "#fffdfa"
dark:
  background: "#13100c"
  foreground: "#f3eeeb"
  card: "#1d1815"
  primary: "#fc6b33"
  muted: "#1f1a17"
  border: "#4e4946"
  accent: "#301b14"
`,
} as const;

export const PICKED_THEME_NAMES = Object.keys(PICKED_THEMES) as (keyof typeof PICKED_THEMES)[];
