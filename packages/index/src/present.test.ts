import {
  type AuthIR,
  type ContentIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { present } from "./present.js";

// Smith's presentation (docs/design/smith-first.md §3): five parts from the files, by rule.
const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Stillwater Yoga, description: A studio's site where visitors see the schedule and members book classes }
models:
  ClassType:
    fields: { name: string!, level: beginner | advanced }
  Session:
    fields: { classType: ClassType!, startsAt: datetime!, capacity: int }
  Booking:
    fields: { session: Session!, name: string! }
  Message:
    fields: { name: string!, email: email!, message: text! }
pages:
  home:
    landing:
      hero: { button: schedule }
      contact: { form: Message }
  schedule: { crud: Session }
  bookings: { crud: Booking }
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: `smithableAuth: 0.1
signIn: { providers: [email] }
defaultAccess: private
defaultRole: member
roles:
  member: { description: Books classes., pages: [bookings] }
  team: { pages: all, read: all, write: [Session] }
public:
  pages: [home, schedule]
  read: [Session]
  create: [Message]
`,
  },
  ir,
).auth as AuthIR;
const content = validateContent(
  {
    path: "smithable.content.yml",
    text: "smithableContent: 0.1\npages:\n  schedule: { title: Schedule }\n",
  },
  ir,
).content as ContentIR;

test("the five parts say what the app is, its pages, the roles, visitors and the signed in", () => {
  const parts = present(ir, auth, content);
  expect(parts.map((p) => p.part)).toEqual(["app", "pages", "roles", "visitors", "signedIn"]);
  expect(parts[0]?.text).toBe(
    "This is Stillwater Yoga. A studio's site where visitors see the schedule and members book classes.",
  );
  // Public pages first, in the visitor's words; the signed-in ones after.
  expect(parts[1]?.text).toBe(
    "It has the home page and schedule for everyone, and for those who sign in: bookings.",
  );
  expect(parts[1]?.concepts).toEqual(["page:home", "page:schedule", "page:bookings"]);
  expect(parts[2]?.text).toBe(
    "People sign in with a code sent to their email. There is an admin role, which can do everything; a member role, which books classes; and a team role.",
  );
  expect(parts[3]?.text).toBe(
    "Anyone on the internet can see the home page and schedule, read sessions and add messages. Everything else needs an account.",
  );
  expect(parts[3]?.concepts).toEqual(["public"]);
  expect(parts[4]?.text).toBe(
    "The member role opens the bookings page and sees only their own records; the team role opens every page, sees everyone's records and changes everyone's sessions. Admins do everything.",
  );
  expect(parts[4]?.text).toMatch(/Admins do everything\.$/);
  expect(parts.map((p) => p.expression)).toEqual([
    "happy",
    "pointing",
    "pointing",
    "waiting",
    "proud",
  ]);
});

test("without an auth file there are two parts, and an app with no description names its kinds", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Tools }\nmodels:\n  Tool:\n    fields: { name: string! }\npages:\n  tools: { crud: Tool }\n",
  }).ir as SpecIR;
  const parts = present(plain);
  expect(parts.map((p) => p.part)).toEqual(["app", "pages"]);
  expect(parts[0]?.text).toBe("This is Tools, an app with tools.");
  expect(parts[1]?.text).toBe("It has tools, open to everyone.");
});

test("a role's description reads after its name by its shape, with the article its name takes", () => {
  const roles = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1
signIn: { providers: [email] }
defaultAccess: private
defaultRole: agent
roles:
  agent: { description: A support person who answers tickets., pages: [bookings] }
  team: { description: Runs the studio., pages: all }
`,
    },
    ir,
  ).auth as AuthIR;
  const parts = present(ir, roles, content);
  const part = parts.find((p) => p.part === "roles");
  expect(part?.text).toContain(
    "There is an admin role, which can do everything; an agent role, a support person who answers tickets; and a team role, which runs the studio.",
  );
});

test("a description of several sentences is kept as written, in parentheses", () => {
  const roles = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1
signIn: { providers: [email] }
defaultAccess: private
defaultRole: staff
roles:
  staff: { description: Reception. Runs the day and reads the messages., pages: all }
`,
    },
    ir,
  ).auth as AuthIR;
  const part = present(ir, roles, content).find((p) => p.part === "roles");
  expect(part?.text).toContain("a staff role (Reception. Runs the day and reads the messages)");
});

test("two pages that would read the same are named by their ids", () => {
  const two = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Desk }\nmodels:\n  Booking:\n    fields: { name: string! }\npages:\n  my-bookings: { crud: Booking }\n  bookings: { crud: Booking }\n",
  }).ir as SpecIR;
  expect(present(two)[1]?.text).toBe("It has my bookings and bookings, open to everyone.");
});

test("private records: 'their own records only' is said of the roles it holds for, from the grants", () => {
  const said = (roles: string) =>
    present(
      ir,
      validateAuth(
        {
          path: "smithable.auth.yml",
          text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\ndefaultRole: guest\nroles:\n${roles}`,
        },
        ir,
      ).auth as AuthIR,
      content,
    ).find((p) => p.part === "signedIn")?.text;
  // The booking starter's shape: one role reads everyone's sessions and bookings, one reads none.
  expect(
    said(
      "  desk: { pages: [schedule, bookings], read: [Session, Booking] }\n  guest: { pages: [bookings], create: [Booking] }\n",
    ),
  ).toBe(
    "The desk role opens the schedule page and the bookings page, sees everyone's sessions and bookings and sees only their own records of the rest; the guest role opens the bookings page, adds bookings and sees only their own records. Admins do everything.",
  );
  // A write grant changes others' records; it does not show them.
  expect(said("  guest: { pages: [bookings], write: [Booking] }\n")).toMatch(
    /^Everyone who signs in sees only their own records; /,
  );
  // A read list naming every kind is everyone's records, not "their own of the rest".
  const every = ir.models.map((m) => m.name).join(", ");
  expect(
    said(`  desk: { pages: [schedule], read: [${every}] }\n  guest: { pages: [bookings] }\n`),
  ).not.toMatch(/desk role[^;]*own records/);
  // No role reads beyond its own: the rule is said once for everyone, as before.
  expect(said("  guest: { pages: [bookings] }\n")).toBe(
    "Everyone who signs in sees only their own records; the guest role opens the bookings page. Admins do everything.",
  );
});

test("a page named by its id never reads as a third page's title (T1689)", () => {
  const three = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Desk }\nmodels:\n  Booking:\n    fields: { name: string! }\npages:\n  my-bookings: { crud: Booking }\n  bookings: { crud: Booking }\n  mine: { crud: Booking }\n",
  }).ir as SpecIR;
  const titled = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  mine: { title: My bookings }\n",
    },
    three,
  ).content as ContentIR;
  expect(present(three, undefined, titled)[1]?.text).toBe(
    "It has my bookings, bookings and mine, open to everyone.",
  );
});

test("two ids that read the same are said as they are written (T1689)", () => {
  const two = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Desk }\nmodels:\n  Booking:\n    fields: { name: string! }\npages:\n  myBookings: { crud: Booking, route: /mine }\n  my-bookings: { crud: Booking }\n  bookings: { crud: Booking }\n",
  });
  expect(two.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(present(two.ir as SpecIR)[1]?.text).toBe(
    "It has myBookings, my-bookings and bookings, open to everyone.",
  );
});
