import { expect, test } from "vitest";
import { validateAuth } from "../auth.js";
import { validateSpec } from "../spec.js";
import { stagePage, validateUx } from "../ux.js";

const files = import.meta.glob("../../../../examples/booking/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const file = (name: string) =>
  Object.entries(files).find(([path]) => path.endsWith(`/${name}`))?.[1] as string;
const ir = validateSpec({ path: "smithable.yml", text: file("smithable.yml") }).ir;
if (!ir) throw new Error("the booking starter does not read");
const auth = validateAuth(
  { path: "smithable.auth.yml", text: file("smithable.auth.yml") },
  ir,
).auth;
const read = (hero: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  home:\n    sections:\n      hero: ${hero}\n`,
    },
    ir,
    [],
    auth,
  );
const message = (hero: string) => read(hero).diagnostics[0]?.message;

test("a stage hero shows a list page: the one named, else the navigation's first (look-breadth §3)", () => {
  // Unsaid: the first list page in the navigation, in the order the spec declares it.
  expect(stagePage(ir)?.id).toBe("my-bookings");
  // Its bookings are private to each member: visitors of the public home may not read them.
  expect(message("{ layout: stage }")).toBe(
    "home is public, and visitors may not read Booking: the stage would show what they may not see.",
  );
  expect(read("{ layout: stage, stage: sessions }").diagnostics).toEqual([]);
  expect(read("{ layout: stage, stage: class-types }").ux?.pages.home?.looks?.hero?.stage).toBe(
    "class-types",
  );
  expect(message("{ layout: stage, stage: schedule }")).toMatch(
    /^schedule is not a list everyone sees; the stage shows one \(/,
  );
  expect(message("{ layout: split, stage: sessions }")).toBe('"stage" goes with layout: stage.');
  // The home page is public: a list visitors may not read is refused.
  expect(message("{ layout: stage, stage: messages }")).toBe(
    "home is public, and visitors may not read Message: the stage would show what they may not see.",
  );
});

test("a stage hero over a list the landing lists again below is a warning: the page repeats itself", () => {
  // Home's classes section lists the class types the stage already shows.
  const found = read("{ layout: stage, stage: class-types }").diagnostics;
  expect(found.map((d) => [d.severity, d.message, d.hint])).toEqual([
    [
      "warning",
      "The hero shows the first records of class-types; the classes section lists them again below.",
      "Remove the classes section, or give it a where of its own.",
    ],
  ]);
  // Sessions are listed nowhere else on home.
  expect(read("{ layout: stage, stage: sessions }").diagnostics).toEqual([]);
});

test("a records section with a where of its own beside the stage is no repeat; an empty where is", () => {
  const shop = (where: string) =>
    validateSpec({
      path: "smithable.yml",
      text: `smithable: 0.1
app: { name: Shop }
models:
  Item: { fields: { title: string!, condition: likeNew | good } }
pages:
  home:
    route: /welcome
    landing:
      hero: {}
      latest: { records: Item${where} }
  catalog: { route: /, crud: Item }
`,
    }).ir;
  const codes = (where: string) => {
    const spec = shop(where);
    if (!spec) throw new Error("the shop does not read");
    return validateUx(
      {
        path: "smithable.ux.yml",
        text: "smithableUx: 0.1\npages: { home: { sections: { hero: { layout: stage, stage: catalog } } } }\n",
      },
      spec,
      [],
    ).diagnostics.map((d) => d.code);
  };
  expect(codes("")).toEqual(["stage-repeats"]);
  expect(codes(", where: { condition: likeNew }")).toEqual([]);
});
