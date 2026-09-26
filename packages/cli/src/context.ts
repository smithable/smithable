import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildContext } from "@smithable/index";
import type { Io } from "./io.js";
import { projectIndex } from "./rules.js";
import { loadSpec } from "./validate.js";

/** Local record of the context sizes Smithable produced (ARCHITECTURE §9.3); never sent anywhere. */
export const TOKEN_LOG = "data/.smithable/token-log.jsonl";

export function logTokens(dir: string, entry: Record<string, unknown>): void {
  const path = join(dir, TOKEN_LOG);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

/**
 * `smithable context "<request>"`: the smallest useful context for a request, as an AI
 * model would get it, with its size in tokens.
 */
export function context(
  dir: string,
  io: Io,
  request: string | undefined,
  flags: { implementation: boolean; json: boolean },
): number {
  if (!request) {
    io.err('context needs a request, like: smithable context "Customers should have a website"\n');
    return 2;
  }
  const { ir, auth } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const index = projectIndex(dir, ir, auth);
  const custom = flags.implementation
    ? [
        ...new Set(
          index.concepts.flatMap((c) =>
            c.files.filter((f) => f.role !== "generated").map((f) => f.path),
          ),
        ),
      ].map((path) => ({ path, text: readFileSync(join(dir, path), "utf8") }))
    : [];
  const slice = buildContext(index, request, { implementation: custom });
  logTokens(dir, { source: "context", request, concepts: slice.concepts, tokens: slice.tokens });
  if (flags.json) {
    io.out(`${JSON.stringify(slice, null, 2)}\n`);
  } else {
    io.out(
      `${slice.text}\n\n≈ ${slice.tokens.total} tokens (${slice.tokens.semantic} semantic, ${slice.tokens.implementation} implementation)\n`,
    );
  }
  return 0;
}
