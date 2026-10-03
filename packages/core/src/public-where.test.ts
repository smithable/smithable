import { expect, test } from "vitest";
import { modelAccess } from "./access.js";
import { applyOperation } from "./apply.js";
import { type AuthIR, validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const spec = `smithable: 0.1
app: { name: Blog }
models:
  Post:
    fields:
      title: string!
      status: draft | published
      pinned: bool
pages:
  posts: { crud: Post }
`;
const auth = (read: string) => `smithableAuth: 0.1
signIn: { providers: [google], allowedDomains: [acme.com] }
defaultAccess: shared
public:
  pages: [posts]
  read:
    - ${read}
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const check = (read: string) => validateAuth({ path: "smithable.auth.yml", text: auth(read) }, ir);

test("visitors may be limited to records with certain values", () => {
  const ok = check("Post: { where: { status: published, pinned: true } }");
  expect(ok.diagnostics.map((d) => d.code)).toEqual([]);
  expect(ok.auth?.public.read).toEqual(["Post"]);
  expect(ok.auth?.public.readWhere).toEqual({ Post: { status: "published", pinned: true } });
  const post = ir.models[0] as SpecIR["models"][number];
  expect(modelAccess(post, ok.auth as AuthIR).read).toMatchObject({
    public: true,
    where: { status: "published", pinned: true },
  });
  expect(check("Post").auth?.public.readWhere).toEqual({});
  expect(modelAccess(post, check("Post").auth as AuthIR).read.where).toBeUndefined();
});

test("a condition must name a choice value or a yes/no field", () => {
  expect(check("Post: { where: { status: archived } }").diagnostics.map((d) => d.code)).toEqual([
    "invalid-where",
  ]);
  expect(check("Post: { where: { title: x } }").diagnostics.map((d) => d.code)).toEqual([
    "invalid-where",
  ]);
  expect(check("Post: { where: { pinned: yes } }").diagnostics.map((d) => d.code)).toEqual([
    "invalid-where",
  ]);
  expect(check("Post: { where: { pinned: [x] } }").diagnostics.map((d) => d.code)).toEqual([
    "invalid-where",
  ]);
  expect(check("Post: { where: { status: [] } }").diagnostics.map((d) => d.code)).toEqual([
    "invalid-value",
  ]);
  expect(
    check("Post: { where: { status: [draft, draft] } }").diagnostics.map((d) => d.code),
  ).toEqual(["invalid-where"]);
  expect(check("Post: { limit: 3 }").diagnostics.map((d) => d.code)).toEqual(["unknown-key"]);
});

test("the condition follows a rename and refuses to lose its field or value", () => {
  const files = { spec, auth: auth("Post: { where: { status: published } }") };
  const renamed = applyOperation(files, "renameField", {
    model: "Post",
    from: "status",
    to: "state",
  });
  expect(renamed.ok && renamed.files.auth).toContain("- { Post: { where: { state: published } } }");
  expect(applyOperation(files, "removeField", { model: "Post", field: "status" })).toMatchObject({
    ok: false,
    message: expect.stringContaining("Visitors read Post only where status fits"),
  });
  expect(
    applyOperation(files, "changeField", { model: "Post", field: "status", type: "draft | live" }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("status is published") });
  const kept = applyOperation(files, "changeField", {
    model: "Post",
    field: "status",
    type: "draft | published | archived",
  });
  expect(kept.ok).toBe(true);
});

test("setPublicWhere limits and widens; setPublic keeps a model's condition", () => {
  const files = { spec, auth: auth("Post") };
  const limited = applyOperation(files, "setPublicWhere", {
    model: "Post",
    where: { status: "published" },
  });
  expect(limited.ok && limited.files.auth).toContain(
    "- { Post: { where: { status: published } } }",
  );
  const kept = applyOperation({ ...files, ...(limited.ok ? limited.files : {}) }, "setPublic", {
    read: ["Post"],
  });
  expect(kept.ok && kept.files.auth).toContain("Post: { where: { status: published } }");
  const widened = applyOperation(
    { ...files, ...(limited.ok ? limited.files : {}) },
    "setPublicWhere",
    { model: "Post" },
  );
  expect(widened.ok && widened.files.auth).toContain("- Post\n");
  expect(applyOperation(files, "setPublicWhere", { model: "Comment" })).toMatchObject({
    ok: false,
  });
});

test("a dashboard tile's where refuses a changed field that loses a value it counts", () => {
  const withTile = spec.replace(
    "  posts: { crud: Post }\n",
    "  posts: { crud: Post }\n  overview:\n    dashboard:\n      live: { count: Post, where: { status: [draft, published] } }\n",
  );
  const files = { spec: withTile, auth: auth("Post") };
  expect(
    applyOperation(files, "changeField", { model: "Post", field: "status", type: "draft | live" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining(
      'The "live" tile of the overview page counts Post records where status is published',
    ),
  });
  expect(
    applyOperation(files, "changeField", {
      model: "Post",
      field: "status",
      type: "draft | published | archived",
    }).ok,
  ).toBe(true);
});

test("setDefaultAccess switches between shared and private, and needs sign-in", () => {
  const files = { spec, auth: auth("Post") };
  const shared = applyOperation(files, "setDefaultAccess", { access: "shared" });
  expect(shared.ok && shared.files.auth).toContain("defaultAccess: shared\n");
  const back = applyOperation(
    { ...files, auth: shared.ok ? shared.files.auth : "" },
    "setDefaultAccess",
    { access: "private" },
  );
  expect(back.ok && back.files.auth).toContain("defaultAccess: private\n");
  expect(
    applyOperation({ spec, auth: "smithableAuth: 0.1\nsignIn: none\n" }, "setDefaultAccess", {
      access: "shared",
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("no sign-in") });
});

test("setPublicWhere and a rename change a condition written as a key with options", () => {
  const files = {
    spec,
    auth: `smithableAuth: 0.1
signIn: { providers: [google], allowedDomains: [acme.com] }
defaultAccess: shared
public:
  pages: [posts]
  read:
    # drafts stay with the team
    - Post: { where: { status: [draft, published] } }
`,
  };
  const narrowed = applyOperation(files, "setPublicWhere", {
    model: "Post",
    where: { status: "published" },
  });
  expect(narrowed.ok && narrowed.files.auth).toContain(
    "    # drafts stay with the team\n    - { Post: { where: { status: published } } }\n",
  );
  const renamed = applyOperation(files, "renameField", {
    model: "Post",
    from: "status",
    to: "state",
  });
  expect(renamed.ok && renamed.files.auth).toContain(
    "    - { Post: { where: { state: [draft, published] } } }\n",
  );
});

test("new users are never administrators by default", () => {
  const only = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\nroles: { admin: { description: Owner. } }\n",
    },
    ir,
  );
  // Listing only admin still leaves a role for everyone else.
  expect(only.diagnostics.map((d) => d.code)).toEqual([]);
  expect(only.auth?.roles.map((r) => r.name)).toEqual(["admin", "member"]);
  expect(only.auth?.defaultRole).toBe("member");
  const asked = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\nroles: { admin: {} }\ndefaultRole: admin\n",
    },
    ir,
  );
  expect(asked.diagnostics.map((d) => d.code)).toEqual(["admin-default-role"]);
  // setRoles: admin as the default means "no other role named"; with several others it is refused.
  const files = { spec, auth: auth("Post") };
  const one = applyOperation(files, "setRoles", {
    roles: { admin: "Owner." },
    defaultRole: "admin",
  });
  expect(one.ok && one.files.auth).not.toContain("defaultRole: admin");
  const two = applyOperation(files, "setRoles", {
    roles: { admin: "Owner.", editor: "Writes." },
    defaultRole: "admin",
  });
  expect(two.ok && two.files.auth).toContain("defaultRole: editor");
  expect(
    applyOperation(files, "setRoles", {
      roles: { editor: "Writes.", reader: "Reads." },
      defaultRole: "admin",
    }),
  ).toMatchObject({ ok: false, message: expect.stringContaining("cannot all be administrators") });
});

test("email is a sign-in provider, and an app with sign-in has an administrator who can get in", () => {
  const read = (text: string) => validateAuth({ path: "smithable.auth.yml", text }, ir);
  const head = "smithableAuth: 0.1\ndefaultAccess: private\n";
  const email = read(`${head}signIn: { providers: [email, google] }\n`);
  expect(email.diagnostics).toEqual([]);
  expect(email.auth?.signIn).toMatchObject({ providers: ["email", "google"] });
  expect(
    read(`${head}signIn: { providers: [magicLink] }\n`).diagnostics.map((d) => d.code),
  ).toContain("not-yet-supported");
  // Invited people only, and nobody to invite them.
  expect(
    read(`${head}signIn: { providers: [email], selfSignUp: false }\n`).diagnostics.map(
      (d) => d.code,
    ),
  ).toContain("no-admin");
  // An administrator nobody can be.
  expect(
    read(
      `${head}signIn: { providers: [email] }\nadmins: [owner@northwind.example]\n`,
    ).diagnostics.map((d) => `${d.severity} ${d.code}`),
  ).toEqual(["warning example-admin"]);
  const files = { spec, auth: auth("Post") };
  const set = applyOperation(files, "setAdmins", { admins: ["Me@Mine.ax", "me@mine.ax"] });
  expect(set.ok && set.files.auth).toContain("admins: [me@mine.ax]");
  expect(applyOperation(files, "setAdmins", { admins: [] })).toMatchObject({ ok: false });
  expect(applyOperation(files, "setAdmins", { admins: ["nobody"] })).toMatchObject({
    ok: false,
    message: expect.stringContaining("not an email address"),
  });
});
