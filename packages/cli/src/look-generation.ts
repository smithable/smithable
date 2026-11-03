import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRevision } from "./project-revision.js";
/** CSS-only preview generation. Structural drafts remain unavailable until isolated rendering. */
export function lookGeneration(dir: string, boot: string): string {
  const hash = createHash("sha256").update(projectRevision(dir, false));
  hash.update(readFileSync(join(dir, "src/styles.css")));
  return `${boot}:${hash.digest("hex")}`;
}
