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

test("an export cut at the cap says so on its first line, before the header", async () => {
  const { csvOf } = (await import(path)) as {
    csvOf(ui: unknown, rows: unknown[], note?: string): string;
  };
  const ui = {
    pluralLabel: "Customers",
    fields: [{ name: "name", label: "Name", kind: "string", get: (r: { name: string }) => r.name }],
  };
  const rows = [{ id: 1, name: "Nordic Timber Oy" }];
  const cut = csvOf(ui, rows, "Exported 1 of 2 matching records").replace(/^﻿/, "");
  expect(cut.split("\r\n").slice(0, 3)).toEqual([
    "Exported 1 of 2 matching records",
    "Name",
    "Nordic Timber Oy",
  ]);
  expect(csvOf(ui, rows).replace(/^﻿/, "").split("\r\n")[0]).toBe("Name");
});
