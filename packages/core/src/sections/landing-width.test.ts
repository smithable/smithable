import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { validateUx } from "../ux.js";

const files = import.meta.glob("../../../../examples/kiosk/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const spec = Object.entries(files).find(([path]) => path.endsWith("/smithable.yml"))?.[1] as string;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("the kiosk starter does not read");
const read = (where: string) =>
  validateUx(
    { path: "smithable.ux.yml", text: `smithableUx: 0.1\npages:\n  where:\n${where}` },
    ir,
    [],
  );

test("a landing page's width: contained unsaid, wide or full (A 215)", () => {
  expect(read("    width: wide\n").ux?.pages.where?.width).toBe("wide");
  expect(read("    width: contained\n").ux?.pages.where?.width).toBeUndefined();
  expect(read("    width: huge\n").diagnostics[0]?.message).toBe(
    '"width" is contained, wide or full.',
  );
  const orders = validateUx(
    { path: "smithable.ux.yml", text: "smithableUx: 0.1\npages:\n  orders:\n    width: wide\n" },
    ir,
    [],
  );
  expect(orders.diagnostics[0]?.message).toBe("A width is for a landing page; orders is not one.");
});

test("a header over the hero needs a cover or photo hero; none is unsaid", () => {
  const photo = read("    header: { over: hero }\n    sections: { hero: { layout: photo } }\n");
  expect(photo.diagnostics).toEqual([]);
  expect(photo.ux?.pages.where?.header).toEqual({ over: "hero" });
  expect(
    read("    header: { over: hero }\n    sections: { hero: { layout: split } }\n").diagnostics[0]
      ?.message,
  ).toBe(
    '"over: hero" needs a cover or photo hero, whose picture runs across the width; where\'s hero is split.',
  );
  expect(read("    header: { over: none }\n").ux?.pages.where?.header).toBeUndefined();
});

test("setLandingWidth and the header's over write the ux file; the defaults take the key away", () => {
  const wide = applyOperation({ spec }, "setLandingWidth", { page: "where", width: "wide" });
  if (!wide.ok) throw new Error(wide.message);
  expect(wide.files.ux).toBe("smithableUx: 0.1\npages:\n  where:\n    width: wide\n");
  expect(
    applyOperation({ spec, ux: wide.files.ux as string }, "setLandingWidth", {
      page: "where",
      width: "contained",
    }),
  ).toMatchObject({ ok: true, files: { ux: "smithableUx: 0.1\n" } });
  const none = applyOperation({ spec }, "setSectionLook", {
    page: "where",
    section: "header",
    key: "over",
    value: "none",
  });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.ux ?? "").not.toContain("over");
});
