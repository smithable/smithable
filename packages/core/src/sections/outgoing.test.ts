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
      bookings: Booking[]
      tier: basic | pro
      count: { type: int, formula: COUNT(bookings) }
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

test("a list field's records, each told; and which fields' change counts", () => {
  const result = read(`  moved:
    when: Customer changed
    fields: [name, email]
    to: mail
    recipient: bookings.owner
  contacts:
    when: Customer changed
    fields: [name]
    where: { tier: pro }
    to: mail
    recipient: bookings.contact
`);
  expect(result.diagnostics.filter((d) => d.severity !== "note").map((d) => d.message)).toEqual([]);
  const [moved, contacts] = result.ir?.outgoing ?? [];
  expect(moved).toEqual({
    name: "moved",
    when: { model: "Customer", event: "changed" },
    fields: ["name", "email"],
    to: "mail",
    recipient: { kind: "list", list: "bookings", model: "Booking", each: { kind: "owner" } },
  });
  expect(contacts?.recipient).toEqual({
    kind: "list",
    list: "bookings",
    model: "Booking",
    each: { kind: "field", field: "contact", via: "email" },
  });
  expect(outgoingText(moved as never)).toBe(
    "When a customer's name or email changes: mails every booking's owner.",
  );
  expect(outgoingText(contacts as never)).toBe(
    "When a customer's name changes so that tier is pro: mails every booking's contact.",
  );
  const messages = (outgoing: string) => read(outgoing).diagnostics.map((d) => d.message);
  expect(
    messages("  x:\n    when: Customer changed\n    to: mail\n    recipient: bookings.title\n"),
  ).toEqual([expect.stringContaining("Booking.title is not owner, an email field")]);
  expect(
    messages(
      "  x:\n    when: Customer created\n    fields: [name]\n    to: mail\n    recipient: owner\n",
    ),
  ).toEqual([expect.stringContaining('goes with "Customer changed" only')]);
  expect(
    messages(
      "  x:\n    when: Customer changed\n    fields: [nome]\n    to: mail\n    recipient: owner\n",
    ),
  ).toEqual([expect.stringContaining('Customer has no field named "nome". Did you mean "name"?')]);
  expect(
    messages(
      "  x:\n    when: Customer changed\n    fields: [count]\n    to: mail\n    recipient: owner\n",
    ),
  ).toEqual([expect.stringContaining("Customer.count is worked out from other fields")]);
  expect(
    messages(
      "  x:\n    when: Customer changed\n    fields: []\n    to: mail\n    recipient: owner\n",
    ),
  ).toEqual([expect.stringContaining("names at least one field")]);
  expect(
    messages(
      "  x:\n    when: Customer changed\n    fields: [bookings]\n    to: mail\n    recipient: owner\n",
    ),
  ).toEqual([expect.stringContaining("Customer.bookings lists other records and stores nothing")]);
  expect(
    messages(
      "  x:\n    when: Customer changed\n    fields: name\n    to: mail\n    recipient: owner\n",
    ),
  ).toEqual([expect.stringContaining("must be a list")]);
});

test("addOutgoing with fields and a list recipient; the model's changes follow into both", () => {
  const files = {
    spec: SPEC,
    auth: "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\nroles:\n  admin: { description: Runs it. }\n  staff: { description: Works. }\ndefaultRole: staff\n",
  };
  const added = applyOperation(files, "addOutgoing", {
    outgoing: "moved",
    when: "Customer changed",
    fields: ["name"],
    recipient: "bookings.contact",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toContain(
    "outgoing:\n  moved:\n    when: Customer changed\n    fields: [name]\n    to: mail\n    recipient: bookings.contact\n",
  );
  const wrong = applyOperation(files, "addOutgoing", {
    outgoing: "moved",
    when: "Customer created",
    fields: ["name"],
    recipient: "owner",
  });
  expect(wrong.ok ? "" : wrong.message).toContain('goes with "Customer changed" only');
  // The list field renamed on the model, the address renamed on the list's model, a watched field renamed.
  const list = applyOperation(added.files, "renameField", {
    model: "Customer",
    from: "bookings",
    to: "visits",
  });
  if (!list.ok) throw new Error(list.message);
  expect(list.files.spec).toContain("recipient: visits.contact\n");
  const each = applyOperation(added.files, "renameField", {
    model: "Booking",
    from: "contact",
    to: "mail",
  });
  if (!each.ok) throw new Error(each.message);
  expect(each.files.spec).toContain("recipient: bookings.mail\n");
  const watched = applyOperation(added.files, "renameField", {
    model: "Customer",
    from: "name",
    to: "title",
  });
  if (!watched.ok) throw new Error(watched.message);
  expect(watched.files.spec).toContain("fields: [title]\n");
  // Removing what the entry uses is refused, each with the place.
  for (const [model, field] of [
    ["Booking", "contact"],
    ["Customer", "bookings"],
    ["Customer", "name"],
  ]) {
    const gone = applyOperation(added.files, "removeField", { model, field });
    expect(gone.ok ? "" : gone.message).toContain(`"moved" under outgoing uses ${model}.${field}`);
  }
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

test("a custom action's entry: after it returns, a call or a role's mail, and no record's words", () => {
  const custom = `${SPEC.replace(
    "actions:\n",
    "actions:\n  importBookings:\n    custom: true\n    input: { file: string! }\n    output: { added: int }\n",
  )}outgoing:\n`;
  const readCustom = (entries: string) =>
    validateSpec(
      { path: "smithable.yml", text: `${custom}${entries}` },
      { roles: ["admin", "staff"] },
    );
  const good = readCustom(
    "  imported: { when: importBookings, to: feed }\n  importMailed: { when: importBookings, to: mail, recipient: staff }\n",
  );
  expect(good.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(good.ir?.outgoing).toEqual([
    { name: "imported", when: { custom: "importBookings" }, to: "feed" },
    {
      name: "importMailed",
      when: { custom: "importBookings" },
      to: "mail",
      recipient: { kind: "role", role: "staff" },
    },
  ]);
  expect(good.ir && outgoingText(good.ir.outgoing[0] as never)).toBe(
    "When “Import bookings” runs: tells feed.",
  );
  // No record: no owner, no address field, no where.
  for (const [entry, says] of [
    ["  a: { when: importBookings, to: mail, recipient: owner }\n", "no owner"],
    ["  a: { when: importBookings, to: mail, recipient: customer.email }\n", "goes to a role"],
    ["  a: { when: importBookings, where: { status: confirmed }, to: feed }\n", '"where"'],
  ] as const)
    expect(
      readCustom(entry)
        .diagnostics.map((d) => d.message)
        .join(" "),
    ).toContain(says);
  // The action cannot go while an entry waits for it.
  const removed = applyOperation(
    {
      spec: `${custom}  imported: { when: importBookings, to: feed }\n`,
      auth: "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\nroles:\n  admin: { description: Runs it. }\n  staff: { description: Works. }\ndefaultRole: staff\n",
    },
    "removeAction",
    { action: "importBookings" },
  );
  expect(removed.ok ? "" : removed.message).toContain(
    '"imported" under outgoing waits for the action "importBookings"',
  );
});

test("show and previous: the fields the mail lists, none, and what changed; refused where they say nothing", () => {
  const read = (outgoing: string) =>
    validateSpec({ path: "smithable.yml", text: `${SPEC}outgoing:\n${outgoing}` });
  const ok = read(
    "  made:\n    when: Booking changed\n    to: mail\n    recipient: owner\n    show: [title, status]\n    previous: true\n",
  );
  expect(ok.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const entry = ok.ir?.outgoing[0];
  if (!entry) throw new Error("entry");
  expect(entry).toMatchObject({ show: ["title", "status"], previous: true });
  expect(outgoingText(entry)).toBe(
    "When a booking is changed: mails its owner with its title, status and what the changed fields were.",
  );
  const none = read(
    "  made:\n    when: Booking created\n    to: mail\n    recipient: owner\n    show: none\n",
  );
  const alone = none.ir?.outgoing[0];
  if (!alone) throw new Error("entry");
  expect(alone.show).toBe("none");
  expect(outgoingText(alone)).toBe("When a booking is added: mails its owner with the text alone.");
  const codes = (o: string) => read(o).diagnostics.map((d) => d.code);
  const made = (rest: string) =>
    `  made:\n    when: Customer created\n    to: mail\n    recipient: owner\n${rest}`;
  // A list of other records, a worked-out field, an unknown field, a word that is not none.
  expect(codes(made("    show: [bookings]\n"))).toContain("invalid-outgoing");
  expect(codes(made("    show: [count]\n"))).toContain("invalid-outgoing");
  expect(codes(made("    show: [nothing]\n"))).toContain("invalid-outgoing");
  expect(codes(made("    show: all\n"))).toContain("invalid-outgoing");
  // What a field was goes with a change only; a custom action has no record.
  expect(codes(made("    previous: true\n"))).toContain("invalid-outgoing");
  expect(
    codes(
      "  done:\n    when: merge\n    to: mail\n    recipient: admin\n    show: [name]\n".replace(
        "merge",
        "confirm",
      ),
    ),
  ).toContain("invalid-outgoing");
});

test("setOutgoingBody sets, clears and refuses show and previous; a renamed field follows, a removed one refuses", () => {
  const files = {
    spec: `${SPEC}outgoing:\n  made:\n    when: Booking changed\n    to: mail\n    recipient: owner\n`,
  };
  const set = applyOperation(files, "setOutgoingBody", {
    outgoing: "made",
    show: ["title", "status"],
    previous: true,
  });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain("    show: [title, status]\n    previous: true\n");
  const none = applyOperation(set.files, "setOutgoingBody", { outgoing: "made", show: ["none"] });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.spec).toContain("    show: none\n");
  const back = applyOperation(none.files, "setOutgoingBody", {
    outgoing: "made",
    show: ["default"],
    previous: false,
  });
  if (!back.ok) throw new Error(back.message);
  expect(back.files.spec).not.toContain("show");
  expect(back.files.spec).not.toContain("previous");
  const wrong = applyOperation(files, "setOutgoingBody", { outgoing: "made", show: ["photo"] });
  expect(wrong.ok).toBe(false);
  expect(applyOperation(files, "setOutgoingBody", { outgoing: "made" }).ok).toBe(false);
  // addOutgoing takes them too.
  const added = applyOperation(files, "addOutgoing", {
    outgoing: "gone",
    when: "Booking deleted",
    recipient: "owner",
    show: ["title"],
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toContain(
    "  gone:\n    when: Booking deleted\n    to: mail\n    recipient: owner\n    show: [title]\n",
  );
  const renamed = applyOperation(set.files, "renameField", {
    model: "Booking",
    from: "status",
    to: "state",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("    show: [title, state]\n");
  const removed = applyOperation(set.files, "removeField", { model: "Booking", field: "title" });
  expect(removed.ok).toBe(false);
});
