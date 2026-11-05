import { afterEach, expect, test } from "vitest";
import { TEMPLATES } from "./templates.gen.js";

// How the kit writes dates, times, numbers and money (docs/design/formats.md, A 230), as the
// generated apps get it (paths the build does not follow).
type When = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};
type Formats = {
  date: "day-month" | "month-day";
  week: "monday" | "sunday";
  numbers: "point" | "comma";
};
const formatsPath: string = "../templates/src/kit/formats.ts";
const formatPath: string = "../templates/src/kit/format.ts";
const timePath: string = "../templates/src/kit/time-text.ts";
const wordsPath: string = "../templates/src/kit/words.ts";
const { FORMATS } = (await import(formatsPath)) as { FORMATS: Formats };
const kit = (await import(formatPath)) as {
  numberText(n: number, digits?: { min?: number; max?: number }): string;
  percentText(n: number): string;
  moneyText(cents: number, currency?: string, compact?: boolean): string;
  readNumber(text: string): number;
  inputNumber(n: number, digits?: number): string;
};
const time = (await import(timePath)) as {
  whenOf(text: string): When;
  dateText(
    when: When,
    shown?: {
      weekday?: "short" | "long";
      month?: "short" | "long";
      year?: boolean;
      time?: boolean;
    },
  ): string;
  clockFrom(source: () => "12h" | "24h"): void;
};
const { languageFrom } = (await import(wordsPath)) as { languageFrom(s: () => string): void };

const NBSP = " ";
const MINUS = "−";

afterEach(() => {
  Object.assign(FORMATS, { date: "day-month", week: "monday", numbers: "point" });
  time.clockFrom(() => "24h");
  languageFrom(() => "en");
});

test("numbers by the app's convention, the same on the server and in every browser", () => {
  expect(kit.numberText(1234.56)).toBe("1,234.56");
  expect(kit.numberText(-9.9)).toBe(`${MINUS}9.9`);
  expect(kit.numberText(-0.0001)).toBe("0");
  expect(kit.percentText(12.5)).toBe("12.5%");
  FORMATS.numbers = "comma";
  expect(kit.numberText(1234567.5)).toBe(`1${NBSP}234${NBSP}567,5`);
  expect(kit.percentText(12.5)).toBe(`12,5${NBSP}%`);
});

test("money: the symbol before with a point, after with a comma, in the page's words", () => {
  expect(kit.moneyText(990, "EUR")).toBe("€9.90");
  expect(kit.moneyText(-990, "EUR")).toBe(`${MINUS}€9.90`);
  expect(kit.moneyText(990, "SEK")).toBe(`SEK${NBSP}9.90`);
  expect(kit.moneyText(120_000, "JPY")).toBe("¥1,200");
  FORMATS.numbers = "comma";
  expect(kit.moneyText(990, "EUR")).toBe(`9,90${NBSP}€`);
  languageFrom(() => "sv");
  expect(kit.moneyText(10_000, "SEK")).toBe(`100,00${NBSP}kr`);
});

test("a typed number: the app's grouping ignored, the other mark only where it is no grouping", () => {
  expect(kit.readNumber("1,5")).toBe(1.5);
  expect(kit.readNumber("1,234")).toBe(1234);
  expect(kit.readNumber("1,234.56")).toBe(1234.56);
  expect(kit.readNumber("abc")).toBeNaN();
  FORMATS.numbers = "comma";
  expect(kit.readNumber(`1${NBSP}234,56`)).toBe(1234.56);
  expect(kit.readNumber("1 234,56")).toBe(1234.56);
  expect(kit.readNumber("1.5")).toBe(1.5);
  expect(kit.readNumber("1.234")).toBe(1234);
  expect(kit.readNumber("-2,5")).toBe(-2.5);
  expect(kit.inputNumber(9.9, 2)).toBe("9,90");
});

test("dates with the month's name in the app's order; times by the app's clock", () => {
  const when = time.whenOf("2026-11-05T14:30");
  expect(when.weekday).toBe(3);
  expect(time.dateText(when, { weekday: "short", year: true })).toBe("Thu 5 Nov 2026");
  expect(time.dateText(when, { time: true })).toBe("5 Nov, 14:30");
  FORMATS.date = "month-day";
  expect(time.dateText(when, { weekday: "short", year: true })).toBe("Thu, Nov 5, 2026");
  time.clockFrom(() => "12h");
  expect(time.dateText(when, { month: "long", time: true })).toBe(`November 5, 2:30${NBSP}PM`);
});

test("no template formats by an implicit locale (formats.md §4)", () => {
  const implicit =
    /Intl\.DateTimeFormat\(\s*(undefined|\))|Intl\.NumberFormat\(\s*(undefined|\)|\{)|Intl\.RelativeTimeFormat|\.toLocale(Date|Time)?String\(/;
  const found = Object.entries(TEMPLATES)
    .filter(([path, text]) => /\.tsx?$/.test(path) && implicit.test(text))
    .map(([path]) => path);
  expect(found).toEqual([]);
});
