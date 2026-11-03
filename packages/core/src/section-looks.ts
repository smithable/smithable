// Pure finite section metadata shared by UX validation, defaults, operations and controls.
export const RHYTHMS = ["standard", "compact", "airy"] as const;
export const READING_MEASURES = ["reading", "wide"] as const;
export const MEDIA_LOOKS = {
  fit: ["cover", "contain"],
  aspect: ["landscape", "portrait", "square"],
  focal: ["center", "top", "bottom", "left", "right"],
} as const;
const RHYTHM = { rhythm: RHYTHMS };
export const BANDS = ["none", "muted", "inverse", "primary"] as const;
export type Band = (typeof BANDS)[number];

/**
 * The looks each section kind has: a key's allowed values, "text" for any (a pricing plan's
 * name), or "models" for a list of the spec's models (a hero's facts). The first value of a layout
 * is the kind's own look, used when none is given.
 */
export const SECTION_LOOKS: Partial<
  Record<string, Record<string, readonly (string | number)[] | "text" | "models" | "page">>
> = {
  mediaText: {
    ...RHYTHM,
    ...MEDIA_LOOKS,
    measure: READING_MEASURES,
    layout: ["split", "stacked"],
    image: ["left", "right"],
    band: BANDS,
  },
  hero: {
    layout: ["split", "centered", "plain", "cover", "photo", "inset", "stage", "tiles"],
    image: ["right", "left"],
    overlay: ["brand", "dark"],
    eyebrow: ["address", "hours"],
    facts: "models",
    stage: "page",
    // Unsaid, the layout's own height; auto, the content's; full, the window's under the header.
    height: ["auto", "full"],
  },
  features: { ...RHYTHM, columns: [3, 2, 4, 5, 6], band: BANDS },
  // Records' columns: the first (3) is for cards; a grid's own is 4 (RECORD_GRID_COLUMNS), a list has none.
  records: {
    ...RHYTHM,
    layout: ["cards", "list", "grid", "ledger", "week"],
    columns: [3, 2, 4, 5, 6],
    band: BANDS,
    by: "text",
  },
  testimonials: { ...RHYTHM, layout: ["cards", "carousel", "one"], band: BANDS },
  pricing: { ...RHYTHM, highlight: "text", band: BANDS },
  // An FAQ's columns are its list's (every answer shown); the accordion is one column.
  faq: { ...RHYTHM, layout: ["accordion", "list"], columns: [1, 2], band: BANDS },
  gallery: { ...RHYTHM, ...MEDIA_LOOKS, columns: [3, 2, 4, 5, 6], band: BANDS },
  callToAction: { ...RHYTHM, band: BANDS },
  contact: { ...RHYTHM, band: BANDS },
  text: { ...RHYTHM, measure: READING_MEASURES, band: BANDS },
  calculator: { ...RHYTHM, band: BANDS },
};
