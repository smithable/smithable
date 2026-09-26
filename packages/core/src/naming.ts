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

export function pascal(name: string): string {
  const c = camel(name);
  return c.charAt(0).toUpperCase() + c.slice(1);
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
