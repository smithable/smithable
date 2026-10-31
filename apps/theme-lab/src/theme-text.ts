// A theme as the file a project writes (docs/spec/v0.1.md, Themes), and one field of it changed.
// The lab's controls and its text view both edit this text: it is what Save writes.
import { DEFAULT_STYLE, SHADOWS, type ThemeIR } from "@smithable/core";
import { parseDocument, stringify } from "yaml";

/** The colors a theme gives in each mode; the parser derives the rest from them. */
const GIVEN = ["background", "foreground", "card", "primary", "muted", "border", "accent"] as const;
const GROUPS = ["headings", "labels", "surfaces", "buttons", "pictures", "tables"] as const;

/** A built-in theme as a file, to start from: what makes it, the defaults left out. */
export function themeText(theme: ThemeIR): string {
  const shadow = Object.entries(SHADOWS).find(([, css]) => css === theme.shadow)?.[0] ?? "none";
  const changed = (group: (typeof GROUPS)[number]) =>
    Object.fromEntries(
      Object.entries(theme.style[group]).filter(
        ([key, value]) => (DEFAULT_STYLE[group] as Record<string, unknown>)[key] !== value,
      ),
    );
  const colors = (mode: "light" | "dark") =>
    Object.fromEntries(GIVEN.map((token) => [token, theme[mode][token]]));
  return stringify({
    smithableTheme: 0.1,
    name: theme.name,
    fonts: {
      body: theme.font,
      ...(theme.style.headingFont ? { heading: theme.style.headingFont } : {}),
      ...(theme.style.labelsFont ? { labels: theme.style.labelsFont } : {}),
    },
    radius: theme.radius,
    shadow,
    density: theme.density,
    motion: theme.motion,
    ...(theme.style.texture !== DEFAULT_STYLE.texture ? { texture: theme.style.texture } : {}),
    chroma: theme.chroma,
    ...(theme.modes !== "both" ? { modes: theme.modes } : {}),
    ...Object.fromEntries(
      GROUPS.map((group) => [group, changed(group)]).filter(([, v]) => Object.keys(v).length),
    ),
    light: colors("light"),
    dark: colors("dark"),
  });
}

/** The text with one field set; the body font where the file names it (`font` or `fonts.body`). */
/** A field's value as the file has it (the body font under font or fonts.body); undefined when absent. */
export function getField(text: string, path: (string | number)[]): unknown {
  const doc = parseDocument(text);
  const at = path.join(".") === "fonts.body" && doc.has("font") ? ["font"] : path;
  return doc.getIn(at);
}

export function setField(text: string, path: (string | number)[], value: unknown): string {
  const doc = parseDocument(text);
  const at = path.join(".") === "fonts.body" && doc.has("font") ? ["font"] : path;
  if (value === undefined) doc.deleteIn(at);
  else doc.setIn(at, value);
  return String(doc);
}
