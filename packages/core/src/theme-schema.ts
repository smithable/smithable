import type { JsonSchema } from "./section.js";
import { SHADOWS, THEME_VERSION, TOKEN_NAMES } from "./theme.js";
import { themeDefaultsSchema } from "./theme-default-schema.js";
import { DISPLAY_FONTS, FONTS, STYLE_VALUES } from "./theme-style.js";
export function buildThemeSchema(): JsonSchema {
  const object = (properties: Record<string, JsonSchema>, required?: string[]): JsonSchema => ({
    type: "object",
    additionalProperties: false,
    properties,
    ...(required ? { required } : {}),
  });
  const body = { enum: FONTS.filter((font) => !DISPLAY_FONTS.includes(font)) };
  const color = {
    type: "string",
    pattern: "^(?:#[0-9a-fA-F]{6}|oklch\\([\\d.]+ [\\d.]+ [\\d.]+\\))$",
  };
  const palette = object(Object.fromEntries(TOKEN_NAMES.map((token) => [token, color])), [
    "background",
    "foreground",
    "primary",
  ]);
  const styles = Object.fromEntries(
    Object.entries(STYLE_VALUES).map(([group, fields]) => [
      group,
      object({
        ...Object.fromEntries(
          Object.entries(fields).map(([key, values]) => [key, { enum: [...values] }]),
        ),
        ...(group === "headings" ? { weight: { enum: [300, 400, 500, 600, 700, 800, 900] } } : {}),
      }),
    ]),
  );
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: `https://docs.smithable.ai/schema/smithable-theme-${THEME_VERSION}.json`,
    title: "Theme",
    description:
      "Reusable style tokens and finite UX defaults. Cross-file compatibility is checked by core validation.",
    ...object(
      {
        smithableTheme: { enum: [THEME_VERSION, Number(THEME_VERSION)] },
        name: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
        font: body,
        fonts: object({ body, heading: { enum: [...FONTS] }, labels: { enum: [...FONTS] } }),
        ...styles,
        texture: { enum: ["none", "grain", "paper"] },
        radius: { type: "string", pattern: "^\\d+(?:\\.\\d+)?(?:px|rem)$" },
        shadow: { enum: Object.keys(SHADOWS) },
        density: { enum: ["comfortable", "standard", "compact"] },
        motion: { enum: ["none", "subtle", "lively"] },
        chroma: { type: "number", minimum: 0, maximum: 0.4 },
        modes: { enum: ["both", "light", "dark"] },
        light: palette,
        dark: palette,
        defaults: themeDefaultsSchema(),
      },
      ["smithableTheme"],
    ),
    oneOf: [
      {
        properties: { modes: { const: "light" } },
        required: ["modes", "light"],
        not: { required: ["dark"] },
      },
      {
        properties: { modes: { const: "dark" } },
        required: ["modes", "dark"],
        not: { required: ["light"] },
      },
      { properties: { modes: { const: "both" } }, required: ["light", "dark"] },
    ],
  };
}
