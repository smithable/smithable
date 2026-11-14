import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A record made by paying for it is held until paid: Ask offers to add one only where the
// caller's role makes it unheld (T821 #1).
const spec = validateSpec({
  path: "smithable.yml",
  text: "smithable: 0.1\napp: { name: Kiosk, currency: EUR }\nmodels:\n  Order:\n    fields: { name: string!, total: money!, paid: bool }\npages:\n  orders: { crud: Order }\npayments:\n  orderPayment:\n    on: Order\n    amount: total\n    when: created\n",
});
const ir = spec.ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\nroles: { admin: {}, staff: { pages: all, write: [Order] } }\nassistant: { for: signed-in, may: change }\n",
  },
  ir,
).auth as AuthIR;

test("Ask refuses to add a paid record for a role that would leave it held", () => {
  expect(spec.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const all = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() })
    .map((f) => f.content)
    .join("\n");
  expect(all).toContain(", paid: true");
  expect(all).toContain(
    "if ((kind as { paid?: boolean }).paid && !kind.access.write.roles.includes(viewer.role))",
  );
  expect(all).toContain("is made by paying for it on its page, not here.");
});
