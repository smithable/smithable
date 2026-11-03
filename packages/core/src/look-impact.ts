// A CSS generation marker cannot certify generated markup.

import { resolveLook } from "./look.js";
import type { ThemeIR } from "./theme.js";
import { THEME_STRUCTURE, themeStructure } from "./theme-structure.js";
import type { UxIR } from "./ux.js";
import { UX_CAPABILITIES, type UxCapability } from "./ux-capabilities.js";

export interface LookImpact {
  kind: "css" | "structural";
  reasons: string[];
}
const at = (value: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>(
    (node, key) =>
      node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
    value,
  );
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [key, stable(value)]),
        )
      : value;
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
/** Compare validated effective UX, including only defaults which survived contextual validation.
 * A masked/default-source-only change is not a markup change. No second inheritance resolver. */
export function lookImpact(
  before: UxIR,
  after: UxIR,
  beforeThemes: readonly ThemeIR[] = [],
  afterThemes: readonly ThemeIR[] = [],
): LookImpact {
  const reasons: string[] = [];
  const pages = new Set([...Object.keys(before.pages), ...Object.keys(after.pages)]);
  for (const value of Object.values(UX_CAPABILITIES)) {
    const cap: UxCapability = value;
    if (!cap.structural) continue;
    for (const page of cap.scope === "app" ? [undefined] : pages) {
      const from = page ? before.pages[page] : before;
      const to = page ? after.pages[page] : after;
      if (!same(at(from, cap.path) ?? cap.fallback, at(to, cap.path) ?? cap.fallback))
        reasons.push(`${page ? `${page}: ` : ""}${cap.label}`);
    }
  }
  // Sections' finite look metadata all maps to generated attributes/component choices.
  for (const page of pages)
    if (!same(before.pages[page]?.looks, after.pages[page]?.looks))
      reasons.push(`${page}: Section composition`);
  for (const page of [undefined, ...pages]) {
    const from = resolveLook(before, beforeThemes, page).theme;
    const to = resolveLook(after, afterThemes, page).theme;
    const oldShape = themeStructure(from),
      newShape = themeStructure(to);
    for (const key of Object.keys(THEME_STRUCTURE) as (keyof typeof THEME_STRUCTURE)[]) {
      if (key === "appearance" && page) continue; // Root control/bootstrap only.
      if (oldShape[key] !== newShape[key])
        reasons.push(`${page ? `${page}: ` : ""}${THEME_STRUCTURE[key]}`);
    }
  }
  return { kind: reasons.length ? "structural" : "css", reasons: [...new Set(reasons)] };
}
