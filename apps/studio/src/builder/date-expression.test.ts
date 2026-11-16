import { applyOperation, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { parse } from "yaml";
import {
  dateControl,
  dateDraft,
  dateDraftReady,
  dateText,
  dateTreeReady,
  windowDraft,
  windowReady,
  windowText,
} from "./date-expression";

const spec = `smithable: 0.1
app: { name: Dates, timezone: UTC }
models:
  Venue:
    fields: { name: string!, opensAt: datetime }
  Session:
    fields:
      title: string!
      startsAt: datetime
      day: date
      copiedStart: { type: datetime, formula: startsAt }
      venue: Venue
      bookings: Booking[]
  Booking:
    fields:
      title: string!
      ownDate: date
      session: Session!
      other: Venue
    capacity: { per: session, max: 3 }
timers:
  daily: { every: day, at: '09:00' }
outgoing:
  digest:
    when: daily
    to: mail
    recipient: admin
    list: { model: Booking, when: session.startsAt, within: '7 days', columns: [title] }
`;
const checked = validateSpec({ path: "smithable.yml", text: spec });
const ir = checked.ir;
if (!ir) throw Error(JSON.stringify(checked.diagnostics));
const document = parse(spec);
const capacityPath = ["models", "Booking", "capacity"];
const listPath = ["outgoing", "digest", "list"];

test("capacity deadlines offer only stored datetimes through the selected per reference", () => {
  expect(checked.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
  const control = dateControl([...capacityPath, "closes"], document, ir);
  expect(control?.kind).toBe("date");
  if (control?.kind !== "date") throw Error("Missing deadline control");
  expect(control.options.map((option) => option.value)).toEqual(["session.startsAt"]);
  expect(control.offsets).toBe("before");
  expect(
    dateDraftReady(dateDraft("2 hours before session.startsAt"), control.options, control.offsets),
  ).toBe(true);
  expect(
    dateDraftReady(dateDraft("2 hours after session.startsAt"), control.options, control.offsets),
  ).toBe(false);
  expect(dateDraftReady(dateDraft("session.day"), control.options, control.offsets)).toBe(false);
  const changed = {
    ...document,
    models: {
      ...document.models,
      Booking: { ...document.models.Booking, capacity: { per: "other", max: 3 } },
    },
  };
  const next = dateControl([...capacityPath, "closes"], changed, ir);
  expect(next?.kind === "date" && next.options.map((option) => option.value)).toEqual([
    "other.opensAt",
  ]);
  expect(
    dateTreeReady(capacityPath, { per: "other", max: 3, closes: "session.startsAt" }, changed, ir),
  ).toBe(false);
});

test("shared date parts round-trip through record timer operations in both directions", () => {
  const control = dateControl([...listPath, "when"], document, ir);
  if (control?.kind !== "date") throw Error("Missing date control");
  expect(control.options.map((option) => option.value)).toEqual([
    "ownDate",
    "session.startsAt",
    "session.day",
    "other.opensAt",
  ]);
  for (const direction of ["before", "after"] as const) {
    for (const unit of ["minute", "hour", "day"] as const) {
      const draft = { field: "session.startsAt", offset: true, amount: "2", unit, direction };
      expect(dateDraftReady(draft, control.options, "both")).toBe(true);
      const result = applyOperation({ spec }, "addTimer", {
        name: "reminder",
        on: "Booking",
        at: dateText(draft),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw Error(result.message);
      expect(parse(result.files.spec).timers.reminder.at).toBe(
        `2 ${unit}s ${direction} session.startsAt`,
      );
    }
  }
  for (const amount of ["", "0", "-1", "1.5", "1e3", "9007199254740992"])
    expect(
      dateDraftReady(
        { ...dateDraft("session.startsAt"), offset: true, amount },
        control.options,
        "both",
      ),
      amount,
    ).toBe(false);
});

test("deadline parts match the real existing operation validator and support removal", () => {
  for (const value of [
    "session.startsAt",
    "1 hour before session.startsAt",
    "2 days before session.startsAt",
  ]) {
    const result = applyOperation({ spec }, "editSpec", {
      file: "smithable.yml",
      path: [...capacityPath, "closes"],
      value,
    });
    expect(result.ok, value).toBe(true);
    if (!result.ok) throw Error(result.message);
    expect(parse(result.files.spec).models.Booking.capacity.closes).toBe(value);
    expect(
      applyOperation(result.files, "editSpec", {
        file: "smithable.yml",
        path: [...capacityPath, "closes"],
        value: null,
      }).ok,
    ).toBe(true);
  }
  for (const value of [
    "1 hour after session.startsAt",
    "0 days before session.startsAt",
    "session.day",
    "other.opensAt",
    "session.copiedStart",
  ])
    expect(
      applyOperation({ spec }, "editSpec", {
        file: "smithable.yml",
        path: [...capacityPath, "closes"],
        value,
      }).ok,
      value,
    ).toBe(false);
});

test("a list mail uses a field plus its own window, with no timer offsets", () => {
  expect(dateTreeReady(listPath, document.outgoing.digest.list, document, ir)).toBe(true);
  expect(dateTreeReady([...listPath, "when"], "1 day before session.startsAt", document, ir)).toBe(
    false,
  );
  for (const value of ["today", "tomorrow", "1 day", "2 weeks", "9007199254740992 days"]) {
    expect(windowReady(value)).toBe(true);
    expect(windowText(windowDraft(value))).toBe(value);
    expect(
      applyOperation({ spec }, "editSpec", {
        file: "smithable.yml",
        path: [...listPath, "within"],
        value,
      }).ok,
      value,
    ).toBe(true);
  }
  for (const value of [
    "session.copiedStart",
    "session.venue.opensAt",
    "session.bookings",
    "session.title",
  ]) {
    expect(
      applyOperation({ spec }, "editSpec", {
        file: "smithable.yml",
        path: [...listPath, "when"],
        value,
      }).ok,
      value,
    ).toBe(false);
  }
  for (const value of ["", "0 days", "-1 days", "1.5 days", "2 hours"])
    expect(windowReady(value), value).toBe(false);
  const missingDate = {
    ...document,
    outgoing: {
      digest: {
        ...document.outgoing.digest,
        list: { model: "Booking", within: "today", columns: ["title"] },
      },
    },
  };
  expect(dateTreeReady(listPath, missingDate.outgoing.digest.list, missingDate, ir)).toBe(false);
  const query = {
    ...document,
    outgoing: {
      digest: {
        ...document.outgoing.digest,
        list: { query: "bookings", when: "ownDate", within: "today" },
      },
    },
  };
  expect(dateTreeReady(listPath, query.outgoing.digest.list, query, ir)).toBe(false);
});

test("incomplete date settings block the whole existing draft before any operation is written", () => {
  for (const closes of [
    "",
    " hours before session.startsAt",
    "0 hours before session.startsAt",
    "session.missing",
  ]) {
    expect(
      dateTreeReady(capacityPath, { per: "session", max: 3, closes }, document, ir),
      closes,
    ).toBe(false);
  }
  expect(dateTreeReady(capacityPath, { per: "session", max: 3 }, document, ir)).toBe(true);
  expect(dateControl(["roles", "admin", "closes"], document, ir)).toBeUndefined();
  expect(dateControl(["models", "Booking", "fields", "closes"], document, ir)).toBeUndefined();
});

test("null is an operation removal token, not a valid saved deadline or window", () => {
  const invalidDeadline = spec.replace(
    "capacity: { per: session, max: 3 }",
    "capacity: { per: session, max: 3, closes: null }",
  );
  const invalidWindow = spec.replace("within: '7 days'", "within: null");
  for (const text of [invalidDeadline, invalidWindow]) {
    expect(
      validateSpec({ path: "smithable.yml", text }).diagnostics.some(
        (item) => item.severity === "error",
      ),
    ).toBe(true);
  }
  const result = applyOperation({ spec }, "editSpec", {
    file: "smithable.yml",
    path: [...listPath, "within"],
    value: null,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.message);
  expect(parse(result.files.spec).outgoing.digest.list.within).toBeUndefined();
});
