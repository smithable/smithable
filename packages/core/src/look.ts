// Effective theme settings and their sources. No host I/O: generation and editors share this.

import { isMap, isScalar, parseDocument } from "yaml";
import type { AuthIR } from "./auth.js";
import { brandColors } from "./brand.js";
import { hexOf } from "./color.js";
import type { SpecIR } from "./ir.js";
import {
  type ThemeIR,
  TOKEN_NAMES,
  type Tokens,
  themeNamed,
  tokensOf,
  withBackground,
} from "./theme.js";
import type { UxIR } from "./ux.js";

export const LOOK_KEYS = ["preset", "primary", "background", "font", "density", "motion"] as const;
export type LookKey = (typeof LOOK_KEYS)[number];
type AuthoredTheme = Partial<Record<LookKey, true>>;
export interface LookAuthorship {
  app: AuthoredTheme;
  pages: Record<string, AuthoredTheme>;
}
export type LookOrigin =
  | { kind: "app-ux"; path: string[] }
  | { kind: "page-ux"; page: string; path: string[] }
  | { kind: "theme"; name: string; source: ThemeIR["source"]; scope: "app" | "page" }
  | { kind: "default" }
  | { kind: "resolved-ux" };

/** Presence in the source, independent of its value. The caller still validates the UX file.
 * Keeping this outside UxIR preserves the existing resolved IR/serialization contract. */
export function lookAuthorship(text: string): LookAuthorship | undefined {
  const doc = parseDocument(text);
  if (doc.errors.length) return undefined;
  const at = (prefix: string[]): AuthoredTheme =>
    Object.fromEntries(
      LOOK_KEYS.flatMap((key) => {
        const path = [
          ...prefix,
          "theme",
          ...(["primary", "background", "font"].includes(key) ? ["brand", key] : [key]),
        ];
        return doc.hasIn(path) ? [[key, true]] : [];
      }),
    );
  const pages: Record<string, AuthoredTheme> = {};
  const node = doc.get("pages", true);
  if (isMap(node))
    for (const pair of node.items)
      if (isScalar(pair.key) && typeof pair.key.value === "string")
        pages[pair.key.value] = at(["pages", pair.key.value]);
  return { app: at([]), pages };
}

/** Preserve the parser's existing precedence: page theme keys over the app's resolved keys. */
export function pageLookUx(ux: UxIR, page?: string): UxIR {
  return page ? { ...ux, theme: { ...ux.theme, ...ux.pages[page]?.theme } } : ux;
}

export interface ResolvedLook {
  theme: ThemeIR;
  settings: UxIR["theme"];
  font: string;
  tokens: { light: Tokens; dark: Tokens };
  provenance: Record<LookKey, LookOrigin>;
  /** Invalid UX is normally refused before resolution. A stale/missing selection falls back. */
  missingTheme?: string;
  ignored: Partial<Record<LookKey, string>>;
}

export function resolveLook(
  ux: UxIR,
  themes: readonly ThemeIR[] = [],
  page?: string,
  authored?: LookAuthorship,
): ResolvedLook {
  const settings = pageLookUx(ux, page).theme;
  const selected = themeNamed(settings.preset, themes);
  const theme = selected ?? themeNamed("modern");
  if (!theme) throw new Error("No platform theme");
  const base = (settings.background && withBackground(theme, settings.background)) || theme;
  const tokens = (mode: "light" | "dark") =>
    tokensOf(base, mode, settings.primary ? brandColors(settings.primary, base, mode) : {});
  const app = authored?.app;
  const own = page ? authored?.pages[page] : undefined;
  const path = (key: LookKey) => [
    "theme",
    ...(["primary", "background", "font"].includes(key) ? ["brand", key] : [key]),
  ];
  const themeOrigin = (scope: "app" | "page"): LookOrigin => ({
    kind: "theme",
    name: theme.name,
    source: theme.source,
    scope,
  });
  const origin = (key: LookKey): LookOrigin => {
    if (!authored) return { kind: "resolved-ux" };
    if (
      key === "background" &&
      settings.background === undefined &&
      (own?.background || app?.background)
    )
      return own?.preset
        ? themeOrigin("page")
        : app?.preset
          ? themeOrigin("app")
          : { kind: "default" };
    if (page && own?.[key]) return { kind: "page-ux", page, path: ["pages", page, ...path(key)] };
    // readTheme assigns these defaults when a page names a preset, even over an explicit app
    // density/motion. Fonts and brand colors keep inheriting the app's unless explicitly set.
    if (page && own?.preset && (key === "density" || key === "motion")) return themeOrigin("page");
    if (app?.[key]) return { kind: "app-ux", path: path(key) };
    if (key === "preset") return { kind: "default" };
    return own?.preset
      ? themeOrigin("page")
      : app?.preset
        ? themeOrigin("app")
        : { kind: "default" };
  };
  return {
    theme,
    settings,
    font: settings.font ?? theme.font,
    ignored:
      authored && settings.background === undefined && (own?.background || app?.background)
        ? {
            background:
              "The background override could not be applied; the theme's background is used.",
          }
        : {},
    tokens: { light: tokens("light"), dark: tokens("dark") },
    provenance: Object.fromEntries(LOOK_KEYS.map((key) => [key, origin(key)])) as Record<
      LookKey,
      LookOrigin
    >,
    ...(!selected ? { missingTheme: settings.preset } : {}),
  };
}

/** A host-authenticated, read-only source snapshot for a look editor. */
export interface ProjectLook {
  ir: SpecIR;
  specText: string;
  auth?: AuthIR;
  uxText: string;
  themes: ThemeIR[];
  themeFiles: { name: string; text: string }[];
  page?: string;
  revision?: string;
}

export interface LookReset {
  key: LookKey;
  page?: string;
}

/** Compare theme meaning across equivalent color representations and object key order. */
export function sameLookTheme(a: ThemeIR, b: ThemeIR): boolean {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([x], [y]) => x.localeCompare(y))
              .map(([key, item]) => [key, stable(item)]),
          )
        : value;
  const values = (theme: ThemeIR) => {
    const { source: _source, light, dark, ...rest } = theme;
    const palette = (tokens: Tokens) =>
      Object.fromEntries(TOKEN_NAMES.map((token) => [token, hexOf(tokens[token])]));
    return stable({
      ...rest,
      ...(theme.modes !== "dark" ? { light: palette(light) } : {}),
      ...(theme.modes !== "light" ? { dark: palette(dark) } : {}),
    });
  };
  return JSON.stringify(values(a)) === JSON.stringify(values(b));
}
