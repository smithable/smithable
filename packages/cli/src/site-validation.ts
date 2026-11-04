/** Strict boundaries for untrusted extracted metadata and model responses. */
export function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new Error("Expected a plain metadata object.");
  const item = value as Record<string, unknown>;
  for (const key of Object.keys(item))
    if (!keys.includes(key) || ["__proto__", "constructor", "prototype"].includes(key))
      throw new Error(`Unexpected metadata field: ${key}.`);
  return item;
}
export function string(value: unknown, max: number, empty = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim()) ||
    value.includes("\0")
  )
    throw new Error("Invalid metadata text.");
  return value;
}
export function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("Metadata list exceeds its bound.");
  return value;
}
export function integer(value: unknown, max: number, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error("Invalid metadata number.");
  return value;
}
export function webAddress(value: unknown): string {
  const text = string(value, 2048);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Invalid metadata web address.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid metadata web address.");
  return url.href;
}
export const enumValue = <T extends string>(value: unknown, allowed: readonly T[]): T => {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new Error("Invalid metadata choice.");
  return value as T;
};
/** Only definite inline declarations; custom properties and overridden values are not visibility. */
export function inlineHidden(style: string): boolean {
  const declarations: string[] = [];
  let part = "",
    quote = "",
    depth = 0,
    escaped = false;
  for (const char of style) {
    if (escaped) {
      part += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      part += char;
      escaped = true;
      continue;
    }
    if (quote) {
      part += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      part += char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === ";" && !depth) {
      declarations.push(part);
      part = "";
    } else part += char;
  }
  declarations.push(part);
  const properties = new Map<string, { value: string; important: boolean }>();
  for (const declaration of declarations) {
    const colon = declaration.indexOf(":"),
      key = declaration.slice(0, colon).trim().toLowerCase();
    if (!["display", "visibility"].includes(key)) continue;
    const raw = declaration
        .slice(colon + 1)
        .trim()
        .toLowerCase(),
      important = /\s*!important\s*$/.test(raw);
    if (properties.get(key)?.important && !important) continue;
    properties.set(key, { value: raw.replace(/\s*!important\s*$/, ""), important });
  }
  return (
    properties.get("display")?.value === "none" ||
    ["hidden", "collapse"].includes(properties.get("visibility")?.value ?? "")
  );
}
