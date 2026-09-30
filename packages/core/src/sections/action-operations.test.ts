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
    (a) => a.name === "mergeCustomers",
  );

describe("addAction", () => {
  test("the CRM's mergeCustomers, written from the operation's words, is the same action", () => {
    // The CRM without its action (and without the page's button that uses it).
    const without = spec
      .replace(/\nactions:\n {2}mergeCustomers:\n(?: {4}.*\n| {6}.*\n)+/, "\n")
      .replace("    actions: [mergeCustomers]\n", "");
    expect(actionOf(without)).toBeUndefined();
    const operation = findOperation("addAction");
    if (!operation) throw new Error("no addAction");
    const args = parseOperationArgs(operation, [
      "mergeCustomers",
      "keep=Customer!",
      "duplicate=Customer!",
      "--allow",
      "admin",
      "--intent",
      "Merge a duplicate customer record into the one we keep.",
    ]);
    const result = applyOperation({ spec: without, auth }, "addAction", args);
    if (!result.ok) throw new Error(result.message);
    const { rules: _, ...original } = actionOf(spec) as object & { rules?: unknown };
    const { rules: __, ...made } = actionOf(result.files.spec) as object & { rules?: unknown };
    expect(made).toEqual(original);
  });

  test("a name that exists or is not camelCase is refused; a role that does not exist is an error", () => {
    expect(applyOperation({ spec, auth }, "addAction", { action: "mergeCustomers" })).toMatchObject(
      { ok: false },
    );
    expect(applyOperation({ spec, auth }, "addAction", { action: "Merge" })).toMatchObject({
      ok: false,
    });
    expect(
      applyOperation({ spec, auth }, "addAction", { action: "archive", allow: ["boss"] }),
    ).toMatchObject({
      ok: false,
    });
  });
});
