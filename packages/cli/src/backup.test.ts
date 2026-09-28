import { expect, test } from "vitest";
import { safeRelative } from "./backup.js";

test("a restored file stays inside the restore folder", () => {
  expect(safeRelative("db/app.db")).toBe("db/app.db");
  for (const key of ["../../etc/passwd", "/etc/passwd", "db/../../x", "a//b", "..\\x"])
    expect(() => safeRelative(key)).toThrow(/unsafe file name/);
});
