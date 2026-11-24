import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const spec = `smithable: 0.1
app: { name: Workshop }
models:
  Post:
    fields: { title: string!, address: string unique, body: markdown!, status: draft | published }
pages:
  members:
    route: /members
    landing:
      hero: {}
      contact: {}
      footer: {}
  welcome:
    route: /
    landing:
      hero: {}
      contact: {}
      footer: {}
  blog: { articles: Post }
`;
const content = `smithableContent: 0.1
pages:
  members:
    contact:
      phone: "+358 111 members"
  welcome:
    contact:
      phone: "+358 222 welcome"
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const words = validateContent({ path: "smithable.content.yml", text: content }, ir).content;
const site = (publicPages: string, signIn = "{ providers: [google] }") => {
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: ${signIn}\ndefaultAccess: shared\npublic:\n  pages: [${publicPages}]\n  read:\n    - Post: { where: { status: published } }\n`,
    },
    ir,
  ).auth as AuthIR;
  if (!words) throw new Error("Invalid content fixture");
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: words });
  return (path: string) => files.find((f) => f.path === path)?.content ?? "";
};

test("the site's shared contact details come only from a landing visitors may open (T1336)", () => {
  // Only the blog is open to visitors: the frame it carries names no contact details, while its
  // home link still goes to the first landing, and that landing keeps its own contact section.
  const blogOnly = site("blog");
  expect(blogOnly("src/generated/site.ts")).not.toContain("+358 111 members");
  expect(blogOnly("src/generated/site.ts")).not.toContain("contact");
  expect(blogOnly("src/generated/site.ts")).toContain('home: "/members"');
  expect(blogOnly("src/routes/blog/index.tsx")).toContain("site={site}");
  // A landing visitors may open gives them, whatever the pages' order.
  const withWelcome = site("blog, welcome");
  expect(withWelcome("src/generated/site.ts")).toContain("+358 222 welcome");
  expect(withWelcome("src/generated/site.ts")).not.toContain("+358 111 members");
  expect(withWelcome("src/generated/site.ts")).toContain('home: "/"');
  // With no sign-in every page is open: the one listed as public still comes first, as the home
  // link does; with none listed, the first landing.
  const open = site("welcome", "none");
  expect(open("src/generated/site.ts")).toContain("+358 222 welcome");
  expect(open("src/generated/site.ts")).toContain('home: "/"');
  const openNoneListed = site("blog", "none");
  expect(openNoneListed("src/generated/site.ts")).toContain("+358 111 members");
  expect(openNoneListed("src/generated/site.ts")).toContain('home: "/members"');
});
