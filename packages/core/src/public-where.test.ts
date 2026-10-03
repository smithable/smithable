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
signIn: { providers: [google], allowedDomains: [example.com] }
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
