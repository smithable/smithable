// Who a new page is for (T760), on the booking starter: staff's page of today's bookings exists.
import { applyOperation, type ProjectFiles } from "@smithable/core";
import { expect, test } from "vitest";
import { checkAudience, rolesExcluded, rolesFor, rolesNamed } from "./audience.js";

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
  // A bare "to X" is no audience; "visible to X" is.
  expect(rolesFor(auth, "a page to send reminders to members")).toEqual([]);
  expect(rolesFor(auth, "a page of sessions visible to members")).toEqual(["member"]);
  // Two phrases: the words do not settle it.
  expect(rolesFor(auth, "a page of bookings for members, for staff")).toEqual([]);
  expect(rolesFor(auth, "en sida med bokningar för memberna, för staffen")).toEqual([]);
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

// T781: negated or excluding wording never makes a role the audience, and a plan that lets that
// role in is sent back.
const granting = (from: ProjectFiles, role: string, page: string, pages: string[]) =>
  apply(from, "grant", { role, what: "pages", names: [...pages, page] });

test("a role under a negation or an exclusion is never granted for, and letting it in is sent back", () => {
  const staffPages = ["sessions", "bookings", "messages"];
  const withPage = apply(files, "addPage", { page: "today", model: "Booking" });
  const memberIn = granting(withPage, "member", "today", ["my-bookings"]);
  for (const request of [
    "Add an admin-only page of bookings, not for members",
    "a page of bookings that is not visible to members",
    "a page of bookings hidden from members",
    "a page of bookings for everyone except members",
    "a page of bookings for staff but not members",
    "a page of bookings without members",
    "a page of bookings, no members",
  ]) {
    const auth = { roles: [{ name: "admin" }, { name: "staff" }, { name: "member" }] } as never;
    expect(rolesFor(auth, request), request).not.toContain("member");
    // The plan that keeps members out (staff in, as some wordings ask) passes; one that lets
    // members in goes back.
    const kept = checkAudience(
      files,
      request.includes("admin-only") ? withPage : granting(withPage, "staff", "today", staffPages),
      request,
    );
    expect(Boolean(kept && "problem" in kept), request).toBe(false);
    const wrong = checkAudience(files, memberIn, request);
    expect(wrong && "problem" in wrong && wrong.problem, request).toMatch(
      /not for member, but member can open "Today" \(today\)/,
    );
  }
  // Admin-only alone: nobody else is asked for, and letting staff in is sent back too.
  const staffIn = granting(withPage, "staff", "today", staffPages);
  const adminOnly = checkAudience(files, staffIn, "an admin-only page of bookings");
  expect(adminOnly && "problem" in adminOnly && adminOnly.problem).toMatch(
    /only for admin, but staff can open/,
  );
});

test("only for staff: staff granted, member not", () => {
  const auth = { roles: [{ name: "admin" }, { name: "staff" }, { name: "member" }] } as never;
  expect(rolesFor(auth, "a page of today's bookings only for staff")).toEqual(["staff"]);
  const withPage = apply(files, "addPage", { page: "today", model: "Booking" });
  const staffOnly = granting(withPage, "staff", "today", ["sessions", "bookings", "messages"]);
  expect(checkAudience(files, staffOnly, "a page of all bookings only for staff")).toBeUndefined();
  const both = granting(staffOnly, "member", "today", ["my-bookings"]);
  const check = checkAudience(files, both, "a page of all bookings only for staff");
  expect(check && "problem" in check && check.problem).toMatch(
    /only for staff, but member can open/,
  );
  // Asked for staff only and not given to them: the missing access, as before.
  const none = checkAudience(files, withPage, "a page of all bookings only for staff");
  expect(none && "problem" in none && none.problem).toMatch(/staff, who cannot open/);
});

test("the Swedish negations and 'bara för' read the same way", () => {
  const sv = { roles: [{ name: "admin" }, { name: "personal" }, { name: "medlem" }] } as never;
  for (const request of [
    "en sida med bokningar, inte för medlemmar",
    "en sida med bokningar, ej för medlemmarna",
    "en sida med bokningar för alla utom medlemmar",
    "en sida med bokningar förutom medlemmarna",
    "en sida med bokningar för personalen men inte medlemmar",
    "en sida med bokningar, dold för medlemmar",
  ])
    expect(rolesFor(sv, request), request).not.toContain("medlem");
  expect(rolesFor(sv, "en sida med dagens bokningar, bara för personalen")).toEqual(["personal"]);
  expect(rolesExcluded(sv, "en sida bara för personalen").only).toEqual(["personal"]);
});

test("negation read where it keeps a role out, and nowhere else", () => {
  const auth = { roles: [{ name: "admin" }, { name: "staff" }, { name: "member" }] } as never;
  // Said after the role.
  expect(
    rolesExcluded(auth, "Create a page of bookings for members; members must not see it").excluded,
  ).toEqual(["member"]);
  expect(rolesFor(auth, "Create a page of bookings for members; members must not see it")).toEqual(
    [],
  );
  // Not about seeing the page: no exclusion.
  expect(
    rolesExcluded(auth, "Create a page of bookings for members, and do not email members").excluded,
  ).toEqual([]);
  expect(rolesFor(auth, "Create a page of bookings for members, and do not email members")).toEqual(
    ["member"],
  );
  // "Not only for members": neither excluded nor the only ones.
  const notOnly = rolesExcluded(auth, "a page of bookings, not only for members");
  expect(notOnly.excluded).toEqual([]);
  expect(notOnly.only).toEqual([]);
  // A public page lets in a role the request keeps out: sent back.
  const open = apply(apply(files, "addPage", { page: "today", model: "Booking" }), "setPublic", {
    pages: ["home", "schedule", "blog", "about", "privacy", "today"],
  });
  const check = checkAudience(files, open, "a page of bookings, not for members");
  expect(check && "problem" in check && check.problem).toMatch(
    /not for member, but member can open/,
  );
});

test("the wordings a second reviewer named: articles, 'only' after the role, contractions, and no false limits", () => {
  const auth = { roles: [{ name: "admin" }, { name: "staff" }, { name: "member" }] } as never;
  expect(rolesExcluded(auth, "a page of bookings, not for the members").excluded).toEqual([
    "member",
  ]);
  expect(rolesExcluded(auth, "a page of bookings for staff only").only).toEqual(["staff"]);
  expect(rolesExcluded(auth, "a page of bookings visible to only staff").only).toEqual(["staff"]);
  expect(
    rolesExcluded(auth, "a page of bookings for staff; members shouldn't see it").excluded,
  ).toEqual(["member"]);
  expect(
    rolesExcluded(auth, "a page of bookings; members are not allowed to see it").excluded,
  ).toEqual(["member"]);
  // Allowed is not denied.
  expect(rolesExcluded(auth, "a page of bookings; members are allowed to see it").excluded).toEqual(
    [],
  );
  // A bare "no" or "without" about something else limits nothing.
  expect(rolesFor(auth, "a page of bookings for members with no sidebar")).toEqual(["member"]);
  expect(rolesFor(auth, "a page of bookings for staff without pagination")).toEqual(["staff"]);
});

test("an exclusion takes a role out, not the roles named positively", () => {
  const auth = { roles: [{ name: "admin" }, { name: "staff" }, { name: "member" }] } as never;
  const withPage = apply(files, "addPage", { page: "today", model: "Booking" });
  for (const request of [
    "a page of all bookings for staff, excluding members",
    "a page of all bookings for staff, not for members",
  ]) {
    expect(rolesFor(auth, request), request).toEqual(["staff"]);
    // Staff asked for and shut out: the missing access, as T760 asks.
    const shut = checkAudience(files, withPage, request);
    expect(shut && "problem" in shut && shut.problem, request).toMatch(/staff, who cannot open/);
  }
  const sv = { roles: [{ name: "admin" }, { name: "personal" }, { name: "medlem" }] } as never;
  for (const request of [
    "en sida med alla bokningar för personalen, utom medlemmar",
    "en sida med alla bokningar för personalen, inte för medlemmar",
  ])
    expect(rolesFor(sv, request), request).toEqual(["personal"]);
});
