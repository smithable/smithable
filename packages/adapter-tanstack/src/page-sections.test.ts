import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateContent,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// Pages as a list of sections (docs/design/page-sections.md): a page of sections alone is laid
// out as a landing page's parts are, in the frame the root gives it; a page of a kind with parts
// beside it generates as before.
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
      text: 'smithableContent: 0.1\npages:\n  about:\n    story: { title: Our story, text: "One room.\\n\\nNow two." }\n    team: { title: Who teaches }\n    faq: { items: [{ question: When?, answer: Mornings. }] }\n  instructors:\n    notice: { title: Closed on Friday }\n',
    },
    ir,
  ).content;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content });
  const file = (path: string) => files.find((f) => f.path === path)?.content;
  const about = file("src/routes/about/index.tsx");
  expect(about).not.toContain("LandingLayout");
  expect(about).toContain('<div data-kit="sections">');
  expect(about).toContain(
    '<TextSection\n          texts="pages.about.story"\n          id="story"\n          title="Our story"',
  );
  expect(about).toContain('texts="pages.about.team"');
  expect(about).toContain('texts="pages.about.faq"');
  expect(file("src/kit/Landing.tsx")).toBeDefined();
  // The crud page is its list as before, with its parts around it: the notice and the questions
  // after the list, since the sections do not place it.
  const instructors = file("src/routes/instructors/index.tsx") ?? "";
  expect(instructors).toContain("ModelTable");
  expect(instructors).toContain(
    `import { After as PartsAfter, Before as PartsBefore } from "./-instructors-parts";`,
  );
  expect(instructors).toContain("<PartsBefore />\n      <InstructorsPage />\n      <PartsAfter />");
  const parts = file("src/routes/instructors/-instructors-parts.tsx") ?? "";
  expect(parts).toMatch(/export function Before\(\) \{\n {2}return null;\n\}/);
  expect(parts).toContain(`<TextSection\n          texts="pages.instructors.notice"`);
  // The list is the kind's own: the parts load nothing of it.
  expect(parts).not.toContain("listInstructors");
  expect(file("src/generated/pages.ts")).toContain("about: {");
});

test("a page's frame: site for everyone, with the workspace for one who may open it; none bare", () => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Studio }
models:
  Session:
    fields:
      startsAt: datetime
  Booking:
    fields:
      session: Session
pages:
  schedule:
    calendar: Session
  mine:
    crud: Booking
  sessions:
    crud: Session
  board:
    sections:
      today: { records: Session }
navigation:
  main: [schedule, mine, sessions, board]
`,
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles:\n  admin: {}\n  member:\n    pages: [mine]\npublic: { pages: [schedule], read: [Session] }\n",
    },
    ir,
  ).auth as AuthIR;
  const ux = validateUx(
    {
      path: "smithable.ux.yml",
      text: "smithableUx: 0.1\npages:\n  schedule: { frame: site }\n  mine: { frame: site }\n  board: { frame: none }\n",
    },
    ir,
  ).ux;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, ux });
  const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";
  const root = file("src/routes/__root.tsx");
  expect(root).toContain('const sitePageRoutes = ["/schedule", "/mine"];');
  expect(root).toContain('const bareRoutes = ["/board"];');
  // The site frame links to the workspace (sessions, the first app page the viewer may open).
  expect(root).toContain('{ to: "/sessions", access: pageAccess["sessions"] }');
  expect(root).not.toContain('{ to: "/board"');
  expect(root).toContain("onSignOut={viewer ? signOut : undefined}");
  // The members' page is in the site's menu for those who may open it.
  expect(file("src/generated/site.ts")).toContain('access: pageAccess["mine"]');
});
