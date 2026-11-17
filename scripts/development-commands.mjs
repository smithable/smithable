// docs/development.md lists every command for working on Smithable; CLAUDE.md's Development
// section names them too. Until the one points to the other, they must say the same: fails when
// a command (`pnpm <script>` or a file under scripts/) named in CLAUDE.md's Development section
// is missing from docs/development.md. Part of `pnpm lint`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** The `pnpm <script>` and scripts/<file> names in a text. */
export function commands(text) {
  const found = new Set();
  for (const [, code] of text.matchAll(/`([^`]+)`/g)) {
    for (const [name] of code.matchAll(/\bpnpm [a-z][\w:-]*|\bscripts\/[\w./-]+\.(?:mjs|js|sh)\b/g))
      found.add(name);
  }
  return found;
}

/** The Development section of CLAUDE.md: from its heading to the next one. */
export function developmentSection(markdown) {
  const start = markdown.indexOf("\n## Development\n");
  if (start < 0) throw new Error("CLAUDE.md has no '## Development' section.");
  const end = markdown.indexOf("\n## ", start + 1);
  return markdown.slice(start, end < 0 ? undefined : end);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const page = commands(read("docs/development.md"));
  const missing = [...commands(developmentSection(read("CLAUDE.md")))].filter((c) => !page.has(c));
  if (missing.length) {
    console.error(
      `docs/development.md is missing ${missing.length} command(s) that CLAUDE.md's Development section names: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}
