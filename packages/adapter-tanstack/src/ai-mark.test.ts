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
