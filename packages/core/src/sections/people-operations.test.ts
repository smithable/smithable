import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";

const files = {
  spec: "smithable: 0.1\napp:\n  name: Club\nmodels:\n  Booking:\n    fields:\n      name: string!\npages:\n  bookings:\n    crud: Booking\n",
  auth: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles:\n  admin:\n    description: Runs the club.\n  customer:\n    description: Books courts for the week.\n    pages: [bookings]\n    create: [Booking]\n",
};

test("addSampleUser makes samples/people.yml with the person, the role's description as the persona", () => {
  const added = applyOperation(files, "addSampleUser", {
    name: "Maja Lindqvist",
    role: "customer",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.people).toBe(
    "- name: Maja Lindqvist\n  role: customer\n  persona: Books courts for the week.\n",
  );
  expect(added.description).toBe('Add sample user "Maja Lindqvist" (customer)');
  const more = applyOperation(added.files, "addSampleUser", {
    name: "Tomas",
    role: "visitor",
    persona: "Looks at the courts, never signs in.",
    pace: 5,
  });
  if (!more.ok) throw new Error(more.message);
  expect(more.files.people).toBe(
    "- name: Maja Lindqvist\n  role: customer\n  persona: Books courts for the week.\n- name: Tomas\n  role: visitor\n  persona: Looks at the courts, never signs in.\n  pace: 5\n",
  );
});

test("addSampleUser refuses an unknown role, a name taken and a sixth person", () => {
  expect(applyOperation(files, "addSampleUser", { name: "Maja", role: "custmer" })).toMatchObject({
    ok: false,
    message: expect.stringContaining('Did you mean "customer"'),
  });
  let current = files as typeof files & { people?: string };
  for (const name of ["A", "B", "C", "D", "E"]) {
    const next = applyOperation(current, "addSampleUser", { name, role: "customer" });
    if (!next.ok) throw new Error(next.message);
    current = next.files as typeof current;
  }
  expect(applyOperation(current, "addSampleUser", { name: "A", role: "admin" })).toMatchObject({
    ok: false,
    message: 'addSampleUser: There is already a sample user called "A".'.replace(
      "addSampleUser: ",
      "",
    ),
  });
  expect(applyOperation(current, "addSampleUser", { name: "F", role: "admin" })).toMatchObject({
    ok: false,
    message: expect.stringContaining("At most 5 sample users"),
  });
});

test("without an auth file only a visitor can be a sample user", () => {
  const { auth: _auth, ...noAuth } = files;
  expect(applyOperation(noAuth, "addSampleUser", { name: "Maja", role: "customer" })).toMatchObject(
    { ok: false, message: expect.stringContaining("The roles: visitor.") },
  );
  const visitor = applyOperation(noAuth, "addSampleUser", { name: "Maja", role: "visitor" });
  if (!visitor.ok) throw new Error(visitor.message);
  expect(visitor.files.people).toContain("persona: Visits the app without signing in.");
});

test("removeSampleUser takes the person's lines and keeps the others' comments; a name not there is refused", () => {
  const people =
    "# The club's people\n- name: Maja\n  role: customer\n  persona: Books a lot.\n# The newcomer\n- name: Tomas\n  role: customer\n  persona: First visit.\n  pace: 3\n";
  const removed = applyOperation({ ...files, people }, "removeSampleUser", { name: "Maja" });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.people).toBe(
    "# The club's people\n# The newcomer\n- name: Tomas\n  role: customer\n  persona: First visit.\n  pace: 3\n",
  );
  expect(removed.description).toBe('Remove sample user "Maja"');
  expect(applyOperation({ ...files, people }, "removeSampleUser", { name: "Maya" })).toMatchObject({
    ok: false,
    message: expect.stringContaining('Did you mean "Maja"'),
  });
  expect(applyOperation(files, "removeSampleUser", { name: "Maja" })).toMatchObject({
    ok: false,
    message: expect.stringContaining("There are none."),
  });
});

test("a role a sample user has cannot be removed", () => {
  const people = "- name: Maja\n  role: customer\n  persona: Books a lot.\n";
  const result = applyOperation({ ...files, people }, "setRoles", {
    roles: { sales: "Sells." },
    defaultRole: "sales",
  });
  expect(result).toMatchObject({
    ok: false,
    message: expect.stringContaining("samples/people.yml"),
  });
});
