import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { recordPicture, validateUx } from "../ux.js";

const files = import.meta.glob("../../../../examples/marketplace/smithable.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const spec = Object.values(files)[0] as string;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("the marketplace does not read");
const read = (pictures: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  catalog:\n    record: { pictures: ${pictures} }\n`,
    },
    ir,
    [],
  );

test("a record's pictures large on its view: aside or top, from its first picture field (A 215)", () => {
  const item = ir.models.find((m) => m.name === "Item");
  if (!item) throw new Error("no Item");
  expect(recordPicture(item)?.name).toBe("photos");
  expect(read("aside").ux?.pages.catalog?.recordPictures).toBe("aside");
  expect(read("top").diagnostics).toEqual([]);
  expect(read("none").ux?.pages.catalog?.recordPictures).toBeUndefined();
  expect(read("left").diagnostics[0]?.message).toBe(
    '"pictures" of a record is aside, top or none.',
  );
});

test("a model without pictures is refused; setRecordPictures writes and takes away", () => {
  const plain = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Notes }\nmodels:\n  Note: { fields: { text: string! } }\npages:\n  notes: { crud: Note }\n",
  }).ir;
  if (!plain) throw new Error("the notes do not read");
  expect(
    validateUx(
      {
        path: "smithable.ux.yml",
        text: "smithableUx: 0.1\npages: { notes: { record: { pictures: aside } } }\n",
      },
      plain,
      [],
    ).diagnostics.map((d) => d.message),
  ).toEqual(["Note has no picture or pictures field to show beside its fields."]);
  const set = applyOperation({ spec }, "setRecordPictures", { page: "catalog", look: "top" });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.ux).toContain("pictures: top");
  expect(
    applyOperation({ spec, ux: set.files.ux as string }, "setRecordPictures", {
      page: "catalog",
      look: "none",
    }),
  ).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
});
