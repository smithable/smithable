import { type AuthIR, type SpecIR, validateAuth, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import bookingAuth from "../../../../examples/booking/smithable.auth.yml?raw";
import bookingSpec from "../../../../examples/booking/smithable.yml?raw";
import crmAuth from "../../../../examples/crm/smithable.auth.yml?raw";
import crmSpec from "../../../../examples/crm/smithable.yml?raw";
import {
  granted,
  gridWarnings,
  headerState,
  roleSentence,
  ticked,
  visitorSentence,
} from "./who-can";

const FILES = { booking: [bookingSpec, bookingAuth], crm: [crmSpec, crmAuth] } as const;
const read = (example: keyof typeof FILES, auth?: (text: string) => string) => {
  const [spec, text] = FILES[example];
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const parsed = validateAuth({ path: "smithable.auth.yml", text: auth ? auth(text) : text }, ir);
  return { ir, auth: parsed.auth as AuthIR };
};

test("the booking and CRM files have none of the grid's warnings", () => {
  const booking = read("booking");
  expect(gridWarnings(booking.ir, booking.auth)).toEqual([]);
  const crm = read("crm");
  expect(gridWarnings(crm.ir, crm.auth)).toEqual([]);
});

test("change without see under private access, and a role that opens no page", () => {
  const { ir, auth } = read("booking", (t) =>
    t
      .replace("pages: [my-bookings]", "write: [Booking]")
      .replace(/(admin:\n.*\n)/, "$1  teacher:\n    description: Teaches.\n")
      .replace("admins:", "defaultRole: member\nadmins:"),
  );
  expect(gridWarnings(ir, auth)).toEqual([
    { kind: "role-opens-nothing", role: "teacher" },
    { kind: "write-without-read", role: "member", key: "write", model: "Booking" },
    { kind: "role-opens-nothing", role: "member" },
  ]);
});

test("anyone reading personal data, and a public page whose records anyone cannot read", () => {
  const { ir, auth } = read("booking", (t) =>
    t.replace("    - ClassType\n", "    - Message\n").replace("create: [Message]", "create: []"),
  );
  const warnings = gridWarnings(ir, auth);
  expect(warnings).toContainEqual(
    expect.objectContaining({ kind: "public-personal-data", model: "Message" }),
  );
  expect(warnings).toContainEqual({
    kind: "public-page-closed-records",
    page: "home",
    models: ["ClassType"],
  });
});

test("a tick writes the grant whole; under all an untick writes the rest", () => {
  const { ir, auth } = read("crm");
  const sales = auth.roles.find((r) => r.name === "sales")?.grants;
  if (!sales || sales === "all") throw new Error("sales has no grants");
  // pages: all leaves out the administrators' team page.
  expect(granted(ir, sales, "pages", "customers")).toBe(true);
  expect(granted(ir, sales, "pages", "team")).toBe(false);
  expect(headerState(ir, sales.pages, "pages")).toBe("all");
  const rest = ticked(ir, sales.pages, "pages", "customers", false);
  expect(rest).not.toContain("customers");
  expect(rest).not.toContain("team");
  expect(headerState(ir, rest, "pages")).toBe("some");
  // Ticked back by hand: every one today, not ones added later.
  const every = ticked(ir, rest, "pages", "customers", true);
  expect(headerState(ir, every, "pages")).toBe("every");
  expect(ticked(ir, ["Customer"], "read", "Customer", false)).toEqual(["none"]);
});

test("the simple view's sentences: each role and visitors in one line (A 166)", () => {
  const { ir, auth } = read("booking");
  const lines = Object.fromEntries(auth.roles.map((r) => [r.name, roleSentence(ir, r.grants)]));
  expect(lines.admin).toBe("May do everything.");
  expect(Object.values(lines).every((l) => /^May .+\.$/.test(l))).toBe(true);
  expect(visitorSentence(auth)).toMatch(/^May open the .+ page/);
});
