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

test("an export cut at the cap says so in its name; the file stays a table, its header first", async () => {
  const { csvName } = (await import(path)) as {
    csvName(ui: { pluralLabel: string }, cut?: { shown: number; total: number }): string;
  };
  expect(csvName({ pluralLabel: "Follow ups" })).toBe("follow-ups.csv");
  expect(csvName({ pluralLabel: "Customers" }, { shown: 10000, total: 14200 })).toBe(
    "customers-10000-of-14200.csv",
  );
});
