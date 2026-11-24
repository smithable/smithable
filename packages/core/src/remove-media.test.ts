// removeMedia (T1473): the hosted service's take-off of deleted stored files, every place that
// names them emptied in one change (media-storage.md §2).
import { expect, test } from "vitest";
import { parse } from "yaml";
import { applyOperation, findOperation, type ProjectFiles } from "./apply.js";
import { YamlEditor } from "./edit.js";
import { mediaSlots, slotName } from "./media.js";
import { forModels, refusedArgs } from "./operation.js";

const ID = "m_01hz8k3q4r5s6t7v8w9x0y1z2a";
const OTHER = "m_7zzzzzzzzzzzzzzzzzzzzzzzzz";
const stored = (id: string, alt: string) => `{ asset: ${id}, alt: ${alt}, width: 960 }`;

const files: ProjectFiles = {
  spec: `smithable: 0.1
app:
  name: Roofs
pages:
  home:
    route: /
    landing:
      hero: {}
      jobs: { gallery: }
      features:
      story: { mediaText: }
`,
  content: `smithableContent: 0.1
languages: [sv]
pages:
  home:
    hero:
      title: Roofs
      image: ${stored(ID, "A roof")}
    jobs:
      items:
        - image: ${stored(ID, "A roof")}
          caption: First
        - image: ${stored(OTHER, "A barn")}
          caption: Second
        - image: ${stored(ID, "A roof")}
          caption: Third
    features:
      items:
        - title: Slate
          text: Laid by hand.
          image: ${stored(ID, "A roof")}
    story:
      title: Our story
      image: ${stored(OTHER, "A barn")}
      items:
        - image: ${stored(ID, "A roof")}
`,
  translations: {
    sv: `smithableContent: 0.1
pages:
  home:
    hero:
      image: { alt: Ett tak }
    jobs:
      items:
        - caption: Första
        - caption: Andra
        - caption: Tredje
`,
  },
};

test("every place naming the file is emptied in one change, the same places in every language", () => {
  const done = applyOperation(files, "removeMedia", { asset: [ID] });
  if (!done.ok) throw new Error(done.message);
  const content = parse(done.files.content as string);
  const home = content.pages.home;
  // The hero is shown without a picture; its words stay.
  expect(home.hero).toEqual({ title: "Roofs" });
  // The gallery's first and third items go with their captions; the second keeps its place as the first.
  expect(home.jobs.items).toEqual([
    { image: { asset: OTHER, alt: "A barn", width: 960 }, caption: "Second" },
  ]);
  // A features card keeps its words; a media-and-text section loses its only extra picture.
  expect(home.features.items).toEqual([{ title: "Slate", text: "Laid by hand." }]);
  expect(home.story).toEqual({
    title: "Our story",
    image: { asset: OTHER, alt: "A barn", width: 960 },
  });
  const sv = parse(done.files.translations?.sv as string);
  expect(sv.pages.home).toEqual({ jobs: { items: [{ caption: "Andra" }] } });
  // Each place is the person's to confirm, and nothing but the stored files goes.
  expect(done.destructive).toBe(true);
  expect(done.mediaOnly).toBe(true);
  expect(done.lostMedia?.map(slotName)).toEqual([
    "the picture of hero on home",
    "picture 1 of jobs on home",
    "picture 3 of jobs on home",
    "picture 1 of features on home",
    "picture 1 of story on home",
  ]);
  expect(done.description).toBe(
    `Take stored file ${ID} out of every place; ${done.lostMedia?.map((s) => `loses the stored file of ${slotName(s)}`).join("; ")}`,
  );
});

test("several files in one change; a file named nowhere changes nothing and says so", () => {
  const both = applyOperation(files, "removeMedia", { asset: [ID, OTHER] });
  if (!both.ok) throw new Error(both.message);
  expect(mediaSlots(parse(both.files.content as string))).toEqual([]);
  // Every gallery item gone: the section is left with no items.
  expect(parse(both.files.content as string).pages.home.jobs).toBeUndefined();

  const none = applyOperation(files, "removeMedia", { asset: ["m_0000000000000000000000000a"] });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.content).toBe(files.content);
  expect(none.destructive).toBe(false);
  expect(none.description).toContain("is in no place, so nothing of it changed");

  const bad = applyOperation(files, "removeMedia", { asset: ["images/a.webp"] });
  expect(bad.ok).toBe(false);
});

test("a person's operation: no model is offered it or may name its files", () => {
  const op = findOperation("removeMedia", []);
  if (!op) throw new Error("op");
  expect(forModels(op)).toBe(false);
  expect(refusedArgs(op, { asset: [ID] }, "model")).toContain('"asset"');
  expect(refusedArgs(op, { asset: [ID] }, "person")).toBeUndefined();
  expect(forModels(findOperation("setSectionPicture", []) ?? op)).toBe(true);
});

// Every example with each of its pictures a stored file, all of them taken out at once: what is
// left still validates (applyOperation refuses a change that leaves a file invalid).
const raw = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const examples = [...new Set(Object.keys(raw).map((p) => p.split("/")[4] as string))].filter(
  (name) => raw[`../../../examples/${name}/smithable.content.yml`],
);

test.each(examples)("%s: every picture slot emptied, it validates", (name) => {
  const file = (s: string) => raw[`../../../examples/${name}/smithable${s}.yml`];
  const editor = new YamlEditor(file(".content") as string);
  const ids: string[] = [];
  const walk = (value: unknown, at: string[]) => {
    if (Array.isArray(value)) for (const [i, v] of value.entries()) walk(v, [...at, String(i)]);
    else if (value && typeof value === "object")
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        const picture = v as { src?: unknown; alt?: unknown } | null;
        if (key === "image" && typeof picture?.src === "string") {
          const id = `m_${String(ids.length).padStart(26, "0")}`;
          ids.push(id);
          editor.set([...at, key], {
            asset: id,
            alt: String(picture.alt ?? "A picture"),
            width: 960,
          });
        } else walk(v, [...at, key]);
      }
  };
  walk(editor.get([]), []);
  const project: ProjectFiles = {
    spec: file("") as string,
    content: editor.text,
    auth: file(".auth"),
    ux: file(".ux"),
  };
  const placed = mediaSlots(editor.get([])).length;
  expect(placed).toBe(ids.length);
  const done = applyOperation(project, "removeMedia", { asset: ids.length ? ids : [ID] });
  if (!done.ok) throw new Error(`${name}: ${done.message}`);
  expect(mediaSlots(parse(done.files.content as string))).toEqual([]);
  expect(done.lostMedia?.length ?? 0).toBe(placed);
});
