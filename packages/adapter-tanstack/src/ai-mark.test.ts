// Every picture the kit shows carries the AI mark when an AI made it (AiMark.tsx, the AI Act's
// Article 50): each <img> sits inside an AiMarked, or says on a line just before why it is not
// marked ("Not marked: …"). A new renderer that shows a stored picture unmarked fails here.
import { expect, test } from "vitest";
import { TEMPLATES } from "./templates.gen.js";

test("every picture the kit shows is marked when an AI made it, or says why not", () => {
  const unmarked: string[] = [];
  for (const [path, source] of Object.entries(TEMPLATES)) {
    if (!/^src\/kit\/.*\.tsx$/.test(path)) continue;
    // Each wrapper takes the picture's own word for it, and wraps (never closes on itself).
    for (const tag of source.match(/<AiMarked\b[^>]*>/g) ?? [])
      if (!/generated=\{(?!false\})/.test(tag) || tag.endsWith("/>"))
        unmarked.push(`${path}: ${tag}`);
    for (let at = source.indexOf("<img"); at >= 0; at = source.indexOf("<img", at + 1)) {
      const before = source.slice(0, at);
      const open = before.split("<AiMarked").length - before.split("</AiMarked>").length;
      const said = before.split("\n").slice(-3).join("\n").includes("Not marked:");
      if (open <= 0 && !said) unmarked.push(`${path}:${before.split("\n").length}`);
    }
  }
  expect(unmarked).toEqual([]);
});

const mark = TEMPLATES["src/kit/AiMark.tsx"] ?? "";

test("the AI mark is the EU's common icon, drawn in the kit, never loaded from elsewhere", () => {
  // Its basic icon's three paths (the black disc, the white A and I) and its worded label's twelve
  // (the black pill, A I and GENERATED), unaltered.
  expect(mark.match(/<path\b/g)).toHaveLength(15);
  expect(mark).toContain('d="M352.84,410.77h1093.16c85.55,0,145.54-59.94,145.54-133.2');
  expect(mark).toContain('d="M272.03,100.72c100.92,0,182.74,81.82,182.74,182.75');
  expect(mark).toContain('d="M328.11,353.74c-1.48,0-2.69-.47-3.63-1.41');
  expect(mark).not.toMatch(/https?:|<img|\.svg/);
});

test("the icon alone is named by the words file; across the page one badge, worded in English", () => {
  expect(mark).toContain("label={w.aiGenerated}");
  // The EU's worded label is English alone: another language joins its own words to the icon.
  expect(mark).toContain('language().startsWith("en") ? (\n            <AiLabel');
  expect(mark).toContain("{w.aiGenerated}\n");
  // The owner's switch hides every mark by this hook (themes.ts).
  expect(mark.match(/data-part="ai-mark"/g)).toHaveLength(2);
});
