import { expect, test } from "vitest";
import auth from "../../../../examples/crm/smithable.auth.yml?raw";
import spec from "../../../../examples/crm/smithable.yml?raw";
import { summaryDiff } from "./change-diff";

test("a changed field is its sentence gone and the new one, under its part; the rest unchanged", () => {
  const after = spec.replace("      phone: phone\n", "      phone: phone!\n");
  const parts = summaryDiff({ spec, auth }, { spec: after, auth });
  expect(parts).toHaveLength(1);
  expect(parts[0]).toMatchObject({ concept: "model:Customer" });
  expect(parts[0]?.removed.join()).toMatch(/a phone(?! \(required)/);
  expect(parts[0]?.added.join()).toMatch(/a phone.*required/);
  expect(summaryDiff({ spec, auth }, { spec, auth })).toEqual([]);
});
