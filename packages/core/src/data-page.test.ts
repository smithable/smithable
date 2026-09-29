import { expect, test } from "vitest";
import { pageAccess } from "./access.js";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import { validateSpec } from "./spec.js";

const spec = (data: string) => `smithable: 0.1
app: { name: Acme }
models:
  Customer:
    fields: { name: string! }
  Order:
    fields: { number: string! }
pages:
  customers: { crud: Customer }
  admin: { data: ${data} }
`;
const read = (data: string) => validateSpec({ path: "smithable.yml", text: spec(data) });
const AUTH =
  "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: {}, sales: {} }\n";

test("data: all is every model, in the spec's order; a list is those models", () => {
  expect(read("all").ir?.pages[1]?.pattern).toEqual({
    kind: "data",
    models: ["Customer", "Order"],
    all: true,
  });
  expect(read("[Order]").ir?.pages[1]?.pattern).toEqual({
    kind: "data",
    models: ["Order"],
    all: false,
  });
});

test("an unknown model is an error with a suggestion; anything but all or a list is refused", () => {
  const unknown = read("[Ordr]");
  expect(unknown.ir).toBeUndefined();
  expect(unknown.diagnostics.map((d) => d.hint ?? d.message).join(" ")).toMatch(/Order/);
  expect(read("some").ir).toBeUndefined();
});

test("a data page is for admins unless it says otherwise, and needs sign-in", () => {
  const ir = read("all").ir;
  if (!ir) throw new Error("invalid");
  const auth = validateAuth({ path: "a", text: AUTH }, ir).auth;
  if (!auth) throw new Error("invalid auth");
  expect(pageAccess(ir.pages[1] as never, auth).roles).toEqual(["admin"]);
  const none = validateAuth({ path: "a", text: "smithableAuth: 0.1\nsignIn: none\n" }, ir);
  expect(none.diagnostics.map((d) => d.code)).toContain("no-sign-in");
});

test("addDataPage adds one for every model, or for the models named, to the main menu", () => {
  const base = spec("all").replace("  admin: { data: all }\n", "");
  const files = { spec: base, auth: AUTH };
  const all = applyOperation(files, "addDataPage", {});
  if (!all.ok) throw new Error(all.message);
  expect(all.files.spec).toContain("admin:\n    data: all");
  const some = applyOperation(files, "addDataPage", { page: "support", models: ["Order"] });
  if (!some.ok) throw new Error(some.message);
  expect(some.files.spec).toContain("support:\n    data: [Order]");
  expect(applyOperation(files, "addDataPage", { models: ["Nope"] })).toMatchObject({ ok: false });
  const noSignIn = applyOperation(
    { spec: base, auth: "smithableAuth: 0.1\nsignIn: none\n" },
    "addDataPage",
    {},
  );
  expect(noSignIn).toMatchObject({ ok: false, message: expect.stringContaining("sign-in") });
});
