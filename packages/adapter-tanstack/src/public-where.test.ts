import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Blog }
models:
  Post:
    fields:
      title: string!
      status: draft | published
pages:
  posts: { crud: Post }
`,
}).ir as SpecIR;
const authOf = (text: string) =>
  validateAuth({ path: "smithable.auth.yml", text }, ir).auth as AuthIR;
const withOwner = authOf(`smithableAuth: 0.1
signIn: { providers: [google], allowedDomains: [example.com] }
defaultAccess: private
public: { pages: [posts], read: [{ Post: { where: { status: published } } }] }
`);
const file = (auth: AuthIR, path: string) =>
  generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() }).find(
    (f) => f.path === path,
  )?.content ?? "";

test("visitors read the records the public condition fits; an owner their own as well", () => {
  const data = file(withOwner, "src/generated/post.server.ts");
  expect(data).toContain('where: { status: "published" }');
  expect(data).toContain('if (scope === "public") return and(eq(posts.status, "published"));');
  expect(data).toContain(
    'scope === "own" && viewer ? or(eq(posts.ownerId, viewer.id), and(eq(posts.status, "published"))) : sql`false`',
  );
  const test = file(withOwner, "src/generated/access.test.ts");
  expect(test).toContain('test("visitors read only post records where status is published"');
  expect(test).toContain('insertPost(stranger.id, {"status":"draft"})');
  expect(test).toContain('insertPost(stranger.id, {"status":"published"});');
});

test("without sign-in, visitors are the only readers and the condition is all there is", () => {
  const none = authOf(`smithableAuth: 0.1
signIn: none
public: { pages: [posts], read: [{ Post: { where: { status: published } } }] }
`);
  const data = file(none, "src/generated/post.server.ts");
  expect(data).toContain('if (scope === "public") return and(eq(posts.status, "published"));');
  expect(data).toContain("return sql`false`;");
  expect(data).not.toContain("or(");
});
