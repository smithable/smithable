import { expect, test } from "vitest";
import { applyOperation, type ProjectFiles } from "./apply.js";
import {
  checkOf,
  deepen,
  planBase,
  planMoved,
  setCheck,
  testsCheck,
  unverified,
  verificationBefore,
} from "./verification.js";

const SPEC = `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields:
      name: string!
      phone: phone
      notes: text
pages:
  customers: { crud: Customer }
`;
const AUTH = `smithableAuth: 0.1
signIn:
  providers: [email]
defaultAccess: private
roles:
  admin: {}
  sales:
    pages: [customers]
    read: [Customer]
`;
const files: ProjectFiles = { spec: SPEC, auth: AUTH };
const context = {
  base: "base-1",
  environment: { where: "local" as const, engine: "test" },
  depth: "change" as const,
};

test("before Apply, every check is not run and the change says what it touches", () => {
  const result = applyOperation(files, "addField", {
    model: "Customer",
    field: "email",
    type: "email",
  });
  const v = verificationBefore(files, result, context);
  expect(v.revision).toBe("");
  expect(v.base).toBe("base-1");
  expect(v.changed).toEqual({
    models: ["Customer"],
    fields: ["Customer.email"],
    pages: [],
    actions: [],
  });
  expect(v.checks.map((c) => [c.id, c.kind, c.state])).toEqual([
    ["spec", "deterministic", "not-run"],
    ["generate", "deterministic", "not-run"],
    ["migrate", "deterministic", "not-run"],
    ["data", "deterministic", "not-run"],
    ["typecheck", "deterministic", "not-run"],
    ["tests", "unit", "not-run"],
    ["browser", "end-to-end", "not-run"],
    ["outside", "deterministic", "not-configured"],
  ]);
  expect(v.checks.some((c) => c.state === "passed" || c.at)).toBe(false);
  expect(checkOf(v, "tests").reason).toContain("smithable verify --depth tests");
});

test("a refused change fails the spec check and blocks every later one", () => {
  const result = applyOperation(files, "removeField", { model: "Customer", field: "nope" });
  const v = verificationBefore(files, result, context);
  expect(checkOf(v, "spec").state).toBe("failed");
  expect(v.checks.slice(1).map((c) => [c.state, c.reason])).toEqual(
    Array(7).fill(["not-run", "blocked by spec"]),
  );
});

test("the consequences: records lost, access gained or lost, custom code, outside", () => {
  const removed = applyOperation(files, "removeField", { model: "Customer", field: "notes" });
  const v = verificationBefore(files, removed, {
    ...context,
    custom: (concept) => (concept === "field:Customer.notes" ? ["src/custom/notes.ts"] : []),
  });
  expect(v.consequences).toEqual([
    {
      about: "records",
      says: "Customer.notes is removed with its values.",
      undo: "data-snapshot",
      model: "Customer",
      field: "notes",
    },
    {
      about: "custom-code",
      says: "src/custom/notes.ts uses what changes and may need updating.",
      undo: "full",
    },
  ]);
  const after: ProjectFiles = {
    spec: `${SPEC}outgoing:\n  welcome: { when: Customer created, to: mail, recipient: admin }\n`,
    auth: AUTH.replace("read: [Customer]", "read: []"),
  };
  const changed = verificationBefore(
    files,
    {
      ok: true,
      files: after,
      added: [],
      removed: [],
      description: "",
      destructive: false,
      effects: [],
    },
    context,
  );
  expect(changed.consequences.map((c) => [c.about, c.says, c.undo])).toEqual([
    ["access", "sales can no longer read Customer records.", "full"],
    ["outside", "Outgoing welcome changes what the app sends, answers or runs on a clock.", "none"],
  ]);
  expect(checkOf(changed, "outside")).toMatchObject({ state: "not-run" });
});

test("a failed check makes every later check not run, naming it; nothing passes without running", () => {
  const v = unverified("b", context.environment, "tests");
  setCheck(v, "spec", "passed", "ok");
  setCheck(v, "typecheck", "failed", "type errors");
  expect(checkOf(v, "spec").at).toBeDefined();
  expect(checkOf(v, "tests")).toMatchObject({ state: "not-run", reason: "blocked by typecheck" });
  expect(checkOf(v, "outside")).toMatchObject({ state: "not-run", reason: "blocked by typecheck" });
  expect(checkOf(v, "tests").at).toBeUndefined();
});

test("an empty test set never passes", () => {
  expect(testsCheck({ available: 0, named: 0 }).state).toBe("not-configured");
  expect(testsCheck({ available: 3, named: 0 }).state).toBe("inconclusive");
  expect(testsCheck({ available: 3, named: 2 }).state).toBe("inconclusive");
  expect(testsCheck({ available: 3, named: 2, ran: 0, failed: 0 }).state).toBe("inconclusive");
  expect(testsCheck({ available: 3, named: 2, ran: 5, failed: 1 }).state).toBe("failed");
  expect(testsCheck({ available: 3, named: 2, ran: 5, failed: 0 })).toMatchObject({
    state: "passed",
    evidence: { ran: 5, failed: 0 },
  });
});

test("a deeper depth turns the checks it adds from 'not part of' to 'not run yet'", () => {
  const v = deepen(unverified("b", context.environment, "change"), "tests");
  expect(v.depth).toBe("tests");
  expect(checkOf(v, "tests").reason).toBe("Not run yet.");
  expect(checkOf(v, "browser").reason).toContain("Not part of depth tests");
  expect(deepen(v, "change").depth).toBe("tests");
});

test("a plan is tied to its base and its operation list", () => {
  const steps = [{ op: "addField", args: { model: "Customer", field: "email", type: "email" } }];
  const plan = planBase("rev-1", steps);
  const reordered = [
    { op: "addField", args: { type: "email", field: "email", model: "Customer" } },
  ];
  expect(planMoved(plan, { base: "rev-1", steps: reordered })).toBeUndefined();
  expect(planMoved(plan, { base: "rev-2", steps })).toBe("base");
  const edited = [{ op: "addField", args: { model: "Customer", field: "mail", type: "email" } }];
  expect(planMoved(plan, { base: "rev-1", steps: edited })).toBe("operations");
});
