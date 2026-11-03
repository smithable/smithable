import { expect, test } from "vitest";
import { previewPages, previewRecordPath } from "./preview-pages.js";

test("record discovery uses bounded readable opaque ids, including missing record 1", () => {
  expect(previewRecordPath("/cases", ["case-johans-åäö"], [])).toBe(
    "/cases/case-johans-%C3%A5%C3%A4%C3%B6",
  );
  expect(previewRecordPath("/cases", ["42"], [])).toBe("/cases/42");
  expect(previewRecordPath("/cases", [], [])).toBeUndefined();
  expect(previewRecordPath("/news", [], ["/sign-in", "/news/hamnen"])).toBe("/news/hamnen");
  expect(previewRecordPath("/cases", [...Array(200).fill(""), "too-late"], [])).toBeUndefined();
});
test("discovery never treats reserved, cross-route or external links as records", () => {
  for (const candidate of [
    "https://other.test/cases/42",
    "/other/42",
    "/cases/new",
    "/cases/../admin",
    "/cases/%2e%2e",
    "/cases/42?delete=true",
    "/cases/42/erase",
    "//other.test/cases/42",
  ])
    expect(previewRecordPath("/cases", [], [candidate]), candidate).toBeUndefined();
  expect(previewRecordPath("//other.test", ["42"], [])).toBeUndefined();
});

test("native sign-in is inventoried as a platform state without a fabricated spec page id", () => {
  expect(previewPages([], {}, { signIn: { providers: [], selfSignUp: false } })).toEqual([
    { id: "auth:sign-in", label: "Sign in / viewer", kind: "sign-in", path: "/sign-in" },
  ]);
  expect(previewPages([], {}, { signIn: "none" })).toEqual([]);
});
