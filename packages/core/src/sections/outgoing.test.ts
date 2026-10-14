import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { outgoingText } from "./outgoing.js";

const SPEC = `smithable: 0.1
app:
  name: Studio
models:
  Customer:
    fields:
      name: string!
      email: email
      manager: User
  Booking:
    fields:
      title: string!
      status: pending | confirmed | canceled
      customer: Customer!
      contact: email
actions:
  confirm:
    on: Booking
    when: { status: pending }
    set: { status: confirmed }
`;

const read = (outgoing: string) =>
  validateSpec(
    { path: "smithable.yml", text: `${SPEC}outgoing:\n${outgoing}` },
    { roles: ["admin", "staff"] },
  );

test("outgoing reads an event or an action, a condition, and every kind of recipient", () => {
  const result = read(`  made:
    when: Booking created
    to: mail
    recipient: owner
  confirmed:
    when: Booking changed
    where: { status: confirmed }
    to: mail
    recipient: customer.email
  gone:
    when: Booking deleted
    to: mail
    recipient: staff
  told:
    when: confirm
    to: mail
    recipient: contact
  managed:
    when: Booking created
    to: mail
    recipient: customer.manager
  feed:
    when: Booking created
    to: statusFeed
`);
  expect(result.diagnostics.filter((d) => d.severity !== "note")).toEqual([]);
  expect(result.ir?.outgoing).toEqual([
    {
      name: "made",
      when: { model: "Booking", event: "created" },
      to: "mail",
      recipient: { kind: "owner" },
    },
    {
      name: "confirmed",
      when: { model: "Booking", event: "changed" },
      where: { status: "confirmed" },
      to: "mail",
      recipient: { kind: "field", path: ["customer", "email"], via: "email" },
    },
    {
      name: "gone",
      when: { model: "Booking", event: "deleted" },
      to: "mail",
      recipient: { kind: "role", role: "staff" },
    },
    {
      name: "told",
      when: { model: "Booking", action: "confirm" },
      to: "mail",
      recipient: { kind: "field", path: ["contact"], via: "email" },
    },
    {
      name: "managed",
      when: { model: "Booking", event: "created" },
      to: "mail",
      recipient: { kind: "field", path: ["customer", "manager"], via: "user" },
    },
    { name: "feed", when: { model: "Booking", event: "created" }, to: "statusFeed" },
  ]);
  const texts = (result.ir?.outgoing ?? []).map((o) => outgoingText(o));
  expect(texts).toEqual([
    "When a booking is added: mails its owner.",
    "When a booking changes so that status is confirmed: mails customer's email.",
    "When a booking is deleted: mails every staff.",
    "When “Confirm” runs on a booking: mails contact.",
    "When a booking is added: mails customer's manager.",
    "When a booking is added: tells status feed.",
  ]);
});

test("what outgoing refuses, each with its reason", () => {
  const messages = (outgoing: string) => read(outgoing).diagnostics.map((d) => d.message);
  expect(
    messages("  x:\n    when: Booking exploded\n    to: mail\n    recipient: owner\n"),
  ).toEqual([expect.stringContaining('"when" is "<Model> created"')]);
  expect(messages("  x:\n    when: Visit created\n    to: mail\n    recipient: owner\n")).toEqual([
    expect.stringContaining('There is no model named "Visit"'),
  ]);
  expect(messages("  x:\n    when: Booking created\n    to: mail\n")).toEqual([
    expect.stringContaining('needs "recipient"'),
  ]);
  expect(messages("  x:\n    when: Booking created\n    to: mail\n    recipient: title\n")).toEqual(
    [
      expect.stringContaining(
        "Booking.title is neither an email field nor a field that refers to User",
      ),
    ],
  );
  expect(
    messages("  x:\n    when: Booking created\n    to: mail\n    recipient: customer.name\n"),
  ).toEqual([expect.stringContaining("Customer.name is not an email field")]);
  expect(
    messages("  x:\n    when: Booking created\n    to: mail\n    recipient: nobody\n"),
  ).toEqual([expect.stringContaining('There is no role named "nobody"')]);
  expect(
    messages("  x:\n    when: Booking created\n    to: statusFeed\n    recipient: owner\n"),
  ).toEqual([expect.stringContaining('"recipient" is for mail')]);
  expect(
    messages(
      "  x:\n    when: Booking created\n    where: { status: paid }\n    to: mail\n    recipient: owner\n",
    ),
  ).toEqual([expect.stringContaining("paid")]);
});

test("addOutgoing and removeOutgoing, and what a change to the model does to an entry", () => {
  const files = {
    spec: SPEC,
    auth: "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\nroles:\n  admin: { description: Runs it. }\n  staff: { description: Works. }\ndefaultRole: staff\n",
  };
  const added = applyOperation(files, "addOutgoing", {
    outgoing: "confirmed",
    when: "Booking changed",
    where: { status: "confirmed" },
    recipient: "customer.email",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toContain(
    "outgoing:\n  confirmed:\n    when: Booking changed\n    where:\n      status: confirmed\n    to: mail\n    recipient: customer.email\n",
  );
  expect(added.description).toBe("Add confirmed: when Booking changed, mail customer.email");
  const twice = applyOperation(added.files, "addOutgoing", {
    outgoing: "confirmed",
    when: "Booking created",
    recipient: "owner",
  });
  expect(twice.ok).toBe(false);
  const noRecipient = applyOperation(files, "addOutgoing", {
    outgoing: "made",
    when: "Booking created",
  });
  expect(noRecipient.ok ? "" : noRecipient.message).toContain("Mail needs a recipient");
  const target = applyOperation(files, "addOutgoing", {
    outgoing: "feed",
    when: "confirm",
    to: "statusFeed",
  });
  if (!target.ok) throw new Error(target.message);
  expect(target.files.spec).toContain("  feed:\n    when: confirm\n    to: statusFeed\n");

  // A renamed choice value follows; a removed one is refused; a renamed field follows into the recipient.
  const renamed = applyOperation(added.files, "changeField", {
    model: "Booking",
    field: "status",
    type: "pending | booked | canceled",
    renames: ["confirmed=booked"],
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("      status: booked\n");
  const canceled = applyOperation(added.files, "addOutgoing", {
    outgoing: "canceled",
    when: "Booking changed",
    where: { status: "canceled" },
    recipient: "owner",
  });
  if (!canceled.ok) throw new Error(canceled.message);
  const lost = applyOperation(canceled.files, "changeField", {
    model: "Booking",
    field: "status",
    type: "pending | confirmed",
  });
  expect(lost.ok ? "" : lost.message).toContain('"canceled" under outgoing wants a value');
  const field = applyOperation(added.files, "renameField", {
    model: "Customer",
    from: "email",
    to: "mail",
  });
  if (!field.ok) throw new Error(field.message);
  expect(field.files.spec).toContain("recipient: customer.mail");
  const removed = applyOperation(added.files, "removeField", { model: "Customer", field: "email" });
  expect(removed.ok ? "" : removed.message).toContain(
    '"confirmed" under outgoing uses Customer.email',
  );
  const action = applyOperation(target.files, "removeAction", { action: "confirm" });
  expect(action.ok ? "" : action.message).toContain(
    '"feed" under outgoing waits for the action "confirm"',
  );

  const gone = applyOperation(added.files, "removeOutgoing", { outgoing: "confirmed" });
  if (!gone.ok) throw new Error(gone.message);
  expect(gone.files.spec).not.toContain("outgoing");
});
