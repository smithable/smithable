import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import { validateSpec } from "./spec.js";

const spec = (
  articles: string,
  fields = "title: string!, address: string unique, summary: text, cover: picture, body: markdown!, publishedOn: date, status: draft | published",
) => `smithable: 0.1
app: { name: Studio }
models:
  Post:
    fields: { ${fields} }
pages:
  posts: { crud: Post }
  blog: { articles: ${articles} }
`;
const read = (text: string) => validateSpec({ path: "smithable.yml", text });
const messages = (text: string) => read(text).diagnostics.map((d) => d.message);

test("the short form infers every part by type and name; the long form names them", () => {
  expect(read(spec("Post")).ir?.pages[1]?.pattern).toEqual({
    kind: "articles",
    model: "Post",
    title: "title",
    body: "body",
    picture: "cover",
    date: "publishedOn",
    address: "address",
    summary: "summary",
  });
  expect(
    read(
      spec(
        "{ model: Post, title: headline, body: text }",
        "headline: string!, text: markdown!, slugline: string",
      ),
    ).ir?.pages[1]?.pattern,
  ).toEqual({ kind: "articles", model: "Post", title: "headline", body: "text" });
});

test("what cannot be inferred, is found twice or is the wrong kind is an error that says how to settle it", () => {
  expect(messages(spec("Post", "title: string!, notes: text"))).toContain(
    'Post has no markdown field for the body of the articles of page "blog".',
  );
  expect(
    messages(spec("Post", "title: string!, body: markdown!, more: markdown")).join(),
  ).toContain("Post has several markdown fields (body, more): name the body");
  expect(messages(spec("{ model: Post, body: title }")).join()).toContain(
    '"title" is the body of the articles of page "blog": it must be a markdown field.',
  );
});

test("a renamed field is followed in the long form; a removal the page relies on is refused", () => {
  const files = { spec: spec("{ model: Post, title: title, body: body }") };
  const renamed = applyOperation(files, "renameField", { model: "Post", from: "body", to: "text" });
  expect(renamed.ok && renamed.files.spec).toContain("body: text");
  const removed = applyOperation(files, "removeField", { model: "Post", field: "body" });
  expect(removed).toMatchObject({ ok: false });
  expect(!removed.ok && removed.message).toContain("The blog page shows Post.body in its articles");
});

test("addArticlesPage adds the short form; a public blog of a model with drafts warns without a where", () => {
  const added = applyOperation(
    { spec: spec("Post").replace("  blog: { articles: Post }\n", "") },
    "addArticlesPage",
    {
      page: "news",
      model: "Post",
    },
  );
  expect(added.ok && added.files.spec).toContain("news:\n    articles: Post");
  const ir = read(spec("Post")).ir;
  if (!ir) throw new Error("no ir");
  const auth = (read: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\npublic:\n  pages: [blog]\n  read: [${read}]\n`,
      },
      ir,
    ).diagnostics.map((d) => d.message);
  expect(auth("Post").join()).toContain(
    "Visitors can read every Post on the blog page, drafts too",
  );
  expect(auth("Post: { where: { status: published } }").join()).not.toContain("drafts too");
});
