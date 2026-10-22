import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// Pages as a list of sections (docs/design/page-sections.md), step 1: the core carries every
// page's sections; a page of sections alone is laid out as a landing page's parts are, and a
// page of a kind with parts beside it generates as before, until the one page renderer (step 2).
test("a page of sections generates a route of its parts; a kind's page with parts still generates", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Instructor:
    fields:
      name: string
pages:
  about:
    sections:
      story: { text: }
      team: { records: Instructor }
      faq:
  instructors:
    crud: Instructor
    sections:
      notice: { text: }
      faq:
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [about, instructors], read: [Instructor] }\n",
    },
    ir,
  ).auth as AuthIR;
  const content = validateContent(
    {
      path: "smithable.content.yml",
      text: "smithableContent: 0.1\npages:\n  about:\n    team: { title: Who teaches }\n    faq: { items: [{ question: When?, answer: Mornings. }] }\n  instructors:\n    notice: { title: Closed on Friday }\n",
    },
    ir,
  ).content;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  const file = (path: string) => files.find((f) => f.path === path)?.content;
  const about = file("src/routes/about/index.tsx");
  expect(about).toContain("LandingLayout");
  expect(about).toContain('texts="pages.about.team"');
  expect(about).toContain('texts="pages.about.faq"');
  expect(file("src/kit/Landing.tsx")).toBeDefined();
  // The crud page is its list as before; its parts wait for the page renderer.
  expect(file("src/routes/instructors/index.tsx")).toContain("ModelTable");
  expect(file("src/generated/pages.ts")).toContain("about: {");
});
