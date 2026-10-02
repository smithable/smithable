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

test("a list of values reads as inArray, and a dashboard or landing section filters the rows", () => {
  const status = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields:
      title: string!
      status: investigating | identified | monitoring | resolved
pages:
  home:
    route: /
    landing:
      hero:
      open: { records: Incident, where: { status: [investigating, identified, monitoring] } }
  overview:
    dashboard:
      open: { count: Incident, where: { status: [investigating, identified] } }
  incidents: { crud: Incident }
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1
signIn: none
public: { pages: [home, incidents], read: [{ Incident: { where: { status: [investigating, resolved] } } }] }
`,
    },
    status,
  ).auth as AuthIR;
  const files = generateApp(status, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const at = (path: string) => files.find((f) => f.path === path)?.content ?? "";
  const data = at("src/generated/incident.server.ts");
  expect(data).toContain('inArray(incidents.status, ["investigating","resolved"])');
  expect(data).toMatch(/import \{ and, eq, inArray, sql/);
  const test = at("src/generated/access.test.ts");
  expect(test).toContain('where status is investigating or resolved"');
  expect(test).toContain('insertIncident(null, {"status":"investigating"});');
  expect(test).toContain('insertIncident(null, {"status":"identified"})');
  expect(at("src/routes/index.tsx")).toContain(
    '.filter((row) => ["investigating","identified","monitoring"].includes(row.status)).slice(0, 6)',
  );
  expect(at("src/routes/overview/index.tsx")).toContain(
    '.filter((row) => ["investigating","identified"].includes(row.status))',
  );
});
