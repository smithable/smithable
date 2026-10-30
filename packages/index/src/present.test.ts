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
    "Everyone who signs in works on their own records only; the member role opens the bookings page; the team role opens every page, sees everyone's records and changes everyone's sessions. Admins do everything.",
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
