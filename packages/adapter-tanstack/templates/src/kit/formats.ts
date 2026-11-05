// Smithable app kit: how the app writes dates, weeks and numbers (app.date, app.week and
// app.numbers in the spec, docs/design/formats.md). The generator writes the app's own choices
// here; in the kit's own sources, the defaults. It imports nothing, so the words files may use it.

export const FORMATS: {
  date: "day-month" | "month-day";
  week: "monday" | "sunday";
  numbers: "point" | "comma";
} = { date: "day-month", week: "monday", numbers: "point" };

/** The minus sign before a negative number or amount: "−9,90 €", "−€9.90" (formats.md §2). */
export const MINUS = "\u2212";

/**
 * A number as the app writes it (app.numbers): "1,234.56" with a point, "1 234,56" with a comma
 * (a no-break space, so it never breaks over a line). Written here, not by Intl, so the server
 * and every browser write it the same.
 */
export function numberText(n: number, digits: { min?: number; max?: number } = {}): string {
  if (!Number.isFinite(n)) return String(n);
  const min = digits.min ?? 0;
  const max = Math.max(min, digits.max ?? 3);
  // Rounded in decimal, not binary: 2.55 to one digit is 2.6, as a person rounds it.
  const shifted = Number(`${Math.round(Number(`${Math.abs(n)}e${max}`))}e-${max}`);
  const rounded = Number.isFinite(shifted) ? shifted : Math.abs(n);
  const [whole = "0", decimals = ""] = rounded.toFixed(max).split(".");
  const fraction = decimals.replace(/0+$/, "").padEnd(min, "0");
  const comma = FORMATS.numbers === "comma";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, comma ? "\u00a0" : ",");
  const negative = n < 0 && (Number(whole) > 0 || Number(fraction) > 0);
  return `${negative ? MINUS : ""}${grouped}${fraction ? `${comma ? "," : "."}${fraction}` : ""}`;
}
