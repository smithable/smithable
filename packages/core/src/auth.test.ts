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
    expect(diagnostics.filter((d) => d.severity !== "note")).toEqual([]);
    // A starter's administrator and domains are samples on domains nobody has: `smithable new` replaces them.
    expect(
      auth.diagnostics.filter((d) => d.code !== "example-admin" && d.code !== "example-domain"),
    ).toEqual([]);
    expect(ir && auth.auth).toBeTruthy();
    expect(auth.auth).toMatchSnapshot();
  });

  test("CRM: sales edit anyone's customers and orders, delete their own, and only admins merge", () => {
    const { ir, auth } = load(
      examples["../../../examples/crm/smithable.yml"] as string,
      examples["../../../examples/crm/smithable.auth.yml"] as string,
    );
    const a = auth.auth as NonNullable<typeof auth.auth>;
    const customer = modelAccess((ir as SpecIR).models[0] as SpecIR["models"][0], a);
    expect(customer).toEqual({
      read: { public: false, roles: ["admin", "sales"], owner: false },
      create: { public: false, roles: ["admin", "sales"], owner: false },
      write: { public: false, roles: ["admin", "sales"], owner: true },
      delete: { public: false, roles: ["admin"], owner: true },
    });
    // A custom action is run by the roles whose "actions" grant names it: here nobody but admins.
    const merge = (ir as SpecIR).actions[0] as SpecIR["actions"][0];
    expect(actionAccess(merge, a).roles).toEqual(["admin"]);
    // A standard action follows the model's write access.
    const models = (ir as SpecIR).models;
    const archive: StandardActionIR = {
      name: "archive",
      custom: false,
      input: [],
      on: "Customer",
      set: [],
    };
    expect(actionAccess(archive, a, models)).toEqual(customer.write);
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
      roles: [
        { name: "admin", grants: "all" },
        { name: "member", grants: {} },
      ],
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
      "warning role-opens-nothing",
      "warning role-opens-nothing",
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
    ).toEqual([
      "warning role-opens-nothing",
      "warning open-shared-access",
      "warning public-personal-data",
    ]);
  });

  test("closed sign-up needs a users page, and a users page needs sign-in", () => {
    const team = `${SPEC}  team: { users: manage }\n`;
    const closed =
      "smithableAuth: 0.1\nsignIn: { providers: [google], selfSignUp: false }\ndefaultAccess: shared\nroles: { admin: all, member: { pages: all } }\nadmins: [owner@studio.ax]\n";
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
    ).toEqual(["warning role-opens-nothing", "error expected-boolean"]);
  });

  test("without sign-in, users cannot be referred to and only public pages open", () => {
    expect(codes("smithableAuth: 0.1\nsignIn: none\npublic: { pages: [notes] }\n")).toEqual([
      "error no-sign-in",
      "warning unreachable-page",
      "warning public-page-closed-records",
    ]);
  });

  test("a role's grants name pages, models and custom actions that exist", () => {
    const { auth } = load(
      `${SPEC}actions:\n  archive: { on: Customer, set: { name: x } }\n`,
      `smithableAuth: 0.1
signIn: { providers: [google] }
defaultAccess: shared
roles:
  admin: all
  sales: { pages: [custmers], write: [Customr], actions: [archive, merge], read: [Note] }
  viewer: { description: Looks. }
defaultRole: sales
`,
    );
    expect(auth.diagnostics.map((d) => [d.severity, d.code, d.hint])).toEqual([
      [
        "warning",
        "open-shared-access",
        'Restrict sign-in with "allowedDomains" or "selfSignUp: false" under "signIn", or use "defaultAccess: private".',
      ],
      ["error", "unknown-page", 'Did you mean "customers"?'],
      ["error", "unknown-model", 'Did you mean "Customer"?'],
      ["error", "standard-action-grant", 'Grant sales "write" on its model instead.'],
      ["error", "unknown-custom-action", undefined],
      [
        "warning",
        "read-with-shared",
        'Remove it, or use "defaultAccess: private" and grant reading to the roles that read everyone\'s records.',
      ],
      [
        "warning",
        "role-opens-nothing",
        'Add "pages: all" (or a list of pages) under roles.viewer in smithable.auth.yml.',
      ],
    ]);
  });

  test("who may do what is not said in smithable.yml any more", () => {
    const spec = `${SPEC.replace("fields: { text: string }", "fields: { text: string }\n    access: { write: [admin] }")}  team: { users: manage, access: [admin] }
actions:
  merge: { custom: true, input: {}, allow: [admin] }
`;
    const { diagnostics } = load(
      spec,
      "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\n",
    );
    expect(diagnostics.map((d) => d.code)).toEqual(["moved-key", "moved-key", "moved-key"]);
    expect(diagnostics[0]?.message).toContain("roles.<role>.write: [Note]");
  });

  test("a role is all, or a block; administrators are always all", () => {
    const parsed = (roles: string) =>
      validateAuth({
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\nroles:\n${roles}`,
      });
    expect(parsed("  admin: all\n  staff: all\n").auth?.roles).toEqual([
      { name: "admin", grants: "all" },
      { name: "staff", grants: "all" },
    ]);
    expect(
      parsed("  admin: { description: Runs it. }\n  staff: { pages: all, create: [Note] }\n").auth
        ?.roles,
    ).toEqual([
      { name: "admin", grants: "all", description: "Runs it." },
      { name: "staff", grants: { pages: "all", create: ["Note"] } },
    ]);
    expect(parsed("  admin: { pages: all }\n").diagnostics.map((d) => d.code)).toEqual([
      "invalid-key",
    ]);
    expect(parsed("  staff: some\n").diagnostics.map((d) => d.code)).toEqual(["invalid-value"]);
    expect(parsed("  staff: { write: Note }\n").diagnostics.map((d) => d.code)).toEqual([
      "expected-list",
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

test("outgoing mail meets the access rules: a visitor-typed address is not mailed, a role must read the model", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: X }
models:
  Message:
    fields: { name: string!, email: email, message: text! }
outgoing:
  thanks: { when: Message created, to: mail, recipient: email }
  told: { when: Message created, to: mail, recipient: staff }
`,
  }).ir;
  if (!ir) throw new Error("spec");
  const auth = (text: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\nroles: { admin: {}, staff: {} }\ndefaultRole: staff\n${text}`,
      },
      ir,
    ).diagnostics.map((d) => d.code);
  const withVisitors = auth("public: { create: [Message] }\n");
  expect(withVisitors).toContain("visitor-typed-recipient");
  expect(withVisitors).toContain("recipient-cannot-read");
  expect(auth("")).not.toContain("visitor-typed-recipient");
  expect(auth("")).toContain("recipient-cannot-read");
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

test("a standard action is run by whoever may change the record: a role granted write, or the owner", () => {
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
`,
  }).ir as SpecIR;
  const access = (roles: string) =>
    actionAccess(
      ir.actions[0] as SpecIR["actions"][0],
      validateAuth(
        {
          path: "smithable.auth.yml",
          text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles:\n${roles}defaultRole: member\n`,
        },
        ir,
      ).auth as AuthIR,
      ir.models,
    );
  // Members cancel their own bookings; staff anyone's; a guest none.
  expect(access("  admin: all\n  member: { create: [Booking] }\n  guest: {}\n")).toEqual({
    public: false,
    roles: ["admin"],
    owner: true,
  });
  expect(access("  admin: all\n  staff: { write: [Booking] }\n  member: {}\n").roles).toEqual([
    "admin",
    "staff",
  ]);
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

test("an action that adds a related record needs the right to create one", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields: { title: string!, status: open | resolved, updates: "Update[]" }
  Update:
    fields: { incident: Incident!, message: text! }
actions:
  resolve:
    on: Incident
    set: { status: resolved }
    add:
      Update: { message: Resolved. }
`,
  }).ir as SpecIR;
  const { auth } = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all, staff: { write: [Incident], create: [Update] }, viewer: { write: [Incident] } }\ndefaultRole: staff\n",
    },
    ir,
  );
  // A viewer may change incidents but not add updates, so the action is staff's (and the owner's).
  expect(actionAccess(ir.actions[0] as SpecIR["actions"][0], auth as AuthIR, ir.models)).toEqual({
    public: false,
    roles: ["admin", "staff"],
    owner: true,
  });
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

test("a role for keys opens no page without a warning; write without read under private access is warned", () => {
  const api = "api: { models: [Note] }\n";
  const roles = (r: string, top = "") =>
    `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\n${top}roles:\n  admin: all\n${r}`;
  // Granted on a model the API offers: used through keys, no page needed.
  expect(codes(roles("  bot: { create: [Note] }\n", api))).toEqual([]);
  // Granted nothing the API offers: still the warning.
  expect(codes(roles("  bot: { create: [Customer] }\n", api))).toEqual([
    "warning role-opens-nothing",
  ]);
  // No api block: the warning as before.
  expect(codes(roles("  bot: { create: [Customer] }\n"))).toEqual(["warning role-opens-nothing"]);
  // write on others' records the role cannot read.
  expect(codes(roles("  sales: { pages: all, write: [Customer] }\n"))).toEqual([
    "warning write-without-read",
  ]);
  expect(codes(roles("  sales: { pages: all, delete: all }\n"))).toEqual([
    "warning write-without-read",
  ]);
  // With read, or create alone, nothing.
  expect(codes(roles("  sales: { pages: all, read: [Customer], write: [Customer] }\n"))).toEqual(
    [],
  );
  expect(codes(roles("  sales: { pages: all, read: all, delete: all }\n"))).toEqual([]);
  expect(codes(roles("  sales: { pages: all, create: [Customer] }\n"))).toEqual([]);
});
