import { expect, test } from "vitest";
import { conditionText } from "./condition.js";
import { validateSpec } from "./spec.js";

// An action's `when` on a reference field: none, any, ME() and not ME() (the last two for a
// field that refers to User), so "Assign to me" shows only on cases that are not already yours.
const spec = (when: string, where = "") => `smithable: 0.1
app: { name: Support }
models:
  Team:
    fields:
      name: string
  SupportCase:
    fields:
      subject: string!
      status: open | closed
      assignee: User
      team: Team
actions:
  assignToMe:
    on: SupportCase
    when: ${when}
    set: { assignee: ME() }
pages:
  cases: { crud: SupportCase, actions: [assignToMe] }
${where}`;

const read = (text: string) => validateSpec({ path: "smithable.yml", text });
const errors = (text: string) =>
  read(text)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);

test("when takes none, any, ME() and not ME() on a reference, in the canonical form", () => {
  for (const [written, stored] of [
    ["{ assignee: none }", "none"],
    ["{ assignee: any }", "any"],
    ["{ assignee: ME() }", "ME()"],
    ["{ assignee: not ME() }", "not ME()"],
    ["{ assignee: not ME () }", "not ME()"],
    ["{ team: none }", "none"],
  ]) {
    const { ir, diagnostics } = read(spec(written as string));
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const action = ir?.actions.find((a) => a.name === "assignToMe");
    const field = (written as string).includes("team") ? "team" : "assignee";
    expect(action && !action.custom && action.when).toEqual({ [field]: stored });
  }
  expect(conditionText({ assignee: "not ME()", status: "open" })).toBe(
    "assignee is not you and status is open",
  );
  expect(conditionText({ assignee: "none" })).toBe("assignee is empty");
  expect(conditionText({ team: "any", assignee: "ME()" })).toBe("team is set and assignee is you");
});

test("a reference wants only those forms, and ME() needs a field that refers to User", () => {
  expect(errors(spec("{ assignee: bob }"))).toEqual([
    expect.stringContaining(
      '"assignee" in "when" of action "assignToMe" is a reference: it is none (empty), any (set), ME() (the person signed in) or not ME().',
    ),
  ]);
  expect(errors(spec("{ team: ME() }"))).toEqual([
    expect.stringContaining(
      '"team" in "when" of action "assignToMe" is a reference to Team, not to User: it is none (empty) or any (set); ME() names nobody there.',
    ),
  ]);
});
