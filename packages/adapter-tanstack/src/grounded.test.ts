import { expect, test } from "vitest";

// The kit's grounded.ts, as the generated apps get it (a path the build does not follow).
const path: string = "../templates/src/kit/grounded.ts";
type Step = { tool: string; args: object; result?: unknown; proposed?: boolean; ms: number };
const { ungrounded, numbersIn } = (await import(path)) as {
  ungrounded(text: string, question: string, steps: Step[], kinds: object[]): string | undefined;
  numbersIn(text: string): number[];
};

const kinds = [{ label: "Invoice", pluralLabel: "Invoices" }];
const step = (tool: string, result: unknown): Step => ({ tool, args: {}, result, ms: 0 });

test("numbers are read as people write them, leaving out dates, times, years and list marks", () => {
  expect(numbersIn("€12,500.50 and 12 500,50 and 1.234,5 in 14 minutes")).toEqual([
    12500.5, 12500.5, 1234.5, 14,
  ]);
  expect(numbersIn("1, 2 and 3 of 1,234")).toEqual([1, 2, 3, 1234]);
  expect(numbersIn("Due 2026-10-31 at 09:30, since 2025.\n1. Kallio\n2. Skerry")).toEqual([]);
});

test("an answer stands when its numbers, nones and names come from the tools", () => {
  const counted = [
    step("measure", {
      by: "status",
      rows: [
        { value: "paid", number: 3 },
        { value: "sent", number: 2 },
      ],
    }),
  ];
  expect(
    ungrounded("3 paid and 2 sent, 5 in all.", "invoices by status", counted, kinds),
  ).toBeUndefined();
  const found = [
    step("find", {
      columns: ["id", "number", "total"],
      rows: [
        [1, "A-1", "100.00"],
        [2, "A-2", "50.50"],
      ],
      total: 2,
    }),
  ];
  expect(ungrounded("Two invoices, €150.50 together.", "", found, kinds)).toBeUndefined();
  expect(
    ungrounded("There are no unpaid invoices.", "", [step("find", { rows: [], total: 0 })], kinds),
  ).toBeUndefined();
  // A choice value that is also a word of the answer is no claim of a change; a missing field is no "none".
  expect(
    ungrounded("3 tasks are done.", "", [step("measure", { total: 3 })], kinds),
  ).toBeUndefined();
  expect(
    ungrounded(
      "Kallio has no phone number.",
      "",
      [step("read", { name: "Kallio", phone: null })],
      kinds,
    ),
  ).toBeUndefined();
  // A number the person gave is theirs to repeat.
  expect(
    ungrounded(
      "None is over 5,000.",
      "invoices over 5000",
      [step("find", { rows: [], total: 0 })],
      kinds,
    ),
  ).toBeUndefined();
});

test("an answer no result bears out is sent back with why", () => {
  expect(ungrounded("Done, I renamed it.", "", [], kinds)).toContain("change was made");
  expect(
    ungrounded(
      "There are no unpaid invoices.",
      "",
      [step("find", { rows: [[1, "A-1"]], total: 1 })],
      kinds,
    ),
  ).toContain("no tool returned an empty result");
  expect(
    ungrounded(
      "No invoices are unpaid.",
      "",
      [
        step("find", {
          rows: [],
          total: 0,
          note: '"status" is one of draft, sent, paid; not "unpaid".',
        }),
      ],
      kinds,
    ),
  ).toContain("draft, sent, paid");
  expect(
    ungrounded("There are 14 sessions.", "", [step("measure", { total: 13 })], kinds),
  ).toContain("The number 14");
  expect(ungrounded("Invoice A-1 is the largest.", "", [], kinds)).toContain(
    "without a tool's result",
  );
});

test("C's bench cases: codes, phone numbers, numbers inside a text, and a note said back", () => {
  // A code is never read as an amount, nor a part of it.
  expect(numbersIn("Invoices 2026-003 and 2026-001")).toEqual([]);
  expect(numbersIn("Call +46 8 555 012 34 before 5")).toEqual([5]);
  // A number quoted from a text field is known.
  expect(
    ungrounded(
      "The frame is 56 cm.",
      "",
      [step("read", { title: "Bike", description: "Steel frame, 56 cm" })],
      kinds,
    ),
  ).toBeUndefined();
  expect(
    ungrounded(
      "Their phone is +46 8 555 012 34.",
      "",
      [step("read", { phone: "+46 8 555 012 34" })],
      kinds,
    ),
  ).toBeUndefined();
  // Saying back the tool's note is no ungrounded "none".
  const note =
    'Nothing has every word of "mobile app" in title. The nearest titles: Website, Payments.';
  expect(
    ungrounded(`${note}`, "", [step("find", { rows: [], total: 0, note })], kinds),
  ).toBeUndefined();
  // A made-up count is still caught.
  expect(
    ungrounded("There are 14 sessions.", "", [step("measure", { total: 13 })], kinds),
  ).toContain("The number 14");
});
