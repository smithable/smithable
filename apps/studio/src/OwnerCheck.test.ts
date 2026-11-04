import { expect, test } from "vitest";
import { adminsOf } from "./OwnerCheck";

test("the administrators an auth file names, in either form, without sample addresses", () => {
  expect(adminsOf("admins: [me@shop.se, 'you@shop.se'] # both\n")).toEqual([
    "me@shop.se",
    "you@shop.se",
  ]);
  expect(adminsOf("roles: {}\nadmins:\n  - me@shop.se\n  - you@shop.se\npublic: {}\n")).toEqual([
    "me@shop.se",
    "you@shop.se",
  ]);
  expect(adminsOf("admins:\n  - me@shop.se\n  # and\n\n  - you@shop.se\n")).toEqual([
    "me@shop.se",
    "you@shop.se",
  ]);
  expect(adminsOf("admins: [owner@stillwater.example]\n")).toEqual([]);
  expect(adminsOf(": not yaml: [")).toEqual([]);
  expect(adminsOf("roles: {}\n")).toEqual([]);
  expect(adminsOf(undefined)).toEqual([]);
});
