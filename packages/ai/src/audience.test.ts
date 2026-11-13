// Who a new page is for (T760), on the booking starter: staff's page of today's bookings exists.
import { applyOperation, type ProjectFiles } from "@smithable/core";
import { expect, test } from "vitest";
import { checkAudience, rolesFor, rolesNamed } from "./audience.js";

const raw = import.meta.glob("../../../examples/booking/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const read = (name: string) => raw[`../../../examples/booking/${name}`] as string;
const files: ProjectFiles = { spec: read("smithable.yml"), auth: read("smithable.auth.yml") };
const apply = (from: ProjectFiles, op: string, args: Record<string, unknown>) => {
  const result = applyOperation(from, op, args);
  if (!result.ok) throw new Error(result.message);
  return result.files;
};
const page = (filter?: Record<string, string>) => {
  let after = apply(files, "addPage", { page: "today", model: "Booking" });
  if (filter) {
    after = apply(after, "setFilters", {
      page: "today",
      fields: ["session.startsAt", "session.classType"],
    });
    after = apply(after, "setDefaultFilter", { page: "today", ...filter });
  }
  return after;
};
const grant = (from: ProjectFiles) =>
  apply(from, "grant", {
    role: "staff",
    what: "pages",
    names: ["sessions", "bookings", "messages", "today"],
  });

test("the roles a request names, by their names, in its words", () => {
  const auth = { roles: [{ name: "admin" }, { name: "staff" }, { name: "member" }] } as never;
  expect(rolesNamed(auth, "a page of today's bookings for staff")).toEqual(["staff"]);
  expect(rolesNamed(auth, "a list the members can see")).toEqual(["member"]);
  expect(rolesNamed(auth, "a page for the admins")).toEqual([]);
  // A role's own forms, never a longer word that starts with it.
  expect(rolesNamed(auth, "en sida för memberna")).toEqual(["member"]);
  expect(rolesNamed(auth, "show the membership level")).toEqual([]);
});

test("a page for a named role that the role cannot open goes back, with what is missing", () => {
  const check = checkAudience(files, page(), "a page of all bookings for staff");
  expect(check && "problem" in check && check.problem).toMatch(
    /staff, who cannot open the new page "Today" \(today\)/,
  );
  // With the access, nothing to say: staff open it.
  expect(checkAudience(files, grant(page()), "a page of all bookings for staff")).toBeUndefined();
});

test("a page the app already has, for the same people, is answered with that page", () => {
  const twin = grant(page({ field: "session.startsAt", value: "today" }));
  const ops = [{ op: "addPage", args: { page: "today", model: "Booking" } }];
  const check = checkAudience(files, twin, "a page of today's bookings for staff", ops);
  expect(check && "answer" in check && check.answer).toMatch(
    /"Bookings" \(bookings\) at \/bookings/,
  );
  // Unless another one was asked for.
  expect(
    checkAudience(files, twin, "another page of today's bookings for staff", ops),
  ).toBeUndefined();
});

test("a page nobody was named for, which only administrators open, is said so", () => {
  const check = checkAudience(files, page(), "a page of all bookings");
  expect(check && "note" in check && check.note).toMatch(
    /Only administrators can open the page "Today" \(today\)/,
  );
});

test("a page left out of a named role's reach is repaired before it is compared with the app's pages", () => {
  // The instructors page opens for administrators only; a second one, for nobody else, is not
  // "the same page" when the request is for staff: the access is what is missing.
  const after = apply(files, "addPage", { page: "teachers", model: "Instructor" });
  const check = checkAudience(files, after, "a page of the instructors for staff");
  expect(check && "problem" in check && check.problem).toMatch(
    /staff, who cannot open the new page "Teachers" \(teachers\)/,
  );
});

test("a role is the audience only where the words make it so", () => {
  const auth = { roles: [{ name: "admin" }, { name: "staff" }, { name: "member" }] } as never;
  expect(rolesFor(auth, "a page listing members, for staff")).toEqual(["staff"]);
  expect(rolesFor(auth, "add a page where staff can see the instructors")).toEqual(["staff"]);
  expect(rolesFor(auth, "a page so the members can see their bookings")).toEqual(["member"]);
  expect(rolesFor(auth, "a page of the class types for staff and members")).toEqual([
    "staff",
    "member",
  ]);
  expect(rolesFor(auth, "en sida för memberna")).toEqual(["member"]);
  expect(rolesFor(auth, "a list of every member")).toEqual([]);
});

test("a role only mentioned is never granted for: the note asks", () => {
  const after = grant(apply(files, "addPage", { page: "today", model: "Booking" }));
  const check = checkAudience(files, after, "a page listing members, for staff");
  expect(check && "note" in check && check.note).toMatch(/should member too\?/);
});

test("a plan that does more than add the same page keeps its change and says so", () => {
  const twin = grant(page({ field: "session.startsAt", value: "today" }));
  const ops = [
    { op: "addPage", args: { page: "today", model: "Booking" } },
    { op: "grant", args: { role: "staff", what: "pages", names: [] } },
  ];
  // Only that page: the app's own page instead.
  const only = checkAudience(files, twin, "a page of today's bookings for staff", ops);
  expect(only && "answer" in only).toBe(true);
  // With another change beside it: the change, and the same page said in the note.
  const more = checkAudience(files, twin, "a page of today's bookings for staff", [
    ...ops,
    { op: "addField", args: { model: "Booking", field: "note", type: "text" } },
  ]);
  expect(more && "note" in more && more.note).toMatch(
    /The app has that page already: "Bookings" \(bookings\)/,
  );
});
