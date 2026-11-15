import { applyOperation, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { conditionContext, conditionReady, conditionTreeReady } from "./condition-paths";
import { referenceAt, referenceWith } from "./reference-paths";

const spec = `smithable: 0.1
app: { name: Condition contexts, timezone: UTC, currency: EUR }
models:
  Work:
    fields:
      name: { type: string }
      status: draft | ready
      active: bool
      person: User
      amount: money
      derived: { type: string, formula: name }
      derivedText: { type: text, formula: name }
      derivedBool: { type: bool, formula: active }
      other: Other!
      starts: datetime
      minutes: int
    capacity: { per: other, max: 3 }
    occupies: { resource: other, starts: starts, duration: minutes }
  Other:
    fields: { title: string, stage: new | old }
    schedule: { hours: { "mon-fri": "09:00-17:00" } }
actions:
  mark: { on: Work, set: { status: ready } }
timers:
  daily: { every: day, at: "09:00", on: Work }
  clock: { every: day, at: "08:00" }
payments:
  pay: { on: Work, amount: amount, when: created, refund: { by: [admin] } }
outgoing:
  notice: { when: Work created, to: mail, recipient: admin }
  digest: { when: clock, to: mail, recipient: admin, list: { model: Work, columns: [name] } }
queries:
  selected: { custom: true, returns: "Other[]" }
pages:
  home: { landing: { work: { records: Work } } }
  stats: { dashboard: { work: { count: Work } } }
  records: { sections: { work: { records: Work } } }
`;

function fixture() {
  const checked = validateSpec({ path: "smithable.yml", text: spec });
  expect(checked.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
  if (!checked.ir) throw Error("Invalid condition fixture");
  return { ir: checked.ir, document: parse(spec) as unknown };
}

test("only validated condition positions use record rows, including both kinds of sections", () => {
  const { ir, document } = fixture();
  for (const path of [
    ["models", "Work", "capacity", "where"],
    ["models", "Work", "occupies", "while"],
    ["models", "Work", "fields", "name", "locked"],
    ["models", "Work", "fields", "name", "required"],
    ["actions", "mark", "when"],
    ["timers", "daily", "where"],
    ["payments", "pay", "when"],
    ["payments", "pay", "refund", "when"],
    ["outgoing", "notice", "where"],
    ["pages", "home", "landing", "work", "where"],
    ["pages", "stats", "dashboard", "work", "where"],
  ])
    expect(conditionContext(path, document, ir)?.model?.name).toBe("Work");
  const sections = referenceWith(document, ["pages", "home", "sections", "work"], {
    records: "Other",
  });
  expect(
    conditionContext(["pages", "home", "sections", "work", "where"], sections, ir)?.model?.name,
  ).toBe("Other");
  for (const path of [
    ["models", "Work", "fields", "where"],
    ["pages", "home", "defaultFilter"],
    ["outgoing", "notice", "when"],
    ["payments", "pay", "paid", "set"],
  ])
    expect(conditionContext(path, document, ir)).toBeUndefined();
});

test("conditions follow the parent's current local model, event and query", () => {
  const { ir, document } = fixture();
  let draft = referenceWith(document, ["payments", "pay", "on"], "Other");
  const payment = conditionContext(["payments", "pay", "when"], draft, ir);
  expect(payment?.model?.name).toBe("Other");
  expect(payment && conditionReady({ status: "ready" }, payment)).toBe(false);
  expect(payment && conditionReady({ stage: "new" }, payment)).toBe(true);
  draft = referenceWith(document, ["outgoing", "notice", "when"], "Other changed");
  expect(conditionContext(["outgoing", "notice", "where"], draft, ir)?.model?.name).toBe("Other");
  draft = referenceWith(document, ["outgoing", "notice", "list"], {
    model: "Work",
    query: "selected",
  });
  expect(conditionContext(["outgoing", "notice", "list", "where"], draft, ir)?.model?.name).toBe(
    "Other",
  );
  draft = referenceWith(document, ["outgoing", "notice", "when"], "missing");
  expect(conditionContext(["outgoing", "notice", "where"], draft, ir)?.model).toBeUndefined();
});

test("offered condition capabilities agree with the real payment and outgoing validators", () => {
  const { ir, document } = fixture();
  const payment = conditionContext(["payments", "pay", "when"], document, ir);
  const outgoing = conditionContext(["outgoing", "notice", "where"], document, ir);
  if (!payment || !outgoing) throw Error("Missing condition context");
  for (const [condition, payOK, outgoingOK] of [
    [{ active: false }, true, true],
    [{ status: ["draft", "ready"] }, true, true],
    [{ status: [] }, false, false],
    [{ status: ["ready", "ready"] }, false, false],
    [{ status: "missing" }, false, false],
    [{ person: "any" }, true, false],
    [{ person: "ME()" }, false, false],
    [{ person: "not ME()" }, false, false],
    [{ derived: "" }, true, false],
    [{ derivedText: "saved" }, true, false],
    [{ derivedBool: true }, true, false],
  ] as const) {
    expect(conditionReady(condition, payment)).toBe(payOK);
    expect(conditionReady(condition, outgoing)).toBe(outgoingOK);
    for (const [path, expected] of [
      [["payments", "pay", "when"], payOK],
      [["outgoing", "notice", "where"], outgoingOK],
    ] as const)
      expect(
        applyOperation({ spec }, "editSpec", {
          file: "smithable.yml",
          path: [...path],
          value: condition,
        }).ok,
      ).toBe(expected);
  }
  expect(conditionReady({}, payment)).toBe(false);
  expect(conditionReady("created", payment)).toBe(true);
});

test("incomplete conditions block the same parent Save instead of losing the row", () => {
  const { ir, document } = fixture();
  const path = ["outgoing", "notice"];
  let draft = referenceWith(document, [...path, "where"], { status: [] });
  expect(conditionTreeReady(path, referenceAt(draft, path), draft, ir)).toBe(false);
  draft = referenceWith(draft, [...path, "where"], { status: "ready", active: false });
  expect(conditionTreeReady(path, referenceAt(draft, path), draft, ir)).toBe(true);
  draft = referenceWith(draft, [...path, "when"], "Other changed");
  expect(conditionTreeReady(path, referenceAt(draft, path), draft, ir)).toBe(false);
});

test("required and locked retain their modes without offering rules on calculated fields", () => {
  const { ir, document } = fixture();
  const path = ["models", "Work", "fields", "name", "required"];
  const context = conditionContext(path, document, ir);
  if (!context) throw Error("Missing required context");
  expect(context.mode).toBe("required");
  expect(conditionReady(true, context)).toBe(true);
  expect(conditionReady(false, context)).toBe(true);
  expect(conditionReady({}, context)).toBe(false);
  expect(conditionReady({ derived: "" }, context)).toBe(true);
  expect(
    conditionContext(["models", "Work", "fields", "derived", "locked"], document, ir)?.fixed,
  ).toBeTruthy();
  expect(
    conditionContext(["models", "Work", "fields", "status", "required"], document, ir)?.fixed,
  ).toBeTruthy();
});

test("every condition context agrees with the actual validator's capabilities", () => {
  const { ir, document } = fixture();
  for (const [path, computed, references, person] of [
    [["models", "Work", "capacity", "where"], false, false, false],
    [["models", "Work", "occupies", "while"], false, false, false],
    [["models", "Work", "fields", "name", "locked"], true, false, false],
    [["models", "Work", "fields", "name", "required"], true, false, false],
    [["timers", "daily", "where"], false, false, false],
    [["actions", "mark", "when"], true, true, true],
    [["payments", "pay", "when"], true, true, false],
    [["payments", "pay", "refund", "when"], true, true, false],
    [["outgoing", "notice", "where"], false, false, false],
    [["outgoing", "digest", "list", "where"], false, false, false],
    [["pages", "home", "landing", "work", "where"], false, false, false],
    [["pages", "records", "sections", "work", "where"], false, false, false],
    [["pages", "stats", "dashboard", "work", "where"], false, false, false],
  ] as const) {
    const context = conditionContext([...path], document, ir);
    if (!context) throw Error(`Missing context ${path}`);
    for (const [condition, expected] of [
      [{ active: false }, true],
      [{ status: ["draft", "ready"] }, true],
      [{ status: "missing" }, false],
      [{ derivedText: "" }, computed],
      [{ person: "any" }, references],
      [{ person: "ME()" }, person],
    ] as const) {
      expect(conditionReady(condition, context), JSON.stringify(path)).toBe(expected);
      expect(
        applyOperation({ spec }, "editSpec", {
          file: "smithable.yml",
          path: [...path],
          value: condition,
        }).ok,
        JSON.stringify([path, condition]),
      ).toBe(expected);
    }
  }
});

test("a redundant saved required rule remains visible/removable without contradicting the type", () => {
  const { ir, document } = fixture();
  const path = ["models", "Work", "fields", "name", "required"];
  const draft = referenceWith(document, path.slice(0, -1), { type: "string!", required: true });
  const context = conditionContext(path, draft, ir);
  if (!context) throw Error("Missing fixed required context");
  expect(context.fixed).toBe("required");
  for (const [value, expected] of [
    [true, true],
    [false, false],
    [undefined, true],
  ] as const) {
    expect(conditionReady(value, context)).toBe(expected);
    expect(
      applyOperation({ spec }, "editSpec", {
        file: "smithable.yml",
        path: path.slice(0, -1),
        value: { type: "string!", ...(value === undefined ? {} : { required: value }) },
      }).ok,
    ).toBe(expected);
  }
});

test("a choice's default in the current draft determines its modes, not the saved required flag", () => {
  const { ir, document } = fixture();
  const path = ["models", "Work", "fields", "status", "required"];
  const draft = referenceWith(document, path.slice(0, -1), {
    type: "draft | ready",
    default: "none",
  });
  const context = conditionContext(path, draft, ir);
  if (!context) throw Error("Missing optional-choice context");
  expect(context.fixed).toBeUndefined();
  expect(conditionReady(true, context)).toBe(true);
  expect(conditionReady({ active: true }, context)).toBe(true);
  expect(
    applyOperation({ spec }, "editSpec", {
      file: "smithable.yml",
      path: path.slice(0, -1),
      value: { type: "draft | ready", default: "none", required: { active: true } },
    }).ok,
  ).toBe(true);
  // With no default, the explicit boolean can make the choice always required.
  const required = validateSpec({
    path: "smithable.yml",
    text: spec.replace(
      "status: draft | ready",
      'status: {type: "draft | ready", default: none, required: true}',
    ),
  });
  expect(required.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
  expect(
    required.ir?.models
      .find((model) => model.name === "Work")
      ?.fields.find((field) => field.name === "status")?.required,
  ).toBe(true);
});
