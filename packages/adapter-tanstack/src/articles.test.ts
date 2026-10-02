import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = `smithable: 0.1
app: { name: Studio }
models:
  Post:
    fields: { title: string!, address: string unique, cover: picture, body: markdown!, publishedOn: date, status: draft | published }
pages:
  posts: { crud: Post }
  blog: { articles: Post }
  news: { articles: Post }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const app = (publicText: string) => {
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n${publicText}`,
    },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return (path: string) => files.find((f) => f.path === path)?.content ?? "";
};

test("a list and a page per article, read through the data function in the handlers", () => {
  const file = app(
    "public:\n  pages: [blog]\n  read:\n    - Post: { where: { status: published } }\n",
  );
  const list = file("src/routes/blog/index.tsx");
  const article = file("src/routes/blog/$address.tsx");
  // The server's data function only inside handlers; the row type from the model's module.
  expect(list).toContain('import { type PostRow } from "#/generated/post";');
  expect(list).toMatch(
    /\.handler\(async \(\{ data: page \}\) => \{\n[^}]*postData\.list\(viewer\)/,
  );
  expect(article).toContain("const i = rows.findIndex((row) => addressOf(row) === address);");
  // What a shared link shows, and the Edit link for those who may change it.
  expect(article).toContain(
    '{ property: "og:image", content: loaderData.origin + loaderData.article.picture.src }',
  );
  expect(article).toContain('allows(pageAccess["posts"], viewer) ? `/posts/${row.id}` : undefined');
  // A public page has the site's frame; a signed-in one the app's shell.
  expect(list).toContain("<LandingLayout appName={app.name} site={site}>");
  expect(file("src/routes/news/index.tsx")).toContain("<PageHeader");
  expect(file("src/routes/__root.tsx")).toContain('const siteRoutes = ["/blog"];');
  // A new post's address comes from its title when left empty.
  expect(file("src/routes/posts/new.tsx")).toContain(
    "address: values.address || addressFrom(values.title)",
  );
  expect(file("src/kit/Articles.tsx")).toContain("export function ArticleView(");
});
