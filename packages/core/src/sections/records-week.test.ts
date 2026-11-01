import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { validateSpec } from "../spec.js";
import { validateUx, weekBy } from "../ux.js";

const spec = `smithable: 0.1
app: { name: Truck }
models:
  Stop: { fields: { place: string!, day: date!, opens: datetime, seats: int } }
  Note: { fields: { text: string! } }
pages:
  where:
    route: /
    landing:
      hero: {}
      stops: { records: Stop }
      notes: { records: Note }
  stops: { crud: Stop }
  notes: { crud: Note }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir;
if (!ir) throw new Error("the truck does not read");
const read = (sections: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  where:\n    sections: ${sections}\n`,
    },
    ir,
    [],
  );

test("a records section as a week: by a date field, said or the model's first (A 215)", () => {
  const stop = ir.models.find((m) => m.name === "Stop");
  if (!stop) throw new Error("no Stop");
  expect(weekBy(stop)?.name).toBe("day");
  expect(weekBy(stop, "opens")?.name).toBe("opens");
  expect(read("{ stops: { layout: week } }").diagnostics).toEqual([]);
  expect(read("{ stops: { layout: week, by: opens } }").ux?.pages.where?.looks?.stops?.by).toBe(
    "opens",
  );
  expect(read("{ stops: { layout: week, by: seats } }").diagnostics.map((d) => d.message)).toEqual([
    '"by" needs a date or date-time field of Stop: seats is not one.',
  ]);
  expect(read("{ notes: { layout: week } }").diagnostics.map((d) => d.message)).toEqual([
    "A week needs a date to place each record by; Note has none.",
  ]);
  expect(read("{ stops: { layout: list, by: day } }").diagnostics.map((d) => d.message)).toEqual([
    '"by" goes with layout: week.',
  ]);
});

test("a week's by follows a renamed field", () => {
  const renamed = applyOperation(
    {
      spec,
      ux: "smithableUx: 0.1\npages:\n  where:\n    sections:\n      stops: { layout: week, by: opens }\n",
    },
    "renameField",
    { model: "Stop", from: "opens", to: "startsAt" },
  );
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.ux).toContain("by: startsAt");
});
