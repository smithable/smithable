import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { grantable } from "./users.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Desk }
models:
  Ticket:
    fields: { title: string! }
  Note:
    fields: { text: string! }
pages:
  tickets: { crud: Ticket }
  notes: { crud: Note }
  team: { users: manage }
`,
}).ir as SpecIR;

const auth = (roles: string): AuthIR => {
  const read = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\ndefaultRole: manager\nroles:\n  admin: {}\n${roles}`,
    },
    ir,
  );
  if (!read.auth) throw new Error(JSON.stringify(read.diagnostics));
  return read.auth;
};

test("an administrator gives any role; a manager only roles within its own rights, never admin", () => {
  const roles = grantable(
    auth(
      "  manager: { pages: [tickets, notes, team], write: [Ticket, Note] }\n  agent: { pages: [tickets], write: [Ticket] }\n  editor: { pages: [notes], write: [Note], delete: [Note] }\n",
    ),
  );
  expect(roles.admin).toEqual(["admin", "manager", "agent", "editor"]);
  // The manager may write tickets and notes but not delete notes: the editor is beyond it.
  expect(roles.manager).toEqual(["manager", "agent"]);
  expect(roles.agent).toEqual(["agent"]);
});

test("a role that runs no actions gives no role that may run them", () => {
  const roles = grantable(
    auth(
      "  manager: { pages: [tickets, team], write: [Ticket], actions: none }\n  agent: { pages: [tickets], write: [Ticket] }\n",
    ),
  );
  expect(roles.manager).toEqual(["manager"]);
});
