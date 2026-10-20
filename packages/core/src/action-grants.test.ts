import { expect, test } from "vitest";
import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateSpec,
  writeActionGrants,
} from "./index.js";

const spec = `smithable: 0.1
app: { name: Desk }
models:
  Ticket:
    fields:
      title: string!
      status: open | closed
actions:
  close: { on: Ticket, set: { status: closed } }
  merge: { custom: true, input: { keep: Ticket! } }
pages:
  tickets: { crud: Ticket, actions: [close, merge] }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const authText = `smithableAuth: 0.1
signIn: { providers: [google] }
defaultAccess: shared
roles:
  admin: all
  agent: { pages: all, write: [Ticket], actions: all }   # writes tickets: all stays all
  helper: { pages: all, actions: all }                   # no write: all would widen
  reader: { pages: all }
defaultRole: reader
`;

test("upgrade writes actions: all out as the custom actions where it would widen a role", () => {
  const auth = validateAuth({ path: "smithable.auth.yml", text: authText }, ir).auth as AuthIR;
  const out = writeActionGrants(authText, ir, auth);
  expect(out.written).toEqual(["helper: actions merge"]);
  expect(out.text).toContain(
    "  agent: { pages: all, write: [Ticket], actions: all }   # writes tickets: all stays all\n",
  );
  expect(out.text).toContain("  helper: { pages: all, actions: [merge] }");
  const again = writeActionGrants(
    out.text,
    ir,
    validateAuth({ path: "smithable.auth.yml", text: out.text }, ir).auth as AuthIR,
  );
  expect(again.written).toEqual([]);
});

test("without custom actions the key goes", () => {
  const noCustom = validateSpec({
    path: "smithable.yml",
    text: spec
      .replace("  merge: { custom: true, input: { keep: Ticket! } }\n", "")
      .replace(", merge]", "]"),
  }).ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: authText }, noCustom)
    .auth as AuthIR;
  const out = writeActionGrants(authText, noCustom, auth);
  expect(out.written).toEqual(["helper: actions none"]);
  expect(out.text).toContain("  helper: { pages: all }");
});
