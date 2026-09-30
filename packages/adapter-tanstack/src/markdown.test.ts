import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const app = (fields: string) => {
  const ir = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1\napp: { name: Blog }\nmodels:\n  Post:\n    fields: { ${fields} }\npages:\n  posts: { crud: Post }\n`,
  }).ir as SpecIR;
  const auth = validateAuth(
    { path: "smithable.auth.yml", text: "smithableAuth: 0.1\nsignIn: none\n" },
    ir,
  ).auth as AuthIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return (path: string) => files.find((f) => f.path === path)?.content;
};

test("a markdown field is edited with the kit's Markdown editor; the formatter is its own dependency", () => {
  const file = app("title: string!, body: markdown!");
  const post = file("src/generated/post.ts") ?? "";
  expect(post).toContain('import { MarkdownEditor } from "#/kit/Markdown";');
  expect(post).toMatch(/name: "body",[^}]*kind: "markdown",[^}]*input: MarkdownEditor/s);
  // Long, and not a list column.
  expect(post).toContain(".max(50000");
  expect(post).toContain('columns: ["title"]');
  expect(file("src/kit/Markdown.tsx")).toContain('lazy(() => import("./MarkdownFormatted"))');
  expect(file("src/kit/MarkdownFormatted.tsx")).toContain('disallowedElements={["img"]}');
  expect(JSON.parse(file("package.json") ?? "{}").dependencies["react-markdown"]).toBe("10.1.0");
});

test("without a markdown field there is no Markdown kit and no dependency", () => {
  const file = app("title: string!, body: text");
  expect(file("src/kit/Markdown.tsx")).toBeUndefined();
  expect(JSON.parse(file("package.json") ?? "{}").dependencies["react-markdown"]).toBeUndefined();
});
