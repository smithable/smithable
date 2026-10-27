import { EDITABLE_FILES, type EditableFile } from "@smithable/core";
import { expect, test } from "vitest";
import code from "../../../docs/site/code.md?raw";
import reference from "../../../docs/spec/v0.1.md?raw";
import { CUSTOM_CODE_DOCS, FILE_DOCS } from "./docs";

/** A heading's anchor as the docs site makes it (scripts/build-docs.mjs `slug`). */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");

test("each file's docs link lands on a heading of the spec reference", () => {
  const anchors = new Set([...reference.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1] ?? "")));
  expect(Object.keys(FILE_DOCS).sort()).toEqual(Object.keys(EDITABLE_FILES).sort());
  const missing = (Object.entries(FILE_DOCS) as [EditableFile, string][])
    .map(([file, url]) => [file, url.split("#")[1]] as const)
    .filter(([, anchor]) => anchor !== undefined && !anchors.has(anchor));
  expect(missing).toEqual([]);
});

test("the custom-code line's link lands on Your own code", () => {
  expect(CUSTOM_CODE_DOCS).toBe("https://docs.smithable.ai/code.html");
  expect(code).toMatch(/^# Your own code\n/);
  expect(code).toContain("never overwrites `src/custom/`");
});
