import { expect, test } from "vitest";
import { TEMPLATES } from "./templates.gen.js";

const files: Record<string, string> = {
  ...import.meta.glob("../templates/**", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("../templates/.*", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};

test("templates.gen.ts is in sync with packages/adapter-tanstack/templates/", () => {
  const expectedTemplates: Record<string, string> = {};
  for (const [fullPath, content] of Object.entries(files)) {
    const relPath = fullPath.replace("../templates/", "");
    const key = relPath === "gitignore" ? ".gitignore" : relPath;
    expectedTemplates[key] = content;
  }

  expect(Object.keys(TEMPLATES).sort()).toEqual(Object.keys(expectedTemplates).sort());

  for (const [key, content] of Object.entries(expectedTemplates)) {
    if (key.endsWith(".css") && content === "") {
      expect(TEMPLATES[key]?.length).toBeGreaterThan(0);
      continue;
    }
    expect(TEMPLATES[key], `File ${key} mismatch. Run pnpm embed to sync.`).toBe(content);
  }
});
