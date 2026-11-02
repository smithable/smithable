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

const text =
  "smithable: 0.1\napp: {name: Makers}\nmodels:\n  WorkItem:\n    fields:\n      name: string!\n      stage: draft | done\n      payment: unpaid | paid\n      estimate: money\n      actual: money\n      created: date\n      due: datetime\n      shipped: date\npages:\n  home: {route: /, landing: {hero: {}, story: {mediaText: true, button: items}, gallery: {}}}\n  items: {crud: WorkItem}\n  overview: {dashboard: {total: {count: WorkItem}}, sections: {briefing: {mediaText: true}}}\n";
const ir = validateSpec({ path: "smithable.yml", text }).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: none\npublic: {pages: [home, items], read: [WorkItem]}\n",
  },
  ir,
).auth as AuthIR;
const content = validateContent(
  {
    path: "smithable.content.yml",
    text: "smithableContent: 0.1\npages:\n  home:\n    story:\n      title: A local story\n      text: First paragraph\n      caption: At work\n      image: {src: images/story.png, alt: A maker near the edge}\n  overview:\n    briefing:\n      title: A useful handoff\n      text: Review the next item.\n",
  },
  ir,
).content;
function files(extra = "") {
  const ux = validateUx(
    { path: "smithable.ux.yml", text: "smithableUx: 0.1\n" + extra },
    ir,
    [],
    auth,
  );
  if (!ux.ux) throw new Error(JSON.stringify(ux.diagnostics));
  return generateApp(ir, { smithableVersion: "0.0.0", auth, content, ux: ux.ux });
}
const file = (list: ReturnType<typeof files>, path: string) =>
  list.find((file) => file.path === path)?.content ?? "";
test("opt-in rhythm/measure wrap shared media markup; omission keeps the old section composition", () => {
  const plain = files();
  expect(file(plain, "src/routes/index.tsx")).not.toContain("SectionPresentation");
  const input =
    "pages: {home: {sections: {story: {layout: split, image: right, rhythm: airy, measure: reading, fit: contain, aspect: portrait, focal: left}}}}\n";
  const shown = files(input),
    page = file(shown, "src/routes/index.tsx");
  expect(files(input)).toEqual(shown);
  expect(page).toContain('<SectionPresentation rhythm="airy" measure="reading">');
  for (const prop of [
    "<MediaText",
    'imageSide="right"',
    'fit="contain"',
    'aspect="portrait"',
    'focal="left"',
    'caption="At work"',
    "/images/story.png",
  ])
    expect(page).toContain(prop);
  expect(page).not.toMatch(/<MediaText[^>]+rhythm=/s);
});
test("named emphasis reaches generated record props; automatic omission and explicit none differ", () => {
  const selected = file(
    files(
      "pages: {items: {record: {header: summary, summary: {status: [payment], amount: [actual], dates: [shipped]}}}}\n",
    ),
    "src/routes/items/$id.tsx",
  );
  expect(selected).toContain('status="payment"');
  expect(selected).toContain('amount="actual"');
  expect(selected).toContain('dates={["shipped"]}');
  const automatic = file(
    files("pages: {items: {record: {header: summary}}}\n"),
    "src/routes/items/$id.tsx",
  );
  expect(automatic).toContain('status="stage"');
  expect(automatic).toContain('amount="estimate"');
  expect(automatic).toContain('dates={["created","due"]}');
  const none = file(
    files(
      "pages: {items: {record: {header: summary, summary: {status: [], amount: [], dates: []}}, form: {aside: summary}}}\n",
    ),
    "src/routes/items/$id.tsx",
  );
  expect(none).not.toContain("RecordSummary");
  expect(none).not.toContain("lg:grid-cols-[1fr_18rem]");
});

test("mixed-page before/after modules use the same section presentation path", () => {
  const plain = file(files(), "src/routes/overview/-overview-parts.tsx");
  expect(plain).not.toContain("SectionPresentation");
  const shown = file(
    files("pages: {overview: {sections: {briefing: {rhythm: compact, measure: reading}}}}\n"),
    "src/routes/overview/-overview-parts.tsx",
  );
  expect(shown).toContain('<SectionPresentation rhythm="compact" measure="reading">');
  expect(shown).toContain("<MediaText");
  expect(shown).toContain("</SectionPresentation>");
});
