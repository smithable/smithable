import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateContent } from "./content.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

// Pages as a list of sections (docs/design/page-sections.md): a page of parts and no kind, parts
// beside a page's kind, the kind's own section placed by name, and the frame in the ux file.
const spec = `smithable: 0.1
app: { name: Studio }
models:
  Instructor:
    fields:
      name: string
  Session:
    fields:
      title: string
      startsAt: datetime
      endsAt: datetime
pages:
  about:
    sections:
      story: { text: }
      team: { records: Instructor }
      faq:
      visit: { contact: }
  sessions:
    crud: Session
    sections:
      notice: { text: }
      crud:
      faq:
  planning:
    sections:
      week: { records: Session, view: calendar, starts: startsAt }
`;

const read = (text: string) => validateSpec({ path: "smithable.yml", text });
const codes = (text: string) => read(text).diagnostics.map((d) => `${d.code}: ${d.message}`);

test("a page of sections has no kind; a kind's page lists its own section first unless placed", () => {
  const { ir, diagnostics } = read(spec);
  expect(diagnostics).toEqual([]);
  const about = ir?.pages.find((p) => p.id === "about");
  expect(about?.pattern).toEqual({ kind: "sections" });
  expect(about?.route).toBe("/about");
  expect(about?.sections.map((s) => `${s.name}:${s.kind}`)).toEqual([
    "story:text",
    "team:records",
    "faq:faq",
    "visit:contact",
  ]);
  const sessions = ir?.pages.find((p) => p.id === "sessions");
  expect(sessions?.sections).toEqual([
    { name: "notice", kind: "text" },
    { name: "crud", kind: "crud", own: true, model: "Session" },
    { name: "faq", kind: "faq" },
  ]);
  const planning = ir?.pages.find((p) => p.id === "planning");
  expect(planning?.sections).toEqual([
    { name: "week", kind: "records", model: "Session", view: "calendar", starts: "startsAt" },
  ]);
  // Without sections naming it, the kind's own section comes first.
  const first = read(spec.replace("      crud:\n", "")).ir?.pages.find((p) => p.id === "sessions");
  expect(first?.sections.map((s) => s.name)).toEqual(["crud", "notice", "faq"]);
});

test("sections are refused when they are flows, take wrong options or miss a date", () => {
  expect(
    codes(spec.replace("      faq:\n      visit", "      crud: Instructor\n      visit")),
  ).toEqual([expect.stringContaining('"crud" is a page\'s kind, not a section')]);
  expect(codes(spec.replace("      crud:\n", "      crud: Session\n"))).toEqual([
    expect.stringContaining("places the page's own list and takes no value"),
  ]);
  expect(
    codes(spec.replace("story: { text: }", "story: { text: , button: about }")),
  ).toContainEqual(expect.stringContaining("A text section has no other options"));
  expect(codes(spec.replace("view: calendar, starts: startsAt", "view: calendar"))).toEqual([
    expect.stringContaining('needs "starts": which of startsAt, endsAt'),
  ]);
  expect(
    codes(
      spec.replace(
        "records: Session, view: calendar, starts: startsAt",
        "records: Instructor, view: calendar",
      ),
    ),
  ).toEqual([expect.stringContaining("has no date field to place its records in a calendar by")]);
  expect(codes(spec.replace("story: { text: }", "story: { view: table }"))).toContainEqual(
    expect.stringContaining("Only a records section has a view"),
  );
  expect(
    codes(
      spec.replace(
        "  planning:\n    sections:\n      week: { records: Session, view: calendar, starts: startsAt }\n",
        "  planning:\n    sections: {}\n",
      ),
    ),
  ).toEqual([expect.stringContaining("needs at least one")]);
  expect(
    codes(
      spec.replace(
        "  planning:\n    sections:",
        "  planning:\n    landing: { hero: }\n    sections:",
      ),
    ),
  ).toEqual([expect.stringContaining('A landing page\'s sections are under "landing"')]);
});

test("the sections' texts live under the page and section in the content file, on every page", () => {
  const ir = read(spec).ir;
  if (!ir) throw new Error("spec");
  const content = (text: string) =>
    validateContent({ path: "smithable.content.yml", text }, ir).diagnostics.map((d) => d.message);
  expect(
    content(`smithableContent: 0.1
pages:
  about:
    story: { title: Our story, text: Twenty years of classes. }
    faq: { items: [{ question: When?, answer: Mornings. }] }
  sessions:
    notice: { title: Closed on Friday }
`),
  ).toEqual([]);
  expect(content("smithableContent: 0.1\npages:\n  sessions:\n    crud: { title: x }\n")).toEqual([
    expect.stringContaining('has no title, subtitle, section or tile named "crud"'),
  ]);
});

test("addSection, moveSection and removeSection work on any page; a kind's own part stays", () => {
  const added = applyOperation({ spec }, "addSection", {
    page: "sessions",
    section: "team",
    records: "Instructor",
    view: "table",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toContain(
    "      faq:\n      team:\n        records: Instructor\n        view: table\n",
  );
  const text = applyOperation({ spec }, "addSection", {
    page: "planning",
    section: "intro",
    text: true,
  });
  if (!text.ok) throw new Error(text.message);
  expect(
    read(text.files.spec)
      .ir?.pages.find((p) => p.id === "planning")
      ?.sections.map((s) => s.kind),
  ).toEqual(["records", "text"]);
  // A page with no sections yet gets the key.
  const fresh = applyOperation(
    {
      spec: spec.replace(
        "    sections:\n      week: { records: Session, view: calendar, starts: startsAt }\n",
        "    crud: Instructor\n",
      ),
    },
    "addSection",
    {
      page: "planning",
      section: "faq",
    },
  );
  if (!fresh.ok) throw new Error(fresh.message);
  expect(fresh.files.spec).toContain(
    "  planning:\n    crud: Instructor\n    sections:\n      faq:\n",
  );
  const moved = applyOperation({ spec }, "moveSection", {
    page: "sessions",
    section: "faq",
    before: "crud",
  });
  if (!moved.ok) throw new Error(moved.message);
  expect(
    read(moved.files.spec)
      .ir?.pages.find((p) => p.id === "sessions")
      ?.sections.map((s) => s.name),
  ).toEqual(["notice", "faq", "crud"]);
  expect(
    applyOperation({ spec }, "removeSection", { page: "sessions", section: "crud" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining("the sessions page's own"),
  });
  const removed = applyOperation({ spec }, "removeSection", {
    page: "sessions",
    section: "notice",
  });
  expect(removed.ok && removed.files.spec).not.toContain("notice");
  expect(applyOperation({ spec }, "removeSection", { page: "about", section: "story" }).ok).toBe(
    true,
  );
  expect(
    applyOperation(
      {
        spec: spec.replace(
          "      week: { records: Session, view: calendar, starts: startsAt }\n",
          "      week: { text: }\n",
        ),
      },
      "removeSection",
      {
        page: "planning",
        section: "week",
      },
    ),
  ).toMatchObject({ ok: false, message: expect.stringContaining("needs at least one section") });
  expect(
    applyOperation({ spec }, "addSection", { page: "about", section: "x", starts: "startsAt" }),
  ).toMatchObject({
    ok: false,
  });
});

test("a page's frame is the ux file's, set by setFrame; default returns it", () => {
  const ir = read(spec).ir;
  if (!ir) throw new Error("spec");
  const ux = (text: string) => validateUx({ path: "smithable.ux.yml", text }, ir);
  expect(ux("smithableUx: 0.1\npages:\n  about: { frame: site }\n").ux?.pages.about?.frame).toBe(
    "site",
  );
  expect(
    ux("smithableUx: 0.1\npages:\n  about: { frame: wide }\n").diagnostics.map((d) => d.message),
  ).toEqual([expect.stringContaining("is site, app or none")]);
  const set = applyOperation({ spec }, "setFrame", { page: "about", frame: "none" });
  if (!set.ok) throw new Error(set.message);
  expect(set.description).toBe("Show the about page alone, without a frame");
  expect(set.files.ux).toContain("about:\n    frame: none");
  const back = applyOperation(set.files, "setFrame", { page: "about", frame: "default" });
  expect(back.ok && back.files.ux).not.toContain("frame");
  expect(applyOperation({ spec }, "setFrame", { page: "nowhere", frame: "app" }).ok).toBe(false);
});
