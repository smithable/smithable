import { describe, expect, test } from "vitest";
import { applyOperation, findOperation, parseOperationArgs } from "../apply.js";
import { validateSpec } from "../spec.js";

const raw = (files: Record<string, unknown>) => Object.values(files)[0] as string;
const spec = raw(
  import.meta.glob("../../../../examples/crm/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);
const auth = raw(
  import.meta.glob("../../../../examples/crm/smithable.auth.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);
const actionOf = (text: string) =>
  validateSpec({ path: "smithable.yml", text }).ir?.actions.find(
    (a) => a.name === "scheduleFollowUps",
  );

describe("addAction", () => {
  test("the CRM's scheduleFollowUps, written from the operation's words, is the same action", () => {
    // The CRM without its custom action (and without the page's button that uses it).
    const without = spec
      .replace(/\n {2}scheduleFollowUps:\n(?: {4}.*\n| {6}.*\n)+/, "\n")
      .replace(
        "    actions: [mergeCustomers, scheduleFollowUps]\n",
        "    actions: [mergeCustomers]\n",
      );
    expect(actionOf(without)).toBeUndefined();
    const operation = findOperation("addAction");
    if (!operation) throw new Error("no addAction");
    const args = parseOperationArgs(operation, [
      "scheduleFollowUps",
      "customer=Customer!",
      "count=int!",
      "everyDays=int!",
      "--output",
      "created=int!",
      "--intent",
      "Plan a series of follow-up notes for a customer, one every so many days.",
    ]);
    const result = applyOperation({ spec: without, auth }, "addAction", args);
    if (!result.ok) throw new Error(result.message);
    const { rules: _, ...original } = actionOf(spec) as object & { rules?: unknown };
    const { rules: __, ...made } = actionOf(result.files.spec) as object & { rules?: unknown };
    expect(made).toEqual(original);
  });

  test("a name that exists or is not camelCase is refused", () => {
    expect(applyOperation({ spec, auth }, "addAction", { action: "mergeCustomers" })).toMatchObject(
      { ok: false },
    );
    expect(applyOperation({ spec, auth }, "addAction", { action: "Merge" })).toMatchObject({
      ok: false,
    });
  });

  test("who may run a custom action is granted in the auth file", () => {
    const granted = applyOperation({ spec, auth }, "grant", {
      role: "sales",
      what: "actions",
      names: ["mergeCustomers"],
    });
    if (!granted.ok) throw new Error(granted.message);
    expect(granted.files.auth).toContain("actions: [mergeCustomers]");
    expect(granted.description).toBe("sales may run merge customers");
    for (const args of [
      { role: "boss", what: "actions", names: ["mergeCustomers"] },
      { role: "sales", what: "actions", names: ["complete"] },
      { role: "admin", what: "write", names: ["Customer"] },
      { role: "sales", what: "edit", names: ["Customer"] },
    ])
      expect(applyOperation({ spec, auth }, "grant", args)).toMatchObject({ ok: false });
  });
});

const load = (files: Record<string, unknown>) => raw(files);
const status = {
  spec: load(
    import.meta.glob("../../../../examples/status/smithable.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  ),
  auth: load(
    import.meta.glob("../../../../examples/status/smithable.auth.yml", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  ),
};
const resolveOf = (text: string) => {
  const action = validateSpec({ path: "smithable.yml", text }).ir?.actions.find(
    (a) => a.name === "resolve",
  );
  if (!action || action.custom) throw new Error("no standard action resolve");
  return action;
};
const run = (files: { spec: string; auth: string }, name: string, words: string[]) => {
  const operation = findOperation(name);
  if (!operation) throw new Error(`no ${name}`);
  return applyOperation(files, name, parseOperationArgs(operation, words));
};

describe("setAction", () => {
  test("the intent is replaced, and removed by an empty one; the rest of the action stays", () => {
    const changed = run(status, "setAction", ["resolve", "--intent", " Close the incident. "]);
    if (!changed.ok) throw new Error(changed.message);
    expect(changed.description).toBe("Change the intent of the action resolve");
    expect(resolveOf(changed.files.spec)).toEqual({
      ...resolveOf(status.spec),
      intent: "Close the incident.",
    });
    const removed = run({ ...status, spec: changed.files.spec }, "setAction", [
      "resolve",
      "--intent",
      "",
    ]);
    if (!removed.ok) throw new Error(removed.message);
    expect(resolveOf(removed.files.spec).intent).toBeUndefined();
    // An action without one gets it.
    const again = run({ ...status, spec: removed.files.spec }, "setAction", [
      "resolve",
      "--intent",
      "Close it.",
    ]);
    if (!again.ok) throw new Error(again.message);
    expect(resolveOf(again.files.spec).intent).toBe("Close it.");
  });

  test("--when and --set replace the condition and the values; a bare --when removes the condition", () => {
    const changed = run(status, "setAction", [
      "resolve",
      "--when",
      "status=identified | monitoring",
      "--set",
      "status=resolved",
    ]);
    if (!changed.ok) throw new Error(changed.message);
    expect(changed.description).toBe("Change the condition and the values of the action resolve");
    const action = resolveOf(changed.files.spec);
    expect(action.when).toEqual({ status: ["identified", "monitoring"] });
    expect(action.set.map((v) => v.field)).toEqual(["status"]);
    // What it adds, who may run it and its intent are as they were.
    const { when: _, set: __, ...rest } = action;
    const { when: ___, set: ____, ...before } = resolveOf(status.spec);
    expect(rest).toEqual(before);
    const open = run(status, "setAction", ["resolve", "--when"]);
    if (!open.ok) throw new Error(open.message);
    expect(resolveOf(open.files.spec).when).toBeUndefined();
  });

  test("what does not fit is refused: no such action, nothing to change, a value the field lacks, a custom action's condition", () => {
    expect(run(status, "setAction", ["close", "--intent", "x"])).toMatchObject({
      ok: false,
      message: 'There is no action named "close".',
    });
    expect(run(status, "setAction", ["resolve"])).toMatchObject({
      ok: false,
      message: "Say what to change: --intent, --when or --set.",
    });
    expect(run(status, "setAction", ["resolve", "--set", "status=gone"])).toMatchObject({
      ok: false,
    });
    expect(
      run({ spec, auth }, "setAction", ["scheduleFollowUps", "--when", "name=x"]),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("custom action"),
    });
    // A custom action's intent changes like any other.
    expect(
      run({ spec, auth }, "setAction", ["scheduleFollowUps", "--intent", "Plan."]),
    ).toMatchObject({ ok: true });
  });
});

describe("removeAction", () => {
  test("a standard action goes from the spec, its page and the list programs are offered", () => {
    const result = run(status, "removeAction", ["resolve"]);
    if (!result.ok) throw new Error(result.message);
    expect(result.description).toBe("Remove the action resolve; programs are no longer offered it");
    const ir = validateSpec({ path: "smithable.yml", text: result.files.spec }).ir;
    expect(ir?.actions.map((a) => a.name)).toEqual(["identified", "monitoring"]);
    expect(result.files.spec).toContain("    actions: [identified, monitoring]\n");
    // The only action the API named: the list goes, the rest of the block stays.
    expect(result.files.auth).not.toMatch(/^ {2}actions:/m);
    expect(result.files.auth).toContain("  models: [Component, Incident]");
  });

  test("the last action takes the page's list and the section with it; a custom one's code stays, and it says so", () => {
    const first = run({ spec, auth }, "removeAction", ["mergeCustomers"]);
    if (!first.ok) throw new Error(first.message);
    const result = run({ spec: first.files.spec, auth }, "removeAction", ["scheduleFollowUps"]);
    if (!result.ok) throw new Error(result.message);
    expect(result.description).toBe(
      "Remove the action scheduleFollowUps; its code in src/custom/actions/ stays",
    );
    expect(result.files.spec).not.toMatch(/^actions:/m);
    expect(result.files.spec).not.toContain("actions: [");
    expect(validateSpec({ path: "smithable.yml", text: result.files.spec }).ir?.actions).toEqual(
      [],
    );
  });

  test("its label in the content file goes with it", () => {
    const labelled = applyOperation(status, "setText", {
      path: ["actions", "resolve", "label"],
      text: "Åtgärdad",
    });
    if (!labelled.ok) throw new Error(labelled.message);
    expect(labelled.files.content).toContain("actions:\n  resolve:\n    label: Åtgärdad\n");
    const result = applyOperation(labelled.files, "removeAction", { action: "resolve" });
    if (!result.ok) throw new Error(result.message);
    expect(result.files.content ?? "").not.toContain("resolve");
  });

  test("an action there is not is refused", () => {
    expect(run(status, "removeAction", ["close"])).toMatchObject({
      ok: false,
      message: 'There is no action named "close".',
    });
  });
});

test("trash: true on a model is read, setTrash turns it on and off, and off asks first", () => {
  const files = {
    spec: "smithable: 0.1\napp:\n  name: X\nmodels:\n  Customer:\n    fields:\n      name: string!\n",
    auth: "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\n",
  };
  const on = applyOperation(files, "setTrash", { model: "Customer", trash: true });
  if (!on.ok) throw new Error(on.message);
  expect(on.files.spec).toContain(
    "  Customer:\n    fields:\n      name: string!\n    trash: true\n",
  );
  expect(on.destructive).toBe(false);
  expect(validateSpec({ path: "smithable.yml", text: on.files.spec }).ir?.models[0]?.trash).toBe(
    true,
  );
  const again = applyOperation(on.files, "setTrash", { model: "Customer", trash: true });
  expect(again.ok ? "" : again.message).toContain("has a trash already");
  const off = applyOperation(on.files, "setTrash", { model: "Customer", trash: false });
  if (!off.ok) throw new Error(off.message);
  expect(off.destructive).toBe(true);
  expect(off.files.spec).not.toContain("trash");
});

test("addAction lists a custom action on rows where a standard one goes: its model's single crud page (A 171)", () => {
  const made = applyOperation({ spec, auth }, "addAction", {
    action: "tagCustomers",
    input: { customers: "Customer[]", segment: "smb | enterprise" },
  });
  if (!made.ok) throw new Error(made.message);
  expect(made.files.spec).toContain("actions: [mergeCustomers, scheduleFollowUps, tagCustomers]");
  expect(made.files.spec).toContain("customers: Customer[]");
});
