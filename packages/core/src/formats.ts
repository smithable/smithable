// How an app writes dates, weeks and numbers (docs/design/formats.md): a few explicit choices
// under `app`, each with a default that says why.
import type { AppIR } from "./ir.js";

/** The values of each choice, the default first. */
export const FORMATS = {
  date: ["day-month", "month-day"],
  week: ["monday", "sunday"],
  numbers: ["point", "comma"],
} as const;

export const FORMAT_KEYS = Object.keys(FORMATS) as (keyof typeof FORMATS)[];

/** The number convention of each of the kit's languages (formats.md §3). */
const NUMBERS_BY_LANGUAGE: Record<string, "point" | "comma"> = { en: "point", sv: "comma" };

/** A format the app writes by, and why: as said, or the default and its reason. */
export interface Chosen<T> {
  value: T;
  /** Empty when the spec says it; otherwise the reason, as `--explain` gives it. */
  reason: string;
}

/** How the app writes numbers: as said, else its language's convention. */
export function numbersOf(app: AppIR, language = "en"): Chosen<"point" | "comma"> {
  if (app.numbers) return { value: app.numbers, reason: "" };
  return {
    value: NUMBERS_BY_LANGUAGE[language] ?? "point",
    reason: `from language ${language}`,
  };
}

/** Every format the app writes by, each with its reason (the clock included), for --explain and Studio. */
export function formatsOf(app: AppIR, language = "en") {
  return {
    clock: app.clock
      ? { value: app.clock, reason: "" }
      : { value: "24h" as const, reason: "unsaid" },
    date: app.date
      ? { value: app.date, reason: "" }
      : { value: "day-month" as const, reason: "unsaid" },
    week: app.week
      ? { value: app.week, reason: "" }
      : { value: "monday" as const, reason: "unsaid" },
    numbers: numbersOf(app, language),
  };
}
