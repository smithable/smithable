import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  customPageFromEdit,
  customPageSource,
  implementationIndex,
} from "@smithable/adapter-tanstack";
import { generate, hashFile, readRecord } from "./generate.js";
import { discardChanges, ensureRepository, git, uncommittedRefusal } from "./git.js";
import type { Io } from "./io.js";
import { loadSpec } from "./validate.js";

/**
 * `smithable customize page:<page>`: gives a page its own component in src/custom/pages/,
 * starting from the generated one, or from a hand edit of the generated route, which moves
 * there (ARCHITECTURE §6.5). The route stays generated. A checkpoint, like an operation.
 */
export async function customize(
  dir: string,
  io: Io,
  target: string | undefined,
  via = "cli",
): Promise<number> {
  const pageId = /^page:([\w-]+)$/.exec(target ?? "")?.[1];
  if (!pageId) {
    io.err("customize needs a page, like: smithable customize page:customers\n");
    return 2;
  }
  const { ir, auth, content, ux } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const page = ir.pages.find((p) => p.id === pageId);
  if (!page) {
    io.err(`There is no page named "${pageId}".\n`);
    return 1;
  }
  // The page made from the generated one: a list's or a dashboard's (A 155); other kinds have none yet.
  if (page.pattern.kind !== "crud" && page.pattern.kind !== "dashboard") {
    io.err(
      `Only a list or dashboard page can be customized this way ("${pageId}" is a ${page.pattern.kind} page).\n`,
    );
    return 1;
  }
  const customPath = join("src", "custom", "pages", `${pageId}.tsx`);
  if (existsSync(join(dir, customPath))) {
    io.err(`${customPath} already exists: the page is customized. Edit that file.\n`);
    return 1;
  }
  ensureRepository(dir);
  const refused = uncommittedRefusal(dir, "so this can be undone on its own");
  if (refused) {
    io.err(refused);
    return 1;
  }

  // The list page's route file; if it was edited by hand, the edit is what moves.
  const routePath = implementationIndex(ir, auth)[`page:${pageId}`]?.files.find((f) =>
    f.path.endsWith("/index.tsx"),
  )?.path as string;
  const options = {
    smithableVersion: "",
    auth,
    ...(content ? { content } : {}),
    ...(ux ? { ux } : {}),
  };
  const recorded = readRecord(dir).files[routePath];
  const current = readFileSync(join(dir, routePath), "utf8");
  const edited = recorded !== undefined && recorded !== hashFile(join(dir, routePath));
  let source: string;
  if (edited) {
    const moved = customPageFromEdit(ir, pageId, options, current);
    if (!moved.ok) {
      io.err(`${routePath} was edited by hand, and the edit cannot move: ${moved.reason}\n`);
      return 1;
    }
    source = moved.source;
  } else {
    source = customPageSource(ir, pageId, options);
  }
  mkdirSync(dirname(join(dir, customPath)), { recursive: true });
  writeFileSync(join(dir, customPath), source);
  const code = await generate(dir, io, {
    tools: true,
    force: false,
    overwrite: [routePath],
    onlyChanged: true,
  });
  if (code !== 0) {
    discardChanges(dir);
    io.err("Regenerating the app failed. Nothing was changed.\n");
    return 1;
  }
  git(dir, ["add", "-A"]);
  const description = `Customize page ${pageId}${edited ? " (moving the hand edit of its route)" : ""}`;
  git(dir, ["commit", "-q", "-m", `smithable: ${description}\n\nSmithable-Snapshot: none\n`]);
  io.out(
    `${description}: the page is now ${customPath}, which is yours. The route keeps loading and access. Undo with: ${via === "mcp" ? "smithable_undo" : "smithable undo"}\n`,
  );
  return 0;
}
