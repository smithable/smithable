// Pure capability metadata only: theme parsing must not initialize the UX/operation registries.
import { isScalar, type ParsedNode } from "yaml";
import { checkKeys, mapEntries, type ParseContext } from "./context.js";
import type { JsonSchema } from "./section.js";
import { SECTION_LOOKS } from "./section-looks.js";
import { UX_CAPABILITIES, type UxCapability } from "./ux-capabilities.js";

type DefaultEnum = readonly (string | number)[];
interface DefaultTree {
  [key: string]: DefaultTree | DefaultEnum;
}
export interface DefaultValues {
  [key: string]: string | number | DefaultValues;
}
export interface ThemeUxDefaults {
  app?: DefaultValues;
  kinds?: Record<string, DefaultValues>;
  sections?: Record<string, DefaultValues>;
}
const enums = (value: DefaultTree | DefaultEnum): value is DefaultEnum => Array.isArray(value);
const app: DefaultTree = {};
const kinds: DefaultTree = {};
const sections: DefaultTree = {};
function put(tree: DefaultTree, path: readonly string[], values: DefaultEnum): void {
  let at = tree;
  for (const key of path.slice(0, -1)) {
    const existing = at[key];
    if (existing && enums(existing)) throw new Error("Overlapping UX default capability paths");
    if (!existing) at[key] = {};
    at = existing ?? (at[key] as DefaultTree);
  }
  const key = path.at(-1);
  if (key) at[key] = values;
}
for (const value of Object.values(UX_CAPABILITIES)) {
  const cap: UxCapability = value;
  if (!cap.themeDefault) continue;
  if (cap.scope === "app") put(app, cap.rawPath, cap.values);
  else
    for (const kind of cap.kinds ?? []) {
      let tree = kinds[kind];
      if (!tree) tree = kinds[kind] = {};
      if (enums(tree)) throw new Error("Overlapping UX default kinds");
      put(tree, cap.rawPath, cap.values);
    }
}
for (const [kind, looks] of Object.entries(SECTION_LOOKS)) {
  const finite = Object.fromEntries(
    Object.entries(looks ?? {}).filter(([, values]) => Array.isArray(values)),
  );
  if (Object.keys(finite).length) sections[kind] = finite as DefaultTree;
}
export const THEME_DEFAULT_TREE: DefaultTree = { app, kinds, sections };

export function readThemeDefaults(
  ctx: ParseContext,
  node: ParsedNode | null,
): ThemeUxDefaults | undefined {
  function read(value: ParsedNode | null, tree: DefaultTree, where: string): DefaultValues {
    const result: DefaultValues = {};
    for (const entry of checkKeys(ctx, mapEntries(ctx, value, where) ?? [], where, {
      allowed: Object.keys(tree),
    })) {
      const expected = tree[entry.key];
      if (!expected) continue;
      if (enums(expected)) {
        const scalar = isScalar(entry.value) ? entry.value.value : undefined;
        if (
          (typeof scalar !== "string" && typeof scalar !== "number") ||
          !expected.includes(scalar)
        )
          ctx.error(
            entry.value,
            "invalid-value",
            `"${entry.key}" of ${where} is one of ${expected.join(", ")}.`,
          );
        else result[entry.key] = scalar;
      } else {
        const child = read(entry.value, expected, `${where}.${entry.key}`);
        if (Object.keys(child).length) result[entry.key] = child;
      }
    }
    return result;
  }
  const defaults = read(node, THEME_DEFAULT_TREE, '"defaults"');
  return Object.keys(defaults).length ? (defaults as ThemeUxDefaults) : undefined;
}

/** One source for parser choices, operation/editor capabilities, and the published schema. */
export function themeDefaultsSchema(): JsonSchema {
  function schema(tree: DefaultTree): JsonSchema {
    return {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.entries(tree).map(([key, value]) => [
          key,
          enums(value) ? { enum: [...value] } : schema(value),
        ]),
      ),
    };
  }
  return schema(THEME_DEFAULT_TREE);
}

export function defaultLeaves(
  values: DefaultValues | undefined,
  prefix: string[] = [],
): { path: string[]; value: string | number }[] {
  return Object.entries(values ?? {}).flatMap(([key, value]) =>
    typeof value === "object"
      ? defaultLeaves(value, [...prefix, key])
      : [{ path: [...prefix, key], value }],
  );
}
