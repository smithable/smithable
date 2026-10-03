import { describe, expect, test } from "vitest";
import { actionAccess, modelAccess, pageAccess } from "./access.js";
import type { AuthIR } from "./auth.js";
import { validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
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
    // A starter's administrator is a sample on a domain nobody has: `smithable new` replaces it.
    expect(auth.diagnostics.filter((d) => d.code !== "example-admin")).toEqual([]);
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
    ).toEqual(["error no-sign-in", "error no-sign-in"]);
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
