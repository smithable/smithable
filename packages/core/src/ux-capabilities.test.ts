import { expect, test } from "vitest";
import { parse } from "yaml";
import { applyOperation, findOperation, type ProjectFiles } from "./apply.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";
import { UX_CAPABILITIES, type UxCapability, uxChoiceProblem } from "./ux-capabilities.js";

const examples = import.meta.glob("../../../examples/*/smithable.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const spec = examples["../../../examples/booking/smithable.yml"] as string;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("Invalid booking fixture");
const at = (data: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>(
    (v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined),
    data,
  );

test("every finite capability is accepted by its canonical operation schema", () => {
  for (const cap of Object.values(UX_CAPABILITIES) as UxCapability[]) {
    const operation = findOperation(cap.operation);
    expect(operation, cap.operation).toBeDefined();
    const property = (operation?.schema.properties as Record<string, unknown> | undefined)?.[
      cap.argument
    ] as { enum?: readonly string[] } | undefined;
    expect(property, cap.operation).toBeDefined();
    if (property?.enum) {
      expect(property.enum).toEqual(expect.arrayContaining([...cap.values, cap.reset]));
    }
  }
});

test("selected-page choices reload on the intended path, reset, and preserve other settings", () => {
  const cases: [
    keyof typeof UX_CAPABILITIES,
    string | undefined,
    string,
    Record<string, unknown>?,
  ][] = [
    ["navigation", undefined, "topbar"],
    ["chrome", undefined, "dark"],
    ["menuActive", undefined, "underline"],
    ["width", "home", "wide"],
    ["headerPosition", "home", "scrolling"],
    ["mark", "instructors", "initials"],
    ["rowActions", "instructors", "menu"],
    ["filtersLook", "schedule", "chips"],
    ["calendarView", "schedule", "agenda"],
    ["capacityLook", "schedule", "bar", { left: "placesLeft", of: "capacity" }],
    ["recordHeader", "sessions", "summary"],
    ["formAside", "sessions", "summary"],
    ["recordPictures", "instructors", "top"],
  ];
  for (const [id, page, value, extra] of cases) {
    const cap: UxCapability = UX_CAPABILITIES[id];
    const files: ProjectFiles = { spec, ux: "smithableUx: 0.1\naiBadge: false\n" };
    const args = { ...cap.fixed, ...extra, ...(page ? { page } : {}), [cap.argument]: value };
    const applied = applyOperation(files, cap.operation, args);
    if (!applied.ok) throw new Error(`${id}: ${applied.message}`);
    expect(applied.files.spec).toBe(spec);
    const read = validateUx({ path: "smithable.ux.yml", text: applied.files.ux ?? "" }, ir);
    expect(read.diagnostics, id).toEqual([]);
    expect(at(page ? read.ux?.pages[page] : read.ux, cap.path), id).toBe(value);
    expect(read.ux?.aiBadge).toBe(false);
    const reset = applyOperation(applied.files, cap.operation, {
      ...args,
      [cap.argument]: cap.reset,
    });
    if (!reset.ok) throw new Error(`${id} reset: ${reset.message}`);
    expect(
      at(
        page ? parse(reset.files.ux ?? "").pages?.[page] : parse(reset.files.ux ?? ""),
        cap.rawPath,
      ),
      id,
    ).toBeUndefined();
  }
});

test("incompatible fields and page kinds are refused without changing source", () => {
  const files = { spec, ux: "smithableUx: 0.1\n" };
  for (const [operation, args] of [
    ["setCalendarColor", { page: "schedule", field: "missing" }],
    ["setCalendarCapacity", { page: "schedule", left: "startsAt", of: "capacity" }],
    ["setCalendarView", { page: "home", view: "agenda" }],
    ["setRecordFirst", { page: "sessions", first: "thread" }],
  ] as const)
    expect(applyOperation(files, operation, args).ok, operation).toBe(false);
  expect(files.ux).toBe("smithableUx: 0.1\n");
});

test("context explanations distinguish legal choices from unavailable prerequisites", () => {
  expect(uxChoiceProblem("mark", "picture", {})).toMatch(/picture/);
  expect(uxChoiceProblem("mark", "initials", {})).toBeUndefined();
  expect(uxChoiceProblem("recordFirst", "thread", {})).toMatch(/conversation/);
  expect(uxChoiceProblem("recordFirst", "thread", { hasThread: true })).toBeUndefined();
  expect(uxChoiceProblem("headerOver", "hero", {})).toMatch(/cover or photo/);
  expect(uxChoiceProblem("headerOver", "hero", { headerOverHero: true })).toBeUndefined();
  expect(uxChoiceProblem("filtersLook", "chips", {})).toMatch(/no filters/);
  expect(uxChoiceProblem("formAside", "summary", {})).toMatch(/summarize/);
  expect(uxChoiceProblem("calendarView", "agenda", { kind: "crud" })).toMatch(/calendar/);
});

test("the last thread shown as a table takes first with it, and a list reset keeps the source valid", () => {
  const support = examples["../../../examples/support/smithable.yml"] as string;
  const initial = { spec: support, ux: "smithableUx: 0.1\n" };
  const thread = applyOperation(initial, "setRecordList", {
    page: "cases",
    field: "messages",
    look: "thread",
  });
  if (!thread.ok) throw new Error(thread.message);
  const first = applyOperation(thread.files, "setRecordFirst", { page: "cases", first: "thread" });
  if (!first.ok) throw new Error(first.message);
  // A 215 (10): the file stays valid, so first goes with the last thread.
  const table = applyOperation(first.files, "setRecordList", {
    page: "cases",
    field: "messages",
    look: "table",
  });
  expect(table).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
  const reset = applyOperation(first.files, "setRecordFirst", { page: "cases", first: "form" });
  if (!reset.ok) throw new Error(reset.message);
  const inline = applyOperation(reset.files, "setRecordList", {
    page: "cases",
    field: "messages",
    look: "inline",
  });
  if (!inline.ok) throw new Error(inline.message);
  const parsed = validateSpec({ path: "smithable.yml", text: support }).ir;
  if (!parsed) throw new Error("Invalid support fixture");
  expect(
    validateUx({ path: "smithable.ux.yml", text: inline.files.ux ?? "" }, parsed).ux?.pages.cases
      ?.lists?.messages,
  ).toBe("inline");
});
