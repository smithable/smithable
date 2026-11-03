import { expect, test } from "vitest";

// The kit's csv.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/csv.ts";
const { cell } = (await import(path)) as { cell(value: unknown): string };

test("a cell is quoted when it must be, and a formula is written as text, a number never", () => {
  expect(cell("Nordic Timber Oy")).toBe("Nordic Timber Oy");
  expect(cell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
  expect(cell("two\nlines")).toBe('"two\nlines"');
  expect(cell(null)).toBe("");
  // Negative amounts and counts stay numbers (C's review of #408).
  expect(cell("-12.50")).toBe("-12.50");
  expect(cell(-3)).toBe("-3");
  // What a spreadsheet would run, also after spaces, is text.
  expect(cell("=1+1")).toBe("'=1+1");
  expect(cell("@SUM(A1)")).toBe("'@SUM(A1)");
  expect(cell("-2+3")).toBe("'-2+3");
  expect(cell(" =1+1")).toBe("' =1+1");
});

test("the file is named by its page and the app's day; an export cut at the cap says so", async () => {
  const { csvName } = (await import(path)) as {
    csvName(
      page: string,
      timeZone?: string,
      cut?: { shown: number; total: number },
      now?: Date,
    ): string;
  };
  const late = new Date("2026-11-03T23:30:00Z");
  expect(csvName("follow-ups", "UTC", undefined, late)).toBe("follow-ups-2026-11-03.csv");
  expect(csvName("follow-ups", "Europe/Mariehamn", undefined, late)).toBe(
    "follow-ups-2026-11-04.csv",
  );
  expect(csvName("customers", "UTC", { shown: 10000, total: 14200 }, late)).toBe(
    "customers-2026-11-03-10000-of-14200.csv",
  );
});

test("a time is ISO in the app's zone, with its offset", async () => {
  const zoned: string = "../templates/src/kit/zoned.ts";
  const { isoIn } = (await import(zoned)) as { isoIn(at: Date, timeZone?: string): string };
  const at = new Date("2026-07-03T12:30:15Z");
  expect(isoIn(at, "UTC")).toBe("2026-07-03T12:30:15+00:00");
  expect(isoIn(at, "Europe/Mariehamn")).toBe("2026-07-03T15:30:15+03:00");
  expect(isoIn(at, "America/St_Johns")).toBe("2026-07-03T10:00:15-02:30");
});
