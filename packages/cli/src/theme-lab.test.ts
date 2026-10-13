import { expect, test } from "vitest";
import { labFrames } from "./theme-lab.js";

test("the lab frames the landing page, then the first list, its form and a record", () => {
  const page = (route: string, kind: string) => ({ route, pattern: { kind } });
  expect(
    labFrames([
      page("/dashboard", "dashboard"),
      page("/", "landing"),
      page("/class-types", "crud"),
    ]),
  ).toEqual([
    { label: "Landing", path: "/" },
    { label: "List", path: "/class-types" },
    { label: "Form", path: "/class-types/new" },
    { label: "Record", path: "/class-types/1" },
  ]);
  expect(labFrames([page("/companies", "crud")])[0]).toEqual({ label: "Landing", path: "/" });
});
