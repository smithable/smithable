import { describe, expect, test } from "vitest";
import { actionAccess, modelAccess, pageAccess } from "./access.js";
import type { AuthIR } from "./auth.js";
import { validateAuth } from "./auth.js";
import type { SpecIR, StandardActionIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const examples = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function load(spec: string, auth: string) {
  const roles = validateAuth({ path: "smithable.auth.yml", text: auth }).auth?.roles.map(
    (r) => r.name,
  );
  const result = validateSpec({ path: "smithable.yml", text: spec }, roles ? { roles } : {});
  return { ...result, auth: validateAuth({ path: "smithable.auth.yml", text: auth }, result.ir) };
}

const SPEC = `smithable: 0.1
app: { name: X }
models:
  Customer:
    fields: { name: string!, email: email, manager: User }
    access: { delete: [admin] }
  Note:
    fields: { text: string }
pages:
  customers: { crud: Customer }
  notes: { crud: Note }
`;

const codes = (auth: string, spec = SPEC) =>
  load(spec, auth).auth.diagnostics.map((d) => `${d.severity} ${d.code}`);

describe("the examples", () => {
  test.each(["crm", "booking", "invoicing"])("%s is valid with its auth file", (name) => {
    const { ir, diagnostics, auth } = load(
      examples[`../../../examples/${name}/smithable.yml`] as string,
      examples[`../../../examples/${name}/smithable.auth.yml`] as string,
    );
    expect(diagnostics).toEqual([]);
    // A starter's administrator and domains are samples on domains nobody has: `smithable new` replaces them.
    expect(
      auth.diagnostics.filter((d) => d.code !== "example-admin" && d.code !== "example-domain"),
    ).toEqual([]);
    expect(ir && auth.auth).toBeTruthy();
    expect(auth.auth).toMatchSnapshot();
  });

  test("CRM: sales edit customers and orders, only admins delete or merge", () => {
    const { ir, auth } = load(
      examples["../../../examples/crm/smithable.yml"] as string,
      examples["../../../examples/crm/smithable.auth.yml"] as string,
    );
    const a = auth.auth as NonNullable<typeof auth.auth>;
    const customer = modelAccess((ir as SpecIR).models[0] as SpecIR["models"][0], a);
    expect(customer).toEqual({
      read: { public: false, roles: ["admin", "sales"], owner: false },
      create: { public: false, roles: ["admin", "sales"], owner: false },
      write: { public: false, roles: ["admin", "sales"], owner: false },
      delete: { public: false, roles: ["admin"], owner: false },
    });
    const merge = (ir as SpecIR).actions[0] as SpecIR["actions"][0];
    expect(actionAccess(merge, a).roles).toEqual(["admin"]);
    // A standard action follows the model's write access; "allow" narrows it, never widens it.
    const models = (ir as SpecIR).models;
    const archive: StandardActionIR = {
      name: "archive",
      custom: false,
      input: [],
      on: "Customer",
      set: [],
    };
    expect(actionAccess(archive, a, models)).toEqual(customer.write);
    expect(actionAccess({ ...archive, allow: ["support"] }, a, models).roles).toEqual(["admin"]);
    const order = { ...archive, on: "Order" };
    expect(actionAccess(order, a, models)).toEqual(
      modelAccess(models.find((m) => m.name === "Order") as SpecIR["models"][0], a).write,
    );
  });

  test("booking: the schedule is public; members see only their own records", () => {
    const { ir, auth } = load(
      examples["../../../examples/booking/smithable.yml"] as string,
      examples["../../../examples/booking/smithable.auth.yml"] as string,
    );
    const a = auth.auth as NonNullable<typeof auth.auth>;
    const spec = ir as SpecIR;
    const session = spec.models.find((m) => m.name === "Session") as SpecIR["models"][0];
    expect(modelAccess(session, a)).toEqual({
      read: { public: true, roles: ["admin"], owner: true },
      create: { public: false, roles: ["admin"], owner: false },
      write: { public: false, roles: ["admin"], owner: true },
      delete: { public: false, roles: ["admin"], owner: true },
    });
    const pages = Object.fromEntries(spec.pages.map((p) => [p.id, pageAccess(p, a)]));
    // The public schedule is a calendar; the list of sessions is the staff's.
    expect(pages.schedule).toEqual({ public: true, roles: ["admin", "member"], owner: false });
    expect(pages.sessions).toEqual({ public: false, roles: ["admin"], owner: false });
    expect(pages["class-types"]).toEqual({ public: false, roles: ["admin"], owner: false });
  });
});

describe("smithable.auth.yml", () => {
  test("defaults: Google, roles admin and member, member for new users", () => {
    const { auth } = load(
      SPEC,
      "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\n",
    );
    expect(auth.auth).toEqual({
      signIn: { providers: ["google"], selfSignUp: true },
      defaultAccess: "private",
      roles: [{ name: "admin" }, { name: "member" }],
      defaultRole: "member",
      admins: [],
      public: { pages: [], read: [], create: [], readWhere: {} },
    });
  });

  test("mistakes are reported with codes", () => {
    expect(codes("signIn: none\n")).toEqual(["error invalid-version"]);
    expect(
      codes(`smithableAuth: 0.1
signIn:
  providers: [google, github, twitter]
  allowedDomains: [acme]
roles: { admin: {}, sales: {}, support: {}, owner: {} }
admins: [boss]
public: { pages: [customer], read: [Customers], write: [Note] }
`),
    ).toEqual([
      "error missing-key",
      "error not-yet-supported",
      "error unknown-provider",
      "error invalid-domain",
      "error missing-key",
      "error invalid-name",
      "error invalid-email",
      "error unknown-page",
      "error unknown-model",
      "error not-yet-supported",
    ]);
  });

  test("risky combinations are warnings, never silent changes", () => {
    expect(
      codes(
        "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\npublic: { read: [Customer, Note] }\n",
      ),
    ).toEqual(["warning open-shared-access", "warning public-personal-data"]);
  });

  test("closed sign-up needs a users page, and a users page needs sign-in", () => {
    const team = `${SPEC}  team: { users: manage }\n`;
    const closed =
      "smithableAuth: 0.1\nsignIn: { providers: [google], selfSignUp: false }\ndefaultAccess: shared\nadmins: [owner@studio.ax]\n";
    expect(codes(closed)).toEqual(["error no-users-page"]);
    const { auth, ir } = load(team, closed);
    expect(auth.diagnostics).toEqual([]);
    expect(auth.auth?.signIn).toEqual({ providers: ["google"], selfSignUp: false });
    const teamPage = ir?.pages.find((p) => p.id === "team");
    expect(teamPage && pageAccess(teamPage, auth.auth as AuthIR)).toEqual({
      public: false,
      roles: ["admin"],
      owner: false,
    });
    // The team page and the User field both need sign-in.
    expect(
      codes(
        "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [customers, notes, team] }\n",
        team,
      ),
    ).toEqual([
      "error no-sign-in",
      "error no-sign-in",
      // The two lists are open to visitors, who may read neither model.
      "warning public-page-closed-records",
      "warning public-page-closed-records",
    ]);
    expect(
      codes(
        "smithableAuth: 0.1\nsignIn: { providers: [google], selfSignUp: maybe }\ndefaultAccess: private\n",
      ),
    ).toEqual(["error expected-boolean"]);
  });

  test("without sign-in, users cannot be referred to and only public pages open", () => {
    expect(codes("smithableAuth: 0.1\nsignIn: none\npublic: { pages: [notes] }\n")).toEqual([
      "error no-sign-in",
      "warning unreachable-page",
      "warning public-page-closed-records",
    ]);
  });

  test("roles used in smithable.yml must exist", () => {
    const spec = SPEC.replace("delete: [admin]", "delete: [amdin]");
    const { diagnostics } = load(
      spec,
      "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\n",
    );
    expect(diagnostics.map((d) => [d.code, d.hint])).toEqual([
      ["unknown-role", 'Did you mean "admin"?'],
    ]);
  });
});

test("a public page's contact form needs visitors to be allowed to add its records", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Message:
    fields: { name: string!, message: text! }
pages:
  home: { route: /, landing: { contact: { form: Message } } }
`,
  }).ir;
  const auth = (create: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\nroles: { admin: {} }\npublic: { pages: [home]${create} }\n`,
      },
      ir,
    ).diagnostics.map((d) => d.code);
  expect(auth("")).toContain("contact-form-closed");
  expect(auth(", create: [Message]")).not.toContain("contact-form-closed");
});

test("a public page's shortcut to a page visitors cannot open is warned about", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Class:
    fields: { name: string! }
pages:
  home: { route: /, landing: { hero: { button: classes, shortcuts: [classes] } } }
  classes: { crud: Class }
`,
  }).ir;
  const auth = (pages: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\nroles: { admin: {} }\npublic: { pages: [${pages}], read: [Class] }\n`,
      },
      ir,
    ).diagnostics.map((d) => d.code);
  expect(auth("home")).toContain("shortcut-closed");
  expect(auth("home, classes")).not.toContain("shortcut-closed");
});

test("a public page of the viewer's own records is warned about: a visitor owns nothing", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Market }
models:
  Item:
    fields: { title: string! }
pages:
  items: { crud: Item }
  myItems: { crud: Item, mine: true }
`,
  }).ir;
  const codes = (pages: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\nroles: { admin: {} }\npublic: { pages: [${pages}], read: [Item] }\n`,
      },
      ir,
    ).diagnostics.map((d) => d.code);
  expect(codes("items, myItems")).toContain("mine-public");
  expect(codes("items")).not.toContain("mine-public");
});

test("a role a standard action allows but that may not edit the record is warned about", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields: { title: string!, status: open | resolved }
    access: { write: [staff] }
actions:
  resolve:
    on: Incident
    set: { status: resolved }
    allow: [staff, viewer]
`,
  }).ir;
  const { diagnostics } = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\nroles: { admin: {}, staff: {}, viewer: {} }\n",
    },
    ir,
  );
  expect(diagnostics.filter((d) => d.code === "action-role-cannot-write")).toMatchObject([
    {
      line: 4,
      message: expect.stringContaining(
        'The action "resolve" allows viewer, but viewer may not edit Incident records',
      ),
    },
  ]);
});

test("a standard action's allow narrows who may run it, and the record's owner still counts", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Booking:
    fields: { status: booked | canceled }
actions:
  cancel:
    on: Booking
    when: { status: booked }
    set: { status: canceled }
    allow: [member]
`,
  }).ir as SpecIR;
  const { auth, diagnostics } = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: {}, member: {}, guest: {} }\ndefaultRole: member\n",
    },
    ir,
  );
  // Members write their own bookings: allowed, a member cancels their own; a guest does not.
  expect(actionAccess(ir.actions[0] as SpecIR["actions"][0], auth as AuthIR, ir.models)).toEqual({
    public: false,
    roles: ["admin"],
    owner: true,
    among: ["admin", "member"],
  });
  expect(diagnostics.filter((d) => d.code === "action-role-cannot-write")).toEqual([]);
});

test("an administrator outside allowedDomains is warned about: nobody else from their domain may sign in", () => {
  const codes = (admins: string) =>
    validateAuth({
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: { providers: [email], allowedDomains: [acme.com] }\ndefaultAccess: shared\nadmins: [${admins}]\n`,
    }).diagnostics.map((d) => d.code);
  expect(codes("you@gmail.com")).toContain("admin-outside-domains");
  expect(codes("you@acme.com")).not.toContain("admin-outside-domains");
});

test("allowedDomains on a domain nobody has is warned about, instead of the admin being outside it", () => {
  const codes = (domains: string) =>
    validateAuth({
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: { providers: [email], allowedDomains: [${domains}] }\ndefaultAccess: shared\nadmins: [you@gmail.com]\n`,
    }).diagnostics.map((d) => d.code);
  expect(codes("acme.example")).toContain("example-domain");
  expect(codes("acme.example")).not.toContain("admin-outside-domains");
  expect(codes("acme.com")).toEqual(["admin-outside-domains"]);
  // A mixed list: the sample domain is to be removed; the real one still lets people in.
  const mixed = validateAuth({
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email], allowedDomains: [acme.example, mine.ax] }\ndefaultAccess: shared\nadmins: [you@mine.ax]\n",
  }).diagnostics;
  expect(mixed.map((d) => d.message)).toEqual([
    "acme.example in allowedDomains is a domain nobody has an account at: remove it.",
  ]);
});

test("an action that adds a related record needs the right to create one, and a listed role without it is warned about", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields: { title: string!, status: open | resolved, updates: "Update[]" }
    access: { write: [admin, staff, viewer] }
  Update:
    fields: { incident: Incident!, message: text! }
    access: { create: [admin, staff] }
actions:
  resolve:
    on: Incident
    set: { status: resolved }
    add:
      Update: { message: Resolved. }
    allow: [staff, viewer]
`,
  }).ir as SpecIR;
  const { auth, diagnostics } = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {}, staff: {}, viewer: {} }\ndefaultRole: staff\n",
    },
    ir,
  );
  expect(
    actionAccess(ir.actions[0] as SpecIR["actions"][0], auth as AuthIR, ir.models),
  ).toMatchObject({
    roles: ["admin", "staff"],
    among: ["admin", "staff"],
  });
  expect(
    diagnostics.filter((d) => d.code === "action-role-cannot-create").map((d) => d.message),
  ).toEqual([
    'The action "resolve" allows viewer and adds a Update, but viewer may not create Update records, so viewer still cannot run it.',
  ]);
});

test("a public page that shows records visitors may not read is warned about", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Tool library }
models:
  Tool:
    fields: { name: string! }
  Loan:
    fields: { tool: Tool! }
  Message:
    fields: { text: text! }
pages:
  home:
    route: /
    landing:
      hero:
      tools: { records: Tool }
      contact: { form: Message }
      footer:
  catalog: { crud: Tool }
  loans: { crud: Loan }
`,
  }).ir;
  const warnings = (rest: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\nroles: { admin: {} }\npublic: { ${rest} }\n`,
      },
      ir,
    ).diagnostics.filter((d) => d.code === "public-page-closed-records");
  // The landing page shows tools as cards: a visitor who may not read them sees none.
  const closed = warnings("pages: [home], create: [Message]");
  expect(closed).toHaveLength(1);
  expect(closed[0]?.message).toBe(
    "Visitors can open home, but may not read Tool, so the page shows them none: add it under public.read, or remove the section of home that shows it.",
  );
  // Readable, it is quiet; a contact form adds records and needs no reading.
  expect(warnings("pages: [home, catalog], read: [Tool], create: [Message]")).toEqual([]);
  // A page that is not public is not a visitor's business.
  expect(warnings("pages: [home], read: [Tool], create: [Message]")).toEqual([]);
  expect(warnings("pages: [home, loans], read: [Tool], create: [Message]")).toHaveLength(1);
});
