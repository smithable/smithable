import { expect, test } from "vitest";
import { stringify } from "yaml";
import { formatDiagnostic } from "./diagnostics.js";
import { validateSpec } from "./spec.js";

const base = `smithable: 0.1
app: { name: Timers }
models:
  Invoice:
    fields:
      number: string
      dueOn: date
      calculatedDate: { type: date, formula: 'DATEADD(dueOn, 1, "day")' }
      status: draft | sent | paid
      assignee: User
      lines: InvoiceLine[]
  InvoiceLine:
    fields:
      invoice: Invoice!
      description: string
  Post:
    fields:
      published: bool
actions:
  markPaid: { on: Invoice, set: { status: paid } }
  publish: { on: Post, set: { published: true } }
  unattended: { custom: true }
  combine: { merge: Invoice }
  divide: { split: Invoice, move: lines }
  assigned: { on: Invoice, when: { assignee: ME() }, set: { status: paid } }
`;

const read = (timer: Record<string, unknown>) =>
  validateSpec({
    path: "project/smithable.yml",
    text: `${base}timers:\n${stringify({ markOverdue: timer })
      .split("\n")
      .map((line) => (line ? `  ${line}` : line))
      .join("\n")}`,
  });

test("the diagnostic fixtures use valid models and actions", () => {
  expect(
    read({ on: "Invoice", at: "dueOn", run: "markPaid" }).diagnostics.filter(
      (d) => d.severity === "error",
    ),
  ).toEqual([]);
});

const cases: [string, Record<string, unknown>, string, string][] = [
  ["no timing choice", { on: "Invoice" }, "invalid-timer", "one of the three"],
  [
    "two timing choices",
    { every: "day", cron: "0 8 * * *", at: "08:00" },
    "invalid-timer",
    "not every and cron",
  ],
  ["invalid schedule", { cron: "0 8 * *" }, "invalid-timer", "five fields"],
  ["unknown repeat interval", { every: "fortnight", at: "08:00" }, "invalid-timer", "none of them"],
  ["missing clock time", { every: "day" }, "missing-key", 'needs "at"'],
  ["invalid clock time", { every: "day", at: "8 am" }, "invalid-timer", "clock time"],
  ["missing record kind", { at: "dueOn" }, "missing-key", 'needs "on"'],
  [
    "invalid date expression",
    { on: "Invoice", at: "a week after dueOn" },
    "invalid-timer",
    "neither",
  ],
  ["unknown date field", { on: "Invoice", at: "missingDate" }, "invalid-timer", "no field named"],
  ["non-date field", { on: "Invoice", at: "number" }, "invalid-timer", "not a date"],
  ["computed date", { on: "Invoice", at: "calculatedDate" }, "invalid-timer", "is computed"],
  [
    "many related records",
    { on: "Invoice", at: "lines.description" },
    "invalid-timer",
    "does not refer to one record",
  ],
  [
    "unknown related date",
    { on: "InvoiceLine", at: "invoice.missingDate" },
    "invalid-timer",
    "no field named",
  ],
  [
    "non-date related field",
    { on: "InvoiceLine", at: "invoice.number" },
    "invalid-timer",
    "not a stored date",
  ],
  ["zero interval", { on: "Invoice", at: "0 days after dueOn" }, "invalid-timer", "above 0"],
  [
    "combining records",
    { on: "Invoice", every: "day", at: "08:00", run: "combine" },
    "invalid-timer",
    "a merge",
  ],
  [
    "dividing records",
    { on: "Invoice", every: "day", at: "08:00", run: "divide" },
    "invalid-timer",
    "a split",
  ],
  [
    "signed-in person's action",
    { on: "Invoice", every: "day", at: "08:00", run: "assigned" },
    "invalid-timer",
    "person signed in",
  ],
  [
    "recordless action with records",
    { on: "Invoice", every: "day", at: "08:00", run: "unattended" },
    "invalid-timer",
    "runs once with no record",
  ],
  [
    "record action without records",
    { every: "day", at: "08:00", run: "markPaid" },
    "invalid-timer",
    "standard action of Invoice",
  ],
  [
    "action for a different record kind",
    { on: "Invoice", every: "day", at: "08:00", run: "publish" },
    "invalid-timer",
    "not of Invoice",
  ],
];

test.each(cases)("plain timer diagnostic: %s", (_name, timer, code, detail) => {
  const diagnostic = read(timer).diagnostics.find(
    (d) => d.code === code && d.message.includes(detail),
  );
  expect(diagnostic).toBeDefined();
  expect(diagnostic?.plain).toEqual({
    message: expect.stringContaining("The timer markOverdue "),
    path: ["timers", "markOverdue"],
  });
  expect(diagnostic?.plain?.message).not.toMatch(/\bevery\b|\bcron\b|\bat:|ME\(\)|["`{}]/i);
  expect(diagnostic?.plain?.message).toMatch(
    /; choose|; remove|needs one way|choose which|choose a date/,
  );
  expect(diagnostic?.file).toBe("project/smithable.yml");
  expect(diagnostic?.line).toBeGreaterThan(1);
  expect(diagnostic?.column).toBeGreaterThan(0);
});

test("plain metadata survives JSON without replacing detailed CLI text", () => {
  const diagnostic = read({ on: "Invoice" }).diagnostics.find((d) => d.code === "invalid-timer");
  if (!diagnostic) throw new Error("Missing timer diagnostic");
  const { plain, ...detailed } = diagnostic;
  expect(JSON.parse(JSON.stringify(diagnostic)).plain).toEqual(plain);
  expect(formatDiagnostic(diagnostic)).toBe(formatDiagnostic(detailed));
  expect(formatDiagnostic(diagnostic)).toContain('"every: day"');
  const unrelated = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: {}\n",
  }).diagnostics;
  expect(unrelated.length).toBeGreaterThan(0);
  expect(unrelated.every((d) => !("plain" in d))).toBe(true);
});

test("other timer diagnostic codes keep the detailed fallback", () => {
  const diagnostic = read({ on: "Missing", at: "dueOn" }).diagnostics.find(
    (d) => d.code === "unknown-model",
  );
  expect(diagnostic?.message).toBe('There is no model named "Missing".');
  expect(diagnostic).not.toHaveProperty("plain");
});
