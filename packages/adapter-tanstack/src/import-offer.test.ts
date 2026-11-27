import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const examples = import.meta.glob("../../../examples/booking/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const bookingSpec = examples["../../../examples/booking/smithable.yml"] as string;
const bookingAuth = examples["../../../examples/booking/smithable.auth.yml"] as string;

const generate = (spec: string) => {
  const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
  const auth = validateAuth({ path: "smithable.auth.yml", text: bookingAuth }, ir).auth as AuthIR;
  return generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
};
const route = (files: ReturnType<typeof generate>, page: string) =>
  files.find(
    (f) => f.path.endsWith(`routes/${page}.tsx`) || f.path.endsWith(`routes/${page}/index.tsx`),
  )?.content ?? "";

test("a member who reads only their own bookings is not offered Import; the roles that read everyone's are (T1688)", () => {
  const list = route(generate(bookingSpec), "my-bookings");
  expect(list).toContain("ImportDialog");
  // Staff do not open My bookings: of those who read everyone's, only the administrator there.
  expect(list).toMatch(/\["admin"\]\.includes\(viewer\.role\)/);
  expect(route(generate(bookingSpec), "bookings")).toMatch(
    /\["admin", ?"staff"\]\.includes\(viewer\.role\)/,
  );
});

test("the key offers Import to everyone who may add one, or to no one (T1688)", () => {
  const keyed = (value: boolean) =>
    route(
      generate(
        bookingSpec.replace(
          /(\n {2}my-bookings:[^\n]*\n {4}crud: Booking\n)/,
          `$1    import: ${value}\n`,
        ),
      ),
      "my-bookings",
    );
  const on = keyed(true);
  expect(on).toContain("ImportDialog");
  expect(on).not.toMatch(/includes\(viewer\.role\)/);
  expect(keyed(false)).not.toContain("ImportDialog");
});
