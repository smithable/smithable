// Who a new page is for (T760), on the booking starter: staff's page of today's bookings exists.
import { applyOperation, type ProjectFiles } from "@smithable/core";
import { expect, test } from "vitest";
import { checkAudience, rolesNamed } from "./audience.js";

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
});

test("a page for a named role that the role cannot open goes back, with what is missing", () => {
  const check = checkAudience(files, page(), "a page of all bookings for staff");
  expect(check && "problem" in check && check.problem).toMatch(
    /staff cannot open the new page today/,
  );
  // With the access, nothing to say: staff open it.
  expect(checkAudience(files, grant(page()), "a page of all bookings for staff")).toBeUndefined();
});

test("a page the app already has, for the same people, is answered with that page", () => {
  const twin = grant(page({ field: "session.startsAt", value: "today" }));
  const check = checkAudience(files, twin, "a page of today's bookings for staff");
  expect(check && "answer" in check && check.answer).toMatch(/"bookings" \(\/bookings\)/);
  // Unless another one was asked for.
  expect(checkAudience(files, twin, "another page of today's bookings for staff")).toBeUndefined();
});

test("a page nobody was named for, which only administrators open, is said so", () => {
  const check = checkAudience(files, page(), "a page of all bookings");
  expect(check && "note" in check && check.note).toMatch(
    /Only administrators can open the page today/,
  );
});
