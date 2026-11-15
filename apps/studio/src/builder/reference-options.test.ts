import { type AuthIR, applyOperation, type SpecIR, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { type ReferenceSource, referenceOptions } from "./reference-options";

const spec = `smithable: 0.1
app: { name: References, timezone: UTC }
models:
  Venue:
    fields:
      name: string!
      email: email
      opens: datetime
      bookings: Booking[]
  Booking:
    fields:
      title: string!
      notes: text
      day: date
      copiedDay: { type: date, formula: day }
      copiedEmail: { type: email, formula: email }
      venue: Venue!
      who: User
      email: email
      phone: phone
      amount: money
      count: int
      enabled: bool
      status: pending | confirmed
      picture: picture
      document: file
      replies: Reply[]
  Reply:
    fields:
      body: markdown
      booking: Booking!
      author: User
      email: email
pages:
  bookings: { crud: Booking }
  venues: { crud: Venue }
actions:
  confirm: { on: Booking, set: { status: confirmed } }
  reserve: { on: Venue, set: { name: reserved } }
timers:
  nightly: { every: day, at: "09:00" }
`;

function fixture(): SpecIR {
  const checked = validateSpec({ path: "smithable.yml", text: spec });
  expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(checked.ir).toBeDefined();
  if (!checked.ir) throw Error("Invalid reference fixture");
  return checked.ir;
}
const values = (source: ReferenceSource, ir = fixture()) =>
  referenceOptions(source, ir).map((option) => option.value);

test("date choices follow one single relation, excluding computed dates, lists and missing models", () => {
  expect(values({ kind: "field", model: "Booking", use: "date", oneHop: true })).toEqual([
    "day",
    "venue.opens",
  ]);
  expect(values({ kind: "field", model: "Missing", use: "date", oneHop: true })).toEqual([]);
});

test("name parts use core's exact path reader, including valid reference names but not lists/files", () => {
  const names = values({ kind: "field", model: "Booking", use: "name", oneHop: true });
  expect(names).toContain("venue");
  expect(names).toContain("venue.name");
  expect(names).not.toContain("venue.bookings");
  expect(names).not.toContain("replies.body");
  expect(names).not.toContain("document");
  for (const part of names) {
    const result = applyOperation({ spec }, "setNamedBy", { model: "Booking", parts: [part] });
    expect(result.ok, part).toBe(true);
  }
});

test("review and incoming fields follow their distinct file and relation rules", () => {
  expect(values({ kind: "field", model: "Booking", use: "upload" })).toEqual([
    "picture",
    "document",
  ]);
  const incoming = values({ kind: "field", model: "Booking", use: "incoming" });
  expect(incoming).toContain("day");
  for (const disallowed of ["copiedDay", "venue", "who", "replies", "picture", "document"])
    expect(incoming).not.toContain(disallowed);
});

test("search, filter and sort use different eligibility rules, including one-hop filter restrictions", () => {
  const search = values({ kind: "field", model: "Booking", use: "search" });
  expect(search).toContain("venue");
  expect(search).toContain("notes");
  expect(search).not.toContain("day");
  const filters = values({ kind: "field", model: "Booking", use: "filter", oneHop: true });
  expect(filters).toContain("day");
  expect(filters).toContain("venue.opens");
  expect(filters).not.toContain("venue.bookings");
  expect(filters).not.toContain("notes");
  expect(filters).not.toContain("copiedDay");
  const sort = values({ kind: "field", model: "Booking", use: "sort" });
  expect(sort).toContain("day");
  for (const disallowed of ["notes", "venue", "replies", "picture", "document", "copiedDay"])
    expect(sort).not.toContain(disallowed);
});

test("sendable fields reuse core's sensitive/upload/list refusal, and never become every field", () => {
  const offered = values({ kind: "field", model: "Booking", use: "sendable" });
  expect(offered).toContain("title");
  for (const name of ["picture", "document", "replies", "copiedDay"])
    expect(offered).not.toContain(name);
});

test("money, integer, required-reference and choice-value candidates recompute for their context", () => {
  expect(values({ kind: "field", model: "Booking", use: "money" })).toEqual(["amount"]);
  expect(values({ kind: "field", model: "Booking", use: "integer" })).toEqual(["count"]);
  expect(values({ kind: "field", model: "Booking", use: "required-reference" })).toEqual(["venue"]);
  expect(values({ kind: "field", model: "Reply", use: "money" })).toEqual([]);
  expect(
    values({ kind: "choice", model: "Booking", field: "status", exclude: ["pending"] }),
  ).toEqual(["confirmed"]);
  expect(values({ kind: "choice", model: "Booking", field: "title" })).toEqual([]);
});

test("timer actions respect model, custom mode and person-dependent conditions", () => {
  const ir = fixture();
  expect(values({ kind: "action", model: "Booking", timer: true }, ir)).toEqual(["confirm"]);
  expect(values({ kind: "action", timer: true }, ir)).toEqual([]);
  const confirm = ir.actions.find((action) => action.name === "confirm");
  if (!confirm || confirm.custom) throw Error("Expected standard fixture action");
  confirm.when = { who: "ME()" };
  expect(values({ kind: "action", model: "Booking", timer: true }, ir)).toEqual([]);
  expect(values({ kind: "action", model: "Booking" }, ir)).toEqual(["confirm"]);
});

test("model list references serialize as Model[], while navigation preserves spec page order", () => {
  expect(values({ kind: "model", list: true })).toEqual(["Venue[]", "Booking[]", "Reply[]"]);
  expect(values({ kind: "page" })).toEqual(["bookings", "venues"]);
  expect(values({ kind: "model", includeUser: true })).toContain("User");
});

test("recipient candidates respect each channel, list recipients and the validated role names", () => {
  const ir = fixture();
  const auth = { roles: [{ name: "admin" }, { name: "sales" }] } as Pick<AuthIR, "roles">;
  const recipients = (channels: ("mail" | "push" | "sms")[]) =>
    referenceOptions({ kind: "recipient", model: "Booking", channels }, ir, auth).map(
      (o) => o.value,
    );
  expect(recipients(["mail"])).toEqual([
    "owner",
    "admin",
    "sales",
    "venue.email",
    "who",
    "email",
    "replies.owner",
    "replies.author",
    "replies.email",
  ]);
  expect(recipients(["push"])).toEqual([
    "owner",
    "admin",
    "sales",
    "who",
    "replies.owner",
    "replies.author",
  ]);
  expect(recipients(["mail", "sms"])).not.toContain("email");
  expect(recipients(["mail"])).not.toContain("copiedEmail");
  expect(recipients(["sms"])).toContain("phone");
  expect(
    referenceOptions({ kind: "recipient", channels: ["mail"] }, ir, auth).map((o) => o.value),
  ).toEqual(["admin", "sales"]);
  expect(referenceOptions({ kind: "role" }, ir)).toEqual([]);
});

test("ambiguous action/timer events are not offered, while model events are exact spec values", () => {
  const ir = fixture();
  expect(values({ kind: "event" }, ir)).toContain("Booking changed");
  ir.timers[0].name = "confirm";
  expect(values({ kind: "event" }, ir)).not.toContain("confirm");
});

test("reply models require exactly one single reference, without guessing a model from field names", () => {
  expect(values({ kind: "reply-model", model: "Booking" })).toEqual(["Reply"]);
  expect(values({ kind: "reply-model", model: "Reply" })).toEqual([]);
  expect(values({ kind: "away-model", model: "Venue" })).toEqual([]);
});

test("mail parts and thread bodies offer their actual field kinds rather than all text-like fields", () => {
  expect(values({ kind: "field", model: "Booking", use: "mail-from" })).toEqual(["title", "email"]);
  expect(values({ kind: "field", model: "Booking", use: "mail-subject" })).toEqual([
    "title",
    "notes",
  ]);
  expect(values({ kind: "field", model: "Booking", use: "mail-body" })).toEqual(["title", "notes"]);
  expect(values({ kind: "field", model: "Booking", use: "mail-attachments" })).toEqual([
    "document",
  ]);
  const bodies = values({ kind: "field", model: "Booking", use: "thread-body" });
  expect(bodies).toEqual(["title", "notes"]);
  for (const body of bodies)
    expect(applyOperation({ spec }, "setThread", { model: "Booking", body }).ok, body).toBe(true);
  expect(values({ kind: "field", model: "Reply", use: "thread-body" })).toEqual(["body"]);
});

test("dashboard grouping follows a reference to a choice, never a referenced date", () => {
  const ir = fixture();
  const venue = ir.models.find((model) => model.name === "Venue");
  const status = ir.models
    .find((model) => model.name === "Booking")
    ?.fields.find((field) => field.name === "status");
  if (!venue || !status) throw Error("Missing grouping fixture");
  venue.fields.push({ ...status, name: "kind" });
  const groups = values({ kind: "field", model: "Booking", use: "group", oneHop: true }, ir);
  expect(groups).toContain("day");
  expect(groups).toContain("venue.kind");
  expect(groups).not.toContain("venue.opens");
});

test("short schedule-away choices exclude an ambiguous resource that the explicit long form can resolve", () => {
  const checked = validateSpec({
    path: "smithable.yml",
    text: spec
      .replace("      replies: Reply[]\n", "")
      .replace(
        "      author: User",
        "      author: User\n      other: Booking!\n      starts: datetime\n      ends: datetime",
      ),
  });
  expect(checked.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!checked.ir) throw Error("Invalid schedule fixture");
  expect(values({ kind: "away-model", model: "Booking" }, checked.ir)).toEqual(["Reply"]);
  expect(values({ kind: "away-model", model: "Booking", short: true }, checked.ir)).toEqual([]);
  expect(values({ kind: "reply-model", model: "Booking" }, checked.ir)).toEqual([]);
});

test("capacity candidates exclude the built-in User even when the reference is required", () => {
  const text = spec.replace("      who: User", "      who: User!");
  const checked = validateSpec({ path: "smithable.yml", text });
  expect(checked.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  if (!checked.ir) throw Error("Invalid capacity fixture");
  expect(
    values({ kind: "field", model: "Booking", use: "required-reference" }, checked.ir),
  ).toEqual(["venue", "who"]);
  expect(
    values({ kind: "field", model: "Booking", use: "capacity-reference" }, checked.ir),
  ).toEqual(["venue"]);
  expect(
    applyOperation({ spec: text }, "setCapacity", { model: "Booking", per: "venue", max: "1" }).ok,
  ).toBe(true);
  expect(
    applyOperation({ spec: text }, "setCapacity", { model: "Booking", per: "who", max: "1" }).ok,
  ).toBe(false);
});
