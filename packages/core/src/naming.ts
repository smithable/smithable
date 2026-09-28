/** Splits camelCase, PascalCase, kebab-case and snake_case names into lowercase words. */
export function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** "creditLimit" → "Credit limit", "class-types" → "Class types". */
export function humanize(name: string): string {
  const text = words(name).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function camel(name: string): string {
  return words(name)
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

/**
 * A spec name from a friendly one: "Max credit" → maxCredit, "Förfallodatum" → forfallodatum.
 * A name that already is one (creditLimit) stays as it is.
 */
export function identifier(label: string): string {
  const words = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/æ/gi, "ae")
    .replace(/ø/gi, "o")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const name = words
    .map((w, i) =>
      i > 0
        ? w[0]?.toUpperCase() + w.slice(1)
        : /^[A-Z0-9]+$/.test(w)
          ? w.toLowerCase() // "VAT number" → vatNumber
          : w[0]?.toLowerCase() + w.slice(1),
    )
    .join("");
  return /^[0-9]/.test(name) ? `field${name}` : name;
}

export function pascal(name: string): string {
  const c = camel(name);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** "credit limit" → "Credit limit": only the first letter changes. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function kebab(name: string): string {
  return words(name).join("-");
}

export function snake(name: string): string {
  return words(name).join("_");
}

/** English plural of the last word: "Customer" → "Customers", "ClassType" → "ClassTypes", "Category" → "Categories". */
export function plural(name: string): string {
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;
  return `${name}s`;
}
