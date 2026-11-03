import { expect, test } from "vitest";
import { LineCounter, parseDocument } from "yaml";
import { applyOperation, findOperation, parseOperationArgs } from "./apply.js";
import { ParseContext } from "./context.js";
import { readSummaryFields, recordSummary } from "./record-emphasis.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

const spec = `smithable: 0.1
app: {name: Work}
models:
  WorkItem:
    fields:
      name: string!
      stage: draft | done
      payment: unpaid | paid
      estimate: money
      actual: money
      created: date
      due: datetime
      shipped: date
      secret: string
pages: {items: {crud: WorkItem}}
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
const model = ir?.models[0];
if (!model) throw new Error("invalid fixture");
const tones = { "WorkItem.payment": { paid: "success" as const } };
const parse = (text: string) => {
  const lines = new LineCounter(),
    doc = parseDocument(text, { lineCounter: lines }),
    ctx = new ParseContext("smithable.ux.yml", lines);
  const fields = readSummaryFields(ctx, doc.contents, model);
  return { fields, diagnostics: ctx.diagnostics };
};
test("omission preserves the exact old automatic selection", () => {
  const before = JSON.stringify(model);
  const summary = recordSummary(model, tones);
  expect([
    summary.status?.name,
    summary.amount?.name,
    summary.dates.map((field) => field.name),
  ]).toEqual(["payment", "estimate", ["created", "due"]]);
  expect(JSON.stringify(model)).toBe(before);
});
test("named status/amount/ordered dates select different eligible fields; [] opts out", () => {
  const read = parse("status: [stage]\namount: [actual]\ndates: [shipped, due]\n");
  expect(read.diagnostics).toEqual([]);
  const summary = recordSummary(model, tones, read.fields);
  expect(summary.status?.name).toBe("stage");
  expect(summary.amount?.name).toBe("actual");
  expect(summary.dates.map((field) => field.name)).toEqual(["shipped", "due"]);
  expect(recordSummary(model, tones, { status: [], amount: [], dates: [] })).toEqual({ dates: [] });
  expect(recordSummary(model, tones, { status: [] }).amount?.name).toBe("estimate");
});
test("wrong types, references, nonexistent and duplicate/excess fields diagnose at original positions", () => {
  for (const text of [
    "amount: [stage]",
    "status: [secret]",
    "dates: [estimate]",
    "status: [missing]",
    "status: [WorkItem.stage]",
    "status: [stage, payment]",
    "dates: [created, due, shipped]",
    "dates: [created, created]",
    "status: stage",
  ])
    expect(
      parse(text).diagnostics.some((d) => d.severity === "error"),
      text,
    ).toBe(true);
  expect(parse("status: [stage]\namount: [missing]\n").diagnostics[0]?.line).toBe(2);
  expect(parse("status: []\namount: []\ndates: []\n").diagnostics).toEqual([]);
});

test("canonical emphasis operation preserves empty lists, resets to auto, and validates selection", () => {
  const initial = { spec, ux: "smithableUx: 0.1\n" };
  const selected = applyOperation(initial, "setRecordEmphasis", {
    page: "items",
    part: "amount",
    fields: ["actual"],
  });
  if (!selected.ok) throw new Error(selected.message);
  const none = applyOperation(selected.files, "setRecordEmphasis", {
    page: "items",
    part: "amount",
    fields: [],
  });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.ux).toContain("amount: []");
  const read = validateUx(
    { path: "smithable.ux.yml", text: none.files.ux ?? "" },
    ir as NonNullable<typeof ir>,
  );
  expect(read.ux?.pages.items?.summaryFields?.amount).toEqual([]);
  const automatic = applyOperation(none.files, "setRecordEmphasis", {
    page: "items",
    part: "amount",
  });
  if (!automatic.ok) throw new Error(automatic.message);
  expect(automatic.files.ux).not.toContain("summary");
  for (const fields of [["secret"], ["missing"], ["estimate", "actual"]])
    expect(
      applyOperation(initial, "setRecordEmphasis", { page: "items", part: "amount", fields }).ok,
    ).toBe(false);
  const op = findOperation("setRecordEmphasis");
  if (!op) throw new Error("missing operation");
  expect(parseOperationArgs(op, ["items", "dates"]).fields).toBeUndefined();
  expect(parseOperationArgs(op, ["items", "dates", "--fields", ""]).fields).toEqual([]);
});
test("renames follow explicit fields; removal and incompatible type change diagnose rather than changing intent", () => {
  const selected = applyOperation({ spec }, "setRecordEmphasis", {
    page: "items",
    part: "amount",
    fields: ["actual"],
  });
  if (!selected.ok) throw new Error(selected.message);
  const renamed = applyOperation(selected.files, "renameField", {
    model: "WorkItem",
    from: "actual",
    to: "charged",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.ux).toContain("charged");
  expect(renamed.files.ux).not.toContain("actual");
  const removed = applyOperation(renamed.files, "removeField", {
    model: "WorkItem",
    field: "charged",
  });
  expect(removed.ok).toBe(false);
  if (!removed.ok) expect(removed.message).toMatch(/summary amount/);
  const wrong = applyOperation(renamed.files, "changeField", {
    model: "WorkItem",
    field: "charged",
    type: "string",
  });
  expect(wrong.ok).toBe(false);
  expect(renamed.files.ux).toContain("charged");
});
